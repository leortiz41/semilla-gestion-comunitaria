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

/** Datos de la pantalla de proyectos: consultas paralelas con ámbito institucional. */
export async function consultarCatalogoProyectos(pool: Consultable, organizacionId: string) {
    const parametros = [organizacionId];
    const [proyectos, comunidades, donantes, organizacion] = await Promise.all([
      pool.query(
        `SELECT p.id, p.nombre, p.tipo, p.estado, p.descripcion, p.presupuesto_asignado::text AS "presupuesto",
                ARRAY(SELECT donante_id FROM proyectos_fichas_donantes WHERE proyecto_id = p.id) AS "donanteIds",
                ARRAY(SELECT d.nombre FROM donantes d
                  WHERE d.organizacion_id = c.organizacion_id AND (
                    EXISTS (SELECT 1 FROM proyectos_fichas_donantes pd WHERE pd.proyecto_id = p.id AND pd.donante_id = d.id)
                    OR EXISTS (SELECT 1 FROM brigadas_donantes_proyectos bp
                      JOIN brigadas_donantes b ON b.id = bp.brigada_id
                      WHERE bp.proyecto_id = p.id AND b.donante_id = d.id)
                  ) ORDER BY d.nombre, d.id) AS donantes,
                p.comunidad_id AS "comunidadId", c.nombre AS comunidad,
                p.fecha_inicio::text AS "fechaInicio", p.fecha_fin::text AS "fechaFin"
         FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
         WHERE c.organizacion_id = $1 ORDER BY p.fecha_inicio DESC, p.nombre, p.id`,
        parametros,
      ),
      pool.query(
        `SELECT id, nombre, municipio FROM comunidades
         WHERE organizacion_id = $1 AND activo ORDER BY nombre, municipio, id`,
        parametros,
      ),
      pool.query('SELECT id, nombre, activo FROM donantes WHERE organizacion_id = $1 ORDER BY nombre, id', parametros),
      pool.query('SELECT moneda FROM organizaciones WHERE id = $1', parametros),
    ]);
  return { proyectos: proyectos.rows, comunidades: comunidades.rows, donantes: donantes.rows,
    moneda: organizacion.rows[0]?.moneda ?? 'HNL' };
}

/** Usuarios activos aptos para responsabilizarse de actividades (sin rol DONANTE). */
export async function consultarResponsablesProyecto(pool: Consultable, proyectoId: string, organizacionId: string) {
      const { rows } = await pool.query(
        `SELECT u.id, u.email AS nombre
         FROM usuarios u
         JOIN comunidades c ON c.organizacion_id = u.organizacion_id
         JOIN proyectos p ON p.comunidad_id = c.id
         WHERE p.id = $1 AND c.organizacion_id = $2 AND u.activo
           AND NOT EXISTS (
             SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
             WHERE ur.usuario_id = u.id AND r.nombre = 'DONANTE'
           )
         ORDER BY u.email, u.id`,
        [proyectoId, organizacionId],
      );
  return rows;
}

/** Bandeja de avances enviados, filtrada por tenant y consultante. */
export async function consultarAvancesPendientes(pool: Consultable, organizacionId: string, usuarioId: string) {
    const { rows } = await pool.query(
      `SELECT av.id, av.actividad_id AS "actividadId", av.proyecto_id AS "proyectoId",
         a.nombre AS actividad, p.nombre AS proyecto, c.nombre AS comunidad,
         av.fecha_avance::text AS fecha, av.comentarios AS descripcion,
         av.observaciones, av.cantidad_reportada::double precision AS "cantidadReportada",
         av.porcentaje_avance::double precision AS "porcentajeAvance",
         a.unidad_medida AS "unidadMedida", autor.email AS responsable,
         (SELECT COUNT(*)::int FROM evidencias ev WHERE ev.avance_proyecto_id = av.id
           AND ev.proyecto_id = p.id
           AND ev.tipo_mime IN ('image/jpeg', 'image/png', 'image/webp')) AS "cantidadEvidencias",
         (av.responsable_usuario_id = $2::uuid) AS "esPropio"
       FROM avances_proyecto av
       JOIN actividades_programadas a ON a.id = av.actividad_id AND a.proyecto_id = av.proyecto_id
       JOIN proyectos p ON p.id = a.proyecto_id
       JOIN comunidades c ON c.id = p.comunidad_id
       JOIN usuarios autor ON autor.id = av.responsable_usuario_id
       WHERE c.organizacion_id = $1 AND av.estado_revision = 'ENVIADO'
       ORDER BY av.fecha_avance DESC, av.creado_en DESC, av.id DESC
       LIMIT 200`,
      [organizacionId, usuarioId],
    );
  return rows;
}

/** Verifica la actividad en el proyecto/organización antes de registrar un avance. */
export async function consultarMetaActividad(pool: Consultable, proyectoId: string, actividadId: string, organizacionId: string) {
        const contexto = await pool.query(
          `SELECT a.meta_cantidad
           FROM actividades_programadas a
           JOIN proyectos p ON p.id = a.proyecto_id
           JOIN comunidades c ON c.id = p.comunidad_id
           WHERE p.id = $1 AND a.id = $2 AND c.organizacion_id = $3`,
          [proyectoId, actividadId, organizacionId],
        );
  return contexto.rows;
}
