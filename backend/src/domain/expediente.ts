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
export const esUuid = (identificador: unknown): identificador is string =>
  typeof identificador === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identificador);
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
  const datosExpediente = valor as Record<string, unknown>;
  function texto(campo: string, longitudMaxima: number, obligatorio = false) {
    const valorCampo = datosExpediente[campo];
    if (
      typeof valorCampo !== 'string' ||
      valorCampo.trim().length > longitudMaxima ||
      (obligatorio && !valorCampo.trim())
    )
      throw new ErrorExpediente(`Revisa el campo ${campo}.`);
    return valorCampo.trim();
  }
  function numero(campo: string, minimo: number, maximo: number, entero = false) {
    const valorCampo = datosExpediente[campo];
    if (valorCampo === null) return null;
    if (
      typeof valorCampo !== 'number' ||
      !Number.isFinite(valorCampo) ||
      valorCampo < minimo ||
      valorCampo > maximo ||
      (entero && !Number.isInteger(valorCampo))
    )
      throw new ErrorExpediente(`Revisa el campo ${campo}.`);
    return valorCampo;
  }
  function lista(campo: string) {
    const valorLista = datosExpediente[campo];
    if (
      !Array.isArray(valorLista) ||
      valorLista.length > 50 ||
      valorLista.some((elemento) => typeof elemento !== 'string' || !elemento.trim() || elemento.trim().length > 150)
    )
      throw new ErrorExpediente(`Revisa la lista ${campo}.`);
    const elementosLimpios = valorLista.map((elemento) => (elemento as string).trim());
    if (
      new Set(elementosLimpios.map((elemento) => elemento.toLocaleLowerCase('es'))).size !==
      elementosLimpios.length
    )
      throw new ErrorExpediente(`Hay valores repetidos en ${campo}.`);
    return elementosLimpios;
  }
  if (!esUuid(datosExpediente.zonaId))
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
  if (!Array.isArray(datosExpediente.visiones) || datosExpediente.visiones.length > 4)
    throw new ErrorExpediente('La visión de desarrollo no es válida.');
  const visiones = datosExpediente.visiones.map((vision: unknown) => {
    if (!vision || typeof vision !== 'object')
      throw new ErrorExpediente('Área de desarrollo inválida.');
    const datosVision = vision as Record<string, unknown>;
    if (
      typeof datosVision.categoria !== 'string' ||
      !categorias.includes(datosVision.categoria) ||
      typeof datosVision.prioridad !== 'string' ||
      !['alta', 'media', 'baja'].includes(datosVision.prioridad) ||
      typeof datosVision.situacion !== 'string' ||
      !datosVision.situacion.trim() ||
      datosVision.situacion.length > 3000 ||
      typeof datosVision.meta !== 'string' ||
      !datosVision.meta.trim() ||
      datosVision.meta.length > 3000
    )
      throw new ErrorExpediente(
        'Cada área registrada necesita situación, meta y prioridad válidas.',
      );
    return {
      categoria: datosVision.categoria,
      situacion: datosVision.situacion.trim(),
      meta: datosVision.meta.trim(),
      prioridad: datosVision.prioridad,
    };
  });
  if (new Set(visiones.map((vision) => vision.categoria)).size !== visiones.length)
    throw new ErrorExpediente('No repitas áreas de desarrollo.');
  return {
    nombre: texto('nombre', 150, true),
    zonaId: datosExpediente.zonaId,
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
