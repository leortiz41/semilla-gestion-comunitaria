import { consultarCapacidadesComunidad, actualizarCapacidadesComunidad } from './capacidades.controller.js';
import { Router } from 'express';
import {
  authenticateAccessToken,
  requirePermission,
} from '../../middleware/auth.middleware.js';
export const capacidadesRouter = Router({ mergeParams: true });
capacidadesRouter.use(authenticateAccessToken);
capacidadesRouter.get('/', requirePermission('comunidades.ver'), consultarCapacidadesComunidad);
capacidadesRouter.put('/', requirePermission('comunidades.gestionar'), actualizarCapacidadesComunidad);
