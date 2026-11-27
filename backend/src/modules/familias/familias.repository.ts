import type { Pool } from 'pg';
import type { DatosFamilia } from './familias.domain.js';

// SQL tenant-scoped conservado de las rutas originales.
const columnas = `
  f.id, f.comunidad_id AS "comunidadId", c.nombre AS comunidad,
  f.numero_casa AS "numeroCasa", f.nombre_referencia AS "nombreReferencia",
  f.direccion_referencia AS "direccionReferencia", f.activo,
  f.creado_en AS "creadoEn", f.actualizado_en AS "actualizadoEn"
`;


export async function consultarComunidadesParaFamilias(pool: Pool, organizacionId: string) {
  return pool.query(
      `SELECT id, nombre, municipio FROM comunidades
       WHERE organizacion_id = $1 AND activo ORDER BY nombre, id`,
      [organizacionId],
    );
}

export async function consultarFamiliasPorOrganizacion(pool: Pool, organizacionId: string) {
  return pool.query(
      `SELECT ${columnas},
          (SELECT count(*)::int FROM miembros_familia mf
           WHERE mf.familia_id = f.id AND mf.fecha_salida IS NULL) AS "integrantesRegistrados",
          (SELECT count(*)::int FROM perfiles_familia pf
           WHERE pf.familia_id = f.id) AS "evaluacionesRegistradas"
       FROM familias f
       JOIN comunidades c ON c.id=f.comunidad_id
       WHERE c.organizacion_id = $1
       ORDER BY f.activo DESC, f.actualizado_en DESC, f.id DESC LIMIT 500`,
      [organizacionId],
    );
}

export async function consultarFamiliaPorId(pool: Pool, familiaId: string, organizacionId: string) {
  return pool.query(
      `SELECT ${columnas}
       FROM familias f JOIN comunidades c ON c.id=f.comunidad_id
       WHERE f.id = $1 AND c.organizacion_id = $2`,
      [familiaId, organizacionId],
    );
}

export async function insertarFamilia(pool: Pool, datos: DatosFamilia, organizacionId: string) {
  return pool.query(
      `INSERT INTO familias (comunidad_id, nombre_referencia, numero_casa, direccion_referencia)
       SELECT c.id, $2, NULLIF($3, ''), NULLIF($4, '')
       FROM comunidades c WHERE c.id = $1 AND c.organizacion_id = $5 AND c.activo
       RETURNING id`,
      [datos.comunidadId, datos.nombreReferencia, datos.numeroCasa, datos.direccionReferencia, organizacionId],
    );
}

export async function editarFamilia(pool: Pool, familiaId: string, datos: DatosFamilia, activo: boolean, organizacionId: string) {
  return pool.query(
      `UPDATE familias f
       SET comunidad_id=$2, nombre_referencia=$3, numero_casa=NULLIF($4, ''),
           direccion_referencia=NULLIF($5, ''), activo=$6, actualizado_en=NOW()
       WHERE f.id=$1
         AND EXISTS (SELECT 1 FROM comunidades origen
                     WHERE origen.id=f.comunidad_id AND origen.organizacion_id=$7)
         AND EXISTS (SELECT 1 FROM comunidades destino
                     WHERE destino.id=$2 AND destino.organizacion_id=$7 AND destino.activo)`,
      [familiaId, datos.comunidadId, datos.nombreReferencia, datos.numeroCasa,
        datos.direccionReferencia, activo, organizacionId],
    );
}
