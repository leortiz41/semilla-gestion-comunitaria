import type { RequestHandler } from 'express';
import { esUuid } from '../../domain/expediente.js';
import { databasePool } from '../../config/database.js';
import {
  validarCorreoCuentaDonante, crearCuentaDonante, guardarAsignacionProyecto,
  publicarEvidenciaDonante, listarFichasDonantes,
} from './accesos-donantes.service.js';

export const crearCuentaAccesoDonante: RequestHandler = async (req, res) => {
  const email = validarCorreoCuentaDonante(req.body?.email);
  if (!email) {
    res.status(400).json({ message: 'Ingresá un correo electrónico válido.' });
    return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'La administración de donantes no está disponible.' });
    return;
  }
  try {
    const resultado = await crearCuentaDonante(databasePool, email, req.auth!.sub, req.auth!.organizacionId);
    if (!resultado) {
      res.status(403).json({ message: 'Se requiere un administrador activo y el rol Donante habilitado.' });
      return;
    }
    res.set('Cache-Control', 'no-store');
    res.status(201).json(resultado);
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ message: 'Ya existe una cuenta con ese correo.' });
      return;
    }
    res.status(500).json({ message: 'No fue posible crear la cuenta de donante.' });
  }
};

export const actualizarAsignacionProyectoDonante: RequestHandler = async (req, res) => {
  const { proyectoId, donanteId } = req.params;
  const asignado = req.body?.asignado;
  if (!esUuid(proyectoId) || !esUuid(donanteId) || typeof asignado !== 'boolean') {
    res.status(400).json({ message: 'Indicá un proyecto, un donante y el estado de acceso válidos.' });
    return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'La administración de donantes no está disponible.' });
    return;
  }
  try {
    const permitido = await guardarAsignacionProyecto(
      databasePool, proyectoId, donanteId, req.auth!.organizacionId, asignado,
    );
    if (!permitido) {
      res.status(404).json({ message: 'El proyecto o el donante no está disponible para esta operación.' });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error actualizando asignación de donante:', error);
    res.status(500).json({ message: 'No fue posible guardar el acceso.' });
  }
};

export const actualizarVisibilidadEvidenciaDonante: RequestHandler = async (req, res) => {
  const { proyectoId, evidenciaId } = req.params;
  const compartida = req.body?.compartida;
  if (!esUuid(proyectoId) || !esUuid(evidenciaId) || typeof compartida !== 'boolean') {
    res.status(400).json({ message: 'Indicá una evidencia y un estado de publicación válidos.' });
    return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'La administración de donantes no está disponible.' });
    return;
  }
  try {
    const actualizado = await publicarEvidenciaDonante(
      databasePool, proyectoId, evidenciaId, req.auth!.organizacionId, compartida,
    );
    if (!actualizado) {
      res.status(404).json({ message: 'La evidencia no está disponible para esta operación.' });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error actualizando visibilidad de evidencia:', error);
    res.status(500).json({ message: 'No fue posible guardar la visibilidad.' });
  }
};

export const obtenerFichasDonantes: RequestHandler = async (req, res) => {
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    res.json(await listarFichasDonantes(databasePool, req.auth!.organizacionId));
  } catch {
    res.status(500).json({ message: 'No fue posible consultar las fichas.' });
  }
};
