import { Router } from 'express';
import {
  authenticateAccessToken,
  requirePermission,
} from '../middleware/auth.middleware.js';
import { esUuid, ErrorExpediente } from '../domain/expediente.js';
import { validarNecesidad } from '../domain/necesidades.js';
import {
  listarNecesidades,
  registrarNecesidad,
} from '../services/necesidades.service.js';
export const necesidadesRouter = Router({ mergeParams: true });
necesidadesRouter.use(authenticateAccessToken);
necesidadesRouter.get(
  '/',
  requirePermission('comunidades.ver'),
  async (req, res) => {
    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'Sesión sin organización.' });
      return;
    }
    if (!esUuid(req.params.id)) {
      res.status(400).json({ message: 'Comunidad inválida.' });
      return;
    }
    try {
      const necesidades = await listarNecesidades(
        req.auth.organizacionId,
        req.params.id,
      );
      if (necesidades === null) {
        res.status(404).json({ message: 'Comunidad no encontrada.' });
        return;
      }
      res.json({ necesidades });
    } catch (e) {
      console.error('Error consultando necesidades:', e);
      res
        .status(500)
        .json({ message: 'No fue posible consultar las necesidades.' });
    }
  },
);
necesidadesRouter.post(
  '/',
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'Sesión sin organización.' });
      return;
    }
    if (!esUuid(req.params.id)) {
      res.status(400).json({ message: 'Comunidad inválida.' });
      return;
    }
    try {
      const datos = validarNecesidad(req.body);
      const necesidad = await registrarNecesidad(
        req.auth.organizacionId,
        req.params.id,
        req.auth.sub,
        datos,
      );
      res.status(201).json({ necesidad });
    } catch (e) {
      if (e instanceof ErrorExpediente) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      console.error('Error registrando necesidad:', e);
      res
        .status(500)
        .json({ message: 'No fue posible registrar la necesidad.' });
    }
  },
);
