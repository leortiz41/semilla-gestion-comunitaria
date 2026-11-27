import { esUuid } from '../../domain/expediente.js';

export interface DatosBrigada {
  lider: string;
  miembros: number;
  llegada: string | null;
  salida: string | null;
  proyectoIds: string[];
  zonaId: string;
  comunidadIds: string[];
  actividades: string[];
  contrataciones: string[];
  observaciones: string | null;
}

function esFechaValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(valor);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function esListaPlan(valor: unknown): valor is string[] {
  return Array.isArray(valor) && valor.length <= 50 &&
    valor.every((texto) => typeof texto === 'string' && texto.trim().length > 0 && texto.length <= 3000);
}

/** Conserva las reglas de entrada anteriores; no depende de Express ni PostgreSQL. */
export function validarBrigada(valor: unknown): DatosBrigada | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const datos = valor as Record<string, unknown>;
  const { miembros, llegada, salida, proyectoId, zonaId, comunidadIds, actividades, contrataciones } = datos;
  const proyectoIds = datos.proyectoIds ?? (proyectoId ? [proyectoId] : []);
  const lider = typeof datos.lider === 'string' ? datos.lider.trim() : '';
  const observaciones = datos.observaciones ?? '';
  if (!esUuid(zonaId) || !Array.isArray(comunidadIds) ||
      !comunidadIds.every(esUuid) || new Set(comunidadIds).size !== comunidadIds.length ||
      !lider || lider.length > 180 || !Number.isInteger(miembros) ||
      (miembros as number) < 1 || (miembros as number) > 100000 ||
      (llegada && !esFechaValida(llegada)) ||
      (salida && (!esFechaValida(salida) || !llegada || salida < llegada)) ||
      !Array.isArray(proyectoIds) || !proyectoIds.every(esUuid) ||
      new Set(proyectoIds.map((id: string) => id.toLowerCase())).size !== proyectoIds.length ||
      !esListaPlan(actividades) || !esListaPlan(contrataciones) ||
      typeof observaciones !== 'string' || observaciones.length > 3000) return null;

  return {
    lider, miembros: miembros as number,
    llegada: (llegada || null) as string | null,
    salida: (salida || null) as string | null,
    proyectoIds, zonaId: zonaId as string, comunidadIds,
    actividades: actividades.map((texto) => texto.trim()),
    contrataciones: contrataciones.map((texto) => texto.trim()),
    observaciones: observaciones.trim() || null,
  };
}
