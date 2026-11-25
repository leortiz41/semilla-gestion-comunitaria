import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import {
  consultarBrigadasFamilia, persistirAsignacionBrigada,
} from './asignaciones-familias.repository.js';

/** Orquesta las operaciones sin SQL ni dependencias HTTP. */
export async function listarBrigadasElegibles(
  familiaId: string, perfilId: string, organizacionId: string,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Base de datos no disponible.');
  const { rows } = await consultarBrigadasFamilia(pool, familiaId, perfilId, organizacionId);
  return rows;
}

export function asignarBrigadaFamiliar(
  familiaId: string, perfilId: string, brigadaId: string | null,
  usuarioId: string, organizacionId: string,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Base de datos no disponible.');
  return persistirAsignacionBrigada(pool, familiaId, perfilId, brigadaId, usuarioId, organizacionId);
}
