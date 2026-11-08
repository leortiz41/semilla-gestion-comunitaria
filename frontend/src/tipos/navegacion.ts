export type SeccionAdministrativa =
  | 'dashboard'
  | 'comunidades'
  | 'familias'
  | 'proyectos'
  | 'evidencias'
  | 'pagos'
  | 'donantes'
  | 'usuarios'
  | 'auditoria'
  | 'perfil';

export type SeccionBarraLateral = Exclude<SeccionAdministrativa, 'perfil'>;

export type SubseccionComunidades = 'listado' | 'nueva' | 'zonas';
