import type { Pool } from 'pg';

type Consultable = Pick<Pool, 'query'>;

/** El portal limita los resultados a la sesión DONANTE y a su organización. */
export async function consultarProyectosDonante(
  pool: Consultable, usuarioId: string, organizacionId: string, puedeVerEvidencias: boolean,
) {
      const { rows } = await pool.query(
        `SELECT p.id, p.nombre, p.estado, p.fecha_inicio::text AS "fechaInicio",
                a."porcentajeAvance"::float AS "porcentajeAvance",
                a."fechaAvance"::text AS "fechaAvance",
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'id', e.id, 'titulo', e.titulo, 'tipo', e.tipo_evidencia,
                    'url', e.archivo_url
                  ) ORDER BY e.creado_en DESC, e.id)
                  FROM evidencias e
                  WHERE $3 AND e.proyecto_id = p.id AND e.visible_para_donantes
                    AND e.solicitud_pago_id IS NULL AND e.archivo_url LIKE 'https://%'
                ), '[]'::jsonb) AS evidencias
           FROM proyectos_donantes pd
           JOIN proyectos p ON p.id = pd.proyecto_id
           JOIN comunidades c ON c.id = p.comunidad_id
           JOIN usuarios u ON u.id = pd.usuario_id AND u.organizacion_id = c.organizacion_id
           LEFT JOIN LATERAL (
             SELECT CASE
                      WHEN count(*) > 0 AND bool_and(ap.peso_resultado IS NOT NULL)
                           AND COALESCE(sum(ap.peso_resultado), 0) > 0
                      THEN sum(ap.peso_resultado * resultado.porcentaje) / sum(ap.peso_resultado)
                    END AS "porcentajeAvance",
                    max(resultado."fechaAvance") AS "fechaAvance"
             FROM actividades_programadas ap
             CROSS JOIN LATERAL (
               SELECT CASE
                        WHEN ap.estado = 'CANCELADA' THEN 0::numeric
                        WHEN ap.meta_cantidad IS NOT NULL THEN LEAST(100::numeric,
                          COALESCE((
                            SELECT sum(av.cantidad_reportada)
                            FROM avances_proyecto av
                            WHERE av.actividad_id = ap.id AND av.proyecto_id = ap.proyecto_id
                              AND av.estado_revision = 'VALIDADO' AND av.cantidad_reportada IS NOT NULL
                          ), 0) * 100 / ap.meta_cantidad)
                        ELSE COALESCE((
                          SELECT av.porcentaje_avance
                          FROM avances_proyecto av
                          WHERE av.actividad_id = ap.id AND av.proyecto_id = ap.proyecto_id
                            AND av.estado_revision = 'VALIDADO' AND av.porcentaje_avance IS NOT NULL
                          ORDER BY av.revisado_en DESC, av.creado_en DESC, av.id DESC
                          LIMIT 1
                        ), 0)
                      END AS porcentaje,
                      (
                        SELECT max(av.fecha_avance)::text
                        FROM avances_proyecto av
                        WHERE av.actividad_id = ap.id AND av.proyecto_id = ap.proyecto_id
                          AND av.estado_revision = 'VALIDADO'
                      ) AS "fechaAvance"
             ) resultado
             WHERE ap.proyecto_id = p.id
           ) a ON TRUE
          WHERE pd.usuario_id = $1 AND c.organizacion_id = $2 AND u.activo
            AND EXISTS (
              SELECT 1 FROM usuarios_roles ur
              JOIN roles r ON r.id = ur.rol_id
              WHERE ur.usuario_id = u.id AND r.activo AND r.nombre = 'DONANTE'
            )
          ORDER BY p.nombre, p.id`,
        [usuarioId, organizacionId, puedeVerEvidencias],
      );
  return rows;
}

/** Se valida la asignación antes de consultar cualquier detalle del mapa. */
export async function consultarProyectoMapaAutorizado(
  pool: Consultable, usuarioId: string, proyectoId: string, organizacionId: string,
) {
      const { rows: proyectos } = await pool.query(
        `SELECT p.id, p.nombre, p.descripcion, p.estado, p.tipo,
                c.id AS "comunidadId", c.nombre AS comunidad
           FROM proyectos_donantes pd
           JOIN usuarios u ON u.id = pd.usuario_id AND u.activo
           JOIN proyectos p ON p.id = pd.proyecto_id
           JOIN comunidades c ON c.id = p.comunidad_id
          WHERE pd.usuario_id = $1 AND pd.proyecto_id = $2
            AND u.organizacion_id = $3 AND c.organizacion_id = $3
            AND EXISTS (SELECT 1 FROM usuarios_roles ur
                         JOIN roles r ON r.id = ur.rol_id
                         WHERE ur.usuario_id = u.id
                           AND r.nombre = 'DONANTE' AND r.activo)
          LIMIT 1`,
        [usuarioId, proyectoId, organizacionId],
      );
  return proyectos[0] ?? null;
}

/** Solo debe invocarse después de comprobar la asignación por la misma sesión. */
export async function consultarContenidoMapa(
  pool: Consultable, proyectoId: string, puedeVerEvidencias: boolean,
) {
      const [actividades, avances, evidencias] = await Promise.all([
        pool.query(
          `SELECT a.id, a.nombre, a.descripcion, a.estado
             FROM actividades_programadas a
            WHERE a.proyecto_id = $1
            ORDER BY a.fecha_inicio NULLS LAST, a.nombre, a.id LIMIT 100`,
          [proyectoId],
        ),
        pool.query(
          `SELECT av.id, av.actividad_id AS "actividadId",
                  av.fecha_avance::text AS fecha,
                  av.comentarios AS descripcion,
                  NULL::text AS observaciones,
                  av.cantidad_reportada::float8 AS "cantidadReportada",
                  av.porcentaje_avance::float8 AS "porcentajeAvance",
                  av.estado_revision AS estado
             FROM avances_proyecto av
            WHERE av.proyecto_id = $1 AND av.estado_revision = 'VALIDADO'
            ORDER BY av.fecha_avance DESC, av.creado_en DESC, av.id DESC LIMIT 500`,
          [proyectoId],
        ),
        pool.query(
          `SELECT e.id, e.avance_proyecto_id AS "avanceId",
                  e.titulo, e.descripcion, e.tipo_mime AS "tipoMime",
                  e.archivo_url AS url
             FROM evidencias e
             JOIN avances_proyecto av ON av.id = e.avance_proyecto_id
                AND av.proyecto_id = e.proyecto_id
            WHERE e.proyecto_id = $1 AND $2::boolean
              AND av.estado_revision = 'VALIDADO'
              AND e.visible_para_donantes = TRUE
              AND e.solicitud_pago_id IS NULL
              AND e.tipo_mime IN ('image/jpeg', 'image/png', 'image/webp')
              AND (e.archivo_url LIKE 'https://%' OR e.archivo_url LIKE 'r2:%')
            ORDER BY e.creado_en DESC, e.id DESC LIMIT 1000`,
          [proyectoId, puedeVerEvidencias],
        ),
      ]);
  return { actividades: actividades.rows, avances: avances.rows, evidencias: evidencias.rows };
}

/** Agregados sin datos personales; filtros por usuario, proyecto y organización. */
export async function consultarImpactoFamiliarDonante(
  pool: Consultable, usuarioId: string, proyectoId: string, organizacionId: string,
) {
      const { rows } = await pool.query(
        `SELECT b.id AS "brigadaId", b.lider, d.nombre AS patrocinador,
                count(pf.id)::int AS "familiasAsignadas",
                count(pf.id) FILTER (WHERE pf.estado IN ('PENDIENTE','EVALUADO'))::int AS "enEspera",
                count(pf.id) FILTER (WHERE pf.estado = 'SELECCIONADO')::int AS aprobadas,
                count(pf.id) FILTER (WHERE pf.estado = 'FINALIZADO')::int AS beneficiadas
         FROM usuarios u
         JOIN proyectos_donantes pd ON pd.usuario_id=u.id AND pd.proyecto_id=$2
         JOIN proyectos p ON p.id=pd.proyecto_id
         JOIN comunidades c ON c.id=p.comunidad_id AND c.organizacion_id=u.organizacion_id
         JOIN cuentas_brigadas_donantes cbd ON cbd.usuario_id=u.id
         JOIN brigadas_donantes b ON b.id=cbd.brigada_id AND b.activo
         JOIN donantes d ON d.id=b.donante_id AND d.organizacion_id=u.organizacion_id AND d.activo
         JOIN brigadas_donantes_proyectos bp ON bp.brigada_id=b.id AND bp.proyecto_id=p.id
         LEFT JOIN asignaciones_familias_brigadas afb ON afb.brigada_id=b.id
         LEFT JOIN perfiles_familia pf ON pf.id=afb.perfil_id AND pf.proyecto_id=p.id
         WHERE u.id=$1 AND u.organizacion_id=$3 AND u.activo
           AND EXISTS (SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
                       WHERE ur.usuario_id=u.id AND r.nombre='DONANTE' AND r.activo)
         GROUP BY b.id,b.lider,d.nombre
         ORDER BY d.nombre,b.lider,b.id`,
        [usuarioId, proyectoId, organizacionId],
      );
  return rows;
}
