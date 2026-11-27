import type { Pool } from 'pg';
import { obtenerRolesActivos, verificarAdministradorActual } from './cuentas.repository.js';

export type ResultadoCambioRoles =
  | { estado: 'NO_ENCONTRADO' }
  | { estado: 'CUENTA_PROTEGIDA' }
  | { estado: 'ADMINISTRACION_NO_AUTORIZADA' }
  | { estado: 'ULTIMO_ADMINISTRADOR' }
  | { estado: 'ACTUALIZADO'; roles: string[] };

/** Conserva el bloqueo de la organización y las restricciones de roles originales. */
export async function actualizarRolesCuenta(
  pool: Pool, usuarioId: string, roles: string[], administradorId: string, organizacionId: string,
): Promise<ResultadoCambioRoles> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serializa cambios en los administradores de una organización.
    const org = await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',
      [organizacionId]);
    const usuario = await client.query('SELECT id FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo FOR UPDATE',
      [usuarioId, organizacionId]);
    if (!org.rows.length || !usuario.rows.length) {
      await client.query('ROLLBACK');
      return { estado: 'NO_ENCONTRADO' };
    }
    const cuentaPlataforma = await client.query(
      `SELECT 1 FROM usuarios_roles upr JOIN roles rpr ON rpr.id=upr.rol_id
       WHERE upr.usuario_id=$1 AND rpr.nombre='SUPERADMINISTRADOR' LIMIT 1`, [usuarioId],
    );
    if (cuentaPlataforma.rows.length) {
      await client.query('ROLLBACK');
      return { estado: 'CUENTA_PROTEGIDA' };
    }
    const admin = await verificarAdministradorActual(pool, administradorId, organizacionId);
    const actuales = await client.query(
      `SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id WHERE ur.usuario_id=$1`,
      [usuarioId],
    );
    const rolesActivos = await obtenerRolesActivos(roles, client);
    if (!admin) {
      await client.query('ROLLBACK');
      return { estado: 'ADMINISTRACION_NO_AUTORIZADA' };
    }
    if (actuales.rows.some((r: { nombre: string }) => r.nombre === 'ADMINISTRADOR') &&
        !roles.includes('ADMINISTRADOR')) {
      const otros = await client.query(`SELECT count(DISTINCT u.id)::int AS total FROM usuarios u
        JOIN usuarios_roles ur ON ur.usuario_id=u.id JOIN roles r ON r.id=ur.rol_id
        WHERE u.organizacion_id=$1 AND u.activo AND r.nombre='ADMINISTRADOR' AND u.id<>$2`,
        [organizacionId, usuarioId],
      );
      if (otros.rows[0].total === 0) {
        await client.query('ROLLBACK');
        return { estado: 'ULTIMO_ADMINISTRADOR' };
      }
    }
    await client.query('DELETE FROM usuarios_roles WHERE usuario_id=$1', [usuarioId]);
    for (const rol of rolesActivos) {
      await client.query('INSERT INTO usuarios_roles(usuario_id,rol_id) VALUES($1,$2)', [usuarioId, rol.id]);
    }
    await client.query(`INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
      VALUES ($1,'CAMBIAR_ROLES_USUARIO','usuarios',$2,$3::jsonb)`,
      [administradorId, usuarioId, JSON.stringify({ roles })]);
    await client.query('COMMIT');
    return { estado: 'ACTUALIZADO', roles };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
