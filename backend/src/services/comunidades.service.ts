import { databasePool } from '../config/database.js';

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

interface ComunidadFila {
  id: string;
  zona_id: string | null;
  nombre: string;
  barrio_colonia: string | null;
  localidad: string | null;
  municipio: string;
  departamento: string;
  activo: boolean;
  nombre_zona: string | null;
  zona_activa: boolean | null;
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
}

interface DiagnosticoPoblacionViviendaFila {
  poblacion_aproximada: number | null;
  viviendas_aproximadas: number | null;
  viviendas_intervencion: number | null;
  tipos_vivienda: string | null;
}

interface VisionDesarrolloComunitariaFila {
  area: AreaVisionDesarrollo;
  situacion_actual: string | null;
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA' | null;
  meta_desarrollo: string | null;
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
  };
}

export async function listarComunidadesPorOrganizacion(
  organizacionId: string,
): Promise<ComunidadListado[]> {
  const pool = obtenerPool();

  const resultado = await pool.query<ComunidadFila>(
    `SELECT
       c.id,
       c.zona_id,
       c.nombre,
       c.barrio_colonia,
       c.localidad,
       c.municipio,
       c.departamento,
       c.activo,
       z.nombre AS nombre_zona,
       z.activo AS zona_activa
     FROM comunidades c
     LEFT JOIN zonas z
       ON z.id = c.zona_id
      AND z.organizacion_id = c.organizacion_id
     WHERE c.organizacion_id = $1
     ORDER BY c.nombre ASC`,
    [organizacionId],
  );

  return resultado.rows.map(mapearComunidad);
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

  const resultado = await pool.query<ComunidadFila>(
    `WITH nueva_comunidad AS (
       INSERT INTO comunidades (
         organizacion_id,
         zona_id,
         nombre,
         municipio,
         departamento
       )
       SELECT $1, z.id, $3, $4, $5
         FROM zonas z
        WHERE z.id = $2
          AND z.organizacion_id = $1
          AND z.activo = TRUE
       RETURNING
         id,
         zona_id,
         nombre,
         barrio_colonia,
         localidad,
         municipio,
         departamento,
         activo
     )
     SELECT
       c.id,
       c.zona_id,
       c.nombre,
       c.barrio_colonia,
       c.localidad,
       c.municipio,
       c.departamento,
       c.activo,
       z.nombre AS nombre_zona,
       z.activo AS zona_activa
     FROM nueva_comunidad c
     LEFT JOIN zonas z
       ON z.id = c.zona_id
      AND z.organizacion_id = $1`,
    [
      organizacionId,
      datos.zonaId,
      datos.nombre.trim(),
      datos.municipio.trim(),
      datos.departamento.trim(),
    ],
  );

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

  const resultado = await pool.query<ComunidadFila>(
    `WITH comunidad_actualizada AS (
       UPDATE comunidades c
          SET zona_id = z.id,
              nombre = $4,
              municipio = $5,
              departamento = $6,
              actualizado_en = NOW()
         FROM zonas z
        WHERE c.id = $1
          AND c.organizacion_id = $2
          AND z.id = $3
          AND z.organizacion_id = $2
          AND z.activo = TRUE
       RETURNING
         c.id,
         c.zona_id,
         c.nombre,
         c.barrio_colonia,
         c.localidad,
         c.municipio,
         c.departamento,
         c.activo
     )
     SELECT
       c.id,
       c.zona_id,
       c.nombre,
       c.barrio_colonia,
       c.localidad,
       c.municipio,
       c.departamento,
       c.activo,
       z.nombre AS nombre_zona,
       z.activo AS zona_activa
     FROM comunidad_actualizada c
     LEFT JOIN zonas z
       ON z.id = c.zona_id
      AND z.organizacion_id = $2`,
    [
      comunidadId,
      organizacionId,
      datos.zonaId,
      datos.nombre.trim(),
      datos.municipio.trim(),
      datos.departamento.trim(),
    ],
  );

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

  const resultado = await pool.query<ComunidadFila>(
    `WITH comunidad_actualizada AS (
       UPDATE comunidades
          SET activo = $3,
              actualizado_en = NOW()
        WHERE id = $1
          AND organizacion_id = $2
       RETURNING
         id,
         zona_id,
         nombre,
         barrio_colonia,
         localidad,
         municipio,
         departamento,
         activo
     )
     SELECT
       c.id,
       c.zona_id,
       c.nombre,
       c.barrio_colonia,
       c.localidad,
       c.municipio,
       c.departamento,
       c.activo,
       z.nombre AS nombre_zona,
       z.activo AS zona_activa
     FROM comunidad_actualizada c
     LEFT JOIN zonas z
       ON z.id = c.zona_id
      AND z.organizacion_id = $2`,
    [comunidadId, organizacionId, activo],
  );

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

  const resultado = await pool.query<DiagnosticoPoblacionViviendaFila>(
    `SELECT
       d.poblacion_aproximada,
       d.viviendas_aproximadas,
       d.viviendas_intervencion,
       d.tipos_vivienda
     FROM comunidades c
     LEFT JOIN diagnosticos_comunitarios d
       ON d.comunidad_id = c.id
      AND d.organizacion_id = c.organizacion_id
     WHERE c.id = $1
       AND c.organizacion_id = $2`,
    [comunidadId, organizacionId],
  );

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

  const resultado = await pool.query<DiagnosticoPoblacionViviendaFila>(
    `INSERT INTO diagnosticos_comunitarios (
       comunidad_id,
       organizacion_id,
       poblacion_aproximada,
       viviendas_aproximadas,
       viviendas_intervencion,
       tipos_vivienda
     )
     SELECT c.id, c.organizacion_id, $3, $4, $5, $6
       FROM comunidades c
      WHERE c.id = $1
        AND c.organizacion_id = $2
     ON CONFLICT (comunidad_id) DO UPDATE
       SET poblacion_aproximada = EXCLUDED.poblacion_aproximada,
           viviendas_aproximadas = EXCLUDED.viviendas_aproximadas,
           viviendas_intervencion = EXCLUDED.viviendas_intervencion,
           tipos_vivienda = EXCLUDED.tipos_vivienda,
           actualizado_en = NOW()
     RETURNING
       poblacion_aproximada,
       viviendas_aproximadas,
       viviendas_intervencion,
       tipos_vivienda`,
    [
      comunidadId,
      organizacionId,
      datos.poblacionAproximada,
      datos.viviendasAproximadas,
      datos.viviendasIntervencion,
      datos.tiposVivienda?.trim() || null,
    ],
  );

  if (resultado.rowCount === 0) {
    return null;
  }

  return mapearDiagnosticoPoblacionVivienda(resultado.rows[0]);
}

export async function obtenerVisionesDesarrolloComunitaria(
  organizacionId: string,
  comunidadId: string,
): Promise<VisionDesarrolloComunitaria[] | undefined> {
  const pool = obtenerPool();

  const comunidad = await pool.query<{ id: string }>(
    `SELECT id
       FROM comunidades
      WHERE id = $1
        AND organizacion_id = $2`,
    [comunidadId, organizacionId],
  );

  if (comunidad.rowCount === 0) {
    return undefined;
  }

  const resultado = await pool.query<VisionDesarrolloComunitariaFila>(
    `SELECT area, situacion_actual, prioridad, meta_desarrollo
       FROM visiones_desarrollo_comunitarias
      WHERE comunidad_id = $1
        AND organizacion_id = $2
      ORDER BY CASE area
        WHEN 'EVANGELISMO' THEN 1
        WHEN 'EDUCACION_FORMAL' THEN 2
        WHEN 'EDUCACION_COMUNITARIA' THEN 3
        WHEN 'INFRAESTRUCTURA' THEN 4
        ELSE 5
      END`,
    [comunidadId, organizacionId],
  );

  return resultado.rows.map(mapearVisionDesarrollo);
}

export async function guardarVisionDesarrolloComunitaria(
  organizacionId: string,
  comunidadId: string,
  datos: VisionDesarrolloComunitaria,
): Promise<VisionDesarrolloComunitaria | null> {
  const pool = obtenerPool();

  const resultado = await pool.query<VisionDesarrolloComunitariaFila>(
    `INSERT INTO visiones_desarrollo_comunitarias (
       comunidad_id,
       organizacion_id,
       area,
       situacion_actual,
       prioridad,
       meta_desarrollo
     )
     SELECT c.id, c.organizacion_id, $3, $4, $5, $6
       FROM comunidades c
      WHERE c.id = $1
        AND c.organizacion_id = $2
     ON CONFLICT (comunidad_id, area) DO UPDATE
       SET situacion_actual = EXCLUDED.situacion_actual,
           prioridad = EXCLUDED.prioridad,
           meta_desarrollo = EXCLUDED.meta_desarrollo,
           actualizado_en = NOW()
     RETURNING area, situacion_actual, prioridad, meta_desarrollo`,
    [
      comunidadId,
      organizacionId,
      datos.area,
      datos.situacionActual?.trim() || null,
      datos.prioridad,
      datos.metaDesarrollo?.trim() || null,
    ],
  );

  if (resultado.rowCount === 0) {
    return null;
  }

  return mapearVisionDesarrollo(resultado.rows[0]);
}
