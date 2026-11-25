import type { Pool } from 'pg';

/** El permiso global debe verificarse en base de datos en cada petición. */
export function consultarSuperadministradorVigente(pool: Pool, usuarioId: string) {
  return pool.query(`SELECT 1 FROM usuarios u
       JOIN organizaciones o ON o.id=u.organizacion_id AND o.activo
       JOIN usuarios_roles ur ON ur.usuario_id=u.id
       JOIN roles r ON r.id=ur.rol_id AND r.nombre='SUPERADMINISTRADOR' AND r.activo
       WHERE u.id=$1 AND u.activo LIMIT 1`, [usuarioId]);
}

/** Indicadores globales: sin datos personales en el resultado. */
export function consultarDashboardPlataforma(pool: Pool) {
  return pool.query(`
      SELECT o.id, o.nombre, o.slug, o.activo, o.creado_en AS "creadoEn",
        (SELECT count(*)::int FROM usuarios u WHERE u.organizacion_id=o.id
          AND NOT EXISTS (SELECT 1 FROM bitacora_auditoria b WHERE b.entidad_id=u.id
          AND b.nombre_entidad='usuarios' AND b.accion='RETIRAR_USUARIO_ORGANIZACION')) AS "usuariosVigentes",
        (SELECT count(*)::int FROM usuarios u WHERE u.organizacion_id=o.id AND u.activo
          AND NOT EXISTS (SELECT 1 FROM bitacora_auditoria b WHERE b.entidad_id=u.id
          AND b.nombre_entidad='usuarios' AND b.accion='RETIRAR_USUARIO_ORGANIZACION')) AS "usuariosActivos",
        (SELECT count(*)::int FROM usuarios u WHERE u.organizacion_id=o.id
          AND EXISTS (SELECT 1 FROM bitacora_auditoria b WHERE b.entidad_id=u.id
          AND b.nombre_entidad='usuarios' AND b.accion='RETIRAR_USUARIO_ORGANIZACION')) AS "usuariosRetirados",
        (SELECT count(*)::int FROM comunidades c WHERE c.organizacion_id=o.id) AS "comunidades",
        (SELECT count(*)::int FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
          WHERE c.organizacion_id=o.id) AS "proyectos",
        (SELECT count(*)::int FROM evidencias e JOIN proyectos p ON p.id=e.proyecto_id
          JOIN comunidades c ON c.id=p.comunidad_id WHERE c.organizacion_id=o.id) AS "evidencias",
        (SELECT max(u.ultimo_acceso_en) FROM usuarios u
          WHERE u.organizacion_id=o.id) AS "ultimoAcceso"
      FROM organizaciones o ORDER BY o.nombre,o.id LIMIT 500
    `);
}

export function consultarOrganizacionesPlataforma(pool: Pool) {
  return pool.query(`SELECT o.id,o.nombre,o.slug,o.activo,o.email_contacto AS "emailContacto",
          (SELECT count(*)::int FROM usuarios u WHERE u.organizacion_id=o.id) AS "cantidadUsuarios",
          (SELECT count(DISTINCT u.id)::int FROM usuarios u
           JOIN usuarios_roles ur ON ur.usuario_id=u.id
           JOIN roles r ON r.id=ur.rol_id AND r.nombre='ADMINISTRADOR'
           WHERE u.organizacion_id=o.id AND u.activo) AS "cantidadAdministradores"
       FROM organizaciones o ORDER BY o.nombre,o.id LIMIT 500`);
}
