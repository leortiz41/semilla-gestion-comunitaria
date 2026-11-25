import type { RequestHandler } from 'express';
import {
  cambiarNombreCuentaPlataforma, cambiarEmailCuentaPlataforma, retirarCuentaPlataforma,
} from './edicion-cuentas.service.js';

const esUuid = (valor: unknown): valor is string => typeof valor === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
const esCorreo = (correo: unknown): correo is string => typeof correo === 'string' &&
  correo.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
const errorHttp = (error: unknown) => error instanceof Error ? error.message : 'ErrorDesconocido';

export const editarNombreCuentaPlataforma: RequestHandler = async (req, res) => {
  const { organizacionId, usuarioId } = req.params;
  const nombreVisible = typeof req.body?.nombreVisible === 'string'
    ? req.body.nombreVisible.trim().replace(/\s+/g, ' ') : '';
  if (!esUuid(organizacionId) || !esUuid(usuarioId) || nombreVisible.length < 2 ||
      nombreVisible.length > 140 || /[\x00-\x1f\x7f]/.test(nombreVisible)) {
    res.status(400).json({ message: 'Organización, cuenta o nombre inválidos.' }); return;
  }
  try {
    const estado = await cambiarNombreCuentaPlataforma({
      organizacionId, usuarioId, operadorId: req.auth!.sub, nombreVisible,
    });
    if (estado === 'NO_DISPONIBLE') {
      res.status(404).json({ message: 'Cuenta u organización no activa.' }); return;
    }
    if (estado === 'PROTEGIDA') {
      res.status(403).json({ message: 'Cuenta de plataforma protegida.' }); return;
    }
    if (estado === 'RETIRADA') {
      res.status(409).json({ message: 'Cuenta retirada.' }); return;
    }
    res.set('Cache-Control', 'no-store'); res.json({ nombreVisible });
  } catch (error) {
    console.error('Error editando nombre de cuenta:', errorHttp(error));
    res.status(500).json({ message: 'No fue posible actualizar el nombre.' });
  }
};

export const editarEmailCuentaPlataforma: RequestHandler = async (req, res) => {
  const { organizacionId, usuarioId } = req.params;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!esUuid(organizacionId) || !esUuid(usuarioId) || !esCorreo(email)) {
    res.status(400).json({ message: 'Organización, usuario o correo inválidos.' }); return;
  }
  try {
    const estado = await cambiarEmailCuentaPlataforma({
      organizacionId, usuarioId, operadorId: req.auth!.sub, email,
    });
    if (estado === 'NO_DISPONIBLE') {
      res.status(404).json({ message: 'La cuenta o su organización no están activas.' }); return;
    }
    if (estado === 'PROTEGIDA') {
      res.status(403).json({ message: 'La cuenta global no admite edición desde este módulo.' }); return;
    }
    res.set('Cache-Control', 'no-store'); res.json({ email });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ message: 'El correo ya está registrado en otra cuenta.' }); return;
    }
    console.error('Error cambiando correo desde plataforma:', errorHttp(error));
    res.status(500).json({ message: 'No fue posible actualizar el correo.' });
  }
};

export const retirarCuentaPlataformaController: RequestHandler = async (req, res) => {
  const { organizacionId, usuarioId } = req.params;
  if (!esUuid(organizacionId) || !esUuid(usuarioId)) {
    res.status(400).json({ message: 'Cuenta u organización inválida.' }); return;
  }
  if (usuarioId === req.auth!.sub) {
    res.status(409).json({ message: 'No podés retirar tu propia cuenta.' }); return;
  }
  try {
    const estado = await retirarCuentaPlataforma({ organizacionId, usuarioId, operadorId: req.auth!.sub });
    if (estado === 'NO_DISPONIBLE') {
      res.status(404).json({ message: 'Cuenta u organización no disponible.' }); return;
    }
    if (estado === 'PROTEGIDA') {
      res.status(403).json({ message: 'Cuenta de plataforma protegida.' }); return;
    }
    if (estado === 'RETIRADA') {
      res.status(409).json({ message: 'La cuenta ya fue retirada.' }); return;
    }
    if (estado === 'ULTIMO_ADMINISTRADOR') {
      res.status(409).json({ message: 'La organización debe conservar al menos un administrador activo.' }); return;
    }
    res.set('Cache-Control', 'no-store'); res.json({ id: usuarioId, activo: false, retirado: true });
  } catch (error) {
    console.error('Error retirando cuenta desde plataforma:', errorHttp(error));
    res.status(500).json({ message: 'No fue posible retirar la cuenta.' });
  }
};
