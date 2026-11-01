export type SeccionAdministrativa =
  | 'dashboard'
  | 'comunidades'
  | 'familias'
  | 'proyectos'
  | 'evidencias'
  | 'pagos'
  | 'usuarios'
  | 'auditoria'
  | 'perfil';

export type SeccionBarraLateral = Exclude<SeccionAdministrativa, 'perfil'>;

export type SubseccionComunidades = 'listado' | 'nueva';
