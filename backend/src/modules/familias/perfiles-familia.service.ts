import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import {
  consultarProyectosDePerfilesEnRepositorio,
  consultarPerfilesFamiliaresEnRepositorio,
  persistirEvaluacionFamiliarEnRepositorio,
  persistirRevisionFamiliarEnRepositorio,
} from './perfiles-familia.repository.js';

function obtenerPool(pool: Pool | null): Pool {
  if (!pool) throw new Error('Base de datos no disponible.');
  return pool;
}

// Las validaciones de entrada y las respuestas HTTP permanecen en el controlador.
// La persistencia y las restricciones por organización pertenecen al repositorio.
export function consultarProyectosDePerfiles(parametros: unknown[], pool: Pool | null = databasePool) {
  return consultarProyectosDePerfilesEnRepositorio(obtenerPool(pool), parametros);
}

export function consultarPerfilesFamiliares(parametros: unknown[], pool: Pool | null = databasePool) {
  return consultarPerfilesFamiliaresEnRepositorio(obtenerPool(pool), parametros);
}

export function persistirEvaluacionFamiliar(parametros: unknown[], pool: Pool | null = databasePool) {
  return persistirEvaluacionFamiliarEnRepositorio(obtenerPool(pool), parametros);
}

export function persistirRevisionFamiliar(parametros: unknown[], pool: Pool | null = databasePool) {
  return persistirRevisionFamiliarEnRepositorio(obtenerPool(pool), parametros);
}
