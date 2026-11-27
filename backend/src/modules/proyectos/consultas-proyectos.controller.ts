import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import {
  obtenerCatalogoInstitucional, obtenerRevisionPendienteInstitucional,
} from './consultas-proyectos.service.js';

/** Controladores HTTP de consulta: sin SQL ni reglas de persistencia. */
export const listarAvancesPendientesRevision: RequestHandler = async (req, res) => {
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const rows = await obtenerRevisionPendienteInstitucional(
      databasePool, req.auth!.organizacionId, req.auth!.sub,
    );
    res.json({ pendientes: rows });
  } catch (error) {
    console.error('Error consultando avances pendientes:', error);
    res.status(500).json({ message: 'No fue posible consultar los avances pendientes.' });
  }
};

export const listarCatalogoProyectos: RequestHandler = async (req, res) => {
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const catalogo = await obtenerCatalogoInstitucional(databasePool, req.auth!.organizacionId);
    res.json(catalogo);
  } catch (error) {
    console.error('Error consultando proyectos:', error);
    res.status(500).json({ message: 'No fue posible consultar los proyectos.' });
  }
};
