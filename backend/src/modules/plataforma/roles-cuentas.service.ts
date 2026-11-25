import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { cambiarRolesDesdePlataforma } from './roles-cuentas.repository.js';

export function actualizarRolesDesdePlataforma(
  datos: { organizacionId: string; usuarioId: string; roles: string[]; operadorId: string },
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Gestión de plataforma no disponible.');
  return cambiarRolesDesdePlataforma(pool, datos);
}
