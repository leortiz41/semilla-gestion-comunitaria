import { ErrorExpediente, esUuid } from './expediente.js';
export interface MetaVision { id: string; descripcion: string }
export function validarMetasVision(metas: unknown, revision: unknown): {metas: MetaVision[]; revision: number} {
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0 || revision >= 2147483647)
    throw new ErrorExpediente('Recarga el área antes de editar sus metas.', 409);
  if (!Array.isArray(metas) || metas.length > 50) throw new ErrorExpediente('Registra hasta 50 metas por área.');
  const limpias = metas.map((m: unknown) => {
    if (!m || typeof m !== 'object') throw new ErrorExpediente('Meta inválida.');
    const v = m as Record<string, unknown>;
    if (!esUuid(v.id) || typeof v.descripcion !== 'string' || !v.descripcion.trim() || v.descripcion.trim().length > 2000)
      throw new ErrorExpediente('Cada meta necesita un identificador válido y una descripción de hasta 2000 caracteres.');
    return {id: v.id as string, descripcion: v.descripcion.trim()};
  });
  if (new Set(limpias.map(m => m.id)).size !== limpias.length || new Set(limpias.map(m => m.descripcion.toLocaleLowerCase('es'))).size !== limpias.length)
    throw new ErrorExpediente('No repitas metas dentro de la misma área.');
  return {metas: limpias, revision};
}
