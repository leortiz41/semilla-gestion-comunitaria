export interface VisionComunidad {
  categoria: string;
  situacion: string;
  meta: string;
  prioridad: string;
}
export interface ExpedienteComunidad {
  nombre: string;
  zonaId: string;
  municipio: string;
  departamento: string;
  latitud: number | null;
  longitud: number | null;
  poblacion: number | null;
  viviendas: number | null;
  viviendasIntervencion: number | null;
  tiposVivienda: string[];
  visiones: VisionComunidad[];
  organizaciones: string[];
  actividadesProductivas: string[];
  productosServicios: string[];
  observacionesOrganizaciones: string;
  potencialProductivo: string;
}
export const esUuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export class ErrorExpediente extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function validarExpediente(valor: unknown): ExpedienteComunidad {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor))
    throw new ErrorExpediente('El expediente no es válido.');
  const d = valor as Record<string, unknown>;
  function texto(campo: string, max: number, obligatorio = false) {
    const v = d[campo];
    if (
      typeof v !== 'string' ||
      v.trim().length > max ||
      (obligatorio && !v.trim())
    )
      throw new ErrorExpediente(`Revisa el campo ${campo}.`);
    return v.trim();
  }
  function numero(campo: string, min: number, max: number, entero = false) {
    const v = d[campo];
    if (v === null) return null;
    if (
      typeof v !== 'number' ||
      !Number.isFinite(v) ||
      v < min ||
      v > max ||
      (entero && !Number.isInteger(v))
    )
      throw new ErrorExpediente(`Revisa el campo ${campo}.`);
    return v;
  }
  function lista(campo: string) {
    const v = d[campo];
    if (
      !Array.isArray(v) ||
      v.length > 50 ||
      v.some((x) => typeof x !== 'string' || !x.trim() || x.trim().length > 150)
    )
      throw new ErrorExpediente(`Revisa la lista ${campo}.`);
    const limpio = v.map((x) => (x as string).trim());
    if (
      new Set(limpio.map((x) => x.toLocaleLowerCase('es'))).size !==
      limpio.length
    )
      throw new ErrorExpediente(`Hay valores repetidos en ${campo}.`);
    return limpio;
  }
  if (!esUuid(d.zonaId))
    throw new ErrorExpediente('Selecciona una zona válida.');
  const latitud = numero('latitud', -90, 90),
    longitud = numero('longitud', -180, 180);
  if ((latitud === null) !== (longitud === null))
    throw new ErrorExpediente(
      'Registra ambas coordenadas o deja ambas vacías.',
    );
  const poblacion = numero('poblacion', 0, 2147483647, true),
    viviendas = numero('viviendas', 0, 2147483647, true),
    viviendasIntervencion = numero(
      'viviendasIntervencion',
      0,
      2147483647,
      true,
    );
  if (
    viviendasIntervencion !== null &&
    (viviendas === null || viviendasIntervencion > viviendas)
  )
    throw new ErrorExpediente(
      'Las viviendas por intervenir no pueden superar el total registrado.',
    );
  const categorias = [
    'Evangelismo',
    'Educación formal',
    'Educación comunitaria',
    'Infraestructura',
  ];
  if (!Array.isArray(d.visiones) || d.visiones.length > 4)
    throw new ErrorExpediente('La visión de desarrollo no es válida.');
  const visiones = d.visiones.map((v: unknown) => {
    if (!v || typeof v !== 'object')
      throw new ErrorExpediente('Área de desarrollo inválida.');
    const x = v as Record<string, unknown>;
    if (
      typeof x.categoria !== 'string' ||
      !categorias.includes(x.categoria) ||
      typeof x.prioridad !== 'string' ||
      !['alta', 'media', 'baja'].includes(x.prioridad) ||
      typeof x.situacion !== 'string' ||
      !x.situacion.trim() ||
      x.situacion.length > 3000 ||
      typeof x.meta !== 'string' ||
      !x.meta.trim() ||
      x.meta.length > 3000
    )
      throw new ErrorExpediente(
        'Cada área registrada necesita situación, meta y prioridad válidas.',
      );
    return {
      categoria: x.categoria,
      situacion: x.situacion.trim(),
      meta: x.meta.trim(),
      prioridad: x.prioridad,
    };
  });
  if (new Set(visiones.map((x) => x.categoria)).size !== visiones.length)
    throw new ErrorExpediente('No repitas áreas de desarrollo.');
  return {
    nombre: texto('nombre', 150, true),
    zonaId: d.zonaId,
    municipio: texto('municipio', 120, true),
    departamento: texto('departamento', 120, true),
    latitud,
    longitud,
    poblacion,
    viviendas,
    viviendasIntervencion,
    visiones,
    tiposVivienda: lista('tiposVivienda'),
    organizaciones: lista('organizaciones'),
    actividadesProductivas: lista('actividadesProductivas'),
    productosServicios: lista('productosServicios'),
    observacionesOrganizaciones: texto('observacionesOrganizaciones', 3000),
    potencialProductivo: texto('potencialProductivo', 3000),
  };
}
