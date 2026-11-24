import type { Pool } from 'pg';
import { guardarBrigadaEnRepositorio } from './brigadas.repository.js';
import type { DatosBrigada } from './brigadas.domain.js';

/** Caso de uso independiente de Express; el repositorio ejecuta una única transacción. */
export function guardarBrigada(
  pool: Pool, fichaId: string, brigadaId: string | null,
  organizacionId: string, datos: DatosBrigada,
) {
  return guardarBrigadaEnRepositorio(pool, fichaId, brigadaId, organizacionId, datos);
}
