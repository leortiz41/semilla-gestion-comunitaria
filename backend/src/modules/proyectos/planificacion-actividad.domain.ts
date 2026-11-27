import { esUuid } from '../../domain/expediente.js';
import { esFecha } from '../../domain/fecha.js';

export const estadosPlanificacionActividad = ['PLANIFICADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'] as const;

export interface DatosPlanificacionActividad {
  nombre: string;
  descripcion: string | null;
  estado: typeof estadosPlanificacionActividad[number];
  fechaInicio: string | null;
  fechaFin: string | null;
  responsableAsignadoId: string | null;
  metaCantidad: number | null;
  unidadMedida: string | null;
  presupuestoEstimado: number | null;
  pesoResultado: number | null;
}

/** Validaciones deterministas independientes de Express y PostgreSQL. */
export function validarPlanificacionActividad(valor: unknown): DatosPlanificacionActividad | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const datos = valor as Record<string, unknown>;
  const { estado, fechaInicio, fechaFin } = datos;
  const responsableAsignadoId = datos.responsableAsignadoId || null;
  const metaCantidad = datos.metaCantidad === '' ? null : datos.metaCantidad ?? null;
  const unidadMedida = typeof datos.unidadMedida === 'string' ? datos.unidadMedida.trim() : '';
  const presupuestoEstimado = datos.presupuestoEstimado === '' ? null : datos.presupuestoEstimado ?? null;
  const pesoResultado = datos.pesoResultado === '' ? null : datos.pesoResultado ?? null;
  const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
  const descripcion = datos.descripcion ?? '';
  const metaValida = metaCantidad === null || (typeof metaCantidad === 'number' &&
    Number.isFinite(metaCantidad) && metaCantidad > 0 &&
    /^\d{1,11}(?:\.\d{1,3})?$/.test(String(metaCantidad)));
  const presupuestoValido = presupuestoEstimado === null || (typeof presupuestoEstimado === 'number' &&
    Number.isFinite(presupuestoEstimado) && presupuestoEstimado >= 0 &&
    /^\d{1,12}(?:\.\d{1,2})?$/.test(String(presupuestoEstimado)));
  const pesoValido = pesoResultado === null || (typeof pesoResultado === 'number' &&
    Number.isFinite(pesoResultado) && pesoResultado >= 0 && pesoResultado <= 100 &&
    /^\d{1,3}(?:\.\d{1,2})?$/.test(String(pesoResultado)));

  if (!nombre || nombre.length > 180 || typeof descripcion !== 'string' || descripcion.length > 3000 ||
      (responsableAsignadoId !== null && !esUuid(responsableAsignadoId)) ||
      !metaValida || (metaCantidad === null) !== !unidadMedida ||
      unidadMedida.length > 80 || !presupuestoValido || !pesoValido ||
      !estadosPlanificacionActividad.some((codigo) => codigo === estado) ||
      (fechaInicio != null && !esFecha(fechaInicio)) ||
      (fechaFin != null && (!esFecha(fechaFin) || (fechaInicio != null && fechaFin < fechaInicio)))) {
    return null;
  }

  return {
    nombre, descripcion: descripcion.trim() || null,
    estado: estado as DatosPlanificacionActividad['estado'],
    fechaInicio: fechaInicio as string | null | undefined ?? null,
    fechaFin: fechaFin as string | null | undefined ?? null,
    responsableAsignadoId: responsableAsignadoId as string | null,
    metaCantidad: metaCantidad as number | null,
    unidadMedida: unidadMedida || null,
    presupuestoEstimado: presupuestoEstimado as number | null,
    pesoResultado: pesoResultado as number | null,
  };
}
