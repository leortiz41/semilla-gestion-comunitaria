const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface OrganizacionSesion {
  id: string;
  nombre: string;
  slug: string;
}

export interface UsuarioSesion {
  id: string;
  email: string;
  nombre: string | null;
  organizacion: OrganizacionSesion;
  roles: string[];
  permisos: string[];
  debeCambiarContrasena: boolean;
}

export interface SesionResponse {
  accessToken: string;
  expiresIn: number;
  usuario: UsuarioSesion;
}

export interface ZonaResumen {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface ComunidadResumen {
  id: string;
  zonaId: string | null;
  nombre: string;
  barrioColonia: string | null;
  localidad: string | null;
  municipio: string;
  departamento: string;
  activo: boolean;
  nombreZona: string | null;
  zonaActiva: boolean | null;
}

export interface DiagnosticoPoblacionVivienda {
  poblacionAproximada: number | null;
  viviendasAproximadas: number | null;
  viviendasIntervencion: number | null;
  tiposVivienda: string | null;
}

export type AreaVisionDesarrollo =
  | 'EVANGELISMO'
  | 'EDUCACION_FORMAL'
  | 'EDUCACION_COMUNITARIA'
  | 'INFRAESTRUCTURA';

export interface VisionDesarrolloComunitaria {
  area: AreaVisionDesarrollo;
  situacionActual: string | null;
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA' | null;
  metaDesarrollo: string | null;
  metas: {id: string; descripcion: string}[];
  revision: number;
}

interface ApiErrorResponse {
  message?: string;
}

async function parseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return new Error(body.message || `Solicitud fallida (${response.status})`);
  } catch {
    return new Error(`Solicitud fallida (${response.status})`);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function iniciarSesion(email: string, password: string): Promise<SesionResponse> {
  return request<SesionResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function renovarSesion(): Promise<SesionResponse> {
  return request<SesionResponse>('/auth/refresh', {
    method: 'POST',
  });
}

export function obtenerUsuario(accessToken: string): Promise<{ usuario: UsuarioSesion }> {
  return request<{ usuario: UsuarioSesion }>('/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function listarZonas(accessToken: string): Promise<{ zonas: ZonaResumen[] }> {
  return request<{ zonas: ZonaResumen[] }>('/zonas', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function crearZona(
  accessToken: string,
  datos: { nombre: string; descripcion?: string | null },
): Promise<{ zona: ZonaResumen }> {
  return request<{ zona: ZonaResumen }>('/zonas', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(datos),
  });
}

export function editarZona(
  accessToken: string,
  zonaId: string,
  datos: { nombre: string; descripcion?: string | null },
): Promise<{ zona: ZonaResumen }> {
  return request<{ zona: ZonaResumen }>(`/zonas/${zonaId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(datos),
  });
}

export function cambiarEstadoZona(
  accessToken: string,
  zonaId: string,
  activo: boolean,
): Promise<{ zona: ZonaResumen }> {
  return request<{ zona: ZonaResumen }>(`/zonas/${zonaId}/estado`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ activo }),
  });
}

export function listarComunidades(accessToken: string): Promise<{ comunidades: ComunidadResumen[] }> {
  return request<{ comunidades: ComunidadResumen[] }>('/comunidades', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function crearComunidad(
  accessToken: string,
  datos: {
    nombre: string;
    zonaId: string;
    municipio: string;
    departamento: string;
  },
): Promise<{ comunidad: ComunidadResumen }> {
  return request<{ comunidad: ComunidadResumen }>('/comunidades', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(datos),
  });
}

export function editarComunidad(
  accessToken: string,
  comunidadId: string,
  datos: {
    nombre: string;
    zonaId: string;
    municipio: string;
    departamento: string;
  },
): Promise<{ comunidad: ComunidadResumen }> {
  return request<{ comunidad: ComunidadResumen }>(`/comunidades/${comunidadId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(datos),
  });
}

export function cambiarEstadoComunidad(
  accessToken: string,
  comunidadId: string,
  activo: boolean,
): Promise<{ comunidad: ComunidadResumen }> {
  return request<{ comunidad: ComunidadResumen }>(`/comunidades/${comunidadId}/estado`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ activo }),
  });
}

export function obtenerDiagnosticoPoblacionVivienda(
  accessToken: string,
  comunidadId: string,
): Promise<{ diagnostico: DiagnosticoPoblacionVivienda | null }> {
  return request<{ diagnostico: DiagnosticoPoblacionVivienda | null }>(
    `/comunidades/${comunidadId}/expediente/poblacion-vivienda`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export function guardarDiagnosticoPoblacionVivienda(
  accessToken: string,
  comunidadId: string,
  datos: DiagnosticoPoblacionVivienda,
): Promise<{ diagnostico: DiagnosticoPoblacionVivienda }> {
  return request<{ diagnostico: DiagnosticoPoblacionVivienda }>(
    `/comunidades/${comunidadId}/expediente/poblacion-vivienda`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(datos),
    },
  );
}

export function obtenerVisionesDesarrollo(
  accessToken: string,
  comunidadId: string,
): Promise<{ visiones: VisionDesarrolloComunitaria[] }> {
  return request<{ visiones: VisionDesarrolloComunitaria[] }>(
    `/comunidades/${comunidadId}/expediente/vision-desarrollo`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export function guardarVisionDesarrollo(
  accessToken: string,
  comunidadId: string,
  area: AreaVisionDesarrollo,
  datos: Omit<VisionDesarrolloComunitaria, 'area'>,
): Promise<{ vision: VisionDesarrolloComunitaria }> {
  return request<{ vision: VisionDesarrolloComunitaria }>(
    `/comunidades/${comunidadId}/expediente/vision-desarrollo/${area}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(datos),
    },
  );
}

export function cambiarContrasena(
  accessToken: string,
  contrasenaActual: string,
  contrasenaNueva: string,
): Promise<void> {
  return request<void>('/auth/cambiar-contrasena', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ contrasenaActual, contrasenaNueva }),
  });
}

export function cerrarSesion(): Promise<void> {
  return request<void>('/auth/logout', {
    method: 'POST',
  });
}

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

export function crearExpediente(token: string, datos: ExpedienteComunidad) {
  return request<{ comunidad: { id: string } }>('/comunidades/expedientes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
}
export function consultarExpediente(token: string, id: string) {
  return request<{
    expediente: ExpedienteComunidad & {
      id: string;
      fechaDiagnostico: string | null;
      diagnosticoId: string | null;
    };
  }>(`/comunidades/${id}/expediente`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function actualizarDiagnostico(
  token: string,
  id: string,
  datos: ExpedienteComunidad,
  diagnosticoAnteriorId: string | null,
) {
  return request<{ comunidad: { id: string } }>(
    `/comunidades/${id}/diagnostico`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...datos, diagnosticoAnteriorId }),
    },
  );
}

export interface CapacidadesComunidad {
 revision:number; organizaciones:string[]; actividadesProductivas:string[]; productosServicios:string[]; observacionesOrganizaciones:string; potencialProductivo:string;
}
export function obtenerCapacidades(token:string,id:string) {return request<{capacidades:CapacidadesComunidad}>(`/comunidades/${id}/expediente/capacidades`,{headers:{Authorization:`Bearer ${token}`}});}
export function guardarCapacidades(token:string,id:string,datos:CapacidadesComunidad) {return request<{capacidades:CapacidadesComunidad}>(`/comunidades/${id}/expediente/capacidades`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(datos)});}

export interface DatosNecesidad {
 id: string; area: AreaVisionDesarrollo; metaId: string|null;
 titulo: string; descripcion: string; situacionInicial: string;
 poblacionAfectada: string|null; cantidadAfectada: number|null;
 resultadoEsperado: string; unidadMedida: string|null; cantidadObjetivo: number|null;
 prioridad: 'POR_EVALUAR'|'ALTA'|'MEDIA'|'BAJA'; motivoPrioridad: string;
}
export interface NecesidadComunitaria extends DatosNecesidad {
 estado: string; creadoEn: string; metaDescripcion: string|null; metaActiva: boolean|null;
}
export function obtenerNecesidades(token:string,id:string) { return request<{necesidades:NecesidadComunitaria[]}>(`/comunidades/${id}/expediente/necesidades`,{headers:{Authorization:`Bearer ${token}`}}); }
export function registrarNecesidad(token:string,id:string,datos:DatosNecesidad) {return request<{necesidad:NecesidadComunitaria}>(`/comunidades/${id}/expediente/necesidades`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(datos)});}

export interface RolCatalogo {
  nombre: string;
  activo: boolean;
  permisos: { codigo: string; descripcion: string | null }[];
}

export function obtenerRoles(tokenAcceso: string) {
  return request<{ roles: RolCatalogo[] }>('/usuarios/roles', {
    headers: { Authorization: `Bearer ${tokenAcceso}` },
  });
}


export interface CuentaOrganizacion {
  id: string;
  email: string;
  activo: boolean;
  debeCambiarContrasena: boolean;
  roles: string[];
}

export function obtenerCuentasOrganizacion(token: string) {
  return request<{ cuentas: CuentaOrganizacion[] }>('/usuarios/cuentas', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function crearCuentaOrganizacion(token: string, email: string, roles: string[]) {
  return request<{ cuenta: CuentaOrganizacion; contrasenaTemporal: string }>('/usuarios/cuentas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email, roles }),
  });
}

export function cambiarRolesCuenta(token: string, usuarioId: string, roles: string[]) {
  return request<{ roles: string[] }>(`/usuarios/cuentas/${usuarioId}/roles`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ roles }),
  });
}


export interface OrganizacionPlataforma {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  emailContacto: string | null;
  cantidadUsuarios: number;
  cantidadAdministradores: number;
}
export function obtenerOrganizacionesPlataforma(token: string) {
  return request<{ organizaciones: OrganizacionPlataforma[] }>('/plataforma/organizaciones', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function crearOrganizacionPlataforma(token: string, datos: { nombre: string; slug: string; emailContacto: string }) {
  return request<{ organizacion: OrganizacionPlataforma }>('/plataforma/organizaciones', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(datos),
  });
}
export function obtenerCuentasPlataforma(token: string, organizacionId: string) {
  return request<{ cuentas: CuentaOrganizacion[] }>(`/plataforma/organizaciones/${organizacionId}/cuentas`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function crearCuentaPlataforma(token: string, organizacionId: string, email: string, roles: string[]) {
  return request<{ cuenta: CuentaOrganizacion; contrasenaTemporal: string }>(
    `/plataforma/organizaciones/${organizacionId}/cuentas`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ email, roles }),
    });
}

export interface ProyectoDonante {
  id: string;
  nombre: string;
  estado: string;
  fechaInicio: string;
  porcentajeAvance: number | null;
  fechaAvance: string | null;
  evidencias: { id: string; titulo: string | null; tipo: string; url: string }[];
}

export function obtenerProyectosDonante(tokenAcceso: string) {
  return request<{ proyectos: ProyectoDonante[] }>('/donantes/proyectos', {
    headers: { Authorization: `Bearer ${tokenAcceso}` },
  });
}

export interface AdministracionDonantes {
  donantes: { id: string; email: string; activo: boolean }[];
  proyectos: {
    id: string;
    nombre: string;
    comunidadId: string;
    donanteIds: string[];
    evidencias: { id: string; titulo: string; compartida: boolean }[];
  }[];
}

export function obtenerAdministracionDonantes(token: string) {
  return request<AdministracionDonantes>('/donantes/administracion', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function actualizarAccesoDonante(token: string, proyectoId: string, donanteId: string, asignado: boolean) {
  return request<void>(`/donantes/administracion/proyectos/${proyectoId}/donantes/${donanteId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ asignado }),
  });
}

export function actualizarEvidenciaDonante(token: string, proyectoId: string, evidenciaId: string, compartida: boolean) {
  return request<void>(`/donantes/administracion/proyectos/${proyectoId}/evidencias/${evidenciaId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ compartida }),
  });
}

export function crearCuentaDonante(token: string, email: string) {
  return request<{ donante: AdministracionDonantes['donantes'][number]; contrasenaTemporal: string }>(
    '/donantes/administracion/cuentas',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email }),
    },
  );
}

export interface FichaDonante {
  id: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  activo: boolean;
  proyectos: string[];
  brigadas: {
    id: string;
    activo: boolean;
    zonaId: string | null;
    proyectoIds: string[];
    comunidadIds: string[];
    lider: string;
    miembros: number;
    llegada: string | null;
    salida: string | null;
    proyectos: string[];
    zona: string | null;
    comunidades: string[];
    actividades: string[];
    contrataciones: string[];
    observaciones: string | null;
  }[];
}

export function obtenerFichasDonantes(token: string) {
  return request<{ fichas: FichaDonante[]; comunidades: { id: string; nombre: string; municipio: string; zonaId: string | null }[]; zonas: { id: string; nombre: string }[] }>('/donantes/administracion/fichas', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function guardarFichaDonante(token: string, datos: Record<string, string | number | string[]>, fichaId?: string, brigadaId?: string) {
  const ruta = fichaId ? `/fichas/${fichaId}/brigadas${brigadaId ? '/' + brigadaId : ''}` : '/fichas';
  return request<void>(`/donantes/administracion${ruta}`, {
    method: brigadaId ? 'PUT' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
}

export function actualizarEstadoDonante(token: string, fichaId: string, activo: boolean, brigadaId?: string) {
  const ruta = brigadaId ? `/fichas/${fichaId}/brigadas/${brigadaId}` : `/fichas/${fichaId}`;
  return request<void>(`/donantes/administracion${ruta}/estado`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ activo }),
  });
}

export interface DatosProyecto {
  comunidadId: string;
  nombre: string;
  tipo: string;
  estado: string;
  fechaInicio: string;
  fechaFin: string | null;
  descripcion: string | null;
  presupuesto: string;
  donanteIds: string[];
}

export interface ProyectoAdministrativo extends DatosProyecto {
  id: string;
  comunidad: string;
  donantes: string[];
}

export function obtenerProyectosAdministrativos(token: string) {
  return request<{
    proyectos: ProyectoAdministrativo[];
    donantes: { id: string; nombre: string; activo: boolean }[];
    moneda: string;
    comunidades: { id: string; nombre: string; municipio: string }[];
  }>('/proyectos', { headers: { Authorization: `Bearer ${token}` } });
}


export interface AvanceConFotografias {
  avanceId: string;
  actividadId: string;
  proyectoId: string;
  proyecto: string;
  estadoProyecto: string;
  actividad: string;
  comunidad: string;
  fecha: string;
  estadoRevision: 'BORRADOR' | 'ENVIADO' | 'VALIDADO' | 'DEVUELTO';
  cantidadEvidencias: number;
  descripcion: string | null;
  observaciones: string | null;
  cantidadReportada: number | null;
  porcentajeAvance: number | null;
  responsable: string | null;
  revisor: string | null;
  revisadoEn: string | null;
  motivoDevolucion: string | null;
}

export function obtenerIndiceFotografias(token: string) {
  return request<{
    avances: AvanceConFotografias[];
    proyectosFinalizados: { id: string; nombre: string; comunidad: string }[];
  }>('/proyectos/evidencias/indice', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface EvidenciaFotografica {
  id: string;
  titulo: string | null;
  descripcion: string | null;
  tipoMime: string;
  creadoEn: string;
  url: string | null;
}
const rutaFotos = (proyectoId: string, actividadId: string, avanceId: string) =>
  `/proyectos/${proyectoId}/actividades/${actividadId}/avances/${avanceId}/evidencias`;

export function obtenerFotosAvance(token: string, proyectoId: string, actividadId: string, avanceId: string) {
  return request<{ evidencias: EvidenciaFotografica[] }>(rutaFotos(proyectoId, actividadId, avanceId), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function subirFotoAvance(
  token: string, proyectoId: string, actividadId: string, avanceId: string,
  foto: File,
) {
  const permitidos = ['image/jpeg', 'image/png', 'image/webp'];
  if (!permitidos.includes(foto.type)) throw new Error('Solo se permiten fotografías JPG, PNG y WebP.');
  if (!foto.size || foto.size > 10 * 1024 * 1024) throw new Error('La fotografía debe pesar entre 1 byte y 10 MB.');
  const ruta = rutaFotos(proyectoId, actividadId, avanceId);
  const preparacion = await request<{ url: string; clave: string; tipoMime: string }>(ruta + '/preparar', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tipoMime: foto.type }),
  });
  let carga: Response;
  try {
    carga = await fetch(preparacion.url, {
      method: 'PUT', headers: { 'Content-Type': preparacion.tipoMime }, body: foto,
    });
  } catch {
    throw new Error('El navegador no pudo completar la carga en R2. Revisá el resultado de la solicitud PUT en Network; podría ser un rechazo de firma o permisos.');
  }
  if (!carga.ok) {
    throw new Error(`R2 rechazó la fotografía (HTTP ${carga.status}). Verificá las credenciales, el bucket y la firma de carga.`);
  }
  try {
    return await request<{ id: string }>(ruta + '/confirmar', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clave: preparacion.clave, tipoMime: foto.type, titulo: foto.name }),
    });
  } catch (fallo) {
    throw new Error('La foto se envió a R2, pero no pudo confirmarse en Neon: ' +
      (fallo instanceof Error ? fallo.message : 'Error desconocido.'));
  }
}

export interface AvancePendienteRevision {
  id: string;
  actividadId: string;
  proyectoId: string;
  actividad: string;
  proyecto: string;
  comunidad: string;
  fecha: string;
  descripcion: string;
  observaciones: string | null;
  cantidadReportada: number | null;
  porcentajeAvance: number | null;
  unidadMedida: string | null;
  responsable: string;
  cantidadEvidencias: number;
  esPropio: boolean;
}

export function obtenerAvancesPendientesRevision(token: string) {
  return request<{ pendientes: AvancePendienteRevision[] }>('/proyectos/revision/pendientes', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function guardarProyectoAdministrativo(token: string, datos: DatosProyecto, id?: string) {
  return request<{ id: string }>(id ? `/proyectos/${id}` : '/proyectos', {
    method: id ? 'PUT' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
}

export interface ActividadProyecto {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  responsableAsignadoId: string | null;
  responsableAsignado: string | null;
  metaCantidad: number | null;
  unidadMedida: string | null;
  presupuestoEstimado: number | null;
  pesoResultado: number | null;
  cantidadValidada: number;
  porcentajeResultado: number;
  ultimaEjecucionValidada: string | null;
  avances: AvanceActividadProyecto[];
}

export interface DatosActividadProyecto {
  nombre: string;
  descripcion: string;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  responsableAsignadoId: string | null;
  metaCantidad: number | null;
  unidadMedida: string | null;
  presupuestoEstimado: number | null;
  pesoResultado: number | null;
}

export interface AvanceActividadProyecto {
  id: string;
  porcentajeAvance: number | null;
  cantidadReportada: number | null;
  fecha: string;
  descripcion: string;
  observaciones: string | null;
  estadoRevision: 'BORRADOR' | 'ENVIADO' | 'VALIDADO' | 'DEVUELTO';
  responsable: string | null;
  revisor: string | null;
  revisadoEn: string | null;
  motivoDevolucion: string | null;
  cantidadEvidencias: number;
  historial: {
    accion: string;
    actor: string | null;
    fecha: string;
    antes: Record<string, unknown> | null;
    despues: Record<string, unknown> | null;
  }[];
}

export interface DatosAvanceActividadProyecto {
  porcentajeAvance: number | null;
  cantidadReportada: number | null;
  fecha: string;
  descripcion: string;
  observaciones: string | null;
  claveIdempotencia: string;
}

export function obtenerResponsablesProyecto(token: string, proyectoId: string) {
  return request<{ responsables: { id: string; nombre: string }[] }>(
    `/proyectos/${proyectoId}/responsables`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export function obtenerActividadesProyecto(token: string, proyectoId: string) {
  return request<{
    actividades: ActividadProyecto[];
    porcentajeProyecto: number | null;
    pesoConfigurado: number;
  }>(`/proyectos/${proyectoId}/actividades`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function guardarActividadProyecto(token: string, proyectoId: string,
  datos: DatosActividadProyecto, actividadId?: string) {
  const ruta = `/proyectos/${proyectoId}/actividades${actividadId ? '/' + actividadId : ''}`;
  return request<{ id: string }>(ruta, {
    method: actividadId ? 'PUT' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
}

export function registrarAvanceActividadProyecto(token: string, proyectoId: string, actividadId: string,
  datos: DatosAvanceActividadProyecto) {
  return request<AvanceActividadProyecto>(`/proyectos/${proyectoId}/actividades/${actividadId}/avances`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
}

export function editarAvanceActividadProyecto(token: string, proyectoId: string, actividadId: string,
  avanceId: string, datos: DatosAvanceActividadProyecto) {
  return request<void>(`/proyectos/${proyectoId}/actividades/${actividadId}/avances/${avanceId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });
}

export function enviarAvanceActividadProyecto(token: string, proyectoId: string, actividadId: string, avanceId: string) {
  return request<void>(`/proyectos/${proyectoId}/actividades/${actividadId}/avances/${avanceId}/enviar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function revisarAvanceActividadProyecto(token: string, proyectoId: string, actividadId: string,
  avanceId: string, accion: 'validar' | 'devolver', motivo?: string) {
  return request<void>(`/proyectos/${proyectoId}/actividades/${actividadId}/avances/${avanceId}/${accion}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: accion === 'devolver' ? JSON.stringify({ motivo }) : undefined,
  });
}

export function corregirAvanceValidadoProyecto(token: string, proyectoId: string, actividadId: string,
  avanceId: string, datos: DatosAvanceActividadProyecto, motivoCorreccion: string) {
  return request<void>(`/proyectos/${proyectoId}/actividades/${actividadId}/avances/${avanceId}/corregir`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...datos, motivoCorreccion }),
  });
}
