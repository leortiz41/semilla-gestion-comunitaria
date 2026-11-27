import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { esUuid } from '../../domain/expediente.js';
import {
  listarProyectosPortal, obtenerMapaPortal, obtenerImpactoFamiliarPortal,
  type ContextoPortalDonante,
} from './portal-donantes.service.js';

function contextoDeSesion(req: Parameters<RequestHandler>[0]): ContextoPortalDonante | null {
  const acceso = req.auth;
  if (!acceso?.organizacionId) return null;
  return {
    usuarioId: acceso.sub, organizacionId: acceso.organizacionId,
    puedeVerEvidencias: acceso.permisos.includes('evidencias.ver'),
  };
}

export const listarProyectosAutorizadosDonante: RequestHandler = async (req, res) => {
  const contexto = contextoDeSesion(req);
  if (!contexto) {
    res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
    return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'El seguimiento de proyectos no está disponible.' });
    return;
  }
  try {
    const proyectos = await listarProyectosPortal(databasePool, contexto);
    res.json({ proyectos });
  } catch (error) {
    console.error('Error consultando seguimiento del donante:', error);
    res.status(500).json({ message: 'No fue posible consultar los proyectos autorizados.' });
  }
};

export const obtenerMapaAutorizadoDonante: RequestHandler = async (req, res) => {
  const proyectoId = req.params.proyectoId;
  const contexto = contextoDeSesion(req);
  if (!esUuid(proyectoId)) {
    res.status(400).json({ message: 'Proyecto inválido.' });
    return;
  }
  if (!databasePool || !contexto) {
    res.status(503).json({ message: 'Mapa de avances no disponible.' });
    return;
  }
  try {
    const mapa = await obtenerMapaPortal(databasePool, proyectoId, contexto);
    if (!mapa) {
      res.status(404).json({ message: 'Proyecto no disponible para tu cuenta.' });
      return;
    }
    res.set('Cache-Control', 'no-store');
    res.json(mapa);
  } catch (error) {
    console.error('Error consultando mapa del donante:', error);
    res.status(500).json({ message: 'No fue posible consultar el mapa del donante.' });
  }
};

export const obtenerImpactoFamiliarAutorizado: RequestHandler = async (req, res) => {
  const proyectoId = req.params.proyectoId;
  if (!esUuid(proyectoId)) {
    res.status(400).json({ message: 'Proyecto inválido.' });
    return;
  }
  try {
    if (!databasePool) {
      res.status(503).json({ message: 'Base de datos no disponible.' });
      return;
    }
    const contexto = contextoDeSesion(req);
    if (!contexto) {
      res.status(503).json({ message: 'Base de datos no disponible.' });
      return;
    }
    const brigadas = await obtenerImpactoFamiliarPortal(databasePool, proyectoId, contexto);
    // No exponer identificaciones, direcciones, miembros ni documentos de las familias.
    res.set('Cache-Control', 'no-store');
    res.json({ brigadas });
  } catch (error) {
    console.error('Error consultando resumen de familias de brigada:', error);
    res.status(500).json({ message: 'No fue posible consultar el impacto familiar.' });
  }
};
