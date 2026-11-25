import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { actualizarEmailCuenta, actualizarNombreCuenta } from './edicion-cuentas.repository.js';

export function cambiarNombreCuenta(
  usuarioId: string, nombreVisible: string, administradorId: string, organizacionId: string,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Base de datos no disponible.');
  return actualizarNombreCuenta(pool, usuarioId, nombreVisible, administradorId, organizacionId);
}

export function cambiarEmailCuenta(
  usuarioId: string, email: string, administradorId: string, organizacionId: string,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Base de datos no disponible.');
  return actualizarEmailCuenta(pool, usuarioId, email, administradorId, organizacionId);
}
