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
       z.nombre AS nombre_zona
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
       z.nombre AS nombre_zona
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
