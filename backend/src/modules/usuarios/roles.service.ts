import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { actualizarRolesCuenta } from './roles.repository.js';

export function cambiarRolesUsuario(
  usuarioId: string, roles: string[], administradorId: string, organizacionId: string,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Base de datos no disponible.');
  return actualizarRolesCuenta(pool, usuarioId, roles, administradorId, organizacionId);
}
