import type { Pool } from 'pg';
import { consultarCierreProyecto, finalizarProyecto, reabrirProyecto } from './cierre-proyecto.repository.js';

type Consultable = Pick<Pool, 'query'>;

export function consultarEstadoCierre(pool: Consultable, proyectoId: string, organizacionId: string) {
  return consultarCierreProyecto(pool, proyectoId, organizacionId);
}

export interface SolicitudFinalizacion {
  proyectoId: string;
  organizacionId: string;
  usuarioId: string;
  evidenciasRevisadas: boolean;
  recursosRevisados: boolean;
}

/** Caso de uso independiente de Express: conserva verificación atómica y auditoría en el repositorio. */
export function ejecutarFinalizacionProyecto(pool: Pool, solicitud: SolicitudFinalizacion) {
  return finalizarProyecto(pool, solicitud.proyectoId, solicitud.organizacionId, solicitud.usuarioId,
    solicitud.evidenciasRevisadas, solicitud.recursosRevisados);
}

export interface SolicitudReapertura {
  proyectoId: string;
  organizacionId: string;
  usuarioId: string;
  motivo: string;
}

export function ejecutarReaperturaProyecto(pool: Pool, solicitud: SolicitudReapertura) {
  return reabrirProyecto(pool, solicitud.proyectoId, solicitud.organizacionId,
    solicitud.usuarioId, solicitud.motivo);
}
