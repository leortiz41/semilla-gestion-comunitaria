import type { Pool } from 'pg';
import type { DatosAvanceActividad } from '../domain/avances-actividad.js';

export interface HistorialAvance {
  accion: string;
  actor: string | null;
  fecha: string;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
}

export interface AvanceActividad extends Omit<DatosAvanceActividad, 'claveIdempotencia'> {
  id: string;
  estadoRevision: 'BORRADOR' | 'ENVIADO' | 'VALIDADO' | 'DEVUELTO';
  responsable: string | null;
  revisor: string | null;
  revisadoEn: string | null;
  motivoDevolucion: string | null;
  historial: HistorialAvance[];
}

export interface AvanceCreado extends AvanceActividad {
  claveIdempotencia: string;
}

export interface ActividadConAvances {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  responsableAsignadoId: string | null;
  responsableAsignado: string | null;
  metaCantidad: number | null;
  unidadMedida: string | null;
  presupuestoEstimado: number | null;
  pesoResultado: number | null;
  cantidadValidada: number;
  porcentajeResultado: number;
  ultimaEjecucionValidada: string | null;
  avances: AvanceActividad[];
}

export interface ResultadoActividadesProyecto {
  actividades: ActividadConAvances[];
  porcentajeProyecto: number | null;
  pesoConfigurado: number;
}

type Consultable = Pick<Pool, 'query'>;

export async function listarActividadesProyecto(
  pool: Consultable,
  proyectoId: string,
  organizacionId: string,
): Promise<ResultadoActividadesProyecto | null> {
  const { rows } = await pool.query<{ actividades: ActividadConAvances[] }>(
    `SELECT COALESCE((
       SELECT jsonb_agg(jsonb_build_object(
         'id', a.id,
         'nombre', a.nombre,
         'descripcion', a.descripcion,
         'estado', a.estado,
         'fechaInicio', a.fecha_inicio,
         'fechaFin', a.fecha_fin,
         'responsableAsignadoId', a.responsable_asignado_usuario_id,
         'responsableAsignado', u.email,
         'metaCantidad', a.meta_cantidad,
         'unidadMedida', a.unidad_medida,
         'presupuestoEstimado', a.presupuesto_estimado,
         'pesoResultado', a.peso_resultado,
         'cantidadValidada', COALESCE((
           SELECT SUM(av.cantidad_reportada)
           FROM avances_proyecto av
           WHERE av.actividad_id = a.id AND av.proyecto_id = p.id
             AND av.estado_revision = 'VALIDADO' AND av.cantidad_reportada IS NOT NULL
         ), 0),
         'porcentajeResultado', CASE
           WHEN a.estado = 'CANCELADA' THEN 0
           WHEN a.meta_cantidad IS NOT NULL THEN LEAST(100::numeric,
             COALESCE((
               SELECT SUM(av.cantidad_reportada)
               FROM avances_proyecto av
               WHERE av.actividad_id = a.id AND av.proyecto_id = p.id
                 AND av.estado_revision = 'VALIDADO' AND av.cantidad_reportada IS NOT NULL
             ), 0) * 100 / a.meta_cantidad)
           ELSE COALESCE((
             SELECT av.porcentaje_avance
             FROM avances_proyecto av
             WHERE av.actividad_id = a.id AND av.proyecto_id = p.id
               AND av.estado_revision = 'VALIDADO' AND av.porcentaje_avance IS NOT NULL
             ORDER BY av.revisado_en DESC, av.creado_en DESC, av.id DESC
             LIMIT 1
           ), 0)
         END,
         'ultimaEjecucionValidada', (
           SELECT MAX(av.fecha_avance)
           FROM avances_proyecto av
           WHERE av.actividad_id = a.id AND av.proyecto_id = p.id
             AND av.estado_revision = 'VALIDADO'
         ),
         'avances', COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id', av.id,
             'porcentajeAvance', av.porcentaje_avance,
             'cantidadReportada', av.cantidad_reportada,
             'fecha', av.fecha_avance,
             'descripcion', av.comentarios,
             'observaciones', av.observaciones,
             'estadoRevision', av.estado_revision,
             'responsable', autor.email,
             'revisor', revisor.email,
             'revisadoEn', av.revisado_en,
             'motivoDevolucion', av.motivo_devolucion,
             'cantidadEvidencias', (
               SELECT COUNT(*)::int FROM evidencias ev
               WHERE ev.avance_proyecto_id = av.id AND ev.proyecto_id = p.id
                 AND ev.tipo_mime IN ('image/jpeg', 'image/png', 'image/webp')
             ),
             'historial', COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'accion', b.accion,
                 'actor', actor.email,
                 'fecha', b.creado_en,
                 'antes', b.valores_anteriores,
                 'despues', b.valores_nuevos
               ) ORDER BY b.creado_en, b.id)
               FROM bitacora_auditoria b
               LEFT JOIN usuarios actor ON actor.id = b.usuario_id
               WHERE b.nombre_entidad = 'avances_proyecto' AND b.entidad_id = av.id
             ), '[]'::jsonb)
           ) ORDER BY av.fecha_avance DESC, av.creado_en DESC, av.id DESC)
           FROM avances_proyecto av
           LEFT JOIN usuarios autor ON autor.id = av.responsable_usuario_id
           LEFT JOIN usuarios revisor ON revisor.id = av.revisor_usuario_id
           WHERE av.actividad_id = a.id AND av.proyecto_id = p.id
         ), '[]'::jsonb)
       ) ORDER BY a.fecha_inicio NULLS LAST, a.nombre, a.id)
       FROM actividades_programadas a
       LEFT JOIN usuarios u ON u.id = a.responsable_asignado_usuario_id
         AND u.organizacion_id = c.organizacion_id
       WHERE a.proyecto_id = p.id
     ), '[]'::jsonb) AS actividades
     FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
     WHERE p.id = $1 AND c.organizacion_id = $2`,
    [proyectoId, organizacionId],
  );
  const actividades = rows[0]?.actividades;
  if (!actividades) return null;

  const pesoConfigurado = actividades.reduce((total, actividad) =>
    total + (actividad.pesoResultado === null ? 0 : Number(actividad.pesoResultado)), 0);
  const proyectoTienePesosCompletos = actividades.length > 0 &&
    actividades.every((actividad) => actividad.pesoResultado !== null) && pesoConfigurado > 0;
  const porcentajeProyecto = proyectoTienePesosCompletos
    ? actividades.reduce((total, actividad) =>
      total + Number(actividad.pesoResultado) * actividad.porcentajeResultado, 0) / pesoConfigurado
    : null;

  return { actividades, porcentajeProyecto, pesoConfigurado };
}

export async function registrarAvanceActividad(
  pool: Consultable,
  proyectoId: string,
  actividadId: string,
  organizacionId: string,
  responsableUsuarioId: string,
  datos: DatosAvanceActividad,
): Promise<AvanceCreado | null> {
  const { rows } = await pool.query<AvanceCreado>(
    `WITH contexto AS (
       SELECT a.id AS actividad_id, a.proyecto_id, a.meta_cantidad,
         u.id AS responsable_usuario_id
       FROM actividades_programadas a
       JOIN proyectos p ON p.id = a.proyecto_id
       JOIN comunidades c ON c.id = p.comunidad_id
       JOIN usuarios u ON u.id = $4 AND u.organizacion_id = c.organizacion_id AND u.activo
       WHERE a.id = $2 AND a.proyecto_id = $1 AND c.organizacion_id = $3
         AND ((a.meta_cantidad IS NOT NULL AND $5::numeric IS NULL AND $6::numeric IS NOT NULL)
           OR (a.meta_cantidad IS NULL AND $5::numeric IS NOT NULL AND $6::numeric IS NULL))
     ), nuevo AS (
       INSERT INTO avances_proyecto (
         proyecto_id, actividad_id, responsable_usuario_id, clave_idempotencia,
         porcentaje_avance, cantidad_reportada, fecha_avance, comentarios, observaciones,
         estado_revision
       )
       SELECT proyecto_id, actividad_id, responsable_usuario_id, $7,
         $5, $6, $8, $9, $10, 'BORRADOR'
       FROM contexto
       ON CONFLICT (clave_idempotencia) DO NOTHING
       RETURNING id, porcentaje_avance, cantidad_reportada, fecha_avance, comentarios,
         observaciones, estado_revision, responsable_usuario_id
     ), auditoria AS (
       INSERT INTO bitacora_auditoria (
         usuario_id, accion, nombre_entidad, entidad_id, valores_nuevos
       )
       SELECT responsable_usuario_id, 'CREAR_BORRADOR_AVANCE', 'avances_proyecto', id,
         jsonb_build_object('estado_revision', estado_revision,
           'porcentaje_avance', porcentaje_avance, 'cantidad_reportada', cantidad_reportada,
           'fecha_avance', fecha_avance, 'comentarios', comentarios, 'observaciones', observaciones)
       FROM nuevo
     )
     SELECT n.id, n.porcentaje_avance::double precision AS \"porcentajeAvance\",
       n.cantidad_reportada::double precision AS \"cantidadReportada\",
       n.fecha_avance::text AS fecha, n.comentarios AS descripcion,
       n.observaciones, n.estado_revision AS \"estadoRevision\", u.email AS responsable,
       NULL::text AS revisor, NULL::text AS \"revisadoEn\", NULL::text AS \"motivoDevolucion\",
       '[]'::jsonb AS historial, $7::uuid::text AS \"claveIdempotencia\"
     FROM nuevo n JOIN usuarios u ON u.id = n.responsable_usuario_id`,
    [
      proyectoId,
      actividadId,
      organizacionId,
      responsableUsuarioId,
      datos.porcentajeAvance,
      datos.cantidadReportada,
      datos.claveIdempotencia,
      datos.fecha,
      datos.descripcion,
      datos.observaciones,
    ],
  );
  return rows[0] ?? null;
}

export type AccionRevisionAvance = 'ENVIAR' | 'VALIDAR' | 'DEVOLVER';

export async function transicionarAvanceActividad(
  pool: Consultable,
  proyectoId: string,
  actividadId: string,
  avanceId: string,
  organizacionId: string,
  usuarioId: string,
  accion: AccionRevisionAvance,
  motivo?: string,
  permitirAutoRevision = false,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `WITH contexto AS MATERIALIZED (
       SELECT av.id, av.estado_revision AS estado_anterior, av.porcentaje_avance,
         av.cantidad_reportada, av.fecha_avance, av.comentarios, av.observaciones,
         av.responsable_usuario_id, av.revisor_usuario_id
       FROM avances_proyecto av
       JOIN actividades_programadas a ON a.id = av.actividad_id AND a.proyecto_id = av.proyecto_id
       JOIN proyectos p ON p.id = a.proyecto_id
       JOIN comunidades c ON c.id = p.comunidad_id
       JOIN usuarios actor ON actor.id = $5 AND actor.organizacion_id = c.organizacion_id AND actor.activo
       WHERE p.id = $1 AND a.id = $2 AND av.id = $3 AND c.organizacion_id = $4
         AND CASE
           WHEN $6 = 'ENVIAR' THEN av.estado_revision IN ('BORRADOR', 'DEVUELTO')
             AND av.responsable_usuario_id = $5
           WHEN $6 IN ('VALIDAR', 'DEVOLVER') THEN av.estado_revision = 'ENVIADO'
             AND (av.responsable_usuario_id <> $5 OR $8::boolean)
           ELSE FALSE
         END
       FOR UPDATE OF av
     ), actualizado AS (
       UPDATE avances_proyecto av SET
         estado_revision = CASE $6 WHEN 'ENVIAR' THEN 'ENVIADO'
           WHEN 'VALIDAR' THEN 'VALIDADO' ELSE 'DEVUELTO' END,
         revisor_usuario_id = CASE WHEN $6 = 'ENVIAR' THEN NULL ELSE $5 END,
         revisado_en = CASE WHEN $6 = 'ENVIAR' THEN NULL ELSE NOW() END,
         motivo_devolucion = CASE WHEN $6 = 'DEVOLVER' THEN $7 ELSE NULL END,
         actualizado_en = NOW()
       FROM contexto c
       WHERE av.id = c.id
       RETURNING av.id, av.estado_revision, av.porcentaje_avance, av.cantidad_reportada,
         av.fecha_avance, av.comentarios, av.observaciones, av.responsable_usuario_id,
         av.revisor_usuario_id, av.revisado_en, av.motivo_devolucion
     )
     INSERT INTO bitacora_auditoria (
       usuario_id, accion, nombre_entidad, entidad_id, valores_anteriores, valores_nuevos
     )
     SELECT $5,
       CASE
         WHEN $6 = 'ENVIAR' THEN 'ENVIAR_AVANCE'
         WHEN c.responsable_usuario_id = $5 AND $6 = 'VALIDAR' THEN 'AUTOVALIDAR_AVANCE'
         WHEN c.responsable_usuario_id = $5 AND $6 = 'DEVOLVER' THEN 'AUTODEVOLVER_AVANCE'
         WHEN $6 = 'VALIDAR' THEN 'VALIDAR_AVANCE'
         ELSE 'DEVOLVER_AVANCE'
       END,
       'avances_proyecto', n.id,
       jsonb_build_object('estado_revision', c.estado_anterior,
         'porcentaje_avance', c.porcentaje_avance, 'cantidad_reportada', c.cantidad_reportada,
         'fecha_avance', c.fecha_avance, 'comentarios', c.comentarios,
         'observaciones', c.observaciones),
       jsonb_build_object('estado_revision', n.estado_revision,
         'revisor_usuario_id', n.revisor_usuario_id, 'revisado_en', n.revisado_en,
         'motivo_devolucion', n.motivo_devolucion,
         'autorrevision', $6 <> 'ENVIAR' AND c.responsable_usuario_id = $5)
     FROM actualizado n JOIN contexto c ON c.id = n.id`,
    [proyectoId, actividadId, avanceId, organizacionId, usuarioId, accion, motivo ?? null, permitirAutoRevision],
  );
  return rowCount === 1;
}

export async function editarAvanceActividad(
  pool: Consultable,
  proyectoId: string,
  actividadId: string,
  avanceId: string,
  organizacionId: string,
  usuarioId: string,
  datos: DatosAvanceActividad,
  correccionValidada = false,
  motivoCorreccion?: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `WITH contexto AS MATERIALIZED (
       SELECT av.id, av.estado_revision AS estado_anterior, av.porcentaje_avance AS porcentaje_anterior,
         av.cantidad_reportada AS cantidad_anterior, av.comentarios AS descripcion_anterior,
         av.observaciones AS observaciones_anteriores, av.fecha_avance AS fecha_anterior,
         av.responsable_usuario_id, a.meta_cantidad
       FROM avances_proyecto av
       JOIN actividades_programadas a ON a.id = av.actividad_id AND a.proyecto_id = av.proyecto_id
       JOIN proyectos p ON p.id = a.proyecto_id
       JOIN comunidades c ON c.id = p.comunidad_id
       JOIN usuarios actor ON actor.id = $5 AND actor.organizacion_id = c.organizacion_id AND actor.activo
       WHERE p.id = $1 AND a.id = $2 AND av.id = $3 AND c.organizacion_id = $4
         AND ((NOT $11 AND av.estado_revision IN ('BORRADOR', 'DEVUELTO')
               AND av.responsable_usuario_id = $5)
           OR ($11 AND av.estado_revision = 'VALIDADO'))
         AND ((a.meta_cantidad IS NOT NULL AND $6::numeric IS NULL AND $7::numeric IS NOT NULL)
           OR (a.meta_cantidad IS NULL AND $6::numeric IS NOT NULL AND $7::numeric IS NULL))
       FOR UPDATE OF av
     ), actualizado AS (
       UPDATE avances_proyecto av SET
         porcentaje_avance = $6, cantidad_reportada = $7, fecha_avance = $8,
         comentarios = $9, observaciones = $10,
         estado_revision = CASE WHEN $11 THEN 'ENVIADO' ELSE av.estado_revision END,
         revisor_usuario_id = CASE WHEN $11 THEN NULL ELSE av.revisor_usuario_id END,
         revisado_en = CASE WHEN $11 THEN NULL ELSE av.revisado_en END,
         motivo_devolucion = CASE WHEN $11 THEN NULL ELSE av.motivo_devolucion END,
         actualizado_en = NOW()
       FROM contexto c WHERE av.id = c.id
       RETURNING av.id, av.estado_revision, av.porcentaje_avance, av.cantidad_reportada,
         av.fecha_avance, av.comentarios, av.observaciones
     )
     INSERT INTO bitacora_auditoria (
       usuario_id, accion, nombre_entidad, entidad_id, valores_anteriores, valores_nuevos
     )
     SELECT $5, CASE WHEN $11 THEN 'CORREGIR_AVANCE_VALIDADO' ELSE 'EDITAR_BORRADOR_AVANCE' END,
       'avances_proyecto', n.id,
       jsonb_build_object('estado_revision', c.estado_anterior,
         'porcentaje_avance', c.porcentaje_anterior, 'cantidad_reportada', c.cantidad_anterior,
         'fecha_avance', c.fecha_anterior, 'comentarios', c.descripcion_anterior,
         'observaciones', c.observaciones_anteriores),
       jsonb_build_object('estado_revision', n.estado_revision,
         'porcentaje_avance', n.porcentaje_avance, 'cantidad_reportada', n.cantidad_reportada,
         'fecha_avance', n.fecha_avance, 'comentarios', n.comentarios,
         'observaciones', n.observaciones, 'motivo_correccion', $12::text)
     FROM actualizado n JOIN contexto c ON c.id = n.id`,
    [
      proyectoId,
      actividadId,
      avanceId,
      organizacionId,
      usuarioId,
      datos.porcentajeAvance,
      datos.cantidadReportada,
      datos.fecha,
      datos.descripcion,
      datos.observaciones,
      correccionValidada,
      motivoCorreccion ?? null,
    ],
  );
  return rowCount === 1;
}
