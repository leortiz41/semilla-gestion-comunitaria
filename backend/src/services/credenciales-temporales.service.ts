import { randomBytes } from 'node:crypto';
import { hashPassword } from '../security/password.js';

type ResultadoConsulta<Fila extends object = Record<string, unknown>> = {
  rows: Fila[];
};

export interface ClienteCredencialesTemporales {
  query<Fila extends object = Record<string, unknown>>(
    consulta: string,
    valores?: unknown[],
  ): Promise<ResultadoConsulta<Fila>>;
  release(): void;
}

export interface ConjuntoConexionesCredencialesTemporales {
  connect(): Promise<ClienteCredencialesTemporales>;
}

export interface CuentaConCredencialTemporal {
  id: string;
  email: string;
  activo: boolean;
  debeCambiarContrasena: boolean;
  roles: string[];
}

export class ErrorCredencialTemporal extends Error {
  constructor(public readonly codigoEstado: number, mensaje: string) {
    super(mensaje);
  }
}

export function generarContrasenaTemporal(): string {
  // El prefijo garantiza los requisitos de complejidad; el resto es aleatorio.
  return `Aa1-${randomBytes(18).toString('base64url')}`;
}

export async function reemitirCredencialTemporalAdministrador(
  entrada: { organizacionId: string; usuarioId: string; superadministradorId: string },
  conexiones: ConjuntoConexionesCredencialesTemporales,
): Promise<{ cuenta: CuentaConCredencialTemporal; contrasenaTemporal: string }> {
  const contrasenaTemporal = generarContrasenaTemporal();
  const hashContrasena = await hashPassword(contrasenaTemporal);
  const cliente = await conexiones.connect();
  let transaccionAbierta = false;

  try {
    await cliente.query('BEGIN');
    transaccionAbierta = true;

    const organizacion = await cliente.query<{ id: string }>(
      'SELECT id FROM organizaciones WHERE id = $1 AND activo = TRUE FOR UPDATE',
      [entrada.organizacionId],
    );
    if (!organizacion.rows.length) {
      throw new ErrorCredencialTemporal(404, 'La organización no existe o está inactiva.');
    }

    const usuario = await cliente.query<{ id: string; email: string; activo: boolean }>(
      `SELECT id, email, activo
         FROM usuarios
        WHERE id = $1 AND organizacion_id = $2
        FOR UPDATE`,
      [entrada.usuarioId, entrada.organizacionId],
    );
    if (!usuario.rows.length || !usuario.rows[0].activo) {
      throw new ErrorCredencialTemporal(404, 'La cuenta administradora no existe o está inactiva.');
    }

    const roles = await cliente.query<{ nombre: string }>(
      `SELECT r.nombre
         FROM usuarios_roles ur
         JOIN roles r ON r.id = ur.rol_id
        WHERE ur.usuario_id = $1 AND r.activo = TRUE
        ORDER BY r.nombre`,
      [entrada.usuarioId],
    );
    const perfiles = roles.rows.map((rol) => rol.nombre);
    if (perfiles.includes('SUPERADMINISTRADOR')) {
      throw new ErrorCredencialTemporal(403, 'La cuenta de superadministración no se gestiona desde las organizaciones.');
    }
    if (!perfiles.includes('ADMINISTRADOR')) {
      throw new ErrorCredencialTemporal(409, 'Solo se pueden reemitir credenciales para administradores de la organización.');
    }

    await cliente.query(
      `UPDATE usuarios
          SET hash_contrasena = $1,
              debe_cambiar_contrasena = TRUE,
              actualizado_en = NOW()
        WHERE id = $2`,
      [hashContrasena, entrada.usuarioId],
    );
    await cliente.query(
      `UPDATE tokens_refresco
          SET revocado_en = COALESCE(revocado_en, NOW())
        WHERE usuario_id = $1`,
      [entrada.usuarioId],
    );
    await cliente.query(
      `INSERT INTO bitacora_auditoria
        (usuario_id, accion, nombre_entidad, entidad_id, valores_nuevos)
       VALUES ($1, 'PLATAFORMA_REEMITIR_CREDENCIAL_TEMPORAL', 'usuarios', $2, $3::jsonb)`,
      [
        entrada.superadministradorId,
        entrada.usuarioId,
        JSON.stringify({ organizacionId: entrada.organizacionId, email: usuario.rows[0].email }),
      ],
    );

    await cliente.query('COMMIT');
    transaccionAbierta = false;
    return {
      cuenta: {
        id: usuario.rows[0].id,
        email: usuario.rows[0].email,
        activo: true,
        debeCambiarContrasena: true,
        roles: perfiles,
      },
      contrasenaTemporal,
    };
  } catch (error) {
    if (transaccionAbierta) {
      await cliente.query('ROLLBACK');
    }
    if (error instanceof ErrorCredencialTemporal) {
      throw error;
    }
    throw new ErrorCredencialTemporal(500, 'No fue posible emitir una nueva credencial temporal.');
  } finally {
    cliente.release();
  }
}
