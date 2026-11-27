export function numero(valor: unknown, valorMaximo: number, entero = false): number | null {
  if (valor === null || valor === '' || valor === undefined) return null;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > valorMaximo ||
      (entero && !Number.isInteger(valor))) return null;
  return valor;
}
export function texto(valor: unknown, longitudMaxima: number): string | null {
  return typeof valor === 'string' && valor.trim().length <= longitudMaxima ? valor.trim() || null : null;
}
export function opcion(valor: unknown): boolean | null | undefined {
  if (valor === null || valor === undefined || valor === '') return null;
  return typeof valor === 'boolean' ? valor : undefined;
}

