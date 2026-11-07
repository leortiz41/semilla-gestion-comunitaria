import type { Pool } from 'pg';
import { databasePool } from '../config/database.js';
import { ErrorExpediente } from '../domain/expediente.js';
import {
  validarNecesidad,
  type DatosNecesidad,
} from '../domain/necesidades.js';
const columnas = `n.id,n.area,n.meta_id AS "metaId",n.titulo,n.descripcion,n.situacion_inicial AS "situacionInicial",
 n.poblacion_afectada AS "poblacionAfectada",n.cantidad_afectada AS "cantidadAfectada",n.resultado_esperado AS "resultadoEsperado",
 n.unidad_medida AS "unidadMedida",n.cantidad_objetivo::float8 AS "cantidadObjetivo",n.prioridad,n.motivo_prioridad AS "motivoPrioridad",
 n.estado,n.creado_en AS "creadoEn",m.descripcion AS "metaDescripcion",m.activa AS "metaActiva"`;
export async function listarNecesidades(
  org: string,
  comunidad: string,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Base de datos no configurada.');
  if (
    !(
      await pool.query(
        'SELECT id FROM comunidades WHERE id=$1 AND organizacion_id=$2',
        [comunidad, org],
      )
    ).rowCount
  )
    return null;
  return (
    await pool.query(
      `SELECT ${columnas} FROM necesidades_comunitarias n LEFT JOIN metas_vision_desarrollo m ON m.id=n.meta_id AND m.organizacion_id=n.organizacion_id WHERE n.comunidad_id=$1 AND n.organizacion_id=$2 ORDER BY n.creado_en DESC,n.id`,
      [comunidad, org],
    )
  ).rows;
}
export async function registrarNecesidad(
  org: string,
  comunidad: string,
  usuario: string,
  entrada: DatosNecesidad,
  pool: Pool | null = databasePool,
) {
  const d = validarNecesidad(entrada);
  if (!pool) throw new Error('Base de datos no configurada.');
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    if (
      !(
        await c.query(
          'SELECT id FROM comunidades WHERE id=$1 AND organizacion_id=$2 FOR UPDATE',
          [comunidad, org],
        )
      ).rowCount
    )
      throw new ErrorExpediente('Comunidad no encontrada.', 404);
    if (
      !(
        await c.query(
          'SELECT id FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo=TRUE FOR SHARE',
          [usuario, org],
        )
      ).rowCount
    )
      throw new ErrorExpediente('Usuario no autorizado.', 403);
    let visionId: string | null = null;
    if (d.metaId) {
      const m = await c.query(
        `SELECT v.id FROM metas_vision_desarrollo m JOIN visiones_desarrollo_comunitarias v ON v.id=m.vision_id AND v.organizacion_id=m.organizacion_id WHERE m.id=$1 AND v.comunidad_id=$2 AND v.organizacion_id=$3 AND v.area=$4 AND m.activa FOR SHARE OF m,v`,
        [d.metaId, comunidad, org, d.area],
      );
      if (!m.rowCount)
        throw new ErrorExpediente(
          'La meta debe estar activa y pertenecer a esta comunidad y área.',
        );
      visionId = m.rows[0].id;
    }
    await c.query(
      `INSERT INTO necesidades_comunitarias(id,comunidad_id,organizacion_id,area,vision_id,meta_id,titulo,descripcion,situacion_inicial,poblacion_afectada,cantidad_afectada,resultado_esperado,unidad_medida,cantidad_objetivo,prioridad,motivo_prioridad,registrado_por_id)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        d.id,
        comunidad,
        org,
        d.area,
        visionId,
        d.metaId,
        d.titulo,
        d.descripcion,
        d.situacionInicial,
        d.poblacionAfectada,
        d.cantidadAfectada,
        d.resultadoEsperado,
        d.unidadMedida,
        d.cantidadObjetivo,
        d.prioridad,
        d.motivoPrioridad,
        usuario,
      ],
    );
    await c.query(
      "INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos) VALUES($1,'REGISTRAR_NECESIDAD','necesidades_comunitarias',$2,$3::jsonb)",
      [
        usuario,
        d.id,
        JSON.stringify({
          ...d,
          comunidadId: comunidad,
          organizacionId: org,
          estado: 'IDENTIFICADA',
        }),
      ],
    );
    const r = await c.query(
      `SELECT ${columnas} FROM necesidades_comunitarias n LEFT JOIN metas_vision_desarrollo m ON m.id=n.meta_id AND m.organizacion_id=n.organizacion_id WHERE n.id=$1 AND n.organizacion_id=$2`,
      [d.id, org],
    );
    await c.query('COMMIT');
    return r.rows[0];
  } catch (e) {
    await c.query('ROLLBACK');
    if ((e as { code?: string }).code === '23505')
      throw new ErrorExpediente(
        'Este registro ya existe. Actualiza la sección antes de intentarlo nuevamente.',
        409,
      );
    throw e;
  } finally {
    c.release();
  }
}
