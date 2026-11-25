/** Validación de campos conservada de las rutas previas. */
export function camposFamilia(entrada: unknown) {
  const v = entrada && typeof entrada === 'object' && !Array.isArray(entrada)
    ? entrada as Record<string, unknown> : {};
  const texto = (clave: string, limite: number, obligatorio = false): string | null => {
    const valor = v[clave];
    if (valor === null || valor === undefined || valor === '') return obligatorio ? null : '';
    return typeof valor === 'string' && valor.trim().length <= limite ? valor.trim() : null;
  };
  return {
    comunidadId: texto('comunidadId', 36, true),
    nombreReferencia: texto('nombreReferencia', 180, true),
    numeroCasa: texto('numeroCasa', 60),
    direccionReferencia: texto('direccionReferencia', 1200),
  };
}


export type DatosFamilia = ReturnType<typeof camposFamilia>;
