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
  async (_req, res) => {
    try {
      const resumen = await obtenerResumenDashboard();
      res.json(resumen);
    } catch (error) {
      console.error('Error obteniendo el resumen del dashboard:', error);
      res.status(500).json({
        message: 'No fue posible obtener el resumen del dashboard.',
      });
    }
  },
);
