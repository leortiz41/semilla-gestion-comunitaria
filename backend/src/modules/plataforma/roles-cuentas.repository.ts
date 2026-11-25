import type { Pool } from 'pg';

export type ResultadoCambioRolesPlataforma =
  | { estado: 'CUENTA_INACTIVA' }
  | { estado: 'CUENTA_PROTEGIDA' }
  | { estado: 'ULTIMO_ADMINISTRADOR' }
  | { estado: 'ROLES_NO_DISPONIBLES' }
  | { estado: 'ACTUALIZADO'; roles: string[] };

/** Bloquea la organización para serializar cambios de administradores y audita la operación. */
export async function cambiarRolesDesdePlataforma(
  pool: Pool,
  datos: { organizacionId: string; usuarioId: string; roles: string[]; operadorId: string },
): Promise<ResultadoCambioRolesPlataforma> {
  const { organizacionId, usuarioId, roles, operadorId } = datos;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const org = await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[organizacionId]);
    const usuario = await client.query(
      'SELECT id,activo FROM usuarios WHERE id=$1 AND organizacion_id=$2 FOR UPDATE',
      [usuarioId,organizacionId],
    );
    if (!org.rows.length || !usuario.rows.length || !usuario.rows[0].activo) {
      await client.query('ROLLBACK');
      return { estado: 'CUENTA_INACTIVA' };
    }
    const actuales = await client.query(
      `SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
       WHERE ur.usuario_id=$1`,[usuarioId],
    );
    if (actuales.rows.some((rolAsignado: { nombre: string }) => rolAsignado.nombre === 'SUPERADMINISTRADOR')) {
      await client.query('ROLLBACK');
      return { estado: 'CUENTA_PROTEGIDA' };
    }
    if (actuales.rows.some((rolAsignado: { nombre: string }) => rolAsignado.nombre === 'ADMINISTRADOR') &&
        !roles.includes('ADMINISTRADOR')) {
      const otros = await client.query(
        `SELECT count(DISTINCT u.id)::int AS total FROM usuarios u
         JOIN usuarios_roles ur ON ur.usuario_id=u.id
         JOIN roles r ON r.id=ur.rol_id
         WHERE u.organizacion_id=$1 AND u.activo AND r.nombre='ADMINISTRADOR' AND u.id<>$2`,
        [organizacionId,usuarioId],
      );
      if (otros.rows[0].total === 0) {
        await client.query('ROLLBACK');
        return { estado: 'ULTIMO_ADMINISTRADOR' };
      }
    }
    const rs = await client.query(
      'SELECT id,nombre FROM roles WHERE nombre=ANY($1::text[]) AND activo',[roles],
    );
    if (rs.rows.length !== roles.length) {
      await client.query('ROLLBACK');
      return { estado: 'ROLES_NO_DISPONIBLES' };
    }
    await client.query('DELETE FROM usuarios_roles WHERE usuario_id=$1',[usuarioId]);
    for (const rol of rs.rows) {
      await client.query('INSERT INTO usuarios_roles(usuario_id,rol_id) VALUES($1,$2)',[usuarioId,rol.id]);
    }
    // La sesión anterior no debe conservar permisos ampliados.
    await client.query(
      'UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW()) WHERE usuario_id=$1',[usuarioId],
    );
    await client.query(
      `INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
       VALUES($1,'PLATAFORMA_CAMBIAR_ROLES','usuarios',$2,$3::jsonb)`,
      [operadorId,usuarioId,JSON.stringify({organizacionId,roles})],
    );
    await client.query('COMMIT');
    return { estado: 'ACTUALIZADO', roles };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
