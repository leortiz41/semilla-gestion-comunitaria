/** Validaciones originales de organizaciones en la plataforma. */
export function prepararNuevaOrganizacion(body: unknown) {
  const datos = body as { nombre?: unknown; slug?: unknown; emailContacto?: unknown } | null;
  const nombre = typeof datos?.nombre === 'string' ? datos.nombre.trim() : '';
  const slug = typeof datos?.slug === 'string' ? datos.slug.trim().toLowerCase() : '';
  const emailContacto = typeof datos?.emailContacto === 'string'
    ? datos.emailContacto.trim().toLowerCase() : null;
  const correoValido = (correo: unknown): correo is string => typeof correo === 'string' &&
    correo.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  if (!nombre || nombre.length > 150 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      slug.length > 80 || (emailContacto && !correoValido(emailContacto))) return null;
  return { nombre, slug, emailContacto };
}

export const esUuidOrganizacion = (valor: unknown): valor is string =>
  typeof valor === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
