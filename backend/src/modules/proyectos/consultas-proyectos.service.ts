import type { Pool } from 'pg';
import { consultarCatalogoProyectos, consultarAvancesPendientes } from './proyectos.repository.js';

type Consultable = Pick<Pool, 'query'>;

/** Casos de uso de consulta sin dependencias de Express. */
export function obtenerCatalogoInstitucional(pool: Consultable, organizacionId: string) {
  return consultarCatalogoProyectos(pool, organizacionId);
}

export function obtenerRevisionPendienteInstitucional(
  pool: Consultable, organizacionId: string, usuarioId: string,
) {
  return consultarAvancesPendientes(pool, organizacionId, usuarioId);
}
