import type { Pool } from 'pg';

// Fila SQL interna: no representa el contrato JSON de la API.
export interface ComunidadFila {
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

/** Consulta de comunidades limitada a la organización autenticada. */
export async function consultarComunidadesPorOrganizacion(pool: Pool, organizacionId: string): Promise<ComunidadFila[]> {
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
  return resultado.rows;
}

export interface DiagnosticoPoblacionViviendaFila {
  poblacion_aproximada: number | null;
  viviendas_aproximadas: number | null;
  viviendas_intervencion: number | null;
  tipos_vivienda: string | null;
}
export interface DatosComunidadBasica {
  zonaId: string;
  nombre: string;
  municipio: string;
  departamento: string;
}
export interface DatosDiagnosticoPoblacionVivienda {
  poblacionAproximada: number | null;
  viviendasAproximadas: number | null;
  viviendasIntervencion: number | null;
  tiposVivienda: string | null;
}

/** Persistencia acotada por organizacionId; SQL sin alteraciones. */
export async function insertarComunidadBasica(pool: Pool, organizacionId: string, datos: DatosComunidadBasica) {
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
  return resultado;
}

/** Persistencia acotada por organizacionId; SQL sin alteraciones. */
export async function actualizarComunidadBasica(pool: Pool, organizacionId: string, comunidadId: string, datos: DatosComunidadBasica) {
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
  return resultado;
}

/** Persistencia acotada por organizacionId; SQL sin alteraciones. */
export async function actualizarEstadoComunidad(pool: Pool, organizacionId: string, comunidadId: string, activo: boolean) {
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
  return resultado;
}

/** Persistencia acotada por organizacionId; SQL sin alteraciones. */
export async function consultarDiagnosticoPoblacion(pool: Pool, organizacionId: string, comunidadId: string) {
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
  return resultado;
}

/** Persistencia acotada por organizacionId; SQL sin alteraciones. */
export async function actualizarDiagnosticoPoblacion(pool: Pool, organizacionId: string, comunidadId: string, datos: DatosDiagnosticoPoblacionVivienda) {
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
  return resultado;
}
