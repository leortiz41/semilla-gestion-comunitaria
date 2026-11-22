import type { Pool } from 'pg';
import { esUuid } from '../../domain/expediente.js';

// La persistencia nunca obtiene el tenant de la solicitud HTTP.
// El identificador de organización se recibe explícitamente de la capa de aplicación.
type Consultable = Pick<Pool, 'query'>;

// Verifica pertenencia del avance a la actividad, proyecto y organización de la sesión.
export async function consultarAccesoEvidenciaAvance(pool: Consultable | null, proyectoId: string, actividadId: string, avanceId: string, organizacionId: string) {
  if (!pool || ![proyectoId, actividadId, avanceId, organizacionId].every(esUuid)) return null;
  const { rows } = await pool.query(
    `SELECT av.id, av.estado_revision AS estado, av.responsable_usuario_id AS responsable
     FROM avances_proyecto av
     JOIN actividades_programadas a ON a.id = av.actividad_id AND a.proyecto_id = av.proyecto_id
     JOIN proyectos p ON p.id = a.proyecto_id
     JOIN comunidades c ON c.id = p.comunidad_id
     WHERE p.id = $1 AND a.id = $2 AND av.id = $3 AND c.organizacion_id = $4`,
    [proyectoId, actividadId, avanceId, organizacionId],
  );
  return rows[0] as { id: string; estado: string; responsable: string } | undefined;
}


/** Índice documental limitado a la organización autorizada; mantiene las consultas originales. */
export async function consultarIndiceEvidencias(pool: Consultable, organizacionId: string) {
    const { rows } = await pool.query(
      `SELECT av.id AS "avanceId", a.id AS "actividadId", p.id AS "proyectoId",
         p.nombre AS proyecto, p.estado AS "estadoProyecto",
         a.nombre AS actividad, c.nombre AS comunidad,
         av.fecha_avance::text AS fecha, av.estado_revision AS "estadoRevision",
         av.comentarios AS descripcion, av.observaciones,
         av.cantidad_reportada::float8 AS "cantidadReportada",
         av.porcentaje_avance::float8 AS "porcentajeAvance",
         av.revisado_en AS "revisadoEn", av.motivo_devolucion AS "motivoDevolucion",
         COALESCE(u.email, '') AS responsable,
         COALESCE(rev.email, '') AS revisor,
         (SELECT COUNT(*)::int FROM evidencias ev
           WHERE ev.proyecto_id=p.id AND ev.avance_proyecto_id=av.id
             AND ev.tipo_mime IN ('image/jpeg','image/png','image/webp')) AS "cantidadEvidencias"
       FROM avances_proyecto av
       JOIN actividades_programadas a ON a.id=av.actividad_id AND a.proyecto_id=av.proyecto_id
       JOIN proyectos p ON p.id=a.proyecto_id
       JOIN comunidades c ON c.id=p.comunidad_id
       LEFT JOIN usuarios u ON u.id=av.responsable_usuario_id
       LEFT JOIN usuarios rev ON rev.id=av.revisor_usuario_id
       WHERE c.organizacion_id=$1
       ORDER BY av.fecha_avance DESC, av.creado_en DESC, av.id DESC
       LIMIT 500`,
      [organizacionId],
    );
    const { rows: finalizados } = await pool.query(
      `SELECT p.id, p.nombre, c.nombre AS comunidad
       FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
       WHERE c.organizacion_id=$1 AND p.estado='FINALIZADO'
       ORDER BY p.nombre, p.id LIMIT 500`,
      [organizacionId],
    );
  return { avances: rows, proyectosFinalizados: finalizados };
}
