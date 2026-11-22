import { consultarActividadesConAvances, insertarAvance, actualizarEstadoAvance, modificarAvance } from './avances-actividad.repository.js';
import type { Pool } from 'pg';
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
