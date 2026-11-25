import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import {
  reemitirCredencialTemporalAdministrador,
} from '../../services/credenciales-temporales.service.js';
import { verificarAdministradorActual } from './cuentas.repository.js';

/** Mantiene el servicio transaccional original para no alterar la política de credenciales. */
export async function reemitirCredencialDeCuenta(
  organizacionId: string, usuarioId: string, administradorId: string,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Base de datos no disponible.');
  if (!await verificarAdministradorActual(pool, administradorId, organizacionId)) {
    return null;
  }
  return reemitirCredencialTemporalAdministrador(
    { organizacionId, usuarioId, superadministradorId: administradorId, permitirOtrosRoles: true },
    pool,
  );
}
