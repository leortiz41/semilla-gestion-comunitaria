import { randomBytes } from 'node:crypto';
import { hashPassword } from '../../security/password.js';
import type { Pool } from 'pg';
import {
  insertarCuentaDonante, asignarProyectoDonante,
  cambiarVisibilidadEvidenciaDonante, consultarFichasDonantes,
} from './accesos-donantes.repository.js';

type Consultable = Pick<Pool, 'query'>;

export function validarCorreoCuentaDonante(valor: unknown): string | null {
  const email = typeof valor === 'string' ? valor.trim().toLowerCase() : '';
  return email.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** Genera las credenciales temporales manteniendo el contrato anterior. */
export async function crearCuentaDonante(
  pool: Consultable, email: string, adminUsuarioId: string, organizacionId: string,
) {
  const contrasenaTemporal = 'Aa1-' + randomBytes(18).toString('base64url');
  const hash = await hashPassword(contrasenaTemporal);
  const donante = await insertarCuentaDonante(pool, email, hash, adminUsuarioId, organizacionId);
  return donante ? { donante, contrasenaTemporal } : null;
}

export function guardarAsignacionProyecto(
  pool: Consultable, proyectoId: string, donanteId: string, organizacionId: string, asignado: boolean,
) {
  return asignarProyectoDonante(pool, proyectoId, donanteId, organizacionId, asignado);
}

export function publicarEvidenciaDonante(
  pool: Consultable, proyectoId: string, evidenciaId: string, organizacionId: string, compartida: boolean,
) {
  return cambiarVisibilidadEvidenciaDonante(pool, proyectoId, evidenciaId, organizacionId, compartida);
}

export function listarFichasDonantes(pool: Consultable, organizacionId: string) {
  return consultarFichasDonantes(pool, organizacionId);
}
