import { Router, type Request, type Response } from 'express';
import {
  ErrorInicializacion,
  crearSuperadministradorInicial,
  estadoInicializacionSuperadministrador,
} from '../services/inicializacion-superadministrador.service.js';

export const inicializacionSuperadministradorRouter = Router();

function metadatosSolicitud(req: Request) {
  return {
    direccionIp: req.ip || null,
    agenteUsuario: req.get('user-agent') ?? null,
  };
}

function esSolicitudSegura(req: Request): boolean {
  return process.env.NODE_ENV !== 'production' || req.secure;
}

function enviarError(res: Response, error: unknown): void {
  if (error instanceof ErrorInicializacion) {
    if (error.segundosReintento) res.set('Retry-After', String(error.segundosReintento));
    res.status(error.codigoEstado).json({ message: error.message });
    return;
  }

  console.error('Error en inicialización de superadministrador:', error);
  res.status(500).json({ message: 'No fue posible completar la configuración inicial.' });
}

inicializacionSuperadministradorRouter.get('/estado', async (_req, res) => {
  const estado = await estadoInicializacionSuperadministrador();
  res.set('Cache-Control', 'no-store');
  res.json(estado);
});

inicializacionSuperadministradorRouter.post('/', async (req, res) => {
  if (!esSolicitudSegura(req)) {
    res.status(400).json({ message: 'La configuración inicial requiere una conexión segura.' });
    return;
  }

  try {
    const resultado = await crearSuperadministradorInicial({
      secretoInstalacion: req.body?.secretoInstalacion,
      contrasena: req.body?.contrasena,
      ...metadatosSolicitud(req),
    });
    res.set('Cache-Control', 'no-store');
    res.status(201).json(resultado);
  } catch (error) {
    enviarError(res, error);
  }
});
