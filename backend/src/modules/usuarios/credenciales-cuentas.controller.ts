import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { ErrorCredencialTemporal } from '../../services/credenciales-temporales.service.js';
import { reemitirCredencialDeCuenta } from './credenciales-cuentas.service.js';

/** Conserva contratos y restricciones HTTP del endpoint original. */
export const reemitirCredencialCuenta: RequestHandler = async (req, res) => {
  const usuarioId = req.params.usuarioId;
  if (typeof usuarioId !== 'string' || !/^[0-9a-f-]{36}$/i.test(usuarioId)) {
    res.status(400).json({ message: 'Cuenta inválida.' }); return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'Gestión de cuentas no disponible.' }); return;
  }
  if (req.auth!.debeCambiarContrasena) {
    res.status(403).json({ message: 'Cambiá tu contraseña temporal antes de gestionar cuentas.' }); return;
  }
  if (usuarioId === req.auth!.sub) {
    res.status(409).json({ message: 'Para cambiar tu propia contraseña usá Mi perfil → Seguridad.' }); return;
  }
  try {
    const respuesta = await reemitirCredencialDeCuenta(
      req.auth!.organizacionId, usuarioId, req.auth!.sub);
    if (!respuesta) {
      res.status(403).json({ message: 'Administración no autorizada.' }); return;
    }
    res.set('Cache-Control', 'no-store');
    res.status(201).json(respuesta);
  } catch (error) {
    if (error instanceof ErrorCredencialTemporal) {
      res.status(error.codigoEstado).json({ message: error.message }); return;
    }
    console.error('Error emitiendo credencial temporal de organización:', error);
    res.status(500).json({ message: 'No fue posible emitir una credencial temporal.' });
  }
};
