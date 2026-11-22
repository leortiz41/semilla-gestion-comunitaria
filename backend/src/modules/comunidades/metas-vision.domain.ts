import { ErrorExpediente, esUuid } from '../../domain/expediente.js';
export interface MetaVision { id: string; descripcion: string }
export function validarMetasVision(metas: unknown, revision: unknown): {metas: MetaVision[]; revision: number} {
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0 || revision >= 2147483647)
    throw new ErrorExpediente('Recarga el área antes de editar sus metas.', 409);
  if (!Array.isArray(metas) || metas.length > 50) throw new ErrorExpediente('Registra hasta 50 metas por área.');
  const metasValidadas = metas.map((meta: unknown) => {
    if (!meta || typeof meta !== 'object') throw new ErrorExpediente('Meta inválida.');
    const datosMeta = meta as Record<string, unknown>;
    if (!esUuid(datosMeta.id) || typeof datosMeta.descripcion !== 'string' || !datosMeta.descripcion.trim() || datosMeta.descripcion.trim().length > 2000)
      throw new ErrorExpediente('Cada meta necesita un identificador válido y una descripción de hasta 2000 caracteres.');
    return {id: datosMeta.id as string, descripcion: datosMeta.descripcion.trim()};
  });
  if (new Set(metasValidadas.map(meta => meta.id)).size !== metasValidadas.length || new Set(metasValidadas.map(meta => meta.descripcion.toLocaleLowerCase('es'))).size !== metasValidadas.length)
    throw new ErrorExpediente('No repitas metas dentro de la misma área.');
  return {metas: metasValidadas, revision};
}
