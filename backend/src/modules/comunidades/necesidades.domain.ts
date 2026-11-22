import { ErrorExpediente, esUuid } from '../../domain/expediente.js';
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
export function validarNecesidad(entradaNecesidad: unknown): DatosNecesidad {
  if (!entradaNecesidad || typeof entradaNecesidad !== 'object' || Array.isArray(entradaNecesidad))
    throw new ErrorExpediente('Datos de necesidad inválidos.');
  const datosNecesidad = entradaNecesidad as Record<string, unknown>;
  if (
    !esUuid(datosNecesidad.id) ||
    !areasNecesidad.includes(datosNecesidad.area as DatosNecesidad['area'])
  )
    throw new ErrorExpediente('Identificador o área inválidos.');
  if (datosNecesidad.metaId !== null && !esUuid(datosNecesidad.metaId))
    throw new ErrorExpediente('Meta de origen inválida.');
  function texto(nombreCampo: string, limiteMaximo: number, requerido = true): string | null {
    const valorCampo = datosNecesidad[nombreCampo];
    if (!requerido && (valorCampo === null || valorCampo === '')) return null;
    if (
      typeof valorCampo !== 'string' ||
      valorCampo.trim().length > limiteMaximo ||
      (requerido && !valorCampo.trim())
    )
      throw new ErrorExpediente(`Revisa ${nombreCampo}: máximo ${limiteMaximo} caracteres.`);
    return valorCampo.trim() || null;
  }
  function numero(nombreCampo: string, limiteMaximo: number, entero: boolean): number | null {
    const valorCampo = datosNecesidad[nombreCampo];
    if (valorCampo === null) return null;
    if (
      typeof valorCampo !== 'number' ||
      !Number.isFinite(valorCampo) ||
      valorCampo < 0 ||
      valorCampo > limiteMaximo ||
      (entero && !Number.isInteger(valorCampo))
    )
      throw new ErrorExpediente(`Cantidad inválida en ${nombreCampo}.`);
    return valorCampo;
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
  if (!['POR_EVALUAR', 'ALTA', 'MEDIA', 'BAJA'].includes(datosNecesidad.prioridad as string))
    throw new ErrorExpediente('Prioridad inválida.');
  if (datosNecesidad.estado !== undefined)
    throw new ErrorExpediente(
      'El estado inicial se asigna al registrar la necesidad.',
    );
  return {
    id: datosNecesidad.id,
    area: datosNecesidad.area as DatosNecesidad['area'],
    metaId: datosNecesidad.metaId as string | null,
    titulo: texto('titulo', 180)!,
    descripcion: texto('descripcion', 3000)!,
    situacionInicial: texto('situacionInicial', 3000)!,
    poblacionAfectada: texto('poblacionAfectada', 2000, false),
    cantidadAfectada,
    resultadoEsperado: texto('resultadoEsperado', 3000)!,
    unidadMedida,
    cantidadObjetivo,
    prioridad: datosNecesidad.prioridad as DatosNecesidad['prioridad'],
    motivoPrioridad: texto('motivoPrioridad', 2000)!,
  };
}
