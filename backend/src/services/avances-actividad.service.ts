import type { Pool } from 'pg';
import type { DatosAvanceActividad } from '../domain/avances-actividad.js';

export interface AvanceActividad {
  id: string;
  porcentajeAvance: number;
  fecha: string;
  descripcion: string;
  responsable: string;
}

export interface ActividadConAvances {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  avances: AvanceActividad[];
}

type Consultable = Pick<Pool, 'query'>;

export async function listarActividadesProyecto(
  pool: Consultable,
  proyectoId: string,
  organizacionId: string,
): Promise<ActividadConAvances[] | null> {
  const { rows } = await pool.query<{ actividades: ActividadConAvances[] }>(
    `SELECT COALESCE((
       SELECT jsonb_agg(jsonb_build_object(
         'id', a.id, 'nombre', a.nombre, 'descripcion', a.descripcion, 'estado', a.estado,
         'fechaInicio', a.fecha_inicio, 'fechaFin', a.fecha_fin,
         'avances', COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id', av.id,
             'porcentajeAvance', av.porcentaje_avance,
             'fecha', av.fecha_avance,
             'descripcion', av.comentarios,
             'responsable', u.email
           ) ORDER BY av.fecha_avance DESC, av.creado_en DESC, av.id DESC)
           FROM avances_proyecto av
           JOIN usuarios u ON u.id = av.responsable_usuario_id
             AND u.organizacion_id = c.organizacion_id
           WHERE av.actividad_id = a.id AND av.proyecto_id = p.id
         ), '[]'::jsonb)
       ) ORDER BY a.fecha_inicio NULLS LAST, a.nombre, a.id)
       FROM actividades_programadas a WHERE a.proyecto_id = p.id
     ), '[]'::jsonb) AS actividades
     FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
     WHERE p.id = $1 AND c.organizacion_id = $2`,
    [proyectoId, organizacionId],
  );
  return rows[0]?.actividades ?? null;
}

export async function registrarAvanceActividad(
  pool: Consultable,
  proyectoId: string,
  actividadId: string,
  organizacionId: string,
  responsableUsuarioId: string,
  datos: DatosAvanceActividad,
): Promise<AvanceActividad | null> {
  const { rows } = await pool.query<AvanceActividad>(
    `WITH contexto AS (
       SELECT a.id AS actividad_id, a.proyecto_id, u.id AS responsable_usuario_id, u.email AS responsable
       FROM actividades_programadas a
       JOIN proyectos p ON p.id = a.proyecto_id
       JOIN comunidades c ON c.id = p.comunidad_id
       JOIN usuarios u ON u.id = $4 AND u.organizacion_id = c.organizacion_id AND u.activo
       WHERE a.id = $2 AND a.proyecto_id = $1 AND c.organizacion_id = $3
     ), nuevo AS (
       INSERT INTO avances_proyecto (
         proyecto_id, actividad_id, responsable_usuario_id, porcentaje_avance, fecha_avance, comentarios
       )
       SELECT proyecto_id, actividad_id, responsable_usuario_id, $5, $6, $7
       FROM contexto
       RETURNING id, proyecto_id, actividad_id, responsable_usuario_id,
         porcentaje_avance, fecha_avance, comentarios
     )
     SELECT n.id, n.porcentaje_avance::double precision AS "porcentajeAvance",
       n.fecha_avance::text AS fecha, n.comentarios AS descripcion, c.responsable
     FROM nuevo n CROSS JOIN contexto c`,
    [
      proyectoId,
      actividadId,
      organizacionId,
      responsableUsuarioId,
      datos.porcentajeAvance,
      datos.fecha,
      datos.descripcion,
    ],
  );
  return rows[0] ?? null;
}
