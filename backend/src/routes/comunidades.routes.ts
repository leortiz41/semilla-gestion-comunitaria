import {
  validarExpediente,
  esUuid,
  ErrorExpediente,
} from '../domain/expediente.js';
import {
  guardarExpediente,
  obtenerExpediente,
} from '../services/expedientes.service.js';
import { Router } from 'express';
import {
  authenticateAccessToken,
  requirePermission,
} from '../middleware/auth.middleware.js';
import {
  crearComunidadBasica,
  editarComunidadBasica,
  listarComunidadesPorOrganizacion,
} from '../services/comunidades.service.js';

export const comunidadesRouter = Router();

comunidadesRouter.get(
  '/',
  authenticateAccessToken,
  requirePermission('comunidades.ver'),
  async (req, res) => {
    try {
      if (!req.auth?.organizacionId) {
        res
          .status(401)
          .json({ message: 'La sesión no contiene una organización válida.' });
        return;
      }

      const comunidades = await listarComunidadesPorOrganizacion(
        req.auth.organizacionId,
      );
      res.json({ comunidades });
    } catch (error) {
      console.error('Error obteniendo comunidades:', error);
      res.status(500).json({
        message: 'No fue posible obtener las comunidades.',
      });
    }
  },
);

comunidadesRouter.post(
  '/',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    if (!req.auth?.organizacionId) {
      res
        .status(401)
        .json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }

    const nombre =
      typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const zonaId =
      typeof req.body?.zonaId === 'string' ? req.body.zonaId.trim() : '';
    const municipio =
      typeof req.body?.municipio === 'string' ? req.body.municipio.trim() : '';
    const departamento =
      typeof req.body?.departamento === 'string'
        ? req.body.departamento.trim()
        : '';

    if (!nombre || !zonaId || !municipio || !departamento) {
      res.status(400).json({
        message: 'Nombre, zona, municipio y departamento son obligatorios.',
      });
      return;
    }

    if (
      nombre.length > 150 ||
      municipio.length > 120 ||
      departamento.length > 120
    ) {
      res
        .status(400)
        .json({ message: 'Uno de los campos supera la longitud permitida.' });
      return;
    }

    try {
      const comunidad = await crearComunidadBasica(req.auth.organizacionId, {
        nombre,
        zonaId,
        municipio,
        departamento,
      });

      if (!comunidad) {
        res.status(400).json({
          message:
            'La zona seleccionada no existe, está inactiva o no pertenece a la organización.',
        });
        return;
      }

      res.status(201).json({ comunidad });
    } catch (error) {
      const codigo =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : null;

      if (codigo === '23505') {
        res.status(409).json({
          message:
            'Ya existe una comunidad con ese nombre, municipio y departamento en la organización.',
        });
        return;
      }

      console.error('Error creando comunidad:', error);
      res
        .status(500)
        .json({ message: 'No fue posible registrar la comunidad.' });
    }
  },
);

comunidadesRouter.patch(
  '/:id',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    const comunidadId =
      typeof req.params.id === 'string' ? req.params.id : null;

    if (!req.auth?.organizacionId) {
      res
        .status(401)
        .json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }

    if (!comunidadId) {
      res
        .status(400)
        .json({ message: 'El identificador de la comunidad no es válido.' });
      return;
    }

    const nombre =
      typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const zonaId =
      typeof req.body?.zonaId === 'string' ? req.body.zonaId.trim() : '';
    const municipio =
      typeof req.body?.municipio === 'string' ? req.body.municipio.trim() : '';
    const departamento =
      typeof req.body?.departamento === 'string'
        ? req.body.departamento.trim()
        : '';

    if (!nombre || !zonaId || !municipio || !departamento) {
      res.status(400).json({
        message: 'Nombre, zona, municipio y departamento son obligatorios.',
      });
      return;
    }

    if (
      nombre.length > 150 ||
      municipio.length > 120 ||
      departamento.length > 120
    ) {
      res
        .status(400)
        .json({ message: 'Uno de los campos supera la longitud permitida.' });
      return;
    }

    try {
      const comunidad = await editarComunidadBasica(
        req.auth.organizacionId,
        comunidadId,
        {
          nombre,
          zonaId,
          municipio,
          departamento,
        },
      );

      if (!comunidad) {
        res.status(400).json({
          message:
            'La comunidad no existe o la zona seleccionada está inactiva o no pertenece a la organización.',
        });
        return;
      }

      res.json({ comunidad });
    } catch (error) {
      const codigo =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : null;

      if (codigo === '23505') {
        res.status(409).json({
          message:
            'Ya existe una comunidad con ese nombre, municipio y departamento en la organización.',
        });
        return;
      }

      console.error('Error editando comunidad:', error);
      res
        .status(500)
        .json({ message: 'No fue posible actualizar la comunidad.' });
    }
  },
);

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
