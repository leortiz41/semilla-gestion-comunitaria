import { Router } from 'express';
import {
  authenticateAccessToken,
  requirePermission,
} from '../middleware/auth.middleware.js';
import {
  cambiarEstadoZona,
  crearZona,
  editarZona,
  listarZonas,
} from '../services/zonas.service.js';

export const zonasRouter = Router();

zonasRouter.get(
  '/',
  authenticateAccessToken,
  requirePermission('comunidades.ver'),
  async (req, res) => {
    try {
      if (!req.auth?.organizacionId) {
        res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
        return;
      }

      const zonas = await listarZonas(req.auth.organizacionId);
      res.json({ zonas });
    } catch (error) {
      console.error('Error obteniendo zonas:', error);
      res.status(500).json({ message: 'No fue posible obtener las zonas.' });
    }
  },
);

zonasRouter.post(
  '/',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const descripcion = typeof req.body?.descripcion === 'string' ? req.body.descripcion : null;

    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }

    if (!nombre) {
      res.status(400).json({ message: 'El nombre de la zona es obligatorio.' });
      return;
    }

    if (nombre.length > 100) {
      res.status(400).json({ message: 'El nombre de la zona no puede superar 100 caracteres.' });
      return;
    }

    try {
      const zona = await crearZona(req.auth.organizacionId, { nombre, descripcion });
      res.status(201).json({ zona });
    } catch (error) {
      const codigo =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : null;

      if (codigo === '23505') {
        res.status(409).json({ message: 'Ya existe una zona con ese nombre en la organización.' });
        return;
      }

      console.error('Error creando zona:', error);
      res.status(500).json({ message: 'No fue posible crear la zona.' });
    }
  },
);

zonasRouter.patch(
  '/:id',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const descripcion = typeof req.body?.descripcion === 'string' ? req.body.descripcion : null;

    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }

    if (!nombre) {
      res.status(400).json({ message: 'El nombre de la zona es obligatorio.' });
      return;
    }

    if (nombre.length > 100) {
      res.status(400).json({ message: 'El nombre de la zona no puede superar 100 caracteres.' });
      return;
    }

    try {
      const zona = await editarZona(req.auth.organizacionId, req.params.id, {
        nombre,
        descripcion,
      });

      if (!zona) {
        res.status(404).json({ message: 'La zona no existe en la organización activa.' });
        return;
      }

      res.json({ zona });
    } catch (error) {
      const codigo =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : null;

      if (codigo === '23505') {
        res.status(409).json({ message: 'Ya existe una zona con ese nombre en la organización.' });
        return;
      }

      console.error('Error editando zona:', error);
      res.status(500).json({ message: 'No fue posible editar la zona.' });
    }
  },
);

zonasRouter.patch(
  '/:id/estado',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }

    if (typeof req.body?.activo !== 'boolean') {
      res.status(400).json({ message: 'El estado de la zona debe ser verdadero o falso.' });
      return;
    }

    try {
      const zona = await cambiarEstadoZona(
        req.auth.organizacionId,
        req.params.id,
        req.body.activo,
      );

      if (!zona) {
        res.status(404).json({ message: 'La zona no existe en la organización activa.' });
        return;
      }

      res.json({ zona });
    } catch (error) {
      console.error('Error cambiando estado de zona:', error);
      res.status(500).json({ message: 'No fue posible cambiar el estado de la zona.' });
    }
  },
);
