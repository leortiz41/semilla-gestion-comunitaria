import { Router } from 'express';
import {
  authenticateAccessToken,
  requirePermission,
} from '../middleware/auth.middleware.js';
import { obtenerResumenDashboard, obtenerEstadisticasDashboard, obtenerFiltrosDashboard, type SeleccionDashboard } from '../services/dashboard.service.js';

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

dashboardRouter.get(
  '/estadisticas',
  authenticateAccessToken,
  requirePermission('proyectos.ver'),
  async (req, res) => {
    try {
      if (!req.auth?.organizacionId || req.auth.roles.includes('DONANTE')) {
        res.status(403).json({ message: 'Las estadísticas institucionales requieren acceso administrativo.' });
        return;
      }
      const parametro = (nombre: string) => {
        const valor = req.query[nombre];
        return typeof valor === 'string' ? valor.trim() : '';
      };
      const comunidadId = parametro('comunidadId');
      const proyectoId = parametro('proyectoId');
      const area = parametro('area');
      const mesesTexto = parametro('meses');
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if ((comunidadId && !uuid.test(comunidadId)) || (proyectoId && !uuid.test(proyectoId)) ||
          area.length > 120 || (mesesTexto && !['3', '6', '12'].includes(mesesTexto))) {
        res.status(400).json({ message: 'Revisá los filtros de comunidad, proyecto, área y período.' });
        return;
      }
      const filtros: SeleccionDashboard = {
        comunidadId: comunidadId || undefined,
        proyectoId: proyectoId || undefined,
        area: area || undefined,
        meses: mesesTexto ? Number(mesesTexto) as 3 | 6 | 12 : undefined,
      };
      res.json(await obtenerEstadisticasDashboard(req.auth.organizacionId, filtros));
    } catch (error) {
      console.error('Error obteniendo estadísticas de proyectos:', error);
      res.status(500).json({ message: 'No fue posible obtener las estadísticas del Dashboard.' });
    }
  },
);

dashboardRouter.get(
  '/filtros',
  authenticateAccessToken,
  requirePermission('proyectos.ver'),
  async (req, res) => {
    try {
      if (!req.auth?.organizacionId || req.auth.roles.includes('DONANTE')) {
        res.status(403).json({ message: 'El catálogo del Dashboard requiere acceso administrativo.' });
        return;
      }
      res.json(await obtenerFiltrosDashboard(req.auth.organizacionId));
    } catch (error) {
      console.error('Error consultando filtros del Dashboard:', error);
      res.status(500).json({ message: 'No fue posible obtener los filtros del Dashboard.' });
    }
  },
);
