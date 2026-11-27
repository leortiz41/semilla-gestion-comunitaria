import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { superadministradorVigente } from './plataforma.service.js';

/** Confirmación de privilegios globales contra la base, no solo contra el JWT. */
export function crearSuperadminActual(pool: Pool | null = databasePool): RequestHandler {
  return async (req, res, next) => {
  if (!pool || !req.auth) {
    res.status(503).json({ message: 'Gestión de plataforma no disponible.' }); return;
  }
  if (req.auth.debeCambiarContrasena) {
    res.status(403).json({ message: 'Cambiá tu contraseña antes de administrar la plataforma.' }); return;
  }
  if (!req.auth.roles.includes('SUPERADMINISTRADOR')) {
    res.status(403).json({ message: 'Acceso reservado al superadministrador.' }); return;
  }
  try {
    if (!await superadministradorVigente(req.auth.sub, pool)) {
      res.status(403).json({ message: 'Privilegios de plataforma revocados.' }); return;
    }
    next();
  } catch (error) {
    console.error('Error verificando permisos de plataforma:', error instanceof Error ? error.message : 'ErrorDesconocido');
    res.status(503).json({ message: 'No fue posible verificar acceso de plataforma.' });
  }
  };
}

export const superadminActual = crearSuperadminActual();
