import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { reemitirCredencialTemporalAdministrador } from '../../services/credenciales-temporales.service.js';

/** Reutiliza la política transaccional existente: no expone contraseñas anteriores. */
export function reemitirCredencialDesdePlataforma(
  organizacionId: string, usuarioId: string, superadministradorId: string,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Gestión de plataforma no disponible.');
  return reemitirCredencialTemporalAdministrador(
    { organizacionId, usuarioId, superadministradorId, permitirOtrosRoles: true }, pool,
  );
}
