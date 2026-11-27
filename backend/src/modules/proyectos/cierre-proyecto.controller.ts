import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { esUuid } from '../../domain/expediente.js';
import { consultarEstadoCierre, ejecutarFinalizacionProyecto, ejecutarReaperturaProyecto } from './cierre-proyecto.service.js';

/** Adaptadores HTTP: no acceden a SQL ni implementan las reglas de cierre. */
export const obtenerEstadoCierre: RequestHandler = async (req, res) => {
  const { proyectoId } = req.params;
  if (!esUuid(proyectoId)) { res.status(400).json({ message: 'Proyecto no válido.' }); return; }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const estado = await consultarEstadoCierre(databasePool, proyectoId, req.auth!.organizacionId);
    if (!estado) { res.status(404).json({ message: 'Proyecto no encontrado.' }); return; }
    res.json({ ...estado, puedeReabrir: req.auth!.roles.includes('ADMINISTRADOR') });
  } catch (error) {
    console.error('Error consultando cierre:', error);
    res.status(500).json({ message: 'No fue posible consultar el cierre del proyecto.' });
  }
};

export const confirmarFinalizacionProyecto: RequestHandler = async (req, res) => {
  const { proyectoId } = req.params;
  if (!esUuid(proyectoId) ||
      req.body?.evidenciasRevisadas !== true || req.body?.recursosRevisados !== true) {
    res.status(400).json({ message: 'Confirmá la revisión de evidencias y recursos.' }); return;
  }
  if (!req.auth!.roles.some((rol) => rol === 'COORDINADOR' || rol === 'ADMINISTRADOR')) {
    res.status(403).json({ message: 'El cierre requiere coordinación o administración.' }); return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const resultado = await ejecutarFinalizacionProyecto(databasePool, {
      proyectoId, organizacionId: req.auth!.organizacionId, usuarioId: req.auth!.sub,
      evidenciasRevisadas: true, recursosRevisados: true,
    });
    if (resultado.tipo !== 'OK') {
      res.status(resultado.tipo === 'NO_ENCONTRADO' ? 404 : 409).json({
        message: resultado.tipo === 'INCOMPLETO'
          ? 'No se puede finalizar: verificá las metas, los avances pendientes y las evidencias por actividad.'
          : 'Este proyecto no está disponible para finalizar.',
        ...(resultado.tipo === 'INCOMPLETO' ? { revision: resultado.revision } : {}),
      });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error finalizando proyecto:', error);
    res.status(500).json({ message: 'No fue posible finalizar el proyecto.' });
  }
};

export const confirmarReaperturaProyecto: RequestHandler = async (req, res) => {
  const { proyectoId } = req.params;
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
  if (!esUuid(proyectoId) || motivo.length < 10 || motivo.length > 3000) {
    res.status(400).json({ message: 'Indica un motivo de reapertura de al menos 10 caracteres.' }); return;
  }
  if (!req.auth!.roles.includes('ADMINISTRADOR')) {
    res.status(403).json({ message: 'La reapertura requiere un administrador.' }); return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const resultado = await ejecutarReaperturaProyecto(databasePool, {
      proyectoId, organizacionId: req.auth!.organizacionId, usuarioId: req.auth!.sub, motivo,
    });
    if (resultado !== 'OK') {
      res.status(resultado === 'NO_ENCONTRADO' ? 404 : 409)
        .json({ message: 'El proyecto no existe o no está finalizado.' }); return;
    }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error reabriendo proyecto:', error);
    res.status(500).json({ message: 'No fue posible reabrir el proyecto.' });
  }
};
