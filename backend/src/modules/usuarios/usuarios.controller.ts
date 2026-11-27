import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { listarRolesDisponibles, listarCuentasOrganizacion } from './usuarios.service.js';

/** Controladores de consulta con los mismos mensajes HTTP y cache policy. */
export const obtenerRolesUsuarios: RequestHandler = async (_req, res) => {
  try {
    if (!databasePool) {
      res.status(503).json({ message: 'El catálogo de roles no está disponible.' });
      return;
    }

    const rows = await listarRolesDisponibles();
    res.json({ roles: rows });
  } catch (error) {
    console.error('Error consultando catálogo de roles:', error);
    res.status(500).json({ message: 'No fue posible consultar los roles.' });
  }
};

export const obtenerCuentasUsuarios: RequestHandler = async (req, res) => {
    if (!databasePool) { res.status(503).json({ message: 'Gestión de cuentas no disponible.' }); return; }
    try {
      const rows = await listarCuentasOrganizacion(req.auth!.organizacionId);
      res.set('Cache-Control', 'no-store');
      res.json({ cuentas: rows });
    } catch (error) {
      console.error('Error consultando cuentas de la organización:', error);
      res.status(500).json({ message: 'No fue posible consultar las cuentas.' });
    }
  };
