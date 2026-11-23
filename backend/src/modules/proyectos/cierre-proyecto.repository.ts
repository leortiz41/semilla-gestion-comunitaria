import type { Pool, PoolClient } from 'pg';

type Consultable = Pick<Pool, 'query'>;
type EstadoCierre = {
  estado: string;
  actividades: number;
  metasCumplidas: number;
  pendientes: number;
  sinEvidencia: number;
  listo: boolean;
};

async function obtenerVerificacion(db: Consultable | PoolClient, proyectoId: string, organizacionId: string): Promise<EstadoCierre | null> {
  const resultado = await db.query<{ estado: string }>(
    `SELECT p.estado FROM proyectos p
     JOIN comunidades c ON c.id = p.comunidad_id
     WHERE p.id = $1 AND c.organizacion_id = $2`,
    [proyectoId, organizacionId],
  );
  if (!resultado.rows[0]) return null;
  const { rows } = await db.query<{
    id: string; estado: string; meta_cantidad: string | null;
    validado: string; estimacion: string; pendientes: number; fotos: number;
  }>(
    `SELECT a.id, a.estado, a.meta_cantidad,
       COALESCE((SELECT SUM(v.cantidad_reportada) FROM avances_proyecto v
         WHERE v.actividad_id = a.id AND v.proyecto_id = a.proyecto_id
         AND v.estado_revision = 'VALIDADO'), 0)::text AS validado,
       COALESCE((SELECT v.porcentaje_avance FROM avances_proyecto v
         WHERE v.actividad_id = a.id AND v.proyecto_id = a.proyecto_id
           AND v.estado_revision = 'VALIDADO' AND v.porcentaje_avance IS NOT NULL
         ORDER BY v.revisado_en DESC, v.creado_en DESC, v.id DESC LIMIT 1), 0)::text AS estimacion,
       (SELECT COUNT(*)::int FROM avances_proyecto v
         WHERE v.actividad_id = a.id AND v.proyecto_id = a.proyecto_id
         AND v.estado_revision <> 'VALIDADO') AS pendientes,
       (SELECT COUNT(*)::int FROM evidencias e
         JOIN avances_proyecto v ON v.id = e.avance_proyecto_id
         WHERE v.actividad_id = a.id AND v.proyecto_id = a.proyecto_id
           AND v.estado_revision = 'VALIDADO' AND e.proyecto_id = a.proyecto_id
           AND e.tipo_mime IN ('image/jpeg', 'image/png', 'image/webp')) AS fotos
     FROM actividades_programadas a
     JOIN proyectos p ON p.id = a.proyecto_id
     JOIN comunidades c ON c.id = p.comunidad_id
     WHERE p.id = $1 AND c.organizacion_id = $2
     ORDER BY a.id`,
    [proyectoId, organizacionId],
  );
  const metasCumplidas = rows.filter((r) =>
    r.estado !== 'CANCELADA' && (r.meta_cantidad === null
      ? Number(r.estimacion) >= 100
      : Number(r.validado) >= Number(r.meta_cantidad))).length;
  const pendientes = rows.reduce((acc, r) => acc + r.pendientes, 0);
  const sinEvidencia = rows.filter((r) => r.estado !== 'CANCELADA' && r.fotos === 0).length;
  const listo = rows.length > 0 && metasCumplidas === rows.length && pendientes === 0 && sinEvidencia === 0;
  return { estado: resultado.rows[0].estado, actividades: rows.length,
    metasCumplidas, pendientes, sinEvidencia, listo };
}

export function consultarCierreProyecto(pool: Consultable, proyectoId: string, organizacionId: string) {
  return obtenerVerificacion(pool, proyectoId, organizacionId);
}

export async function finalizarProyecto(pool: Pool, proyectoId: string, organizacionId: string,
  usuarioId: string, evidenciasRevisadas: boolean, recursosRevisados: boolean,
) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const actual = await cliente.query<{ estado: string }>(
      `SELECT p.estado FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
       WHERE p.id = $1 AND c.organizacion_id = $2 FOR UPDATE OF p`,
      [proyectoId, organizacionId],
    );
    if (!actual.rows.length) { await cliente.query('ROLLBACK'); return { tipo: 'NO_ENCONTRADO' } as const; }
    if (actual.rows[0].estado === 'FINALIZADO') {
      await cliente.query('ROLLBACK'); return { tipo: 'YA_FINALIZADO' } as const;
    }
    if (actual.rows[0].estado === 'CANCELADO') {
      await cliente.query('ROLLBACK'); return { tipo: 'CANCELADO' } as const;
    }
    const revision = await obtenerVerificacion(cliente, proyectoId, organizacionId);
    if (!revision?.listo || !evidenciasRevisadas || !recursosRevisados) {
      await cliente.query('ROLLBACK'); return { tipo: 'INCOMPLETO', revision } as const;
    }
    await cliente.query(
      `UPDATE proyectos SET estado = 'FINALIZADO', actualizado_en = NOW() WHERE id = $1`, [proyectoId],
    );
    await cliente.query(
      `INSERT INTO bitacora_auditoria
        (usuario_id, accion, nombre_entidad, entidad_id, valores_anteriores, valores_nuevos)
       VALUES ($1, 'FINALIZAR_PROYECTO', 'proyectos', $2, $3::jsonb, $4::jsonb)`,
      [usuarioId, proyectoId, JSON.stringify({ estado: actual.rows[0].estado }),
        JSON.stringify({ estado: 'FINALIZADO', evidenciasRevisadas, recursosRevisados, revision })],
    );
    await cliente.query('COMMIT');
    return { tipo: 'OK' } as const;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally { cliente.release(); }
}

export async function reabrirProyecto(pool: Pool, proyectoId: string, organizacionId: string,
  usuarioId: string, motivo: string,
) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const actual = await cliente.query<{ estado: string }>(
      `SELECT p.estado FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
       WHERE p.id = $1 AND c.organizacion_id = $2 FOR UPDATE OF p`,
      [proyectoId, organizacionId],
    );
    if (!actual.rows.length) { await cliente.query('ROLLBACK'); return 'NO_ENCONTRADO' as const; }
    if (actual.rows[0].estado !== 'FINALIZADO') {
      await cliente.query('ROLLBACK'); return 'NO_FINALIZADO' as const;
    }
    await cliente.query(
      `UPDATE proyectos SET estado = 'EN_EJECUCION', actualizado_en = NOW() WHERE id = $1`, [proyectoId],
    );
    await cliente.query(
      `INSERT INTO bitacora_auditoria
        (usuario_id, accion, nombre_entidad, entidad_id, valores_anteriores, valores_nuevos)
       VALUES ($1, 'REABRIR_PROYECTO', 'proyectos', $2, $3::jsonb, $4::jsonb)`,
      [usuarioId, proyectoId, JSON.stringify({ estado: 'FINALIZADO' }),
        JSON.stringify({ estado: 'EN_EJECUCION', motivo })],
    );
    await cliente.query('COMMIT');
    return 'OK' as const;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally { cliente.release(); }
}
