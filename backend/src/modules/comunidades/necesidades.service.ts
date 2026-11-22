import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { ErrorExpediente } from '../../domain/expediente.js';
import {
  validarNecesidad,
  type DatosNecesidad,
} from './necesidades.domain.js';
const columnas = `n.id,n.area,n.meta_id AS "metaId",n.titulo,n.descripcion,n.situacion_inicial AS "situacionInicial",
 n.poblacion_afectada AS "poblacionAfectada",n.cantidad_afectada AS "cantidadAfectada",n.resultado_esperado AS "resultadoEsperado",
 n.unidad_medida AS "unidadMedida",n.cantidad_objetivo::float8 AS "cantidadObjetivo",n.prioridad,n.motivo_prioridad AS "motivoPrioridad",
 n.estado,n.creado_en AS "creadoEn",m.descripcion AS "metaDescripcion",m.activa AS "metaActiva"`;
export async function listarNecesidades(
  organizacionId: string,
  comunidadId: string,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Base de datos no configurada.');
  if (
    !(
      await pool.query(
        'SELECT id FROM comunidades WHERE id=$1 AND organizacion_id=$2',
        [comunidadId, organizacionId],
      )
    ).rowCount
  )
    return null;
  return (
    await pool.query(
      `SELECT ${columnas} FROM necesidades_comunitarias n LEFT JOIN metas_vision_desarrollo m ON m.id=n.meta_id AND m.organizacion_id=n.organizacion_id WHERE n.comunidad_id=$1 AND n.organizacion_id=$2 ORDER BY n.creado_en DESC,n.id`,
      [comunidadId, organizacionId],
    )
  ).rows;
}
export async function registrarNecesidad(
  organizacionId: string,
  comunidadId: string,
  usuarioId: string,
  entrada: DatosNecesidad,
  pool: Pool | null = databasePool,
) {
  const datosNecesidad = validarNecesidad(entrada);
  if (!pool) throw new Error('Base de datos no configurada.');
  const clienteTransaccion = await pool.connect();
  try {
    await clienteTransaccion.query('BEGIN');
    if (
      !(
        await clienteTransaccion.query(
          'SELECT id FROM comunidades WHERE id=$1 AND organizacion_id=$2 FOR UPDATE',
          [comunidadId, organizacionId],
        )
      ).rowCount
    )
      throw new ErrorExpediente('Comunidad no encontrada.', 404);
    if (
      !(
        await clienteTransaccion.query(
          'SELECT id FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo=TRUE FOR SHARE',
          [usuarioId, organizacionId],
        )
      ).rowCount
    )
      throw new ErrorExpediente('Usuario no autorizado.', 403);
    let visionId: string | null = null;
    if (datosNecesidad.metaId) {
      const resultadoMeta = await clienteTransaccion.query(
        `SELECT v.id FROM metas_vision_desarrollo m JOIN visiones_desarrollo_comunitarias v ON v.id=m.vision_id AND v.organizacion_id=m.organizacion_id WHERE m.id=$1 AND v.comunidad_id=$2 AND v.organizacion_id=$3 AND v.area=$4 AND m.activa FOR SHARE OF m,v`,
        [datosNecesidad.metaId, comunidadId, organizacionId, datosNecesidad.area],
      );
      if (!resultadoMeta.rowCount)
        throw new ErrorExpediente(
          'La meta debe estar activa y pertenecer a esta comunidad y área.',
        );
      visionId = resultadoMeta.rows[0].id;
    }
    await clienteTransaccion.query(
      `INSERT INTO necesidades_comunitarias(id,comunidad_id,organizacion_id,area,vision_id,meta_id,titulo,descripcion,situacion_inicial,poblacion_afectada,cantidad_afectada,resultado_esperado,unidad_medida,cantidad_objetivo,prioridad,motivo_prioridad,registrado_por_id)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        datosNecesidad.id,
        comunidadId,
        organizacionId,
        datosNecesidad.area,
        visionId,
        datosNecesidad.metaId,
        datosNecesidad.titulo,
        datosNecesidad.descripcion,
        datosNecesidad.situacionInicial,
        datosNecesidad.poblacionAfectada,
        datosNecesidad.cantidadAfectada,
        datosNecesidad.resultadoEsperado,
        datosNecesidad.unidadMedida,
        datosNecesidad.cantidadObjetivo,
        datosNecesidad.prioridad,
        datosNecesidad.motivoPrioridad,
        usuarioId,
      ],
    );
    await clienteTransaccion.query(
      "INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos) VALUES($1,'REGISTRAR_NECESIDAD','necesidades_comunitarias',$2,$3::jsonb)",
      [
        usuarioId,
        datosNecesidad.id,
        JSON.stringify({
          ...datosNecesidad,
          comunidadId: comunidadId,
          organizacionId: organizacionId,
          estado: 'IDENTIFICADA',
        }),
      ],
    );
    const resultadoNecesidad = await clienteTransaccion.query(
      `SELECT ${columnas} FROM necesidades_comunitarias n LEFT JOIN metas_vision_desarrollo m ON m.id=n.meta_id AND m.organizacion_id=n.organizacion_id WHERE n.id=$1 AND n.organizacion_id=$2`,
      [datosNecesidad.id, organizacionId],
    );
    await clienteTransaccion.query('COMMIT');
    return resultadoNecesidad.rows[0];
  } catch (error) {
    await clienteTransaccion.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505')
      throw new ErrorExpediente(
        'Este registro ya existe. Actualiza la sección antes de intentarlo nuevamente.',
        409,
      );
    throw error;
  } finally {
    clienteTransaccion.release();
  }
}
