import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { validarNecesidad, type DatosNecesidad } from './necesidades.domain.js';
import { consultarNecesidadesEnRepositorio, insertarNecesidadEnRepositorio } from './necesidades.repository.js';

export function listarNecesidades(
  organizacionId: string, comunidadId: string, pool: Pool | null = databasePool,
) {
  return consultarNecesidadesEnRepositorio(organizacionId, comunidadId, pool);
}

export function registrarNecesidad(
  organizacionId: string, comunidadId: string, usuarioId: string,
  entrada: DatosNecesidad, pool: Pool | null = databasePool,
) {
  const datosNecesidad = validarNecesidad(entrada);
  return insertarNecesidadEnRepositorio(organizacionId, comunidadId, usuarioId, datosNecesidad, pool);
}
