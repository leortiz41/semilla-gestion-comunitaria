import { Router } from 'express';
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
        `SELECT p.id, p.nombre,
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

donantesRouter.use('/administracion', administracionDonantes);
