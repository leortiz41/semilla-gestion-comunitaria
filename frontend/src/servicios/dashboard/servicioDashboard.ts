const URL_API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface ResumenDashboard {
  comunidadesRegistradas: number;
  comunidadesActivas: number;
}

interface RespuestaErrorApi {
  message?: string;
}

export async function obtenerResumenDashboard(
  tokenAcceso: string,
): Promise<ResumenDashboard> {
  const respuesta = await fetch(`${URL_API}/dashboard/resumen`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${tokenAcceso}`,
    },
  });

  if (!respuesta.ok) {
    let mensaje = `No fue posible obtener el resumen (${respuesta.status}).`;

    try {
      const cuerpo = (await respuesta.json()) as RespuestaErrorApi;
      mensaje = cuerpo.message || mensaje;
    } catch {
      // Si la respuesta no contiene JSON, conservamos el mensaje general.
    }

    throw new Error(mensaje);
  }

  return (await respuesta.json()) as ResumenDashboard;
}

export interface EstadisticasDashboard {
  moneda: string;
  proyectosTotales: number;
  proyectosActivos: number;
  proyectosFinalizados: number;
  presupuestoAsignado: number;
  evidenciasRegistradas: number;
  avancesValidados: number;
  proyectosPorEstado: { estado: string; cantidad: number }[];
  avancesPorMes: { mes: string; validados: number; enviados: number }[];
  proyectosPorArea: { area: string; cantidad: number }[];
}

export interface FiltrosDashboard {
  comunidades: { id: string; nombre: string }[];
  proyectos: { id: string; nombre: string; comunidadId: string; tipo: string }[];
  areas: string[];
}

export interface SeleccionDashboard {
  comunidadId?: string;
  proyectoId?: string;
  area?: string;
  meses?: '' | '3' | '6' | '12';
}

export async function obtenerFiltrosDashboard(tokenAcceso: string): Promise<FiltrosDashboard> {
  const respuesta = await fetch(`${URL_API}/dashboard/filtros`, {
    headers: { Authorization: `Bearer ${tokenAcceso}` },
  });
  if (!respuesta.ok) throw new Error('No fue posible obtener las opciones de filtrado.');
  return respuesta.json() as Promise<FiltrosDashboard>;
}

export async function obtenerEstadisticasDashboard(tokenAcceso: string, filtros: SeleccionDashboard = {}): Promise<EstadisticasDashboard> {
  const parametros = new URLSearchParams();
  if (filtros.comunidadId) parametros.set('comunidadId', filtros.comunidadId);
  if (filtros.proyectoId) parametros.set('proyectoId', filtros.proyectoId);
  if (filtros.area) parametros.set('area', filtros.area);
  if (filtros.meses) parametros.set('meses', filtros.meses);
  const consulta = parametros.toString();
  const respuesta = await fetch(`${URL_API}/dashboard/estadisticas${consulta ? '?' + consulta : ''}`, {
    headers: { Authorization: `Bearer ${tokenAcceso}` },
  });
  if (!respuesta.ok) {
    let mensaje = 'No se pudieron consultar las estadísticas.';
    try {
      const cuerpo = await respuesta.json() as RespuestaErrorApi;
      mensaje = cuerpo.message || mensaje;
    } catch { /* Respuesta sin JSON */ }
    throw new Error(mensaje);
  }
  return respuesta.json() as Promise<EstadisticasDashboard>;
}

export interface PosicionWidget {
  id: string; x: number; y: number; w: number; h: number;
}
export interface PreferenciasDashboard {
  visibles: string[];
  posiciones: PosicionWidget[];
}
export async function obtenerPreferenciasDashboard(token: string): Promise<PreferenciasDashboard | null> {
  const respuesta = await fetch(`${URL_API}/dashboard/preferencias`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!respuesta.ok) throw new Error('No se pudieron recuperar las preferencias personales.');
  const datos = await respuesta.json() as { configuracion: PreferenciasDashboard | null };
  return datos.configuracion;
}
export async function guardarPreferenciasDashboard(token: string, configuracion: PreferenciasDashboard): Promise<void> {
  const respuesta = await fetch(`${URL_API}/dashboard/preferencias`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ configuracion }),
  });
  if (!respuesta.ok) throw new Error('No se pudo guardar la distribución personal en Neon.');
}
