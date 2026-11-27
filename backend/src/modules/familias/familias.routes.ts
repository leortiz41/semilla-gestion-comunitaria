import { Router } from 'express';
import { authenticateAccessToken, requirePermission, requireRole } from '../../middleware/auth.middleware.js';
import {
  listarComunidadesPermitidas, listarExpedientesFamiliares,
  consultarExpedienteFamiliar, registrarFamilia, modificarFamilia,
} from './familias.controller.js';

export const familiasRouter = Router();

// Datos personales: solo equipo interno, nunca DONANTE.
familiasRouter.use(
  authenticateAccessToken,
  requireRole('ADMINISTRADOR', 'COORDINADOR', 'CAMPO'),
  requirePermission('comunidades.ver'),
);
const gestion = [requireRole('ADMINISTRADOR', 'COORDINADOR'), requirePermission('comunidades.gestionar')];

familiasRouter.get('/comunidades', listarComunidadesPermitidas);
familiasRouter.get('/', listarExpedientesFamiliares);
familiasRouter.get('/:familiaId', consultarExpedienteFamiliar);
familiasRouter.post('/', ...gestion, registrarFamilia);
familiasRouter.put('/:familiaId', ...gestion, modificarFamilia);
