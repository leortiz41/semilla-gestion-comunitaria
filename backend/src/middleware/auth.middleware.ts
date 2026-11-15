import type { NextFunction, Request, Response } from 'express';
import { limitarAccesoDonante } from '../security/acceso-donante.js';
import { databasePool } from '../config/database.js';
import { verifyAccessToken } from '../security/token.js';

// Confirmar el estado actual en la base, no confiar solo en el JWT emitido.
export async function authenticateAccessToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Se requiere autenticación.' }); return;
  }
  let acceso: ReturnType<typeof verifyAccessToken>;
  try {
    acceso = verifyAccessToken(authorization.slice('Bearer '.length).trim());
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado.' }); return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'La autenticación no está disponible.' }); return;
  }
  try {
    const resultado = await databasePool.query(
      `SELECT 1 FROM usuarios u JOIN organizaciones o ON o.id=u.organizacion_id
        WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo AND o.activo LIMIT 1`,
      [acceso.sub, acceso.organizacionId],
    );
    if (!resultado.rows.length) {
      res.status(403).json({ message: 'La cuenta o su organización se encuentra desactivada.' }); return;
    }
    req.auth = { ...acceso, ...limitarAccesoDonante(acceso.roles, acceso.permisos) };
    next();
  } catch (error) {
    console.error('No se pudo verificar el estado de la sesión:', error);
    res.status(503).json({ message: 'No fue posible verificar la sesión.' });
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ message: 'Se requiere autenticación.' });
      return;
    }

    if (!req.auth.permisos.includes(permission)) {
      res.status(403).json({ message: 'No tiene permisos para realizar esta acción.' });
      return;
    }

    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ message: 'Se requiere autenticación.' });
      return;
    }

    if (!roles.some((role) => req.auth?.roles.includes(role))) {
      res.status(403).json({ message: 'Su rol no permite realizar esta acción.' });
      return;
    }

    next();
  };
}
