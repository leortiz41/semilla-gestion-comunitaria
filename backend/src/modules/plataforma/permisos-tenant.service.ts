import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { consultarMatrizAccesos, actualizarRestriccionesUsuario, actualizarRestriccionesRol } from './permisos-tenant.repository.js';

function conexion(pool: Pool | null): Pool {
  if (!pool) throw new Error('Gestión de plataforma no disponible.');
  return pool;
}

export function obtenerMatrizTenant(organizacionId:string, pool:Pool | null = databasePool) {
  return consultarMatrizAccesos(conexion(pool), organizacionId);
}

export function guardarRestriccionesUsuario(
  datos:{organizacionId:string;usuarioId:string;permisos:string[];operadorId:string},
  pool:Pool | null = databasePool,
) {
  return actualizarRestriccionesUsuario(conexion(pool),datos);
}

export function guardarRestriccionesRol(
  datos:{organizacionId:string;nombre:string;permisos:string[];operadorId:string},
  pool:Pool | null = databasePool,
) {
  return actualizarRestriccionesRol(conexion(pool),datos);
}
