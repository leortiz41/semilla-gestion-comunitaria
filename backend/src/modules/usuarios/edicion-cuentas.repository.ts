import type { Pool } from 'pg';

export type ResultadoEdicionCuenta =
  | { estado: 'ADMINISTRACION_NO_AUTORIZADA' }
  | { estado: 'NO_ENCONTRADO' }
  | { estado: 'CUENTA_PROTEGIDA' }
  | { estado: 'ACTUALIZADO' };

/** Conserva la transacción y la auditoría de la actualización del nombre visible. */
export async function actualizarNombreCuenta(
  pool: Pool, usuarioId: string, nombreVisible: string, administradorId: string, organizacionId: string,
): Promise<ResultadoEdicionCuenta> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const organizacion = await client.query(
      'SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE', [organizacionId]);
    const administrador = await client.query(`SELECT 1 FROM usuarios u
      JOIN usuarios_roles ur ON ur.usuario_id=u.id
      JOIN roles r ON r.id=ur.rol_id AND r.nombre='ADMINISTRADOR' AND r.activo
      WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo LIMIT 1`,
      [administradorId, organizacionId]);
    if (!organizacion.rowCount || !administrador.rowCount) {
      await client.query('ROLLBACK');
      return { estado: 'ADMINISTRACION_NO_AUTORIZADA' };
    }
    const cuenta = await client.query(`SELECT u.id, pf.nombre_visible AS "nombreVisible"
      FROM usuarios u
      LEFT JOIN perfiles_usuarios pf ON pf.usuario_id=u.id AND pf.organizacion_id=u.organizacion_id
      WHERE u.id=$1 AND u.organizacion_id=$2 FOR UPDATE OF u`, [usuarioId, organizacionId]);
    if (!cuenta.rowCount) {
      await client.query('ROLLBACK');
      return { estado: 'NO_ENCONTRADO' };
    }
    const protegida = await client.query(`SELECT 1 FROM usuarios_roles ur
      JOIN roles r ON r.id=ur.rol_id
      WHERE ur.usuario_id=$1 AND r.nombre='SUPERADMINISTRADOR' LIMIT 1`, [usuarioId]);
    if (protegida.rowCount) {
      await client.query('ROLLBACK');
      return { estado: 'CUENTA_PROTEGIDA' };
    }
    const anterior = cuenta.rows[0].nombreVisible as string | null;
    if (anterior !== nombreVisible) {
      await client.query(`INSERT INTO perfiles_usuarios (usuario_id,organizacion_id,nombre_visible)
        VALUES ($1,$2,$3) ON CONFLICT(usuario_id)
        DO UPDATE SET nombre_visible=EXCLUDED.nombre_visible,actualizado_en=NOW()`,
        [usuarioId, organizacionId, nombreVisible]);
      await client.query(`INSERT INTO bitacora_auditoria
        (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
        VALUES ($1,'CAMBIAR_NOMBRE_USUARIO','usuarios',$2,$3::jsonb,$4::jsonb)`,
        [administradorId, usuarioId,
          JSON.stringify({ nombreVisible: anterior }),
          JSON.stringify({ nombreVisible })]);
    }
    await client.query('COMMIT');
    return { estado: 'ACTUALIZADO' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Cambiar correo revoca tokens solo cuando cambia el valor; no modifica roles ni credenciales. */
export async function actualizarEmailCuenta(
  pool: Pool, usuarioId: string, email: string, administradorId: string, organizacionId: string,
): Promise<ResultadoEdicionCuenta> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const org = await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',
      [organizacionId]);
    const admin = await client.query(`SELECT 1 FROM usuarios u
      JOIN usuarios_roles ur ON ur.usuario_id=u.id
      JOIN roles r ON r.id=ur.rol_id AND r.nombre='ADMINISTRADOR' AND r.activo
      WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo LIMIT 1`,
      [administradorId, organizacionId]);
    if (!org.rows.length || !admin.rows.length) {
      await client.query('ROLLBACK');
      return { estado: 'ADMINISTRACION_NO_AUTORIZADA' };
    }
    const cuenta = await client.query('SELECT id,email FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo FOR UPDATE',
      [usuarioId, organizacionId]);
    if (!cuenta.rows.length) {
      await client.query('ROLLBACK');
      return { estado: 'NO_ENCONTRADO' };
    }
    const esPlataforma = await client.query(`SELECT 1 FROM usuarios_roles ur
      JOIN roles r ON r.id=ur.rol_id WHERE ur.usuario_id=$1 AND r.nombre='SUPERADMINISTRADOR' LIMIT 1`, [usuarioId]);
    if (esPlataforma.rows.length) {
      await client.query('ROLLBACK');
      return { estado: 'CUENTA_PROTEGIDA' };
    }
    const anterior = cuenta.rows[0].email as string;
    if (anterior === email) {
      await client.query('COMMIT');
      return { estado: 'ACTUALIZADO' };
    }
    await client.query('UPDATE usuarios SET email=$1, actualizado_en=NOW() WHERE id=$2', [email, usuarioId]);
    await client.query('UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW()) WHERE usuario_id=$1', [usuarioId]);
    await client.query(`INSERT INTO bitacora_auditoria (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
      VALUES ($1,'CAMBIAR_EMAIL_USUARIO','usuarios',$2,$3::jsonb,$4::jsonb)`,
      [administradorId,usuarioId,JSON.stringify({email:anterior}),JSON.stringify({email})]);
    await client.query('COMMIT');
    return { estado: 'ACTUALIZADO' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
