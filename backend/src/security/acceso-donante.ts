const permisosDonante = new Set(['proyectos.ver', 'evidencias.ver']);

export function limitarAccesoDonante(roles: string[], permisos: string[]) {
  if (!roles.includes('DONANTE') && !roles.includes('CONSULTA')) return { roles, permisos };

  return {
    roles: ['DONANTE'],
    permisos: permisos.filter((permiso) => permisosDonante.has(permiso)),
  };
}
