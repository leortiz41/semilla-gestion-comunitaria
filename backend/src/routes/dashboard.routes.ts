import { Router } from 'express';
import {
  authenticateAccessToken,
  requirePermission,
} from '../middleware/auth.middleware.js';
import { obtenerResumenDashboard } from '../services/dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/resumen',
  authenticateAccessToken,
  requirePermission('comunidades.ver'),
  async (req, res) => {
    try {
      if (!req.auth?.organizacionId) {
        res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
        return;
      }

      const resumen = await obtenerResumenDashboard(req.auth.organizacionId);
      res.json(resumen);
    } catch (error) {
      console.error('Error obteniendo el resumen del dashboard:', error);
      res.status(500).json({
        message: 'No fue posible obtener el resumen del dashboard.',
      });
    }
  },
);
