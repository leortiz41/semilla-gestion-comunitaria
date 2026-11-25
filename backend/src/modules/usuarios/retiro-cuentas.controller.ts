import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { retirarCuenta } from './retiro-cuentas.service.js';

export const retirarCuentaUsuario: RequestHandler = async (req, res) => {
  const id = req.params.usuarioId;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(400).json({ message: 'Cuenta inválida.' }); return;
  }
  if (id === req.auth!.sub) {
    res.status(409).json({ message: 'No podés retirar tu propia cuenta.' }); return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'Gestión de cuentas no disponible.' }); return;
  }
  try {
    const resultado = await retirarCuenta(id, req.auth!.sub, req.auth!.organizacionId);
    switch (resultado.estado) {
      case 'ADMINISTRACION_NO_AUTORIZADA':
        res.status(403).json({ message: 'Administración no autorizada.' }); return;
      case 'NO_ENCONTRADO':
        res.status(404).json({ message: 'Cuenta no encontrada.' }); return;
      case 'CUENTA_PROTEGIDA':
        res.status(403).json({ message: 'Cuenta de plataforma protegida.' }); return;
      case 'YA_RETIRADA':
        res.status(409).json({ message: 'Cuenta ya retirada.' }); return;
      case 'ULTIMO_ADMINISTRADOR':
        res.status(409).json({ message: 'La organización debe conservar al menos un administrador.' }); return;
      case 'RETIRADA':
        res.set('Cache-Control', 'no-store');
        res.json({ id: resultado.id, activo: false, retirado: true }); return;
    }
  } catch (error) {
    console.error('Error retirando usuario:', error);
    res.status(500).json({ message: 'No fue posible retirar la cuenta.' });
  }
};
