import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { esUuid } from '../../domain/expediente.js';
import {
  listarAccesosDonantes, validarFichaDonante, crearFichaDonante, actualizarEstadoDonante,
} from './administracion-donantes.service.js';

/** La autorización por rol y permisos se mantiene en el router administrativo. */
export const obtenerAdministracionDonantes: RequestHandler = async (req, res) => {
  if (!databasePool) {
    res.status(503).json({ message: 'La administración de donantes no está disponible.' });
    return;
  }
  try {
    const resultado = await listarAccesosDonantes(databasePool, req.auth!.organizacionId);
    res.json(resultado);
  } catch (error) {
    console.error('Error consultando administración de donantes:', error);
    res.status(500).json({ message: 'No fue posible consultar los accesos.' });
  }
};

export const guardarFichaDonante: RequestHandler = async (req, res) => {
  const datos = validarFichaDonante(req.body);
  if (!datos) {
    res.status(400).json({ message: 'Revisá el nombre, el correo y el teléfono.' });
    return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    await crearFichaDonante(databasePool, req.auth!.organizacionId, datos);
    res.sendStatus(204);
  } catch {
    res.status(500).json({ message: 'No fue posible guardar el donante.' });
  }
};

export const modificarEstadoDonante: RequestHandler = async (req, res) => {
  const { id, brigadaId } = req.params;
  const activo = req.body?.activo;
  if (!esUuid(id) || (brigadaId !== undefined && !esUuid(brigadaId)) || typeof activo !== 'boolean') {
    res.status(400).json({ message: 'Indicá un registro y un estado válidos.' });
    return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const actualizado = await actualizarEstadoDonante(
      databasePool, req.auth!.organizacionId, id, brigadaId ?? null, activo,
    );
    if (!actualizado) {
      res.status(404).json({ message: 'No se encontró el registro.' });
      return;
    }
    res.sendStatus(204);
  } catch {
    res.status(500).json({ message: 'No fue posible actualizar el estado.' });
  }
};
