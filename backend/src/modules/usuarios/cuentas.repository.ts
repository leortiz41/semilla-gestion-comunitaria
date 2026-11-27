import type { Pool, PoolClient } from 'pg';

export async function verificarAdministradorActual(
  pool: Pool, usuarioId: string, organizacionId: string,
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM usuarios u JOIN usuarios_roles ur ON ur.usuario_id=u.id
     JOIN roles r ON r.id=ur.rol_id
     WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo
       AND r.nombre='ADMINISTRADOR' AND r.activo LIMIT 1`,
    [usuarioId, organizacionId],
  );
  return Boolean(result.rows.length);
}

export async function obtenerRolesActivos(roles: string[], client: PoolClient) {
  const { rows } = await client.query(
    'SELECT id,nombre FROM roles WHERE activo AND nombre=ANY($1::text[])', [roles],
  );
  if (rows.length !== roles.length) throw new Error('ROLES_NO_DISPONIBLES');
  return rows as { id: string; nombre: string }[];
}

export interface AltaCuenta {
  email: string;
  roles: string[];
  nombreVisible: string;
  hash: string;
  organizacionId: string;
  administradorId: string;
}

/** Escritura atómica del usuario, sus roles, perfil y bitácora. */
export async function insertarCuentaOrganizacion(pool: Pool, datos: AltaCuenta) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rolesActivos = await obtenerRolesActivos(datos.roles, client);
    const { rows } = await client.query(
      `INSERT INTO usuarios (email, hash_contrasena, organizacion_id, debe_cambiar_contrasena)
       VALUES ($1,$2,$3,TRUE) RETURNING id,email,activo`,
      [datos.email, datos.hash, datos.organizacionId],
    );
    for (const rol of rolesActivos) {
      await client.query('INSERT INTO usuarios_roles (usuario_id,rol_id) VALUES ($1,$2)',
        [rows[0].id, rol.id]);
    }
    await client.query(
      'INSERT INTO perfiles_usuarios (usuario_id,organizacion_id,nombre_visible) VALUES ($1,$2,$3)',
      [rows[0].id, datos.organizacionId, datos.nombreVisible],
    );
    await client.query(
      `INSERT INTO bitacora_auditoria (usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
       VALUES ($1,'CREAR_USUARIO','usuarios',$2,$3::jsonb)`,
      [datos.administradorId, rows[0].id, JSON.stringify({
        email: datos.email, roles: datos.roles, nombreVisible: datos.nombreVisible,
      })],
    );
    await client.query('COMMIT');
    return { ...rows[0], roles: datos.roles, nombreVisible: datos.nombreVisible };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
