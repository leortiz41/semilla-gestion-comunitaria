import { databasePool } from '../../config/database.js';
import type { Pool } from 'pg';
import { consultarComunidadesParaFamilias, consultarFamiliasPorOrganizacion,
  consultarFamiliaPorId, insertarFamilia, editarFamilia } from './familias.repository.js';
import type { DatosFamilia } from './familias.domain.js';

function obtenerPool(pool: Pool | null): Pool {
  if (!pool) throw new Error('Base de datos no disponible.');
  return pool;
}
export async function listarComunidadesFamilia(organizacionId: string, pool: Pool | null = databasePool) {
  const { rows } = await consultarComunidadesParaFamilias(obtenerPool(pool), organizacionId);
  return rows;
}
export async function listarFamilias(organizacionId: string, pool: Pool | null = databasePool) {
  const { rows } = await consultarFamiliasPorOrganizacion(obtenerPool(pool), organizacionId);
  return rows;
}
export async function obtenerFamilia(familiaId: string, organizacionId: string, pool: Pool | null = databasePool) {
  const { rows } = await consultarFamiliaPorId(obtenerPool(pool), familiaId, organizacionId);
  return rows[0] ?? null;
}
export async function crearFamilia(datos: DatosFamilia, organizacionId: string, pool: Pool | null = databasePool) {
  const { rows } = await insertarFamilia(obtenerPool(pool), datos, organizacionId);
  return rows[0] ?? null;
}
export async function actualizarFamilia(familiaId: string, datos: DatosFamilia, activo: boolean,
  organizacionId: string, pool: Pool | null = databasePool) {
  const { rowCount } = await editarFamilia(obtenerPool(pool), familiaId, datos, activo, organizacionId);
  return Boolean(rowCount);
}
