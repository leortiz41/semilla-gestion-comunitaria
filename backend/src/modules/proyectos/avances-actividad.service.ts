import { consultarActividadesConAvances, insertarAvance, actualizarEstadoAvance, modificarAvance } from './avances-actividad.repository.js';
import type { Pool } from 'pg';
import { consultarMetaActividad, consultarLimiteDeValidacion } from './proyectos.repository.js';
import type { DatosAvanceActividad } from './avances-actividad.domain.js';

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
  cantidadEvidencias?: number;
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
  const { rows } = await consultarActividadesConAvances(pool, proyectoId, organizacionId);
  const actividades = rows[0]?.actividades;
  if (!actividades) return null;

  const pesoConfigurado = actividades.reduce((total, actividad) =>
    total + (actividad.pesoResultado === null ? 0 : Number(actividad.pesoResultado)), 0);
  const todosLosPesosConfigurados = actividades.length > 0 &&
    actividades.every((actividad) => actividad.pesoResultado !== null) && pesoConfigurado > 0;
  const ningunPesoConfigurado = actividades.every((actividad) => actividad.pesoResultado === null);
  // Para una actividad no hace falta ponderación. Para varias, si ninguna
  // tiene peso manual, se usa reparto equitativo sin alterar la planificación.
  // Una ponderación parcialmente configurada se deja pendiente para evitar
  // mostrar un resultado global potencialmente engañoso.
  const porcentajeProyecto = actividades.length === 1
    ? Number(actividades[0].porcentajeResultado)
    : todosLosPesosConfigurados
      ? actividades.reduce((total, actividad) =>
          total + Number(actividad.pesoResultado) * actividad.porcentajeResultado, 0) / pesoConfigurado
      : actividades.length > 1 && ningunPesoConfigurado
        ? actividades.reduce((total, actividad) =>
            total + Number(actividad.porcentajeResultado), 0) / actividades.length
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
  const { rows } = await insertarAvance(pool, proyectoId, actividadId, organizacionId, responsableUsuarioId, datos);
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
  const { rowCount } = await actualizarEstadoAvance(pool, proyectoId, actividadId, avanceId, organizacionId, usuarioId, accion, motivo, permitirAutoRevision);
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
  const { rowCount } = await modificarAvance(pool, proyectoId, actividadId, avanceId, organizacionId, usuarioId, datos, correccionValidada, motivoCorreccion);
  return rowCount === 1;
}

/** Reglas de preparación de avance: metadatos siempre limitados a la organización. */
export async function comprobarTipoDeMetaAvance(
  pool: Consultable, proyectoId: string, actividadId: string, organizacionId: string,
  datos: DatosAvanceActividad,
): Promise<'NO_ENCONTRADO' | 'TIPO_INCORRECTO' | 'OK'> {
  const filas = await consultarMetaActividad(pool, proyectoId, actividadId, organizacionId);
  if (!filas.length) return 'NO_ENCONTRADO';
  return (filas[0].meta_cantidad !== null) !== (datos.cantidadReportada !== null)
    ? 'TIPO_INCORRECTO' : 'OK';
}

/** Devuelve el detalle de un posible exceso sin duplicar consultas SQL en controladores. */
export async function consultarExcesoDeMeta(
  pool: Consultable, avanceId: string, actividadId: string,
  proyectoId: string, organizacionId: string,
) {
  const limite = await consultarLimiteDeValidacion(pool, avanceId, actividadId, proyectoId, organizacionId);
  return limite && limite.total > limite.meta ? limite : null;
}
