import { necesidadesRouter } from './necesidades.routes.js';
import {capacidadesRouter} from './capacidades.routes.js';
import { validarExpediente, esUuid, ErrorExpediente } from '../../domain/expediente.js';
import { guardarExpediente, obtenerExpediente } from '../../services/expedientes.service.js';
import { Router } from 'express';
import { listarComunidades, crearComunidad, obtenerDiagnosticoComunidad, guardarDiagnosticoComunidad, obtenerVisionDesarrolloComunidad, guardarVisionDesarrolloComunidad, editarComunidad, actualizarEstadoComunidad } from './comunidades.controller.js';
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
comunidadesRouter.post(
  '/expedientes',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'Sesión sin organización.' });
      return;
    }
    try {
      const datos = validarExpediente(req.body);
      const comunidad = await guardarExpediente(
        req.auth.organizacionId,
        req.auth.sub,
        datos,
      );
      res.status(201).json({ comunidad });
    } catch (e) {
      if (e instanceof ErrorExpediente) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        e.code === '23505'
      ) {
        res.status(409).json({
          message: 'Ya existe una comunidad con ese nombre y ubicación.',
        });
        return;
      }
      console.error('Error guardando expediente:', e);
      res.status(500).json({
        message:
          'No fue posible guardar el expediente. No se guardaron cambios parciales.',
      });
    }
  },
);
comunidadesRouter.get(
  '/:id/expediente',
  authenticateAccessToken,
  requirePermission('comunidades.ver'),
  async (req, res) => {
    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'Sesión sin organización.' });
      return;
    }
    if (!esUuid(req.params.id)) {
      res.status(400).json({ message: 'Identificador de comunidad inválido.' });
      return;
    }
    try {
      const expediente = await obtenerExpediente(
        req.auth.organizacionId,
        req.params.id,
      );
      if (!expediente) {
        res.status(404).json({ message: 'Comunidad no encontrada.' });
        return;
      }
      res.json({ expediente });
    } catch (e) {
      console.error('Error consultando expediente:', e);
      res
        .status(500)
        .json({ message: 'No fue posible consultar el expediente.' });
    }
  },
);

comunidadesRouter.put(
  '/:id/diagnostico',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'Sesión sin organización.' });
      return;
    }
    if (
      !esUuid(req.params.id) ||
      !(
        req.body?.diagnosticoAnteriorId === null ||
        esUuid(req.body?.diagnosticoAnteriorId)
      )
    ) {
      res
        .status(400)
        .json({
          message:
            'Identificador de comunidad o versión del diagnóstico inválido.',
        });
      return;
    }
    try {
      const datos = validarExpediente({
        ...req.body,
        nombre: 'Diagnóstico',
        municipio: 'Sin cambio',
        departamento: 'Sin cambio',
        zonaId: '00000000-0000-0000-0000-000000000000',
        latitud: null,
        longitud: null,
      });
      const comunidad = await guardarExpediente(
        req.auth.organizacionId,
        req.auth.sub,
        datos,
        undefined,
        {
          comunidadId: req.params.id,
          diagnosticoAnteriorId: req.body.diagnosticoAnteriorId,
        },
      );
      res.json({ comunidad });
    } catch (e) {
      if (e instanceof ErrorExpediente) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      console.error('Error actualizando diagnóstico:', e);
      res
        .status(500)
        .json({
          message:
            'No se pudo actualizar el diagnóstico. No se guardaron cambios parciales.',
        });
    }
  },
);

comunidadesRouter.use('/:id/expediente/capacidades',capacidadesRouter);

comunidadesRouter.use('/:id/expediente/necesidades', necesidadesRouter);
