import type { Pool } from 'pg';

export type ResultadoRetiroCuenta =
  | { estado: 'ADMINISTRACION_NO_AUTORIZADA' }
  | { estado: 'NO_ENCONTRADO' }
  | { estado: 'CUENTA_PROTEGIDA' }
  | { estado: 'YA_RETIRADA' }
  | { estado: 'ULTIMO_ADMINISTRADOR' }
  | { estado: 'RETIRADA'; id: string };

/** Retirada lógica transaccional, sin borrar datos relacionados ni permitir reactivación. */
export async function retirarCuentaOrganizacion(
  pool: Pool, usuarioId: string, administradorId: string, organizacionId: string,
): Promise<ResultadoRetiroCuenta> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const organizacion = await client.query(
      'SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE', [organizacionId]);
    const admin = await client.query(`SELECT 1 FROM usuarios u JOIN usuarios_roles ur ON ur.usuario_id=u.id
      JOIN roles r ON r.id=ur.rol_id AND r.nombre='ADMINISTRADOR' AND r.activo
      WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo LIMIT 1`, [administradorId,organizacionId]);
    if (!organizacion.rowCount || !admin.rowCount) {
      await client.query('ROLLBACK');
      return { estado: 'ADMINISTRACION_NO_AUTORIZADA' };
    }
    const cuenta = await client.query(
      'SELECT id,activo FROM usuarios WHERE id=$1 AND organizacion_id=$2 FOR UPDATE',
      [usuarioId,organizacionId]);
    if (!cuenta.rowCount) {
      await client.query('ROLLBACK');
      return { estado: 'NO_ENCONTRADO' };
    }
    const roles = await client.query(`SELECT r.nombre FROM usuarios_roles ur
      JOIN roles r ON r.id=ur.rol_id WHERE ur.usuario_id=$1`, [usuarioId]);
    if (roles.rows.some((r: { nombre: string }) => r.nombre === 'SUPERADMINISTRADOR')) {
      await client.query('ROLLBACK');
      return { estado: 'CUENTA_PROTEGIDA' };
    }
    const retirada = await client.query(`SELECT 1 FROM bitacora_auditoria
      WHERE entidad_id=$1 AND nombre_entidad='usuarios' AND accion='RETIRAR_USUARIO_ORGANIZACION' LIMIT 1`,
      [usuarioId]);
    if (retirada.rowCount) {
      await client.query('ROLLBACK');
      return { estado: 'YA_RETIRADA' };
    }
    if (roles.rows.some((r: { nombre: string }) => r.nombre === 'ADMINISTRADOR')) {
      const otros = await client.query(`SELECT COUNT(DISTINCT u.id)::int AS total FROM usuarios u
        JOIN usuarios_roles ur ON ur.usuario_id=u.id JOIN roles r ON r.id=ur.rol_id AND r.activo
        WHERE u.organizacion_id=$1 AND u.activo AND r.nombre='ADMINISTRADOR' AND u.id<>$2`,
        [organizacionId,usuarioId]);
      if (!otros.rows[0].total) {
        await client.query('ROLLBACK');
        return { estado: 'ULTIMO_ADMINISTRADOR' };
      }
    }
    await client.query('UPDATE usuarios SET activo=FALSE,actualizado_en=NOW() WHERE id=$1',[usuarioId]);
    await client.query('UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW()) WHERE usuario_id=$1',[usuarioId]);
    await client.query(`INSERT INTO bitacora_auditoria
      (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
      VALUES ($1,'RETIRAR_USUARIO_ORGANIZACION','usuarios',$2,$3::jsonb,$4::jsonb)`,
      [administradorId,usuarioId,JSON.stringify({activo:cuenta.rows[0].activo}),
        JSON.stringify({activo:false,retirado:true,organizacionId})]);
    await client.query('COMMIT');
    return { estado: 'RETIRADA', id: usuarioId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
