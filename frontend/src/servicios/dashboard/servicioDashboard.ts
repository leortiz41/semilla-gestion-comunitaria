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

export async function obtenerEstadisticasDashboard(tokenAcceso: string): Promise<EstadisticasDashboard> {
  const respuesta = await fetch(`${URL_API}/dashboard/estadisticas`, {
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
