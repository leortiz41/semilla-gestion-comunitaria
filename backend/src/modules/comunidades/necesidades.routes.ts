import { consultarNecesidadesComunidad, crearNecesidadComunidad } from './necesidades.controller.js';
import { Router } from 'express';
import {
  authenticateAccessToken,
  requirePermission,
} from '../../middleware/auth.middleware.js';
export const necesidadesRouter = Router({ mergeParams: true });
necesidadesRouter.use(authenticateAccessToken);
necesidadesRouter.get('/', requirePermission('comunidades.ver'), consultarNecesidadesComunidad);
necesidadesRouter.post('/', requirePermission('comunidades.gestionar'), crearNecesidadComunidad);
