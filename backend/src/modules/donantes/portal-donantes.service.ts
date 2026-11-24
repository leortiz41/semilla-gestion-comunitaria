import type { Pool } from 'pg';
import { firmarObjetoR2, r2Disponible } from '../../services/r2-evidencias.service.js';
import {
  consultarProyectosDonante, consultarProyectoMapaAutorizado,
  consultarContenidoMapa, consultarImpactoFamiliarDonante,
} from './portal-donantes.repository.js';

type Consultable = Pick<Pool, 'query'>;

/** Los permisos y la organización provienen exclusivamente de la sesión validada. */
export interface ContextoPortalDonante {
  usuarioId: string;
  organizacionId: string;
  puedeVerEvidencias: boolean;
}

export async function listarProyectosPortal(pool: Consultable, contexto: ContextoPortalDonante) {
  return consultarProyectosDonante(
    pool, contexto.usuarioId, contexto.organizacionId, contexto.puedeVerEvidencias,
  );
}

/** No devuelve actividades ni fotografías si el proyecto no está asignado al DONANTE. */
export async function obtenerMapaPortal(
  pool: Consultable, proyectoId: string, contexto: ContextoPortalDonante,
) {
  const proyecto = await consultarProyectoMapaAutorizado(
    pool, contexto.usuarioId, proyectoId, contexto.organizacionId,
  );
  if (!proyecto) return null;
  const { actividades, avances, evidencias } = await consultarContenidoMapa(
    pool, proyectoId, contexto.puedeVerEvidencias,
  );
  return {
    proyecto, actividades, avances,
    evidencias: await Promise.all(evidencias.map(async (foto: { url: unknown }) => ({
      ...foto,
      url: typeof foto.url === 'string' && foto.url.startsWith('r2:')
        ? (r2Disponible() ? await firmarObjetoR2(foto.url.slice(3), 'GET', undefined, 900) : null)
        : typeof foto.url === 'string' && foto.url.startsWith('https://') ? foto.url : null,
    }))),
  };
}

/** Sin identificaciones, domicilios ni documentos de familias. */
export function obtenerImpactoFamiliarPortal(
  pool: Consultable, proyectoId: string, contexto: ContextoPortalDonante,
) {
  return consultarImpactoFamiliarDonante(
    pool, contexto.usuarioId, proyectoId, contexto.organizacionId,
  );
}
