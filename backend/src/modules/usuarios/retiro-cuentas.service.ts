import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { retirarCuentaOrganizacion } from './retiro-cuentas.repository.js';

export function retirarCuenta(
  usuarioId: string, administradorId: string, organizacionId: string,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Base de datos no disponible.');
  return retirarCuentaOrganizacion(pool, usuarioId, administradorId, organizacionId);
}
