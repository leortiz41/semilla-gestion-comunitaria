import type { Pool } from 'pg';
import type { DatosPlanificacionActividad } from './planificacion-actividad.domain.js';
import {
  guardarActividadEnRepositorio, existeProyectoEnOrganizacion, consultarSaldoActividad,
} from './proyectos.repository.js';

type Consultable = Pick<Pool, 'query'>;

export type ResultadoPlanificacion =
  | { tipo: 'OK'; actividad: Record<string, unknown> }
  | { tipo: 'NO_ENCONTRADO' }
  | { tipo: 'PRESUPUESTO_INSUFICIENTE' }
  | { tipo: 'RESPONSABLE_INVALIDO' };

/** Orquesta el caso de uso y traduce fallos de persistencia a resultados de negocio. */
export async function guardarPlanificacionActividad(
  pool: Consultable, proyectoId: string, actividadId: string | null,
  organizacionId: string, datos: DatosPlanificacionActividad,
): Promise<ResultadoPlanificacion> {
  const valores = [
    proyectoId, organizacionId, datos.nombre, datos.descripcion,
    datos.estado, datos.fechaInicio, datos.fechaFin, actividadId,
    datos.presupuestoEstimado, datos.responsableAsignadoId, datos.metaCantidad,
    datos.unidadMedida, datos.pesoResultado,
  ];
  const rows = await guardarActividadEnRepositorio(pool, actividadId, valores);
  if (rows.length) return { tipo: 'OK', actividad: rows[0] };
  const existe = await existeProyectoEnOrganizacion(pool, proyectoId, organizacionId);
  if (!existe) return { tipo: 'NO_ENCONTRADO' };
  const saldos = await consultarSaldoActividad(pool, proyectoId, organizacionId, actividadId);
  if (saldos.length && Number(datos.presupuestoEstimado ?? 0) >
      Number(saldos[0].presupuesto) - Number(saldos[0].asignado)) {
    return { tipo: 'PRESUPUESTO_INSUFICIENTE' };
  }
  return { tipo: 'RESPONSABLE_INVALIDO' };
}
