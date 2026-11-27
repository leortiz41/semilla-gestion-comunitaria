import { Router } from 'express';
import { authenticateAccessToken, requirePermission, requireRole } from '../../middleware/auth.middleware.js';
import { consultarBrigadasFamiliares, actualizarBrigadaFamiliar } from './asignaciones-familias.controller.js';

export const asignacionesFamiliasRouter = Router();
asignacionesFamiliasRouter.use(
  authenticateAccessToken,
  requireRole('ADMINISTRADOR', 'COORDINADOR', 'CAMPO'),
  requirePermission('comunidades.ver'),
);

asignacionesFamiliasRouter.get('/:familiaId/perfiles/:perfilId/brigadas', consultarBrigadasFamiliares);
asignacionesFamiliasRouter.put(
  '/:familiaId/perfiles/:perfilId/brigada',
  requireRole('ADMINISTRADOR', 'COORDINADOR'),
  requirePermission('comunidades.gestionar'),
  actualizarBrigadaFamiliar,
);
