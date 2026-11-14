import { Router, type Request, type Response } from 'express';
import {
  BootstrapError,
  crearSuperadminInicial,
  estadoBootstrapSuperadmin,
} from '../services/bootstrap-superadmin.service.js';

export const bootstrapSuperadminRouter = Router();

function requestMetadata(req: Request) {
  return {
    direccionIp: req.ip || null,
    agenteUsuario: req.get('user-agent') ?? null,
  };
}

function isSecureRequest(req: Request): boolean {
  return process.env.NODE_ENV !== 'production' || req.secure;
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof BootstrapError) {
    if (error.retryAfterSeconds) res.set('Retry-After', String(error.retryAfterSeconds));
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  console.error('Error en bootstrap de superadministrador:', error);
  res.status(500).json({ message: 'No fue posible completar la configuración inicial.' });
}

bootstrapSuperadminRouter.get('/estado', async (_req, res) => {
  const state = await estadoBootstrapSuperadmin();
  res.set('Cache-Control', 'no-store');
  res.json(state);
});

bootstrapSuperadminRouter.post('/', async (req, res) => {
  if (!isSecureRequest(req)) {
    res.status(400).json({ message: 'La configuración inicial requiere una conexión segura.' });
    return;
  }

  try {
    const result = await crearSuperadminInicial({
      secretoInstalacion: req.body?.secretoInstalacion,
      contrasena: req.body?.contrasena,
      ...requestMetadata(req),
    });
    res.set('Cache-Control', 'no-store');
    res.status(201).json(result);
  } catch (error) {
    sendError(res, error);
  }
});
