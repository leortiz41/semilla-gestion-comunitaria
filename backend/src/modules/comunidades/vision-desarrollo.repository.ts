import type { Pool } from 'pg';
import { ErrorExpediente } from '../../domain/expediente.js';
import type { MetaVision } from './metas-vision.domain.js';
import type { VisionDesarrolloComunitaria } from './comunidades.service.js';

export interface VisionDesarrolloComunitariaFila {
  area: VisionDesarrolloComunitaria['area'];
  situacion_actual: string | null;
  prioridad: VisionDesarrolloComunitaria['prioridad'];
  meta_desarrollo: string | null;
  metas: MetaVision[];
  revision: number;
}

const consultaVisiones = `SELECT v.area, v.situacion_actual, v.prioridad, v.meta_desarrollo, v.revision,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'descripcion',m.descripcion) ORDER BY m.orden,m.id)
 FROM metas_vision_desarrollo m WHERE m.vision_id=v.id AND m.organizacion_id=v.organizacion_id AND m.activa), '[]'::jsonb) AS metas
 FROM visiones_desarrollo_comunitarias v WHERE v.comunidad_id=$1 AND v.organizacion_id=$2`;


/** Consulta restringida por comunidad y organización. */
export async function consultarVisionesDesarrollo(
  pool: Pool, organizacionId: string, comunidadId: string,
): Promise<VisionDesarrolloComunitariaFila[] | undefined> {
  const comunidad = await pool.query('SELECT id FROM comunidades WHERE id=$1 AND organizacion_id=$2', [comunidadId,organizacionId]);
  if (!comunidad.rowCount) return undefined;
  const resultadoVisiones = await pool.query<VisionDesarrolloComunitariaFila>(consultaVisiones + ' ORDER BY v.area', [comunidadId,organizacionId]);
  return resultadoVisiones.rows;
}

/** Conserva la transacción original: revisión, bloqueo, metas, bitácora y rollback. */
export async function persistirVisionDesarrollo(
  pool: Pool, organizacionId: string, comunidadId: string,
  datos: VisionDesarrolloComunitaria, usuarioId: string,
  metas: MetaVision[], revision: number,
): Promise<VisionDesarrolloComunitariaFila | null> {
  const clienteTransaccion = await pool.connect();
  try {
    await clienteTransaccion.query('BEGIN');
    const comunidad = await clienteTransaccion.query('SELECT id FROM comunidades WHERE id=$1 AND organizacion_id=$2 FOR UPDATE', [comunidadId,organizacionId]);
    if (!comunidad.rowCount) { await clienteTransaccion.query('ROLLBACK'); return null; }
    const usuario = await clienteTransaccion.query('SELECT id FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo=TRUE FOR SHARE',[usuarioId,organizacionId]);
    if (!usuario.rowCount) throw new ErrorExpediente('Usuario no autorizado.',403);
    const anterior = await clienteTransaccion.query('SELECT id,revision FROM visiones_desarrollo_comunitarias WHERE comunidad_id=$1 AND organizacion_id=$2 AND area=$3',[comunidadId,organizacionId,datos.area]);
    if ((anterior.rows[0]?.revision ?? 0) !== revision) throw new ErrorExpediente('Otra persona actualizó esta área. Cancela y recarga la sección antes de editar.',409);
    const resultadoVisionGuardada = await clienteTransaccion.query(`INSERT INTO visiones_desarrollo_comunitarias(comunidad_id,organizacion_id,area,situacion_actual,prioridad,revision)
      VALUES ($1,$2,$3,$4,$5,1) ON CONFLICT (comunidad_id,area) DO UPDATE
      SET situacion_actual=EXCLUDED.situacion_actual,prioridad=EXCLUDED.prioridad,revision=visiones_desarrollo_comunitarias.revision+1,actualizado_en=NOW() RETURNING id`,
      [comunidadId,organizacionId,datos.area,datos.situacionActual,datos.prioridad]);
    const visionId=resultadoVisionGuardada.rows[0].id;
    // Quitar archiva la meta; no borra su identificador ni su último texto.
    await clienteTransaccion.query('UPDATE metas_vision_desarrollo SET activa=FALSE,actualizado_en=NOW() WHERE vision_id=$1 AND organizacion_id=$2 AND activa',[visionId,organizacionId]);
    for (const [orden,meta] of metas.entries()) {
      const fila=await clienteTransaccion.query(`INSERT INTO metas_vision_desarrollo(id,vision_id,organizacion_id,descripcion,orden)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET descripcion=EXCLUDED.descripcion,orden=EXCLUDED.orden,activa=TRUE,actualizado_en=NOW()
        WHERE metas_vision_desarrollo.vision_id=EXCLUDED.vision_id AND metas_vision_desarrollo.organizacion_id=EXCLUDED.organizacion_id RETURNING id`,[meta.id,visionId,organizacionId,meta.descripcion,orden]);
      if (!fila.rowCount) throw new ErrorExpediente('Una meta no pertenece a esta área.',400);
    }
    await clienteTransaccion.query("INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos) VALUES($1,'GUARDAR_METAS_VISION','visiones_desarrollo_comunitarias',$2,$3::jsonb)",[usuarioId,visionId,JSON.stringify({revision:revision+1,metas})]);
    const resultado=await clienteTransaccion.query<VisionDesarrolloComunitariaFila>(consultaVisiones+' AND v.area=$3',[comunidadId,organizacionId,datos.area]);
    await clienteTransaccion.query('COMMIT');
    return resultado.rows[0];
  } catch(error) { await clienteTransaccion.query('ROLLBACK'); throw error; } finally { clienteTransaccion.release(); }
}

