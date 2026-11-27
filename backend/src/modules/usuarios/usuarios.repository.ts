import type { Pool } from 'pg';

/** Catálogo histórico; no permite editar permisos globales. */
export function consultarCatalogoRoles(pool: Pool) {
  return pool.query(`
      SELECT CASE WHEN r.nombre = 'CONSULTA' THEN 'DONANTE' ELSE r.nombre END AS nombre, r.activo,
        COALESCE(
          jsonb_agg(jsonb_build_object('codigo', p.codigo, 'descripcion', p.descripcion)
                    ORDER BY p.codigo) FILTER (WHERE p.id IS NOT NULL AND (
                      r.nombre NOT IN ('DONANTE', 'CONSULTA')
                      OR p.codigo IN ('proyectos.ver', 'evidencias.ver')
                    )),
          '[]'::jsonb
        ) AS permisos
      FROM roles r
      LEFT JOIN roles_permisos rp ON rp.rol_id = r.id
      LEFT JOIN permisos p ON p.id = rp.permiso_id
      WHERE r.nombre IN ('ADMINISTRADOR', 'COORDINADOR', 'FINANZAS', 'CAMPO', 'CONSULTA', 'DONANTE')
      GROUP BY r.id, r.nombre, r.activo
    `);
}

/** Lista solo cuentas de la organización, excluyendo superadministradores. */
export function consultarCuentasOrganizacion(pool: Pool, organizacionId: string) {
  return pool.query(`SELECT u.id, u.email, u.activo, u.debe_cambiar_contrasena AS "debeCambiarContrasena",
           (SELECT pf.nombre_visible FROM perfiles_usuarios pf
             WHERE pf.usuario_id=u.id AND pf.organizacion_id=u.organizacion_id) AS "nombreVisible",
           EXISTS (SELECT 1 FROM bitacora_auditoria b WHERE b.entidad_id=u.id
             AND b.nombre_entidad='usuarios' AND b.accion='RETIRAR_USUARIO_ORGANIZACION') AS retirado,
           COALESCE(array_agg(r.nombre ORDER BY r.nombre) FILTER (WHERE r.id IS NOT NULL), '{}'::text[]) AS roles
         FROM usuarios u LEFT JOIN usuarios_roles ur ON ur.usuario_id=u.id
         LEFT JOIN roles r ON r.id=ur.rol_id
         WHERE u.organizacion_id=$1 AND NOT EXISTS (
           SELECT 1 FROM usuarios_roles upr JOIN roles rpr ON rpr.id=upr.rol_id
           WHERE upr.usuario_id=u.id AND rpr.nombre='SUPERADMINISTRADOR'
         ) GROUP BY u.id
         ORDER BY u.email LIMIT 500`, [organizacionId]);
}
