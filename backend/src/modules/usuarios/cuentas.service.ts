import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { hashPassword } from '../../security/password.js';
import { insertarCuentaOrganizacion, verificarAdministradorActual } from './cuentas.repository.js';

export class AdministradorInactivoError extends Error {
  constructor() { super('ADMINISTRADOR_INACTIVO'); }
}

/** Genera la credencial temporal únicamente después de validar al administrador. */
export async function crearCuentaOrganizacion(
  datos: { email: string; roles: string[]; nombreVisible: string },
  administradorId: string, organizacionId: string,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Base de datos no disponible.');
  if (!await verificarAdministradorActual(pool, administradorId, organizacionId)) {
    throw new AdministradorInactivoError();
  }
  const contrasenaTemporal = 'Aa1-' + randomBytes(18).toString('base64url');
  const hash = await hashPassword(contrasenaTemporal);
  const cuenta = await insertarCuentaOrganizacion(pool, {
    ...datos, hash, organizacionId, administradorId,
  });
  return { cuenta, contrasenaTemporal };
}
