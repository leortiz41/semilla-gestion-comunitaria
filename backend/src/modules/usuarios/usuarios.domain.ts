/** Reglas históricas de cuentas. Los roles de plataforma no son asignables. */
const perfilesAsignables = ['ADMINISTRADOR', 'COORDINADOR', 'CAMPO', 'FINANZAS', 'DONANTE'];
export const validarRoles = (valor: unknown): string[] | null => {
  if (!Array.isArray(valor) || !valor.length || valor.length > perfilesAsignables.length ||
      !valor.every((rol) => typeof rol === 'string' && perfilesAsignables.includes(rol)) ||
      new Set(valor).size !== valor.length || (valor.includes('DONANTE') && valor.length !== 1)) return null;
  return valor as string[];
};
export const validarEmail = (valor: unknown) => typeof valor === 'string' &&
  valor.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
export const normalizarNombre = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
export const validarNombre = (valor: string): boolean =>
  valor.length >= 2 && valor.length <= 100 && !/[\x00-\x1f\x7f]/.test(valor);

