import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../security/token.js';

export function authenticateAccessToken(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.header('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Se requiere autenticación.' });
    return;
  }

  const token = authorization.slice('Bearer '.length).trim();

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado.' });
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
