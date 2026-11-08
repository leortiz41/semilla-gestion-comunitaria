import { Router } from 'express';
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
