import type { Pool } from 'pg';

// Consultas de brigadas vinculadas a un proyecto, con alcance explícito de organización.
export async function listarBrigadasRecursos(pool: Pool, proyectoId: string, organizacionId: string) {
    const proyecto = await pool.query(
      `SELECT 1 FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
       WHERE p.id = $1 AND c.organizacion_id = $2`,
      [proyectoId, organizacionId],
    );
    if (!proyecto.rowCount) return null;
    const { rows } = await pool.query(
      `SELECT b.id, d.nombre AS donante, b.lider, b.miembros,
         (bp.proyecto_id IS NOT NULL) AS vinculada,
         COALESCE(r.monto_comprometido, 0)::double precision AS "montoComprometido",
         COALESCE(r.monto_recibido, 0)::double precision AS "montoRecibido",
         COALESCE(r.voluntarios_previstos, b.miembros) AS "voluntariosPrevistos",
         r.materiales_comprometidos AS "materialesComprometidos",
         r.materiales_entregados AS "materialesEntregados",
         r.observaciones,
         COALESCE(ARRAY(
           SELECT ba.actividad_id FROM brigadas_actividades_proyecto ba
           JOIN actividades_programadas a ON a.id = ba.actividad_id AND a.proyecto_id = $1
           WHERE ba.brigada_id = b.id AND ba.proyecto_id = $1
           ORDER BY a.nombre
         ), ARRAY[]::uuid[]) AS "actividadIds"
       FROM brigadas_donantes b
       JOIN donantes d ON d.id = b.donante_id
       LEFT JOIN brigadas_donantes_proyectos bp ON bp.brigada_id = b.id AND bp.proyecto_id = $1
       LEFT JOIN brigadas_recursos_proyecto r ON r.brigada_id = b.id AND r.proyecto_id = $1
       WHERE d.organizacion_id = $2 AND b.activo AND d.activo
       ORDER BY (bp.proyecto_id IS NOT NULL) DESC, d.nombre, b.lider, b.id`,
      [proyectoId, organizacionId],
    );
    return rows;
}

export interface DatosRecursosBrigada {
  vinculada: boolean;
  actividadIds: string[];
  montoComprometido: number;
  montoRecibido: number;
  voluntariosPrevistos: number;
  materialesComprometidos: string | null;
  materialesEntregados: string | null;
  observaciones: string | null;
}

export async function guardarRecursosBrigada(pool: Pool, proyectoId: string, brigadaId: string,
  organizacionId: string, datos: DatosRecursosBrigada,
): Promise<'OK' | 'NO_ENCONTRADO' | 'SIN_VINCULO' | 'ACTIVIDAD_INVALIDA' | 'TIENE_ENTREGAS'> {
  const { vinculada, actividadIds, montoComprometido, montoRecibido,
    voluntariosPrevistos, materialesComprometidos, materialesEntregados, observaciones } = datos;
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `SELECT b.id FROM brigadas_donantes b
       JOIN donantes d ON d.id = b.donante_id
       JOIN proyectos p ON p.id = $2
       JOIN comunidades c ON c.id = p.comunidad_id
       WHERE b.id = $1 AND b.activo AND d.activo
         AND d.organizacion_id = $3 AND c.organizacion_id = $3 AND p.estado <> 'FINALIZADO'`,
      [brigadaId, proyectoId, organizacionId],
    );
    if (!rows.length) {
      await cliente.query('ROLLBACK');
      return 'NO_ENCONTRADO';
    }
    const actividades = await cliente.query(
      `SELECT id FROM actividades_programadas
       WHERE proyecto_id = $1 AND id = ANY($2::uuid[])`,
      [proyectoId, actividadIds],
    );
    if (!vinculada && actividadIds.length) {
      await cliente.query('ROLLBACK');
      return 'SIN_VINCULO';
    }
    if (actividades.rowCount !== actividadIds.length) {
      await cliente.query('ROLLBACK');
      return 'ACTIVIDAD_INVALIDA';
    }
    if (vinculada) {
      await cliente.query(
        `INSERT INTO brigadas_donantes_proyectos (brigada_id, proyecto_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`, [brigadaId, proyectoId],
      );
      await cliente.query(
        `INSERT INTO brigadas_recursos_proyecto
           (brigada_id, proyecto_id, monto_comprometido, monto_recibido,
            voluntarios_previstos, materiales_comprometidos, materiales_entregados, observaciones)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (brigada_id, proyecto_id) DO UPDATE SET
           monto_comprometido = EXCLUDED.monto_comprometido,
           monto_recibido = EXCLUDED.monto_recibido,
           voluntarios_previstos = EXCLUDED.voluntarios_previstos,
           materiales_comprometidos = EXCLUDED.materiales_comprometidos,
           materiales_entregados = EXCLUDED.materiales_entregados,
           observaciones = EXCLUDED.observaciones, actualizado_en = NOW()`,
        [brigadaId, proyectoId, montoComprometido, montoRecibido, voluntariosPrevistos,
          materialesComprometidos ?? null, materialesEntregados ?? null, observaciones ?? null],
      );
      await cliente.query('DELETE FROM brigadas_actividades_proyecto WHERE brigada_id = $1 AND proyecto_id = $2',
        [brigadaId, proyectoId]);
      await cliente.query(
        `INSERT INTO brigadas_actividades_proyecto (brigada_id, proyecto_id, actividad_id)
         SELECT $1, $2, unnest($3::uuid[])`, [brigadaId, proyectoId, actividadIds],
      );
    } else {
      const entregas = await cliente.query(
        `SELECT 1 FROM brigadas_recursos_proyecto
         WHERE brigada_id = $1 AND proyecto_id = $2
           AND (monto_recibido > 0 OR NULLIF(TRIM(materiales_entregados), '') IS NOT NULL)`,
        [brigadaId, proyectoId],
      );
      if (entregas.rowCount) {
        await cliente.query('ROLLBACK');
        return 'TIENE_ENTREGAS';
      }
      await cliente.query('DELETE FROM brigadas_donantes_proyectos WHERE brigada_id = $1 AND proyecto_id = $2',
        [brigadaId, proyectoId]);
    }
    await cliente.query('COMMIT');
    return 'OK';
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
