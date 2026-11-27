import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { insertarOrganizacion, actualizarEstadoOrganizacion, type NuevaOrganizacion } from './organizaciones.repository.js';

export function crearOrganizacion(
  datos: NuevaOrganizacion, administradorId: string, pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Gestión de plataforma no disponible.');
  return insertarOrganizacion(pool, datos, administradorId);
}

export function cambiarEstadoOrganizacion(
  organizacionId: string, activo: boolean, administradorId: string,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Gestión de plataforma no disponible.');
  return actualizarEstadoOrganizacion(pool, organizacionId, activo, administradorId);
}
