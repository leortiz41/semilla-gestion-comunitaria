import type { Pool } from 'pg';
import {
  consultarAdministracionDonantes, insertarFichaDonante, cambiarEstadoDonante,
} from './administracion-donantes.repository.js';

type Consultable = Pick<Pool, 'query'>;

export function listarAccesosDonantes(pool: Consultable, organizacionId: string) {
  return consultarAdministracionDonantes(pool, organizacionId);
}

export interface DatosFichaDonante { nombre: string; correo: string; telefono: string | null }

export function validarFichaDonante(entrada: unknown): DatosFichaDonante | null {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return null;
  const datos = entrada as Record<string, unknown>;
  const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
  const correo = typeof datos.correo === 'string' ? datos.correo.trim().toLowerCase() : '';
  const telefono = typeof datos.telefono === 'string' ? datos.telefono.trim() : '';
  if (!nombre || nombre.length > 180 || correo.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || telefono.length > 50) return null;
  return { nombre, correo, telefono: telefono || null };
}

export function crearFichaDonante(pool: Consultable, organizacionId: string, datos: DatosFichaDonante) {
  return insertarFichaDonante(pool, organizacionId, datos);
}

export function actualizarEstadoDonante(
  pool: Consultable, organizacionId: string, fichaId: string,
  brigadaId: string | null, activo: boolean,
) {
  return cambiarEstadoDonante(pool, organizacionId, fichaId, brigadaId, activo);
}
