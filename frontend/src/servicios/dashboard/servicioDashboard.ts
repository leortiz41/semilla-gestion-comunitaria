const URL_API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface ResumenDashboard {
  comunidadesRegistradas: number;
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
