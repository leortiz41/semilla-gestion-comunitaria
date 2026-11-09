import { esFecha } from './fecha.js';

export interface DatosAvanceActividad {
  porcentajeAvance: number;
  fecha: string;
  descripcion: string;
}

export function validarAvanceActividad(valor: unknown): DatosAvanceActividad | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;

  const datos = valor as Record<string, unknown>;
  const porcentajeAvance = datos.porcentajeAvance;
  const fecha = datos.fecha;
  const descripcion = datos.descripcion;

  if (typeof porcentajeAvance !== 'number' || !Number.isFinite(porcentajeAvance) ||
      porcentajeAvance < 0 || porcentajeAvance > 100 ||
      !/^(?:\d{1,2}|100)(?:\.\d{1,2})?$/.test(String(porcentajeAvance)) ||
      !esFecha(fecha) || typeof descripcion !== 'string' ||
      !descripcion.trim() || descripcion.trim().length > 3000) {
    return null;
  }

  return { porcentajeAvance, fecha, descripcion: descripcion.trim() };
}
