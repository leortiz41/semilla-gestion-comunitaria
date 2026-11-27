import type { Pool } from 'pg';

/** Recalcula roles y permisos efectivos contra el estado vigente de la organización. */
export function consultarSesionAutorizada(pool: Pool, usuarioId: string, organizacionId: string) {
  return pool.query(
      `SELECT
         ARRAY(SELECT DISTINCT r.nombre FROM usuarios_roles ur
           JOIN roles r ON r.id=ur.rol_id AND r.activo
           WHERE ur.usuario_id=u.id ORDER BY r.nombre) AS roles,
         ARRAY(SELECT DISTINCT p.codigo FROM usuarios_roles ur
           JOIN roles r ON r.id=ur.rol_id AND r.activo
           JOIN roles_permisos rp ON rp.rol_id=r.id
           JOIN permisos p ON p.id=rp.permiso_id
           WHERE ur.usuario_id=u.id AND NOT EXISTS (
             SELECT 1 FROM organizaciones_roles_permisos_restringidos bloqueado
             WHERE bloqueado.organizacion_id=u.organizacion_id
               AND bloqueado.rol_id=r.id AND bloqueado.permiso_id=p.id
           ) AND NOT EXISTS (
             SELECT 1 FROM usuarios_permisos_restringidos restr
             WHERE restr.organizacion_id=u.organizacion_id
               AND restr.usuario_id=u.id AND restr.permiso_id=p.id
           ) ORDER BY p.codigo) AS permisos
         FROM usuarios u JOIN organizaciones o ON o.id=u.organizacion_id
         WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo AND o.activo LIMIT 1`,
      [usuarioId, organizacionId],
    );
}
