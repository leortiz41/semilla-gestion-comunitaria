import { ErrorExpediente, esUuid } from './expediente.js';
export const areasNecesidad = [
  'EVANGELISMO',
  'EDUCACION_FORMAL',
  'EDUCACION_COMUNITARIA',
  'INFRAESTRUCTURA',
] as const;
export interface DatosNecesidad {
  id: string;
  area: (typeof areasNecesidad)[number];
  metaId: string | null;
  titulo: string;
  descripcion: string;
  situacionInicial: string;
  poblacionAfectada: string | null;
  cantidadAfectada: number | null;
  resultadoEsperado: string;
  unidadMedida: string | null;
  cantidadObjetivo: number | null;
  prioridad: 'POR_EVALUAR' | 'ALTA' | 'MEDIA' | 'BAJA';
  motivoPrioridad: string;
}
export function validarNecesidad(body: unknown): DatosNecesidad {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ErrorExpediente('Datos de necesidad inválidos.');
  const d = body as Record<string, unknown>;
  if (
    !esUuid(d.id) ||
    !areasNecesidad.includes(d.area as DatosNecesidad['area'])
  )
    throw new ErrorExpediente('Identificador o área inválidos.');
  if (d.metaId !== null && !esUuid(d.metaId))
    throw new ErrorExpediente('Meta de origen inválida.');
  function texto(k: string, max: number, requerido = true): string | null {
    const v = d[k];
    if (!requerido && (v === null || v === '')) return null;
    if (
      typeof v !== 'string' ||
      v.trim().length > max ||
      (requerido && !v.trim())
    )
      throw new ErrorExpediente(`Revisa ${k}: máximo ${max} caracteres.`);
    return v.trim() || null;
  }
  function numero(k: string, max: number, entero: boolean): number | null {
    const v = d[k];
    if (v === null) return null;
    if (
      typeof v !== 'number' ||
      !Number.isFinite(v) ||
      v < 0 ||
      v > max ||
      (entero && !Number.isInteger(v))
    )
      throw new ErrorExpediente(`Cantidad inválida en ${k}.`);
    return v;
  }
  const cantidadAfectada = numero('cantidadAfectada', 2147483647, true);
  const cantidadObjetivo = numero('cantidadObjetivo', 999999999999.99, false);
  const unidadMedida = texto('unidadMedida', 80, false);
  if (
    (cantidadObjetivo === null) !== (unidadMedida === null) ||
    (cantidadObjetivo !== null &&
      (cantidadObjetivo <= 0 ||
        Math.abs(cantidadObjetivo * 100 - Math.round(cantidadObjetivo * 100)) >
          0.001))
  )
    throw new ErrorExpediente(
      'Indica una cantidad objetivo positiva con hasta dos decimales y su unidad, o deja ambas vacías.',
    );
  if (!['POR_EVALUAR', 'ALTA', 'MEDIA', 'BAJA'].includes(d.prioridad as string))
    throw new ErrorExpediente('Prioridad inválida.');
  if (d.estado !== undefined)
    throw new ErrorExpediente(
      'El estado inicial se asigna al registrar la necesidad.',
    );
  return {
    id: d.id,
    area: d.area as DatosNecesidad['area'],
    metaId: d.metaId as string | null,
    titulo: texto('titulo', 180)!,
    descripcion: texto('descripcion', 3000)!,
    situacionInicial: texto('situacionInicial', 3000)!,
    poblacionAfectada: texto('poblacionAfectada', 2000, false),
    cantidadAfectada,
    resultadoEsperado: texto('resultadoEsperado', 3000)!,
    unidadMedida,
    cantidadObjetivo,
    prioridad: d.prioridad as DatosNecesidad['prioridad'],
    motivoPrioridad: texto('motivoPrioridad', 2000)!,
  };
}
