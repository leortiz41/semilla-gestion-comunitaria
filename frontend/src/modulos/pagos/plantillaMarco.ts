import type { JSONContent } from '@tiptap/core';

const titulo = (texto: string, nivel = 2): JSONContent => ({
  type: 'heading', attrs: { level: nivel }, content: [{ type: 'text', text: texto }],
});
const parrafo = (texto: string): JSONContent => ({
  type: 'paragraph', content: [{ type: 'text', text: texto }],
});

/**
 * Estructura editable basada en el documento de ejemplo suministrado.
 * No incluye nombres ni números de identidad reales. Requiere revisión jurídica.
 */
export const plantillaMarco: JSONContent = {
  type: 'doc',
  content: [
    titulo('CONTRATO DE PRESTACIÓN DE SERVICIOS', 1),
    parrafo('Entre {{organizacion.nombre}}, con domicilio en {{organizacion.domicilio}}, representada por {{representante.nombre}}, en adelante EL CONTRATANTE, y {{contratista.nombre}}, con domicilio en {{contratista.domicilio}}, en adelante EL CONTRATISTA, se acuerda el presente contrato sujeto a las siguientes cláusulas.'),
    titulo('PRIMERA. OBJETO'),
    parrafo('EL CONTRATISTA se compromete a realizar las siguientes actividades: {{contrato.objeto}}, en el proyecto {{proyecto.nombre}}, conforme a las condiciones pactadas por las partes.'),
    titulo('SEGUNDA. DURACIÓN O PLAZO'),
    parrafo('La ejecución tendrá una duración de {{contrato.duracion}} días a partir del {{contrato.fechaInicio}}. Cualquier prórroga requerirá acuerdo escrito.'),
    titulo('TERCERA. PRECIO'),
    parrafo('El valor total del contrato será de {{contrato.monto}}.'),
    titulo('CUARTA. FORMA DE PAGO'),
    parrafo('{{contrato.formaPago}}. Las solicitudes y autorizaciones de desembolso se registrarán por separado en el sistema.'),
    titulo('QUINTA. OBLIGACIONES'),
    parrafo('EL CONTRATANTE facilitará el acceso y la información necesaria para la ejecución del servicio. EL CONTRATISTA cumplirá las actividades conforme al alcance, calidad y plazo acordados.'),
    titulo('SEXTA. SUPERVISIÓN'),
    parrafo('EL CONTRATANTE, directamente o por su representante autorizado, podrá supervisar la ejecución del servicio y comunicar observaciones al CONTRATISTA.'),
    titulo('SÉPTIMA. TERMINACIÓN'),
    parrafo('La terminación del contrato y las consecuencias de su incumplimiento se regirán por las condiciones pactadas y la normativa aplicable.'),
    titulo('OCTAVA. INDEPENDENCIA'),
    parrafo('Las partes deberán revisar la naturaleza jurídica de la relación y asegurar que esta cláusula refleje la prestación efectiva del servicio y las leyes aplicables.'),
    titulo('NOVENA. CESIÓN'),
    parrafo('EL CONTRATISTA no podrá ceder la ejecución del servicio a terceros sin autorización previa y escrita del CONTRATANTE.'),
    titulo('DÉCIMA. DOMICILIO'),
    parrafo('Para los efectos del presente contrato, las partes fijan como domicilio contractual {{contrato.lugarFirma}}.'),
    parrafo('Firmado en {{contrato.lugarFirma}}, el {{contrato.fechaFirma}}.'),
    parrafo('________________________                     ________________________'),
    parrafo('{{representante.nombre}}                     {{contratista.nombre}}'),
    parrafo('CONTRATANTE                                      CONTRATISTA'),
    parrafo('________________________                     ________________________'),
    parrafo('TESTIGO 1                                          TESTIGO 2'),
  ],
};

export const variablesContrato = [
  { clave: 'organizacion.nombre', etiqueta: 'Organización contratante' },
  { clave: 'organizacion.domicilio', etiqueta: 'Domicilio institucional' },
  { clave: 'representante.nombre', etiqueta: 'Representante legal' },
  { clave: 'contratista.nombre', etiqueta: 'Nombre del contratista' },
  { clave: 'contratista.domicilio', etiqueta: 'Domicilio del contratista' },
  { clave: 'proyecto.nombre', etiqueta: 'Proyecto' },
  { clave: 'contrato.objeto', etiqueta: 'Objeto del contrato' },
  { clave: 'contrato.duracion', etiqueta: 'Duración en días' },
  { clave: 'contrato.fechaInicio', etiqueta: 'Fecha de inicio' },
  { clave: 'contrato.monto', etiqueta: 'Precio pactado (L)' },
  { clave: 'contrato.formaPago', etiqueta: 'Forma y condiciones de pago' },
  { clave: 'contrato.lugarFirma', etiqueta: 'Lugar de firma' },
  { clave: 'contrato.fechaFirma', etiqueta: 'Fecha de firma' },
] as const;

export function completarPlantilla(contenido: JSONContent, valores: Record<string,string>): JSONContent {
  const recorrer = (nodo: JSONContent): JSONContent => ({
    ...nodo,
    text: nodo.text?.replace(/\{\{([\w.]+)\}\}/g, (token, clave: string) => valores[clave] || token),
    content: nodo.content?.map(recorrer),
  });
  return recorrer(contenido);
}
