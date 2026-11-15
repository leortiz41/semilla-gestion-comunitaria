import { createHash, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
import { databasePool } from '../config/database.js';
import { hashPassword, validateNewPassword } from '../security/password.js';

export const CORREO_SUPERADMINISTRADOR_INICIAL = 'leortiz41@gmail.com';

const MAX_INTENTOS = 5;
const VENTANA_INTENTOS_MS = 15 * 60 * 1000;
const BLOQUEO_MS = 15 * 60 * 1000;

type ResultadoConsulta<Row extends object = Record<string, unknown>> = { rows: Row[] };

export interface ClienteInicializacion {
  query<Row extends object = Record<string, unknown>>(
    query: string,
    values?: unknown[],
  ): Promise<ResultadoConsulta<Row>>;
  release(): void;
}

export interface ConjuntoConexionesInicializacion {
  query<Row extends object = Record<string, unknown>>(
    query: string,
    values?: unknown[],
  ): Promise<ResultadoConsulta<Row>>;
  connect(): Promise<ClienteInicializacion>;
}

interface EstadoInicializacion {
  consumido_en: Date | string | null;
  usuario_id: string | null;
  intentos_fallidos: number;
  ventana_intentos_inicia_en: Date | string | null;
  bloqueado_hasta: Date | string | null;
}

export class ErrorInicializacion extends Error {
  constructor(
    public readonly codigoEstado: number,
    message: string,
    public readonly segundosReintento?: number,
  ) {
    super(message);
  }
}

export interface DependenciasInicializacion {
  conexiones?: ConjuntoConexionesInicializacion;
  secretoInstalacion?: string;
  identificadorOrganizacion?: string;
}

function secretoConfigurado(secreto: string | undefined): string | null {
  return secreto && secreto.length >= 32 ? secreto : null;
}

function resolverDependencias(dependencias: DependenciasInicializacion) {
  const conexiones = dependencias.conexiones ?? (databasePool as Pool | null);
  const secretoInstalacion = secretoConfigurado(
    dependencias.secretoInstalacion ?? process.env.SEMILLA_SECRETO_INICIALIZACION,
  );
  const identificadorOrganizacion = (
    dependencias.identificadorOrganizacion ?? process.env.SEMILLA_IDENTIFICADOR_ORGANIZACION_INICIALIZACION ?? 'ministerio-sal-y-luz'
  ).trim().toLowerCase();

  if (!conexiones || !secretoInstalacion || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identificadorOrganizacion)) {
    throw new ErrorInicializacion(503, 'El asistente de configuración inicial no está disponible.');
  }

  return {
    conexiones: conexiones as ConjuntoConexionesInicializacion,
    secretoInstalacion,
    identificadorOrganizacion,
  };
}

function resumenCriptografico(valor: string): Buffer {
  return createHash('sha256').update(valor, 'utf8').digest();
}

export function secretoDeInstalacionValido(secretoRecibido: string, secretoConfigurado: string): boolean {
  const resumenEsperado = resumenCriptografico(secretoConfigurado);
  const resumenRecibido = resumenCriptografico(secretoRecibido);
  return timingSafeEqual(resumenEsperado, resumenRecibido);
}

function aFecha(valor: Date | string | null): Date | null {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function segundosHasta(fecha: Date | string | null): number {
  const hasta = aFecha(fecha)?.getTime() ?? Date.now();
  return Math.max(1, Math.ceil((hasta - Date.now()) / 1000));
}

async function estadoBloqueado(cliente: ClienteInicializacion): Promise<EstadoInicializacion> {
  try {
    const resultado = await cliente.query<EstadoInicializacion>(
      `SELECT consumido_en, usuario_id, intentos_fallidos, ventana_intentos_inicia_en, bloqueado_hasta
         FROM inicializacion_superadministrador
        WHERE id = 1
        FOR UPDATE`,
    );

    const estado = resultado.rows[0];
    if (!estado) {
      throw new ErrorInicializacion(503, 'El asistente de configuración inicial no está disponible.');
    }

    return estado;
  } catch (error) {
    if (error instanceof ErrorInicializacion) throw error;
    throw new ErrorInicializacion(503, 'El asistente de configuración inicial no está disponible.');
  }
}

async function consumirSiExisteSuperadministrador(cliente: ClienteInicializacion): Promise<boolean> {
  const existente = await cliente.query<{ id: string }>(
    `SELECT u.id
       FROM usuarios u
       JOIN usuarios_roles ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
      WHERE r.nombre = 'SUPERADMINISTRADOR'
      LIMIT 1`,
  );

  if (!existente.rows[0]) return false;

  await cliente.query(
    `UPDATE inicializacion_superadministrador
        SET consumido_en = COALESCE(consumido_en, NOW()),
            usuario_id = COALESCE(usuario_id, $1),
            actualizado_en = NOW()
      WHERE id = 1`,
    [existente.rows[0].id],
  );
  return true;
}

async function registrarIntentoFallido(
  cliente: ClienteInicializacion,
  estado: EstadoInicializacion,
): Promise<number | undefined> {
  const ahora = new Date();
  const inicioVentana = aFecha(estado.ventana_intentos_inicia_en);
  const ventanaVencida = !inicioVentana || ahora.getTime() - inicioVentana.getTime() >= VENTANA_INTENTOS_MS;
  const intentos = (ventanaVencida ? 0 : estado.intentos_fallidos) + 1;
  const bloqueadoHasta = intentos >= MAX_INTENTOS ? new Date(ahora.getTime() + BLOQUEO_MS) : null;

  await cliente.query(
    `UPDATE inicializacion_superadministrador
        SET intentos_fallidos = $1,
            ventana_intentos_inicia_en = $2,
            bloqueado_hasta = $3,
            ultimo_intento_en = $4,
            actualizado_en = $4
      WHERE id = 1`,
    [intentos, ventanaVencida ? ahora : inicioVentana, bloqueadoHasta, ahora],
  );

  return bloqueadoHasta ? segundosHasta(bloqueadoHasta) : undefined;
}

export async function estadoInicializacionSuperadministrador(
  dependencias: DependenciasInicializacion = {},
): Promise<{ disponible: boolean }> {
  let configuracion: ReturnType<typeof resolverDependencias>;
  try {
    configuracion = resolverDependencias(dependencias);
  } catch {
    return { disponible: false };
  }

  try {
    const [estado, superadministrador] = await Promise.all([
      configuracion.conexiones.query<Pick<EstadoInicializacion, 'consumido_en'>>(
        'SELECT consumido_en FROM inicializacion_superadministrador WHERE id = 1',
      ),
      configuracion.conexiones.query(
        `SELECT 1
           FROM usuarios_roles ur
           JOIN roles r ON r.id = ur.rol_id
          WHERE r.nombre = 'SUPERADMINISTRADOR'
          LIMIT 1`,
      ),
    ]);
    return { disponible: Boolean(estado.rows[0]) && !estado.rows[0].consumido_en && !superadministrador.rows.length };
  } catch {
    return { disponible: false };
  }
}

export async function crearSuperadministradorInicial(
  entrada: { secretoInstalacion: string; contrasena: string; direccionIp: string | null; agenteUsuario: string | null },
  dependencias: DependenciasInicializacion = {},
): Promise<{ email: string }> {
  if (
    typeof entrada.secretoInstalacion !== 'string' ||
    typeof entrada.contrasena !== 'string' ||
    entrada.secretoInstalacion.length > 512 ||
    entrada.contrasena.length > 256
  ) {
    throw new ErrorInicializacion(400, 'Datos de configuración inválidos.');
  }

  try {
    validateNewPassword(entrada.contrasena);
  } catch (error) {
    throw new ErrorInicializacion(400, error instanceof Error ? error.message : 'La contraseña no es válida.');
  }

  const { conexiones, secretoInstalacion, identificadorOrganizacion } = resolverDependencias(dependencias);
  const cliente = await conexiones.connect();
  let transaccionAbierta = false;

  try {
    await cliente.query('BEGIN');
    transaccionAbierta = true;
    const estado = await estadoBloqueado(cliente);

    if (estado.consumido_en || await consumirSiExisteSuperadministrador(cliente)) {
      await cliente.query('COMMIT');
      transaccionAbierta = false;
      throw new ErrorInicializacion(410, 'La configuración inicial ya no está disponible.');
    }

    const bloqueadoHasta = aFecha(estado.bloqueado_hasta);
    if (bloqueadoHasta && bloqueadoHasta.getTime() > Date.now()) {
      await cliente.query('COMMIT');
      transaccionAbierta = false;
      throw new ErrorInicializacion(429, 'Demasiados intentos. Espera antes de volver a intentarlo.', segundosHasta(bloqueadoHasta));
    }

    if (!secretoDeInstalacionValido(entrada.secretoInstalacion, secretoInstalacion)) {
      const segundosReintento = await registrarIntentoFallido(cliente, estado);
      await cliente.query('COMMIT');
      transaccionAbierta = false;
      if (segundosReintento) {
        throw new ErrorInicializacion(429, 'Demasiados intentos. Espera antes de volver a intentarlo.', segundosReintento);
      }
      throw new ErrorInicializacion(401, 'No fue posible validar el secreto de instalación.');
    }

    const organizacion = await cliente.query<{ id: string }>(
      'SELECT id FROM organizaciones WHERE slug = $1 AND activo = TRUE FOR UPDATE',
      [identificadorOrganizacion],
    );
    const rol = await cliente.query<{ id: string }>(
      "SELECT id FROM roles WHERE nombre = 'SUPERADMINISTRADOR' AND activo = TRUE LIMIT 1",
    );
    const correoExistente = await cliente.query(
      'SELECT 1 FROM usuarios WHERE LOWER(email) = $1 LIMIT 1',
      [CORREO_SUPERADMINISTRADOR_INICIAL],
    );

    if (!organizacion.rows[0] || !rol.rows[0]) {
      throw new ErrorInicializacion(503, 'La configuración inicial no está lista para crear la cuenta.');
    }
    if (correoExistente.rows.length) {
      throw new ErrorInicializacion(409, 'No fue posible completar la configuración inicial.');
    }

    const hashContrasena = await hashPassword(entrada.contrasena);
    const usuario = await cliente.query<{ id: string }>(
      `INSERT INTO usuarios (email, hash_contrasena, organizacion_id, debe_cambiar_contrasena)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id`,
      [CORREO_SUPERADMINISTRADOR_INICIAL, hashContrasena, organizacion.rows[0].id],
    );
    await cliente.query(
      'INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, $2)',
      [usuario.rows[0].id, rol.rows[0].id],
    );
    await cliente.query(
      `INSERT INTO bitacora_auditoria
        (usuario_id, accion, nombre_entidad, entidad_id, valores_nuevos, direccion_ip, agente_usuario)
       VALUES ($1, 'INICIALIZACION_SUPERADMINISTRADOR_GRAFICA', 'usuarios', $1, $2::jsonb, $3, $4)`,
      [
        usuario.rows[0].id,
        JSON.stringify({ rol: 'SUPERADMINISTRADOR', organizacionIdentidad: identificadorOrganizacion }),
        entrada.direccionIp,
        entrada.agenteUsuario,
      ],
    );
    await cliente.query(
      `UPDATE inicializacion_superadministrador
          SET consumido_en = NOW(),
              usuario_id = $1,
              intentos_fallidos = 0,
              bloqueado_hasta = NULL,
              ultimo_intento_en = NOW(),
              actualizado_en = NOW()
        WHERE id = 1`,
      [usuario.rows[0].id],
    );
    await cliente.query('COMMIT');
    transaccionAbierta = false;
    return { email: CORREO_SUPERADMINISTRADOR_INICIAL };
  } catch (error) {
    if (transaccionAbierta) await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
