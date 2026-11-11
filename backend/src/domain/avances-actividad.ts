import { esFecha } from './fecha.js';
import { esUuid } from './expediente.js';

export interface DatosAvanceActividad {
  porcentajeAvance: number | null;
  cantidadReportada: number | null;
  fecha: string;
  descripcion: string;
  observaciones: string | null;
  claveIdempotencia: string;
}

export function validarAvanceActividad(valor: unknown): DatosAvanceActividad | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;

  const datos = valor as Record<string, unknown>;
  const porcentajeAvance = datos.porcentajeAvance;
  const cantidadReportada = datos.cantidadReportada;
  const fecha = datos.fecha;
  const descripcion = datos.descripcion;
  const observaciones = datos.observaciones;
  const claveIdempotencia = datos.claveIdempotencia;
  const porcentajeValido = typeof porcentajeAvance === 'number' && Number.isFinite(porcentajeAvance) &&
    porcentajeAvance >= 0 && porcentajeAvance <= 100 &&
    /^(?:\d{1,2}|100)(?:\.\d{1,2})?$/.test(String(porcentajeAvance));
  const cantidadValida = typeof cantidadReportada === 'number' && Number.isFinite(cantidadReportada) &&
    cantidadReportada > 0 && /^\d{1,11}(?:\.\d{1,3})?$/.test(String(cantidadReportada));
  const porcentajeInformado = porcentajeAvance !== undefined && porcentajeAvance !== null;
  const cantidadInformada = cantidadReportada !== undefined && cantidadReportada !== null;
  const observacionesValidas = observaciones === undefined || observaciones === null ||
    (typeof observaciones === 'string' && observaciones.trim().length <= 3000);

  if (porcentajeInformado === cantidadInformada ||
      (porcentajeInformado && !porcentajeValido) ||
      (cantidadInformada && !cantidadValida) ||
      !esUuid(claveIdempotencia) || !esFecha(fecha) ||
      typeof descripcion !== 'string' || !descripcion.trim() || descripcion.trim().length > 3000 ||
      !observacionesValidas || (porcentajeValido && !String(observaciones ?? '').trim())) {
    return null;
  }

  return {
    porcentajeAvance: porcentajeValido ? porcentajeAvance : null,
    cantidadReportada: cantidadValida ? cantidadReportada : null,
    fecha,
    descripcion: descripcion.trim(),
    observaciones: typeof observaciones === 'string' && observaciones.trim()
      ? observaciones.trim() : null,
    claveIdempotencia,
  };
}
