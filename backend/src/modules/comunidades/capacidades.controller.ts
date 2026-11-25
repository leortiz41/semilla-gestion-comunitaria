import type { RequestHandler } from 'express';
import { esUuid, ErrorExpediente } from '../../domain/expediente.js';
import { obtenerCapacidades, guardarCapacidades, validarCapacidades } from './capacidades.service.js';

export const consultarCapacidadesComunidad: RequestHandler = async (req, res) => {
    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'Sesión sin organización.' });
      return;
    }
    if (!esUuid(req.params.id)) {
      res.status(400).json({ message: 'Comunidad inválida.' });
      return;
    }
    try {
      const capacidades = await obtenerCapacidades(
        req.auth.organizacionId,
        req.params.id,
      );
      if (!capacidades) {
        res.status(404).json({ message: 'Comunidad no encontrada.' });
        return;
      }
      res.json({ capacidades });
    } catch (e) {
      console.error('Error consultando capacidades:', e);
      res
        .status(500)
        .json({
          message: 'No fue posible consultar organización y productividad.',
        });
    }
  };

export const actualizarCapacidadesComunidad: RequestHandler = async (req, res) => {
    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'Sesión sin organización.' });
      return;
    }
    if (!esUuid(req.params.id)) {
      res.status(400).json({ message: 'Comunidad inválida.' });
      return;
    }
    try {
      const datos = validarCapacidades(req.body);
      const capacidades = await guardarCapacidades(
        req.auth.organizacionId,
        req.params.id,
        req.auth.sub,
        datos,
      );
      res.json({ capacidades });
    } catch (e) {
      if (e instanceof ErrorExpediente) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      console.error('Error guardando capacidades:', e);
      res
        .status(500)
        .json({
          message:
            'No fue posible guardar la sección. No se guardaron cambios parciales.',
        });
    }
  };
