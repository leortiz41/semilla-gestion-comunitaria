import { databasePool } from '../config/database.js';
import type { ExpedienteComunidad } from '../domain/expediente.js';
import type { Pool } from 'pg';
import { guardarExpedienteEnRepositorio, obtenerExpedienteEnRepositorio } from '../modules/comunidades/expedientes.repository.js';

/** Adaptadores de compatibilidad con los imports existentes. */
export function guardarExpediente(
  organizacionId: string, usuarioId: string, datos: ExpedienteComunidad,
  pool: Pool | null = databasePool,
  edicion?: { comunidadId: string; diagnosticoAnteriorId: string | null },
) {
  return guardarExpedienteEnRepositorio(organizacionId, usuarioId, datos, pool, edicion);
}

export function obtenerExpediente(
  organizacionId: string, comunidadId: string,
  pool: Pool | null = databasePool,
) {
  return obtenerExpedienteEnRepositorio(organizacionId, comunidadId, pool);
}
