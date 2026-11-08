import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission } from '../middleware/auth.middleware.js';

export const usuariosRouter = Router();

usuariosRouter.get('/roles', authenticateAccessToken, requirePermission('usuarios.ver'), async (_req, res) => {
  try {
    if (!databasePool) {
      res.status(503).json({ message: 'El catálogo de roles no está disponible.' });
      return;
    }

    const { rows } = await databasePool.query(`
      SELECT r.nombre, r.activo,
        COALESCE(
          jsonb_agg(jsonb_build_object('codigo', p.codigo, 'descripcion', p.descripcion)
                    ORDER BY p.codigo) FILTER (WHERE p.id IS NOT NULL),
          '[]'::jsonb
        ) AS permisos
      FROM roles r
      LEFT JOIN roles_permisos rp ON rp.rol_id = r.id
      LEFT JOIN permisos p ON p.id = rp.permiso_id
      WHERE r.nombre IN ('ADMINISTRADOR', 'COORDINADOR', 'FINANZAS', 'CAMPO', 'CONSULTA')
      GROUP BY r.id, r.nombre, r.activo
    `);
    res.json({ roles: rows });
  } catch (error) {
    console.error('Error consultando catálogo de roles:', error);
    res.status(500).json({ message: 'No fue posible consultar los roles.' });
  }
});
