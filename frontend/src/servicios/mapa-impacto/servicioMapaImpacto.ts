const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface ProyectoMapa {
  id: string;
  nombre: string;
  estado: string;
  tipo: string;
  comunidad: string;
}

export interface DetalleImpacto {
  proyecto: {
    id: string; nombre: string; descripcion: string | null;
    estado: string; tipo: string; comunidadId: string; comunidad: string;
  };
  actividades: { id: string; nombre: string; descripcion: string | null; estado: string }[];
  avances: {
    id: string; actividadId: string; fecha: string;
    descripcion: string | null; estado: string;
  }[];
  evidencias: {
    id: string; avanceId: string; titulo: string | null;
    descripcion: string | null; tipoMime: string; url: string | null;
  }[];
}

async function consultar<T>(ruta: string, token: string): Promise<T> {
  const respuesta = await fetch(`${API}/mapa-impacto${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!respuesta.ok) {
    let mensaje = 'No fue posible consultar el Mapa de Impacto.';
    try {
      const json = await respuesta.json() as { message?: string };
      mensaje = json.message || mensaje;
    } catch { /* Mantener mensaje general. */ }
    throw new Error(mensaje);
  }
  return respuesta.json() as Promise<T>;
}

export function listarProyectosMapa(token: string) {
  return consultar<{ proyectos: ProyectoMapa[] }>('/proyectos', token);
}

export function obtenerMapaProyecto(token: string, proyectoId: string) {
  return consultar<DetalleImpacto>(`/proyectos/${encodeURIComponent(proyectoId)}`, token);
}


export function renovarEnlaceFotografiaMapa(
  token: string, proyectoId: string, evidenciaId: string,
) {
  return consultar<{ url: string }>(
    `/proyectos/${encodeURIComponent(proyectoId)}/evidencias/${encodeURIComponent(evidenciaId)}/enlace`,
    token,
  );
}

export type PosicionPanelMapa = {
  id: 'diagrama' | 'detalle'; x: number; y: number; w: number; h: number;
};
export type PosicionesNodosMapa = Record<string, { x: number; y: number }>;
export interface PreferenciasMapaImpacto {
  paneles?: PosicionPanelMapa[];
  nodos?: PosicionesNodosMapa;
}

export async function obtenerPreferenciasMapa(token: string, proyectoId: string) {
  return consultar<{ configuracion: PreferenciasMapaImpacto | null }>(
    `/proyectos/${encodeURIComponent(proyectoId)}/preferencias`, token,
  );
}
export async function guardarPreferenciasMapa(
  token: string, proyectoId: string,
  tipo: 'paneles' | 'nodos',
  valor: PosicionPanelMapa[] | PosicionesNodosMapa,
): Promise<void> {
  const respuesta = await fetch(
    `${API}/mapa-impacto/proyectos/${encodeURIComponent(proyectoId)}/preferencias`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, valor }),
    },
  );
  if (!respuesta.ok) throw new Error('No se pudo guardar la configuración del mapa en Neon.');
}
