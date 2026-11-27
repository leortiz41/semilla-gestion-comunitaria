import { necesidadesRouter } from './necesidades.routes.js';
import {capacidadesRouter} from './capacidades.routes.js';
import { Router } from 'express';
import { listarComunidades, crearComunidad, obtenerDiagnosticoComunidad, guardarDiagnosticoComunidad, obtenerVisionDesarrolloComunidad, guardarVisionDesarrolloComunidad, editarComunidad, actualizarEstadoComunidad, crearExpedienteComunidad, consultarExpedienteComunidad, actualizarDiagnosticoExpediente } from './comunidades.controller.js';
import {
  authenticateAccessToken,
  requirePermission,
} from '../../middleware/auth.middleware.js';

export const comunidadesRouter = Router();

comunidadesRouter.get('/', authenticateAccessToken,
  requirePermission('comunidades.ver'), listarComunidades);

comunidadesRouter.post('/', authenticateAccessToken,
  requirePermission('comunidades.gestionar'), crearComunidad);

comunidadesRouter.get('/:id/expediente/poblacion-vivienda', authenticateAccessToken,
  requirePermission('comunidades.ver'), obtenerDiagnosticoComunidad);

comunidadesRouter.put('/:id/expediente/poblacion-vivienda', authenticateAccessToken,
  requirePermission('comunidades.gestionar'), guardarDiagnosticoComunidad);

comunidadesRouter.get('/:id/expediente/vision-desarrollo', authenticateAccessToken,
  requirePermission('comunidades.ver'), obtenerVisionDesarrolloComunidad);

comunidadesRouter.put('/:id/expediente/vision-desarrollo/:area', authenticateAccessToken,
  requirePermission('comunidades.gestionar'), guardarVisionDesarrolloComunidad);

comunidadesRouter.patch('/:id', authenticateAccessToken,
  requirePermission('comunidades.gestionar'), editarComunidad);

comunidadesRouter.patch('/:id/estado', authenticateAccessToken,
  requirePermission('comunidades.gestionar'), actualizarEstadoComunidad);

// El registro básico permanece compatible; este endpoint guarda todas las secciones.
comunidadesRouter.post('/expedientes', authenticateAccessToken,
  requirePermission('comunidades.gestionar'), crearExpedienteComunidad);

comunidadesRouter.get('/:id/expediente', authenticateAccessToken,
  requirePermission('comunidades.ver'), consultarExpedienteComunidad);

comunidadesRouter.put('/:id/diagnostico', authenticateAccessToken,
  requirePermission('comunidades.gestionar'), actualizarDiagnosticoExpediente);

comunidadesRouter.use('/:id/expediente/capacidades',capacidadesRouter);

comunidadesRouter.use('/:id/expediente/necesidades', necesidadesRouter);
