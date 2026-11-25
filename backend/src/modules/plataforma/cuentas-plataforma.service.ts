import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { hashPassword } from '../../security/password.js';
import {
  consultarCuentasPlataforma, insertarCuentaPlataforma, cambiarEstadoCuentaPlataforma,
} from './cuentas-plataforma.repository.js';

function poolDisponible(pool: Pool | null): Pool {
  if (!pool) throw new Error('Gestión de plataforma no disponible.');
  return pool;
}

export function listarCuentasPlataforma(
  organizacionId: string, pool: Pool | null = databasePool,
) {
  return consultarCuentasPlataforma(poolDisponible(pool), organizacionId);
}

export async function crearCuentaPlataforma(
  datos: {organizacionId:string;email:string;nombreVisible:string;roles:string[]},
  operadorId: string, pool: Pool | null = databasePool,
) {
  const temporal='Aa1-'+randomBytes(18).toString('base64url');
  const hash=await hashPassword(temporal);
  const resultado=await insertarCuentaPlataforma(poolDisponible(pool),{...datos,hash,operadorId});
  return resultado.estado==='CREADA'
    ? {...resultado,contrasenaTemporal:temporal}
    : resultado;
}

export function actualizarEstadoCuentaPlataforma(
  datos: {organizacionId:string;usuarioId:string;activo:boolean;operadorId:string},
  pool: Pool | null = databasePool,
) {
  return cambiarEstadoCuentaPlataforma(poolDisponible(pool),datos);
}
