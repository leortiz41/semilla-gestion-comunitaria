import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { consultarCatalogoRoles, consultarCuentasOrganizacion } from './usuarios.repository.js';

function obtenerPool(pool: Pool | null): Pool {
  if (!pool) throw new Error('Base de datos no disponible.');
  return pool;
}

/** Lecturas de roles y cuentas; las reglas de autorización siguen en middleware. */
export async function listarRolesDisponibles(pool: Pool | null = databasePool) {
  const { rows } = await consultarCatalogoRoles(obtenerPool(pool));
  return rows;
}

export async function listarCuentasOrganizacion(
  organizacionId: string, pool: Pool | null = databasePool,
) {
  const { rows } = await consultarCuentasOrganizacion(obtenerPool(pool), organizacionId);
  return rows;
}
