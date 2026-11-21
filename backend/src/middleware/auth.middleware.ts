import type { NextFunction, Request, Response } from 'express';
import { limitarAccesoDonante } from '../security/acceso-donante.js';
import { databasePool } from '../config/database.js';
import { verifyAccessToken } from '../security/token.js';

// Confirmar el estado actual en la base, no confiar solo en el JWT emitido.
export function crearAutenticacion(pool: typeof databasePool = databasePool) {
 return async function authenticateAccessToken(req: Request, res: Response, next: NextFunction): Promise<void> {
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
  if (!pool) {
    res.status(503).json({ message: 'La autenticación no está disponible.' }); return;
  }
  try {
    const resultado = await pool.query(
      `SELECT
         ARRAY(SELECT DISTINCT r.nombre FROM usuarios_roles ur
           JOIN roles r ON r.id=ur.rol_id AND r.activo
           WHERE ur.usuario_id=u.id ORDER BY r.nombre) AS roles,
         ARRAY(SELECT DISTINCT p.codigo FROM usuarios_roles ur
           JOIN roles r ON r.id=ur.rol_id AND r.activo
           JOIN roles_permisos rp ON rp.rol_id=r.id
           JOIN permisos p ON p.id=rp.permiso_id
           WHERE ur.usuario_id=u.id AND NOT EXISTS (
             SELECT 1 FROM organizaciones_roles_permisos_restringidos bloqueado
             WHERE bloqueado.organizacion_id=u.organizacion_id
               AND bloqueado.rol_id=r.id AND bloqueado.permiso_id=p.id
           ) AND NOT EXISTS (
             SELECT 1 FROM usuarios_permisos_restringidos restr
             WHERE restr.organizacion_id=u.organizacion_id
               AND restr.usuario_id=u.id AND restr.permiso_id=p.id
           ) ORDER BY p.codigo) AS permisos
         FROM usuarios u JOIN organizaciones o ON o.id=u.organizacion_id
         WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo AND o.activo LIMIT 1`,
      [acceso.sub, acceso.organizacionId],
    );
    if (!resultado.rows.length) {
      res.status(403).json({ message: 'La cuenta o su organización se encuentra desactivada.' }); return;
    }
    const actual=resultado.rows[0] as {roles:string[];permisos:string[]};
    // En cada petición se recalculan permisos efectivos: revocaciones y cambios
    // de roles surten efecto inmediatamente, aunque el JWT anterior siga vigente.
    req.auth = { ...acceso, ...limitarAccesoDonante(actual.roles,actual.permisos) };
    next();
  } catch (error) {
    console.error('No se pudo verificar el estado de la sesión:', error);
    res.status(503).json({ message: 'No fue posible verificar la sesión.' });
  }
 };
}

export const authenticateAccessToken = crearAutenticacion();

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
