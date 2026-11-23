import type { Pool } from 'pg';
import { esUuid } from '../../domain/expediente.js';

// La persistencia nunca obtiene el tenant de la solicitud HTTP.
// El identificador de organización se recibe explícitamente de la capa de aplicación.
type Consultable = Pick<Pool, 'query'>;

// Verifica pertenencia del avance a la actividad, proyecto y organización de la sesión.
export async function consultarAccesoEvidenciaAvance(pool: Consultable | null, proyectoId: string, actividadId: string, avanceId: string, organizacionId: string) {
  if (!pool || ![proyectoId, actividadId, avanceId, organizacionId].every(esUuid)) return null;
  const { rows } = await pool.query(
    `SELECT av.id, av.estado_revision AS estado, av.responsable_usuario_id AS responsable
     FROM avances_proyecto av
     JOIN actividades_programadas a ON a.id = av.actividad_id AND a.proyecto_id = av.proyecto_id
     JOIN proyectos p ON p.id = a.proyecto_id
     JOIN comunidades c ON c.id = p.comunidad_id
     WHERE p.id = $1 AND a.id = $2 AND av.id = $3 AND c.organizacion_id = $4`,
    [proyectoId, actividadId, avanceId, organizacionId],
  );
  return rows[0] as { id: string; estado: string; responsable: string } | undefined;
}


/** Índice documental limitado a la organización autorizada; mantiene las consultas originales. */
export async function consultarIndiceEvidencias(pool: Consultable, organizacionId: string) {
    const { rows } = await pool.query(
      `SELECT av.id AS "avanceId", a.id AS "actividadId", p.id AS "proyectoId",
         p.nombre AS proyecto, p.estado AS "estadoProyecto",
         a.nombre AS actividad, c.nombre AS comunidad,
         av.fecha_avance::text AS fecha, av.estado_revision AS "estadoRevision",
         av.comentarios AS descripcion, av.observaciones,
         av.cantidad_reportada::float8 AS "cantidadReportada",
         av.porcentaje_avance::float8 AS "porcentajeAvance",
         av.revisado_en AS "revisadoEn", av.motivo_devolucion AS "motivoDevolucion",
         COALESCE(u.email, '') AS responsable,
         COALESCE(rev.email, '') AS revisor,
         (SELECT COUNT(*)::int FROM evidencias ev
           WHERE ev.proyecto_id=p.id AND ev.avance_proyecto_id=av.id
             AND ev.tipo_mime IN ('image/jpeg','image/png','image/webp')) AS "cantidadEvidencias"
       FROM avances_proyecto av
       JOIN actividades_programadas a ON a.id=av.actividad_id AND a.proyecto_id=av.proyecto_id
       JOIN proyectos p ON p.id=a.proyecto_id
       JOIN comunidades c ON c.id=p.comunidad_id
       LEFT JOIN usuarios u ON u.id=av.responsable_usuario_id
       LEFT JOIN usuarios rev ON rev.id=av.revisor_usuario_id
       WHERE c.organizacion_id=$1
       ORDER BY av.fecha_avance DESC, av.creado_en DESC, av.id DESC
       LIMIT 500`,
      [organizacionId],
    );
    const { rows: finalizados } = await pool.query(
      `SELECT p.id, p.nombre, c.nombre AS comunidad
       FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
       WHERE c.organizacion_id=$1 AND p.estado='FINALIZADO'
       ORDER BY p.nombre, p.id LIMIT 500`,
      [organizacionId],
    );
  return { avances: rows, proyectosFinalizados: finalizados };
}

/** Datos de la pantalla de proyectos: consultas paralelas con ámbito institucional. */
export async function consultarCatalogoProyectos(pool: Consultable, organizacionId: string) {
    const parametros = [organizacionId];
    const [proyectos, comunidades, donantes, organizacion] = await Promise.all([
      pool.query(
        `SELECT p.id, p.nombre, p.tipo, p.estado, p.descripcion, p.presupuesto_asignado::text AS "presupuesto",
                ARRAY(SELECT donante_id FROM proyectos_fichas_donantes WHERE proyecto_id = p.id) AS "donanteIds",
                ARRAY(SELECT d.nombre FROM donantes d
                  WHERE d.organizacion_id = c.organizacion_id AND (
                    EXISTS (SELECT 1 FROM proyectos_fichas_donantes pd WHERE pd.proyecto_id = p.id AND pd.donante_id = d.id)
                    OR EXISTS (SELECT 1 FROM brigadas_donantes_proyectos bp
                      JOIN brigadas_donantes b ON b.id = bp.brigada_id
                      WHERE bp.proyecto_id = p.id AND b.donante_id = d.id)
                  ) ORDER BY d.nombre, d.id) AS donantes,
                p.comunidad_id AS "comunidadId", c.nombre AS comunidad,
                p.fecha_inicio::text AS "fechaInicio", p.fecha_fin::text AS "fechaFin"
         FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
         WHERE c.organizacion_id = $1 ORDER BY p.fecha_inicio DESC, p.nombre, p.id`,
        parametros,
      ),
      pool.query(
        `SELECT id, nombre, municipio FROM comunidades
         WHERE organizacion_id = $1 AND activo ORDER BY nombre, municipio, id`,
        parametros,
      ),
      pool.query('SELECT id, nombre, activo FROM donantes WHERE organizacion_id = $1 ORDER BY nombre, id', parametros),
      pool.query('SELECT moneda FROM organizaciones WHERE id = $1', parametros),
    ]);
  return { proyectos: proyectos.rows, comunidades: comunidades.rows, donantes: donantes.rows,
    moneda: organizacion.rows[0]?.moneda ?? 'HNL' };
}

/** Usuarios activos aptos para responsabilizarse de actividades (sin rol DONANTE). */
export async function consultarResponsablesProyecto(pool: Consultable, proyectoId: string, organizacionId: string) {
      const { rows } = await pool.query(
        `SELECT u.id, u.email AS nombre
         FROM usuarios u
         JOIN comunidades c ON c.organizacion_id = u.organizacion_id
         JOIN proyectos p ON p.comunidad_id = c.id
         WHERE p.id = $1 AND c.organizacion_id = $2 AND u.activo
           AND NOT EXISTS (
             SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
             WHERE ur.usuario_id = u.id AND r.nombre = 'DONANTE'
           )
         ORDER BY u.email, u.id`,
        [proyectoId, organizacionId],
      );
  return rows;
}

/** Bandeja de avances enviados, filtrada por tenant y consultante. */
export async function consultarAvancesPendientes(pool: Consultable, organizacionId: string, usuarioId: string) {
    const { rows } = await pool.query(
      `SELECT av.id, av.actividad_id AS "actividadId", av.proyecto_id AS "proyectoId",
         a.nombre AS actividad, p.nombre AS proyecto, c.nombre AS comunidad,
         av.fecha_avance::text AS fecha, av.comentarios AS descripcion,
         av.observaciones, av.cantidad_reportada::double precision AS "cantidadReportada",
         av.porcentaje_avance::double precision AS "porcentajeAvance",
         a.unidad_medida AS "unidadMedida",
         a.meta_cantidad::double precision AS "metaCantidad",
         COALESCE((
           SELECT SUM(v.cantidad_reportada) FROM avances_proyecto v
           WHERE v.actividad_id = a.id AND v.proyecto_id = p.id
             AND v.estado_revision = 'VALIDADO' AND v.id <> av.id
         ), 0)::double precision AS "cantidadValidada",
         autor.email AS responsable,
         (SELECT COUNT(*)::int FROM evidencias ev WHERE ev.avance_proyecto_id = av.id
           AND ev.proyecto_id = p.id
           AND ev.tipo_mime IN ('image/jpeg', 'image/png', 'image/webp')) AS "cantidadEvidencias",
         (av.responsable_usuario_id = $2::uuid) AS "esPropio"
       FROM avances_proyecto av
       JOIN actividades_programadas a ON a.id = av.actividad_id AND a.proyecto_id = av.proyecto_id
       JOIN proyectos p ON p.id = a.proyecto_id
       JOIN comunidades c ON c.id = p.comunidad_id
       JOIN usuarios autor ON autor.id = av.responsable_usuario_id
       WHERE c.organizacion_id = $1 AND av.estado_revision = 'ENVIADO'
       ORDER BY av.fecha_avance DESC, av.creado_en DESC, av.id DESC
       LIMIT 200`,
      [organizacionId, usuarioId],
    );
  return rows;
}

/** Verifica la actividad en el proyecto/organización antes de registrar un avance. */
export async function consultarMetaActividad(pool: Consultable, proyectoId: string, actividadId: string, organizacionId: string) {
        const contexto = await pool.query(
          `SELECT a.meta_cantidad
           FROM actividades_programadas a
           JOIN proyectos p ON p.id = a.proyecto_id
           JOIN comunidades c ON c.id = p.comunidad_id
           WHERE p.id = $1 AND a.id = $2 AND c.organizacion_id = $3`,
          [proyectoId, actividadId, organizacionId],
        );
  return contexto.rows;
}

/** Requiere que el controlador haya validado el acceso al avance y al tenant. */
export async function consultarEvidenciasAvance(pool: Consultable, proyectoId: string, avanceId: string) {
    const { rows } = await pool.query(
      `SELECT id, titulo, descripcion, tipo_mime AS "tipoMime", archivo_url AS "archivoUrl", creado_en AS "creadoEn"
       FROM evidencias WHERE proyecto_id=$1 AND avance_proyecto_id=$2
       ORDER BY creado_en DESC, id DESC`, [proyectoId, avanceId],
    );
  return rows;
}

/** Requiere autorización previa del avance antes de recuperar la clave privada. */
export async function consultarClaveEvidencia(pool: Consultable, evidenciaId: string, proyectoId: string, avanceId: string) {
    const encontrado=await pool.query(
      `SELECT e.archivo_url AS clave FROM evidencias e
       WHERE e.id=$1 AND e.proyecto_id=$2 AND e.avance_proyecto_id=$3`,
      [evidenciaId,proyectoId,avanceId]);
    const clave=encontrado.rows[0]?.clave as string|undefined;
  return clave;
}

/** Escritura atómica de actividad; mantiene CTE, bloqueo y presupuesto del proyecto. */
export async function guardarActividadEnRepositorio(pool: Consultable, actividadId: string | null, valores: (string | number | null)[]) {
    // La creación no tiene actividadId: no enviar un parámetro $8 sin tipo.
    const valoresCreacion = [...valores.slice(0, 7), ...valores.slice(8)];
    const { rows } = actividadId
      ? await pool.query(
        `WITH proyecto AS MATERIALIZED (
           SELECT p.id, p.presupuesto_asignado, c.organizacion_id
           FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
           WHERE p.id = $1 AND c.organizacion_id = $2 AND p.estado <> 'FINALIZADO'
           FOR UPDATE OF p
         ), otros AS (
           SELECT COALESCE(SUM(a.presupuesto_estimado), 0) AS total
           FROM actividades_programadas a JOIN proyecto p ON p.id = a.proyecto_id
           WHERE a.id IS DISTINCT FROM $8::uuid
         )
         UPDATE actividades_programadas a SET nombre = $3, descripcion = $4, estado = $5,
           fecha_inicio = $6, fecha_fin = $7, responsable_asignado_usuario_id = $10,
           meta_cantidad = $11, unidad_medida = $12, presupuesto_estimado = $9,
           peso_resultado = $13, actualizado_en = NOW()
         FROM proyecto p CROSS JOIN otros o
         WHERE a.proyecto_id = p.id AND a.id = $8
           AND COALESCE($9::numeric, 0) + o.total <= p.presupuesto_asignado
           AND ($10::uuid IS NULL OR EXISTS (
             SELECT 1 FROM usuarios u WHERE u.id = $10 AND u.organizacion_id = p.organizacion_id AND u.activo
           ))
         RETURNING a.id`, valores,
      )
      : await pool.query(
        `WITH proyecto AS MATERIALIZED (
           SELECT p.id, p.presupuesto_asignado, c.organizacion_id
           FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
           WHERE p.id = $1 AND c.organizacion_id = $2 AND p.estado <> 'FINALIZADO'
           FOR UPDATE OF p
         ), otros AS (
           SELECT COALESCE(SUM(a.presupuesto_estimado), 0) AS total
           FROM actividades_programadas a JOIN proyecto p ON p.id = a.proyecto_id
         )
         INSERT INTO actividades_programadas (
           proyecto_id, nombre, descripcion, estado, fecha_inicio, fecha_fin,
           responsable_asignado_usuario_id, meta_cantidad, unidad_medida,
           presupuesto_estimado, peso_resultado
         )
         SELECT p.id, $3, $4, $5, $6, $7, $9, $10, $11, $8, $12
         FROM proyecto p CROSS JOIN otros o
         WHERE COALESCE($8::numeric, 0) + o.total <= p.presupuesto_asignado
           AND ($9::uuid IS NULL OR EXISTS (
             SELECT 1 FROM usuarios u WHERE u.id = $9 AND u.organizacion_id = p.organizacion_id AND u.activo
           ))
         RETURNING id`, valoresCreacion,
      );
  return rows;
}

/** Verificaciones posteriores a una escritura rechazada: tenant y presupuesto disponible. */
export async function existeProyectoEnOrganizacion(pool: Consultable, proyectoId: string, organizacionId: string) {
      const disponible = await pool.query(
        `SELECT 1 FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
         WHERE p.id = $1 AND c.organizacion_id = $2`,
        [proyectoId, organizacionId],
      );
  return disponible.rows.length > 0;
}

export async function consultarSaldoActividad(pool: Consultable, proyectoId: string, organizacionId: string, actividadId: string | null) {
      const { rows: saldos } = await pool.query(
        `SELECT p.presupuesto_asignado::numeric AS presupuesto,
          COALESCE(SUM(a.presupuesto_estimado) FILTER (WHERE a.id IS DISTINCT FROM $3::uuid), 0)::numeric AS asignado
         FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
         LEFT JOIN actividades_programadas a ON a.proyecto_id=p.id
         WHERE p.id=$1 AND c.organizacion_id=$2
         GROUP BY p.id,p.presupuesto_asignado`,
        [proyectoId,organizacionId,actividadId ?? null],
      );
  return saldos;
}

/** Escritura transaccional de proyectos y sus donantes; conserva bloqueo y rollback originales. */
export async function guardarProyectoEnRepositorio(
  pool: Pool,
  datos: { id?: string; organizacionId: string; presupuesto?: string; donanteIds?: string[];
    tipoDeDiagnostico: boolean; parametros: (string | null)[] },
) {
  const { id, organizacionId, presupuesto, donanteIds, tipoDeDiagnostico, parametros } = datos;
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      if (id && presupuesto !== undefined) {
        const asignacion = await cliente.query(
          `SELECT p.presupuesto_asignado::text AS presupuesto_actual,
             COALESCE((SELECT SUM(a.presupuesto_estimado) FROM actividades_programadas a
               WHERE a.proyecto_id = p.id), 0)::text AS presupuesto_actividades
           FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
           WHERE p.id = $1 AND c.organizacion_id = $2
           FOR UPDATE OF p`,
          [id, organizacionId],
        );
        if (asignacion.rows.length && Number(presupuesto) < Number(asignacion.rows[0].presupuesto_actividades)) {
          await cliente.query('ROLLBACK');
          return { tipo: 'PRESUPUESTO_INSUFICIENTE' } as const;
        }
      }
      const resultado = id
      ? await cliente.query(
        `UPDATE proyectos p SET nombre = $3, tipo = $4, estado = $5,
           fecha_inicio = $6, fecha_fin = $7, descripcion = $8, presupuesto_asignado = COALESCE($9, p.presupuesto_asignado), actualizado_en = NOW()
         FROM comunidades c
         WHERE p.id = $10 AND ($11::boolean OR p.tipo = $4) AND p.comunidad_id = c.id AND c.id = $1 AND c.organizacion_id = $2 AND p.estado <> 'FINALIZADO'
         RETURNING p.id`,
        [...parametros, id, tipoDeDiagnostico],
      )
      : await cliente.query(
        `INSERT INTO proyectos (comunidad_id, nombre, tipo, estado, fecha_inicio, fecha_fin, descripcion, presupuesto_asignado)
         SELECT id, $3, $4, $5, $6, $7, $8, COALESCE($9::numeric, 0) FROM comunidades
         WHERE id = $1 AND organizacion_id = $2 AND activo RETURNING id`,
        parametros,
      );
      if (!resultado.rowCount) {
        await cliente.query('ROLLBACK');
        return { tipo: 'NO_ENCONTRADO' } as const;
      }
      const proyectoId = resultado.rows[0].id;
      if (donanteIds !== undefined) {
        const seleccion = await cliente.query(
          `SELECT id FROM donantes d WHERE d.organizacion_id = $1 AND d.id = ANY($2::uuid[])
             AND (d.activo OR EXISTS (
               SELECT 1 FROM proyectos_fichas_donantes pd WHERE pd.proyecto_id = $3 AND pd.donante_id = d.id
             )) FOR SHARE OF d`,
          [organizacionId, donanteIds, proyectoId],
        );
        if (seleccion.rowCount !== donanteIds.length) {
          await cliente.query('ROLLBACK');
          return { tipo: 'DONANTES_INVALIDOS' } as const;
        }
        await cliente.query('DELETE FROM proyectos_fichas_donantes WHERE proyecto_id = $1', [proyectoId]);
        await cliente.query(
          'INSERT INTO proyectos_fichas_donantes (proyecto_id, donante_id) SELECT $1, unnest($2::uuid[])',
          [proyectoId, donanteIds],
        );
      }
      await cliente.query('COMMIT');
      return { tipo: 'OK', id: proyectoId } as const;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
}


/** Registro transaccional de fotografía previamente autorizada y verificada en R2.
 * Revalida el estado del avance bajo FOR UPDATE. La confirmación permite reintentos.
 */
export async function registrarEvidenciaEnRepositorio(
  pool: Pool,
  datos: {
    proyectoId: string; actividadId: string; avanceId: string; organizacionId: string;
    usuarioId: string; clave: string; mime: string; titulo: string; descripcion?: string;
    modo: 'proxy' | 'confirmar';
  },
): Promise<{ tipo: 'CAMBIO_ESTADO' } | { tipo: 'CREADA' | 'EXISTENTE'; id: string }> {
  const { proyectoId, actividadId, avanceId, organizacionId, usuarioId, clave, mime, titulo, descripcion, modo } = datos;
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const vigente = await cliente.query(
      `SELECT av.id FROM avances_proyecto av
       JOIN actividades_programadas a ON a.id=av.actividad_id AND a.proyecto_id=av.proyecto_id
       JOIN proyectos p ON p.id=a.proyecto_id JOIN comunidades c ON c.id=p.comunidad_id
       WHERE av.id=$1 AND a.id=$2 AND p.id=$3 AND c.organizacion_id=$4
         AND av.responsable_usuario_id=$5 AND av.estado_revision IN ('BORRADOR','DEVUELTO')
       FOR UPDATE OF av`,
      [avanceId, actividadId, proyectoId, organizacionId, usuarioId],
    );
    if (!vigente.rows.length) {
      await cliente.query('ROLLBACK');
      return { tipo: 'CAMBIO_ESTADO' };
    }

    if (modo === 'confirmar') {
      const existente = await cliente.query(
        'SELECT id FROM evidencias WHERE proyecto_id=$1 AND avance_proyecto_id=$2 AND archivo_url=$3 LIMIT 1',
        [proyectoId, avanceId, 'r2:' + clave],
      );
      if (existente.rows.length) {
        await cliente.query('COMMIT');
        return { tipo: 'EXISTENTE', id: existente.rows[0].id };
      }
    }

    const guardado = modo === 'confirmar'
      ? await cliente.query(
        `INSERT INTO evidencias (proyecto_id, avance_proyecto_id, tipo_evidencia, titulo, descripcion,
          archivo_url, tipo_mime, subido_por_usuario_id, visible_para_donantes)
         VALUES ($1,$2,'FOTOGRAFIA',$3,$4,$5,$6,$7,false) RETURNING id`,
        [proyectoId, avanceId, titulo || null, descripcion || null, 'r2:' + clave, mime, usuarioId],
      )
      : await cliente.query(
        `INSERT INTO evidencias
         (proyecto_id,avance_proyecto_id,tipo_evidencia,titulo,archivo_url,
          tipo_mime,subido_por_usuario_id,visible_para_donantes)
         VALUES ($1,$2,'FOTOGRAFIA',$3,$4,$5,$6,false) RETURNING id`,
        [proyectoId, avanceId, titulo || null, 'r2:' + clave, mime, usuarioId],
      );
    const evidenciaId = guardado.rows[0].id as string;
    await cliente.query(
      `INSERT INTO bitacora_auditoria (usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
       VALUES($1,'REGISTRAR_EVIDENCIA','evidencias',$2,$3::jsonb)`,
      [usuarioId, evidenciaId, JSON.stringify({ proyectoId, actividadId, avanceId, tipoMime: mime })],
    );
    await cliente.query('COMMIT');
    return { tipo: 'CREADA', id: evidenciaId };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

/** Explica un rechazo de validación sin exponer avances de otras organizaciones. */
export async function consultarLimiteDeValidacion(pool: Consultable, avanceId: string, actividadId: string, proyectoId: string, organizacionId: string) {
              const { rows: limites } = await pool.query<{
                meta: number; total: number; unidad: string | null;
              }>(
                `SELECT a.meta_cantidad::float AS meta,
                   (COALESCE((SELECT SUM(previo.cantidad_reportada)
                     FROM avances_proyecto previo
                     WHERE previo.actividad_id = a.id
                       AND previo.proyecto_id = p.id AND previo.id <> av.id
                       AND previo.estado_revision = 'VALIDADO'), 0)
                    + COALESCE(av.cantidad_reportada, 0))::float AS total,
                   a.unidad_medida AS unidad
                 FROM avances_proyecto av
                 JOIN actividades_programadas a ON a.id = av.actividad_id
                   AND a.proyecto_id = av.proyecto_id
                 JOIN proyectos p ON p.id = a.proyecto_id
                 JOIN comunidades c ON c.id = p.comunidad_id
                 WHERE av.id = $1 AND av.actividad_id = $2 AND av.proyecto_id = $3
                   AND c.organizacion_id = $4 AND av.estado_revision = 'ENVIADO'
                   AND a.meta_cantidad IS NOT NULL`,
                [avanceId, actividadId, proyectoId, organizacionId],
              );
  return limites[0];
}
