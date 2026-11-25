import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { validarRoles } from './usuarios.domain.js';
import { cambiarRolesUsuario } from './roles.service.js';

/** HTTP compatible con las respuestas de gestión de roles existentes. */
export const actualizarRolesUsuario: RequestHandler = async (req, res) => {
  const roles = validarRoles(req.body?.roles);
  const usuarioId = req.params.usuarioId;
  if (!roles || typeof usuarioId !== 'string' || !/^[0-9a-f-]{36}$/i.test(usuarioId)) {
    res.status(400).json({ message: 'Usuario o roles no válidos.' }); return;
  }
  if (!databasePool) { res.status(503).json({ message: 'Gestión de cuentas no disponible.' }); return; }
  if (usuarioId === req.auth!.sub && !roles.includes('ADMINISTRADOR')) {
    res.status(409).json({ message: 'No podés quitarte tu propio rol de administrador.' }); return;
  }
  try {
    const resultado = await cambiarRolesUsuario(
      usuarioId, roles, req.auth!.sub, req.auth!.organizacionId,
    );
    switch (resultado.estado) {
      case 'NO_ENCONTRADO':
        res.status(404).json({ message: 'Usuario no encontrado en tu organización.' }); return;
      case 'CUENTA_PROTEGIDA':
        res.status(403).json({ message: 'Las cuentas de plataforma no pueden administrarse desde una organización.' }); return;
      case 'ADMINISTRACION_NO_AUTORIZADA':
        res.status(403).json({ message: 'Administración no autorizada.' }); return;
      case 'ULTIMO_ADMINISTRADOR':
        res.status(409).json({ message: 'La organización debe conservar al menos un administrador.' }); return;
      case 'ACTUALIZADO':
        res.json({ roles: resultado.roles }); return;
    }
  } catch (error) {
    if ((error as Error).message === 'ROLES_NO_DISPONIBLES') {
      res.status(400).json({ message: 'Alguno de los roles no está activo.' }); return;
    }
    console.error('Error actualizando roles:', error);
    res.status(500).json({ message: 'No fue posible actualizar los roles.' });
  }
};
