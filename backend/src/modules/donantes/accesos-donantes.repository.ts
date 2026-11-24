import type { Pool } from 'pg';
type Consultable = Pick<Pool, 'query'>;

/** Crea el acceso y asigna el rol DONANTE en una sola sentencia SQL. */
export async function insertarCuentaDonante(
  pool: Consultable, email: string, hash: string, adminUsuarioId: string, organizacionId: string,
) {
    const { rows } = await pool.query(
      `WITH rol AS (
         SELECT id FROM roles WHERE nombre = 'DONANTE' AND activo
       ), cuenta AS (
         INSERT INTO usuarios (email, hash_contrasena, organizacion_id, debe_cambiar_contrasena)
         SELECT $1, $2, u.organizacion_id, TRUE
         FROM usuarios u
         WHERE u.id = $3 AND u.organizacion_id = $4 AND u.activo
           AND EXISTS (SELECT 1 FROM rol)
           AND EXISTS (
             SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
             WHERE ur.usuario_id = u.id AND r.nombre = 'ADMINISTRADOR' AND r.activo
           )
         RETURNING id, email, activo
       ), asignacion AS (
         INSERT INTO usuarios_roles (usuario_id, rol_id)
         SELECT cuenta.id, rol.id FROM cuenta CROSS JOIN rol
       )
       SELECT id, email, activo FROM cuenta`,
      [email, hash, adminUsuarioId, organizacionId],
    );
  return rows[0] ?? null;
}

/** Relación proyecto-donante restringida al mismo tenant. */
export async function asignarProyectoDonante(
  pool: Consultable, proyectoId: string, donanteId: string, organizacionId: string, asignado: boolean,
) {
    const { rows } = await pool.query(
      `WITH alcance AS (
         SELECT u.id AS usuario_id, p.id AS proyecto_id
         FROM usuarios u CROSS JOIN proyectos p
         JOIN comunidades c ON c.id = p.comunidad_id
         WHERE u.id = $1 AND p.id = $2 AND u.organizacion_id = $3 AND c.organizacion_id = $3
           AND (NOT $4 OR u.activo)
           AND EXISTS (
             SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
             WHERE ur.usuario_id = u.id AND r.nombre = 'DONANTE' AND r.activo
           )
       ), asignacion AS (
         INSERT INTO proyectos_donantes (usuario_id, proyecto_id)
         SELECT usuario_id, proyecto_id FROM alcance WHERE $4
         ON CONFLICT DO NOTHING
       ), revocacion AS (
         DELETE FROM proyectos_donantes pd USING alcance a
         WHERE NOT $4 AND pd.usuario_id = a.usuario_id AND pd.proyecto_id = a.proyecto_id
       )
       SELECT EXISTS (SELECT 1 FROM alcance) AS permitido`,
      [donanteId, proyectoId, organizacionId, asignado],
    );
  return Boolean(rows[0]?.permitido);
}

/** Evidencia visible sólo cuando pertenece a la organización y cumple las reglas previas. */
export async function cambiarVisibilidadEvidenciaDonante(
  pool: Consultable, proyectoId: string, evidenciaId: string, organizacionId: string, compartida: boolean,
) {
    const resultado = await pool.query(
      `UPDATE evidencias e SET visible_para_donantes = $1, actualizado_en = NOW()
       FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
       WHERE e.id = $2 AND p.id = $3 AND e.proyecto_id = p.id AND c.organizacion_id = $4
         AND (NOT $1 OR (e.solicitud_pago_id IS NULL AND e.archivo_url LIKE 'https://%'))`,
      [compartida, evidenciaId, proyectoId, organizacionId],
    );
  return Boolean(resultado.rowCount);
}

/** Listado administrativo de fichas, proyectos, brigadas, comunidades y zonas. */
export async function consultarFichasDonantes(pool: Consultable, organizacionId: string) {
    const { rows } = await pool.query(
      `SELECT d.id, d.nombre, d.correo, d.telefono, d.activo,
              ARRAY(SELECT p.nombre FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
                WHERE c.organizacion_id = d.organizacion_id AND (
                  EXISTS (SELECT 1 FROM proyectos_fichas_donantes pd WHERE pd.donante_id = d.id AND pd.proyecto_id = p.id)
                  OR EXISTS (SELECT 1 FROM brigadas_donantes b JOIN brigadas_donantes_proyectos bp ON bp.brigada_id = b.id
                    WHERE b.donante_id = d.id AND bp.proyecto_id = p.id)
                ) ORDER BY p.nombre, p.id) AS proyectos,
              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', b.id, 'lider', b.lider, 'miembros', b.miembros, 'activo', b.activo,
                'zonaId', b.zona_id,
                'proyectoIds', ARRAY(SELECT bp.proyecto_id FROM brigadas_donantes_proyectos bp
                  WHERE bp.brigada_id = b.id),
                'comunidadIds', ARRAY(SELECT bc.comunidad_id FROM brigadas_donantes_comunidades bc
                  WHERE bc.brigada_id = b.id),
                'llegada', b.fecha_llegada::text, 'salida', b.fecha_salida::text,
                'actividades', b.lista_actividades, 'contrataciones', b.lista_contrataciones,
                'zona', (SELECT z.nombre FROM zonas z
                  WHERE z.id = b.zona_id AND z.organizacion_id = d.organizacion_id),
                'comunidades', ARRAY(SELECT c.nombre FROM brigadas_donantes_comunidades bc
                  JOIN comunidades c ON c.id = bc.comunidad_id AND c.organizacion_id = d.organizacion_id
                  WHERE bc.brigada_id = b.id ORDER BY c.nombre, c.id),
                'observaciones', b.observaciones,
                'proyectos', ARRAY(SELECT p.nombre FROM brigadas_donantes_proyectos bp
                  JOIN proyectos p ON p.id = bp.proyecto_id
                  JOIN comunidades c ON c.id = p.comunidad_id
                  WHERE bp.brigada_id = b.id AND c.organizacion_id = d.organizacion_id ORDER BY p.nombre, p.id)
              ) ORDER BY b.fecha_llegada DESC NULLS LAST, b.id)
              FROM brigadas_donantes b WHERE b.donante_id = d.id), '[]'::jsonb) AS brigadas
         FROM donantes d WHERE d.organizacion_id = $1 ORDER BY d.nombre, d.id`,
      [organizacionId],
    );
    const parametros = [organizacionId];
    const [comunidades, zonas] = await Promise.all([
      pool.query(
        'SELECT id, nombre, municipio, zona_id AS "zonaId" FROM comunidades WHERE organizacion_id = $1 AND activo ORDER BY nombre, id',
        parametros,
      ),
      pool.query(
        'SELECT id, nombre FROM zonas WHERE organizacion_id = $1 AND activo ORDER BY nombre, id',
        parametros,
      ),
    ]);
  return { fichas: rows, comunidades: comunidades.rows, zonas: zonas.rows };
}
