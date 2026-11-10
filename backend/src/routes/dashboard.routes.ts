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

const widgetsPermitidos = new Set(['proyectos','actividades','presupuesto','evidencias','estados','areas','avances']);
function validarConfiguracionDashboard(valor: unknown): valor is {
  visibles: string[];
  posiciones: { id: string; x: number; y: number; w: number; h: number }[];
} {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const cfg = valor as Record<string, unknown>;
  if (!Array.isArray(cfg.visibles) || !Array.isArray(cfg.posiciones) ||
    cfg.visibles.length > 7 || cfg.posiciones.length > 7) return false;
  const visibles = cfg.visibles as unknown[];
  const posiciones = cfg.posiciones as unknown[];
  const ids = posiciones.map((p) => p && typeof p === 'object' ? (p as Record<string, unknown>).id : undefined);
  if (new Set(visibles).size !== visibles.length || new Set(ids).size !== ids.length) return false;
  return visibles.every((id) => typeof id === 'string' && widgetsPermitidos.has(id)) &&
    posiciones.every((p) => {
      if (!p || typeof p !== 'object') return false;
      const { id, x, y, w, h } = p as Record<string, unknown>;
      return typeof id === 'string' && widgetsPermitidos.has(id) &&
        typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < 12 &&
        typeof y === 'number' && Number.isInteger(y) && y >= 0 && y < 100 &&
        typeof w === 'number' && Number.isInteger(w) && w > 0 && w <= 12 && x + w <= 12 &&
        typeof h === 'number' && Number.isInteger(h) && h > 0 && h <= 12;
    });
}

dashboardRouter.get('/preferencias', authenticateAccessToken, requirePermission('proyectos.ver'), async (req, res) => {
  try {
    if (!req.auth?.organizacionId || req.auth.roles.includes('DONANTE')) {
      res.status(403).json({ message: 'Acceso administrativo requerido.' }); return;
    }
    const { databasePool } = await import('../config/database.js');
    if (!databasePool) throw new Error('Base de datos no disponible');
    const { rows } = await databasePool.query(
      `SELECT configuracion FROM preferencias_dashboard
       WHERE usuario_id=$1 AND organizacion_id=$2`,
      [req.auth.sub, req.auth.organizacionId],
    );
    res.json({ configuracion: rows[0]?.configuracion ?? null });
  } catch (error) {
    console.error('Error obteniendo preferencias del Dashboard:', error);
    res.status(500).json({ message: 'No fue posible cargar las preferencias del Dashboard.' });
  }
});

dashboardRouter.put('/preferencias', authenticateAccessToken, requirePermission('proyectos.ver'), async (req, res) => {
  try {
    if (!req.auth?.organizacionId || req.auth.roles.includes('DONANTE')) {
      res.status(403).json({ message: 'Acceso administrativo requerido.' }); return;
    }
    if (!validarConfiguracionDashboard(req.body?.configuracion)) {
      res.status(400).json({ message: 'La configuración del Dashboard no es válida.' }); return;
    }
    const { databasePool } = await import('../config/database.js');
    if (!databasePool) throw new Error('Base de datos no disponible');
    const { rowCount } = await databasePool.query(
      `INSERT INTO preferencias_dashboard (usuario_id, organizacion_id, configuracion)
       SELECT u.id, u.organizacion_id, $3::jsonb FROM usuarios u
       WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo
       ON CONFLICT (usuario_id, organizacion_id) DO UPDATE SET
         configuracion=EXCLUDED.configuracion, actualizado_en=NOW()`,
      [req.auth.sub, req.auth.organizacionId, JSON.stringify(req.body.configuracion)],
    );
    if (!rowCount) { res.status(403).json({ message: 'Usuario no autorizado.' }); return; }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error guardando preferencias del Dashboard:', error);
    res.status(500).json({ message: 'No fue posible guardar las preferencias del Dashboard.' });
  }
});
