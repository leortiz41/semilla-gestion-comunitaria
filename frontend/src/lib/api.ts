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
