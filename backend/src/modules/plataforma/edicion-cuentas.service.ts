import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import {
  editarNombreDesdePlataforma, editarEmailDesdePlataforma, retirarCuentaDesdePlataforma,
} from './edicion-cuentas.repository.js';

type Contexto = { organizacionId: string; usuarioId: string; operadorId: string };

export function cambiarNombreCuentaPlataforma(
  datos: Contexto & { nombreVisible: string }, pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Gestión de plataforma no disponible.');
  return editarNombreDesdePlataforma(pool, datos);
}

export function cambiarEmailCuentaPlataforma(
  datos: Contexto & { email: string }, pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Gestión de plataforma no disponible.');
  return editarEmailDesdePlataforma(pool, datos);
}

export function retirarCuentaPlataforma(
  datos: Contexto, pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Gestión de plataforma no disponible.');
  return retirarCuentaDesdePlataforma(pool, datos);
}
