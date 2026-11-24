import type { Pool } from 'pg';

type Consultable = Pick<Pool, 'query'>;

/** Persistencia de la bandeja administrativa, restringida siempre a la organización. */
export async function consultarAdministracionDonantes(pool: Consultable, organizacionId: string) {
  const parametros = [organizacionId];
  const [donantes, proyectos] = await Promise.all([
    pool.query(
      `SELECT u.id, u.email, u.activo
         FROM usuarios u
        WHERE u.organizacion_id = $1
          AND EXISTS (
            SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
            WHERE ur.usuario_id = u.id AND r.nombre = 'DONANTE' AND r.activo
          )
        ORDER BY u.email, u.id`, parametros,
    ),
    pool.query(
      `SELECT p.id, p.nombre, p.comunidad_id AS "comunidadId",
              ARRAY(SELECT pd.usuario_id FROM proyectos_donantes pd
                    JOIN usuarios u ON u.id = pd.usuario_id AND u.organizacion_id = $1
                    WHERE pd.proyecto_id = p.id) AS "donanteIds",
              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                  'id', e.id, 'titulo', COALESCE(e.titulo, e.tipo_evidencia),
                  'compartida', e.visible_para_donantes
                ) ORDER BY e.creado_en DESC, e.id)
                FROM evidencias e
                WHERE e.proyecto_id = p.id AND e.solicitud_pago_id IS NULL
                  AND e.archivo_url LIKE 'https://%'), '[]'::jsonb) AS evidencias
         FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
        WHERE c.organizacion_id = $1
        ORDER BY p.nombre, p.id`, parametros,
    ),
  ]);
  return { donantes: donantes.rows, proyectos: proyectos.rows };
}

export async function insertarFichaDonante(
  pool: Consultable, organizacionId: string,
  datos: { nombre: string; correo: string; telefono: string | null },
): Promise<void> {
  await pool.query(
    'INSERT INTO donantes (organizacion_id, nombre, correo, telefono) VALUES ($1, $2, $3, $4)',
    [organizacionId, datos.nombre, datos.correo, datos.telefono],
  );
}

export async function cambiarEstadoDonante(
  pool: Consultable, organizacionId: string, fichaId: string,
  brigadaId: string | null, activo: boolean,
): Promise<boolean> {
  const parametros = [activo, fichaId, organizacionId];
  const resultado = brigadaId
    ? await pool.query(
      `UPDATE brigadas_donantes b SET activo = $1 FROM donantes d
       WHERE d.id = $2 AND d.organizacion_id = $3 AND b.donante_id = d.id AND b.id = $4`,
      [...parametros, brigadaId],
    )
    : await pool.query(
      'UPDATE donantes SET activo = $1 WHERE id = $2 AND organizacion_id = $3',
      parametros,
    );
  return Boolean(resultado.rowCount);
}
