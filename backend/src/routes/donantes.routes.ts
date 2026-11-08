import { randomBytes } from 'node:crypto';
import { hashPassword } from '../security/password.js';
import { Router, type RequestHandler } from 'express';
import { esUuid } from '../domain/expediente.js';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission, requireRole } from '../middleware/auth.middleware.js';

export const donantesRouter = Router();

donantesRouter.get(
  '/proyectos',
  authenticateAccessToken,
  requireRole('DONANTE'),
  requirePermission('proyectos.ver'),
  async (req, res) => {
    const acceso = req.auth;
    if (!acceso?.organizacionId) {
      res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }
    if (!databasePool) {
      res.status(503).json({ message: 'El seguimiento de proyectos no está disponible.' });
      return;
    }

    try {
      const { rows } = await databasePool.query(
        `SELECT p.id, p.nombre, p.estado, p.fecha_inicio::text AS "fechaInicio",
                a.porcentaje_avance::float AS "porcentajeAvance",
                a.fecha_avance::text AS "fechaAvance",
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'id', e.id, 'titulo', e.titulo, 'tipo', e.tipo_evidencia,
                    'url', e.archivo_url
                  ) ORDER BY e.creado_en DESC, e.id)
                  FROM evidencias e
                  WHERE $3 AND e.proyecto_id = p.id AND e.visible_para_donantes
                    AND e.solicitud_pago_id IS NULL AND e.archivo_url LIKE 'https://%'
                ), '[]'::jsonb) AS evidencias
           FROM proyectos_donantes pd
           JOIN proyectos p ON p.id = pd.proyecto_id
           JOIN comunidades c ON c.id = p.comunidad_id
           JOIN usuarios u ON u.id = pd.usuario_id AND u.organizacion_id = c.organizacion_id
           LEFT JOIN LATERAL (
             SELECT porcentaje_avance, fecha_avance FROM avances_proyecto
             WHERE proyecto_id = p.id
             ORDER BY fecha_avance DESC, creado_en DESC, id DESC
             LIMIT 1
           ) a ON TRUE
          WHERE pd.usuario_id = $1 AND c.organizacion_id = $2 AND u.activo
            AND EXISTS (
              SELECT 1 FROM usuarios_roles ur
              JOIN roles r ON r.id = ur.rol_id
              WHERE ur.usuario_id = u.id AND r.activo AND r.nombre = 'DONANTE'
            )
          ORDER BY p.nombre, p.id`,
        [acceso.sub, acceso.organizacionId, acceso.permisos.includes('evidencias.ver')],
      );
      res.json({ proyectos: rows });
    } catch (error) {
      console.error('Error consultando seguimiento del donante:', error);
      res.status(500).json({ message: 'No fue posible consultar los proyectos autorizados.' });
    }
  },
);

const administracionDonantes = Router();

administracionDonantes.use(
  authenticateAccessToken,
  requireRole('ADMINISTRADOR'),
  requirePermission('usuarios.gestionar'),
  requirePermission('proyectos.gestionar'),
  requirePermission('evidencias.gestionar'),
);

administracionDonantes.post('/cuentas', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: 'Ingresá un correo electrónico válido.' });
    return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'La administración de donantes no está disponible.' });
    return;
  }

  const acceso = req.auth!;
  try {
    const contrasenaTemporal = 'Aa1-' + randomBytes(18).toString('base64url');
    const hash = await hashPassword(contrasenaTemporal);
    const { rows } = await databasePool.query(
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
      [email, hash, acceso.sub, acceso.organizacionId],
    );
    if (!rows.length) {
      res.status(403).json({ message: 'Se requiere un administrador activo y el rol Donante habilitado.' });
      return;
    }
    res.set('Cache-Control', 'no-store');
    res.status(201).json({ donante: rows[0], contrasenaTemporal });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ message: 'Ya existe una cuenta con ese correo.' });
      return;
    }
    res.status(500).json({ message: 'No fue posible crear la cuenta de donante.' });
  }
});

administracionDonantes.get('/', async (req, res) => {
  if (!databasePool) {
    res.status(503).json({ message: 'La administración de donantes no está disponible.' });
    return;
  }
  const parametros = [req.auth!.organizacionId];
  try {
    const [donantes, proyectos] = await Promise.all([
      databasePool.query(
        `SELECT u.id, u.email, u.activo
           FROM usuarios u
          WHERE u.organizacion_id = $1
            AND EXISTS (
              SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
              WHERE ur.usuario_id = u.id AND r.nombre = 'DONANTE' AND r.activo
            )
          ORDER BY u.email, u.id`, parametros,
      ),
      databasePool.query(
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
    res.json({ donantes: donantes.rows, proyectos: proyectos.rows });
  } catch (error) {
    console.error('Error consultando administración de donantes:', error);
    res.status(500).json({ message: 'No fue posible consultar los accesos.' });
  }
});

administracionDonantes.put('/proyectos/:proyectoId/donantes/:donanteId', async (req, res) => {
  const { proyectoId, donanteId } = req.params;
  const asignado = req.body?.asignado;
  if (!esUuid(proyectoId) || !esUuid(donanteId) || typeof asignado !== 'boolean') {
    res.status(400).json({ message: 'Indicá un proyecto, un donante y el estado de acceso válidos.' });
    return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'La administración de donantes no está disponible.' });
    return;
  }
  try {
    const { rows } = await databasePool.query(
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
      [donanteId, proyectoId, req.auth!.organizacionId, asignado],
    );
    if (!rows[0].permitido) {
      res.status(404).json({ message: 'El proyecto o el donante no está disponible para esta operación.' });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error actualizando asignación de donante:', error);
    res.status(500).json({ message: 'No fue posible guardar el acceso.' });
  }
});

administracionDonantes.put('/proyectos/:proyectoId/evidencias/:evidenciaId', async (req, res) => {
  const { proyectoId, evidenciaId } = req.params;
  const compartida = req.body?.compartida;
  if (!esUuid(proyectoId) || !esUuid(evidenciaId) || typeof compartida !== 'boolean') {
    res.status(400).json({ message: 'Indicá una evidencia y un estado de publicación válidos.' });
    return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'La administración de donantes no está disponible.' });
    return;
  }
  try {
    const resultado = await databasePool.query(
      `UPDATE evidencias e SET visible_para_donantes = $1, actualizado_en = NOW()
       FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
       WHERE e.id = $2 AND p.id = $3 AND e.proyecto_id = p.id AND c.organizacion_id = $4
         AND (NOT $1 OR (e.solicitud_pago_id IS NULL AND e.archivo_url LIKE 'https://%'))`,
      [compartida, evidenciaId, proyectoId, req.auth!.organizacionId],
    );
    if (!resultado.rowCount) {
      res.status(404).json({ message: 'La evidencia no está disponible para esta operación.' });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error actualizando visibilidad de evidencia:', error);
    res.status(500).json({ message: 'No fue posible guardar la visibilidad.' });
  }
});

administracionDonantes.get('/fichas', async (req, res) => {
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const { rows } = await databasePool.query(
      `SELECT d.id, d.nombre, d.correo, d.telefono,
              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', b.id, 'lider', b.lider, 'miembros', b.miembros,
                'zonaId', b.zona_id, 'proyectoId', b.proyecto_id,
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
                'proyecto', (SELECT p.nombre FROM proyectos p
                  JOIN comunidades c ON c.id = p.comunidad_id
                  WHERE p.id = b.proyecto_id AND c.organizacion_id = d.organizacion_id)
              ) ORDER BY b.fecha_llegada DESC NULLS LAST, b.id)
              FROM brigadas_donantes b WHERE b.donante_id = d.id), '[]'::jsonb) AS brigadas
         FROM donantes d WHERE d.organizacion_id = $1 ORDER BY d.nombre, d.id`,
      [req.auth!.organizacionId],
    );
    const parametros = [req.auth!.organizacionId];
    const [comunidades, zonas] = await Promise.all([
      databasePool.query(
        'SELECT id, nombre, municipio, zona_id AS "zonaId" FROM comunidades WHERE organizacion_id = $1 AND activo ORDER BY nombre, id',
        parametros,
      ),
      databasePool.query(
        'SELECT id, nombre FROM zonas WHERE organizacion_id = $1 AND activo ORDER BY nombre, id',
        parametros,
      ),
    ]);
    res.json({ fichas: rows, comunidades: comunidades.rows, zonas: zonas.rows });
  } catch {
    res.status(500).json({ message: 'No fue posible consultar las fichas.' });
  }
});

administracionDonantes.post('/fichas', async (req, res) => {
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim().toLowerCase() : '';
  const telefono = typeof req.body?.telefono === 'string' ? req.body.telefono.trim() : '';
  if (!nombre || nombre.length > 180 || correo.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || telefono.length > 50) {
    res.status(400).json({ message: 'Revisá el nombre, el correo y el teléfono.' });
    return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    await databasePool.query(
      'INSERT INTO donantes (organizacion_id, nombre, correo, telefono) VALUES ($1, $2, $3, $4)',
      [req.auth!.organizacionId, nombre, correo, telefono || null],
    );
    res.sendStatus(204);
  } catch {
    res.status(500).json({ message: 'No fue posible guardar el donante.' });
  }
});

function esFechaValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(valor);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function esListaPlan(valor: unknown): valor is string[] {
  return Array.isArray(valor) && valor.length <= 50 &&
    valor.every((texto) => typeof texto === 'string' && texto.trim().length > 0 && texto.length <= 3000);
}

const guardarBrigada: RequestHandler = async (req, res) => {
  const { id, brigadaId } = req.params;
  const { miembros, llegada, salida, proyectoId, zonaId, comunidadIds, actividades, contrataciones } = req.body ?? {};
  const lider = typeof req.body?.lider === 'string' ? req.body.lider.trim() : '';
  const observaciones = req.body?.observaciones ?? '';
  if (!esUuid(id) || (brigadaId !== undefined && !esUuid(brigadaId)) || !esUuid(zonaId) || !Array.isArray(comunidadIds) ||
      !comunidadIds.every(esUuid) || new Set(comunidadIds).size !== comunidadIds.length || !lider || lider.length > 180 ||
      !Number.isInteger(miembros) || miembros < 1 || miembros > 100000 ||
      (llegada && !esFechaValida(llegada)) ||
      (salida && (!esFechaValida(salida) || !llegada || salida < llegada)) ||
      (proyectoId && !esUuid(proyectoId)) ||
      !esListaPlan(actividades) || !esListaPlan(contrataciones) ||
      typeof observaciones !== 'string' || observaciones.length > 3000) {
    res.status(400).json({ message: 'Revisá la zona, las comunidades y los datos del viaje.' });
    return;
  }
  const organizacion = req.auth!.organizacionId;
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const cliente = await databasePool.connect();
    try {
      await cliente.query('BEGIN');
      if (brigadaId) {
        const bloqueo = await cliente.query(
          `SELECT b.id FROM brigadas_donantes b JOIN donantes d ON d.id = b.donante_id
           WHERE b.id = $1 AND d.id = $2 AND d.organizacion_id = $3 FOR UPDATE OF b`,
          [brigadaId, id, organizacion],
        );
        if (!bloqueo.rowCount) {
          await cliente.query('ROLLBACK');
          res.status(404).json({ message: 'No se encontró la brigada.' });
          return;
        }
      }

      const datos = `SELECT d.id AS donante_id, $3::uuid AS proyecto_id, $4::text AS lider,
              $5::integer AS miembros, $6::date AS llegada, $7::date AS salida,
              $8::text[] AS actividades, $9::text[] AS contrataciones, $10::text AS observaciones,
              z.id AS zona_id
         FROM donantes d
         JOIN zonas z ON z.id = $11 AND z.organizacion_id = d.organizacion_id AND z.activo
         WHERE d.id = $1 AND d.organizacion_id = $2
           AND (SELECT count(*) FROM comunidades_validas) = cardinality($12::uuid[])
           AND ($3::uuid IS NULL OR EXISTS (
             SELECT 1 FROM proyectos p JOIN comunidades_validas c ON c.id = p.comunidad_id
             WHERE p.id = $3::uuid
           ))`;
      const operacion = brigadaId
        ? `UPDATE brigadas_donantes b SET proyecto_id = d.proyecto_id, lider = d.lider,
             miembros = d.miembros, fecha_llegada = d.llegada, fecha_salida = d.salida,
             lista_actividades = d.actividades, lista_contrataciones = d.contrataciones,
             observaciones = d.observaciones, zona_id = d.zona_id, comunidad_id = NULL
           FROM datos d WHERE b.id = $13 AND b.donante_id = d.donante_id RETURNING b.id`
        : `INSERT INTO brigadas_donantes
             (donante_id, proyecto_id, lider, miembros, fecha_llegada, fecha_salida,
              lista_actividades, lista_contrataciones, observaciones, zona_id)
           SELECT * FROM datos RETURNING id`;
      const parametros = [id, organizacion, proyectoId || null, lider, miembros,
        llegada || null, salida || null, actividades.map((texto) => texto.trim()),
        contrataciones.map((texto) => texto.trim()), observaciones.trim() || null, zonaId, comunidadIds];
      if (brigadaId) parametros.push(brigadaId);
      const resultado = await cliente.query(
        `WITH comunidades_validas AS (
           SELECT id FROM comunidades
           WHERE id = ANY($12::uuid[]) AND zona_id = $11 AND organizacion_id = $2 AND activo
         ), datos AS (${datos})
         ${operacion}`, parametros,
      );
      if (!resultado.rowCount) {
        await cliente.query('ROLLBACK');
        res.status(404).json({ message: 'La zona, las comunidades o el proyecto no corresponden a la selección.' });
        return;
      }

      const guardada = resultado.rows[0].id;
      if (brigadaId) {
        await cliente.query('DELETE FROM brigadas_donantes_comunidades WHERE brigada_id = $1', [guardada]);
      }
      await cliente.query(
        `INSERT INTO brigadas_donantes_comunidades (brigada_id, comunidad_id)
         SELECT $1, id FROM unnest($2::uuid[]) AS seleccion(id)`,
        [guardada, comunidadIds],
      );
      await cliente.query('COMMIT');
      res.sendStatus(204);
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  } catch {
    res.status(500).json({ message: 'No fue posible guardar la brigada.' });
  }
};

administracionDonantes.post('/fichas/:id/brigadas', guardarBrigada);
administracionDonantes.put('/fichas/:id/brigadas/:brigadaId', guardarBrigada);

administracionDonantes.delete('/fichas/:id/brigadas/:brigadaId', async (req, res) => {
  const { id, brigadaId } = req.params;
  if (!esUuid(id) || !esUuid(brigadaId)) {
    res.status(400).json({ message: 'Identificador de brigada inválido.' });
    return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const resultado = await databasePool.query(
      `DELETE FROM brigadas_donantes b USING donantes d
       WHERE b.id = $1 AND b.donante_id = d.id AND d.id = $2 AND d.organizacion_id = $3`,
      [brigadaId, id, req.auth!.organizacionId],
    );
    if (!resultado.rowCount) {
      res.status(404).json({ message: 'No se encontró la brigada.' });
      return;
    }
    res.sendStatus(204);
  } catch {
    res.status(500).json({ message: 'No fue posible eliminar la brigada.' });
  }
});

donantesRouter.use('/administracion', administracionDonantes);
