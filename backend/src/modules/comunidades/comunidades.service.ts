import type { Pool } from 'pg';
import { consultarComunidadesPorOrganizacion, insertarComunidadBasica, actualizarComunidadBasica, actualizarEstadoComunidad, consultarDiagnosticoPoblacion, actualizarDiagnosticoPoblacion, type ComunidadFila, type DiagnosticoPoblacionViviendaFila } from './comunidades.repository.js';
import { validarMetasVision, type MetaVision } from './metas-vision.domain.js';
import { databasePool } from '../../config/database.js';
import { consultarVisionesDesarrollo, persistirVisionDesarrollo, type VisionDesarrolloComunitariaFila } from './vision-desarrollo.repository.js';

export interface ComunidadListado {
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
  metas: MetaVision[];
  revision: number;
}

function obtenerPool() {
  if (!databasePool) {
    throw new Error('La base de datos no está configurada.');
  }

  return databasePool;
}

function mapearComunidad(comunidad: ComunidadFila): ComunidadListado {
  return {
    id: comunidad.id,
    zonaId: comunidad.zona_id,
    nombre: comunidad.nombre,
    barrioColonia: comunidad.barrio_colonia,
    localidad: comunidad.localidad,
    municipio: comunidad.municipio,
    departamento: comunidad.departamento,
    activo: comunidad.activo,
    nombreZona: comunidad.nombre_zona,
    zonaActiva: comunidad.zona_activa,
  };
}

function mapearDiagnosticoPoblacionVivienda(
  diagnostico: DiagnosticoPoblacionViviendaFila,
): DiagnosticoPoblacionVivienda {
  return {
    poblacionAproximada: diagnostico.poblacion_aproximada,
    viviendasAproximadas: diagnostico.viviendas_aproximadas,
    viviendasIntervencion: diagnostico.viviendas_intervencion,
    tiposVivienda: diagnostico.tipos_vivienda,
  };
}

function mapearVisionDesarrollo(
  vision: VisionDesarrolloComunitariaFila,
): VisionDesarrolloComunitaria {
  return {
    area: vision.area,
    situacionActual: vision.situacion_actual,
    prioridad: vision.prioridad,
    metaDesarrollo: vision.meta_desarrollo,
    metas: vision.metas,
    revision: vision.revision,
  };
}

export async function listarComunidadesPorOrganizacion(
  organizacionId: string,
): Promise<ComunidadListado[]> {
  const pool = obtenerPool();
  const comunidades = await consultarComunidadesPorOrganizacion(pool, organizacionId);
  return comunidades.map(mapearComunidad);
}

export async function crearComunidadBasica(
  organizacionId: string,
  datos: {
    zonaId: string;
    nombre: string;
    municipio: string;
    departamento: string;
  },
): Promise<ComunidadListado | null> {
  const pool = obtenerPool();

  const resultado = await insertarComunidadBasica(pool, organizacionId, datos);

  if (resultado.rowCount === 0) {
    return null;
  }

  return mapearComunidad(resultado.rows[0]);
}

export async function editarComunidadBasica(
  organizacionId: string,
  comunidadId: string,
  datos: {
    zonaId: string;
    nombre: string;
    municipio: string;
    departamento: string;
  },
): Promise<ComunidadListado | null> {
  const pool = obtenerPool();

  const resultado = await actualizarComunidadBasica(pool, organizacionId, comunidadId, datos);

  if (resultado.rowCount === 0) {
    return null;
  }

  return mapearComunidad(resultado.rows[0]);
}

export async function cambiarEstadoComunidad(
  organizacionId: string,
  comunidadId: string,
  activo: boolean,
): Promise<ComunidadListado | null> {
  const pool = obtenerPool();

  const resultado = await actualizarEstadoComunidad(pool, organizacionId, comunidadId, activo);

  if (resultado.rowCount === 0) {
    return null;
  }

  return mapearComunidad(resultado.rows[0]);
}

export async function obtenerDiagnosticoPoblacionVivienda(
  organizacionId: string,
  comunidadId: string,
): Promise<DiagnosticoPoblacionVivienda | null | undefined> {
  const pool = obtenerPool();

  const resultado = await consultarDiagnosticoPoblacion(pool, organizacionId, comunidadId);

  if (resultado.rowCount === 0) {
    return undefined;
  }

  const fila = resultado.rows[0];
  if (
    fila.poblacion_aproximada === null &&
    fila.viviendas_aproximadas === null &&
    fila.viviendas_intervencion === null &&
    fila.tipos_vivienda === null
  ) {
    return null;
  }

  return mapearDiagnosticoPoblacionVivienda(fila);
}

export async function guardarDiagnosticoPoblacionVivienda(
  organizacionId: string,
  comunidadId: string,
  datos: DiagnosticoPoblacionVivienda,
): Promise<DiagnosticoPoblacionVivienda | null> {
  const pool = obtenerPool();

  const resultado = await actualizarDiagnosticoPoblacion(pool, organizacionId, comunidadId, datos);

  if (resultado.rowCount === 0) {
    return null;
  }

  return mapearDiagnosticoPoblacionVivienda(resultado.rows[0]);
}

export async function obtenerVisionesDesarrolloComunitaria(
  organizacionId: string, comunidadId: string, pool: Pool = obtenerPool(),
): Promise<VisionDesarrolloComunitaria[] | undefined> {
  const filas = await consultarVisionesDesarrollo(pool, organizacionId, comunidadId);
  return filas?.map(mapearVisionDesarrollo);
}

export async function guardarVisionDesarrolloComunitaria(
  organizacionId: string, comunidadId: string, datos: VisionDesarrolloComunitaria,
  usuarioId: string, pool: Pool = obtenerPool(),
): Promise<VisionDesarrolloComunitaria | null> {
  const { metas, revision } = validarMetasVision(datos.metas, datos.revision);
  const fila = await persistirVisionDesarrollo(pool, organizacionId, comunidadId, datos, usuarioId, metas, revision);
  return fila ? mapearVisionDesarrollo(fila) : null;
}
