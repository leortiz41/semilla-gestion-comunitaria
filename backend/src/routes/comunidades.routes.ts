import { Router } from 'express';
import {
  authenticateAccessToken,
  requirePermission,
} from '../middleware/auth.middleware.js';
import { listarComunidadesPorOrganizacion } from '../services/comunidades.service.js';

export const comunidadesRouter = Router();

comunidadesRouter.get(
  '/',
  authenticateAccessToken,
  requirePermission('comunidades.ver'),
  async (req, res) => {
    try {
      if (!req.auth?.organizacionId) {
        res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
        return;
      }

      const comunidades = await listarComunidadesPorOrganizacion(req.auth.organizacionId);
      res.json({ comunidades });
    } catch (error) {
      console.error('Error obteniendo comunidades:', error);
      res.status(500).json({
        message: 'No fue posible obtener las comunidades.',
      });
    }
  },
);
