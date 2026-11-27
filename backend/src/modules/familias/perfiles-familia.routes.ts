import { Router } from 'express';
import { authenticateAccessToken, requirePermission, requireRole } from '../../middleware/auth.middleware.js';
import {
  listarProyectosElegibles, listarEvaluacionesFamiliares,
  guardarEvaluacionFamiliar, revisarEvaluacionFamiliar,
} from './perfiles-familia.controller.js';

export const perfilesFamiliaRouter = Router();
perfilesFamiliaRouter.use(
  authenticateAccessToken, requireRole('ADMINISTRADOR', 'COORDINADOR', 'CAMPO'),
  requirePermission('comunidades.ver'),
);
const editar = [requireRole('ADMINISTRADOR', 'COORDINADOR'), requirePermission('comunidades.gestionar')];

perfilesFamiliaRouter.get('/opciones/proyectos', listarProyectosElegibles);
perfilesFamiliaRouter.get('/:familiaId/perfiles', listarEvaluacionesFamiliares);
perfilesFamiliaRouter.put('/:familiaId/perfiles/:proyectoId', ...editar, guardarEvaluacionFamiliar);
perfilesFamiliaRouter.post('/:familiaId/perfiles/:perfilId/revisar', ...editar, revisarEvaluacionFamiliar);
