export type SeccionAdministrativa =
  | 'dashboard'
  | 'comunidades'
  | 'familias'
  | 'proyectos'
  | 'mapa-impacto'
  | 'evidencias'
  | 'pagos'
  | 'donantes'
  | 'usuarios'
  | 'plataforma'
  | 'auditoria'
  | 'perfil';

export type SeccionBarraLateral = Exclude<SeccionAdministrativa, 'perfil'>;

export type SubseccionComunidades = 'listado' | 'nueva' | 'zonas';
