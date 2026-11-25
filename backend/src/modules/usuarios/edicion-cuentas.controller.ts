import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { normalizarNombre, validarEmail } from './usuarios.domain.js';
import { cambiarEmailCuenta, cambiarNombreCuenta } from './edicion-cuentas.service.js';

/** Las respuestas HTTP siguen conservando los mismos códigos y mensajes. */
export const editarNombreCuenta: RequestHandler = async (req, res) => {
  const usuarioId = req.params.usuarioId;
  const nombreVisible = normalizarNombre(req.body?.nombreVisible);
  if (typeof usuarioId !== 'string' || !/^[0-9a-f-]{36}$/i.test(usuarioId) ||
      nombreVisible.length < 2 || nombreVisible.length > 140 ||
      /[\x00-\x1f\x7f]/.test(nombreVisible)) {
    res.status(400).json({ message: 'Cuenta o nombre visible no válido (2 a 140 caracteres).' });
    return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'Gestión de cuentas no disponible.' }); return;
  }
  try {
    const resultado = await cambiarNombreCuenta(
      usuarioId, nombreVisible, req.auth!.sub, req.auth!.organizacionId);
    if (resultado.estado === 'ADMINISTRACION_NO_AUTORIZADA') {
      res.status(403).json({ message: 'Administración no autorizada.' }); return;
    }
    if (resultado.estado === 'NO_ENCONTRADO') {
      res.status(404).json({ message: 'Cuenta no encontrada en tu organización.' }); return;
    }
    if (resultado.estado === 'CUENTA_PROTEGIDA') {
      res.status(403).json({ message: 'La cuenta global no puede modificarse desde una organización.' }); return;
    }
    res.set('Cache-Control', 'no-store');
    res.json({ nombreVisible });
  } catch (error) {
    console.error('Error actualizando nombre visible de cuenta:', error);
    res.status(500).json({ message: 'No fue posible actualizar el nombre visible.' });
  }
};

export const editarEmailCuenta: RequestHandler = async (req, res) => {
  const usuarioId = req.params.usuarioId;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (typeof usuarioId !== 'string' || !/^[0-9a-f-]{36}$/i.test(usuarioId) || !validarEmail(email)) {
    res.status(400).json({ message: 'Usuario o correo electrónico inválido.' }); return;
  }
  if (!databasePool) { res.status(503).json({ message: 'Gestión de cuentas no disponible.' }); return; }
  try {
    const resultado = await cambiarEmailCuenta(
      usuarioId, email, req.auth!.sub, req.auth!.organizacionId);
    if (resultado.estado === 'ADMINISTRACION_NO_AUTORIZADA') {
      res.status(403).json({ message: 'Administración no autorizada.' }); return;
    }
    if (resultado.estado === 'NO_ENCONTRADO') {
      res.status(404).json({ message: 'Usuario no encontrado en tu organización.' }); return;
    }
    if (resultado.estado === 'CUENTA_PROTEGIDA') {
      res.status(403).json({ message: 'La cuenta global no puede modificarse desde una organización.' }); return;
    }
    res.set('Cache-Control', 'no-store');
    res.json({ email });
  } catch (error) {
    if ((error as {code?:string}).code === '23505') {
      res.status(409).json({ message: 'El correo ya está registrado en otra cuenta.' }); return;
    }
    console.error('Error cambiando correo de cuenta:', error);
    res.status(500).json({ message: 'No fue posible actualizar el correo.' });
  }
};
