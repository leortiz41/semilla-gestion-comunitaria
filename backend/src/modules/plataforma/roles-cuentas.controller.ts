import type { RequestHandler } from 'express';
import { actualizarRolesDesdePlataforma } from './roles-cuentas.service.js';

const rolesPermitidos = ['ADMINISTRADOR', 'COORDINADOR', 'FINANZAS', 'CAMPO', 'DONANTE'];
export const rolesValidosPlataforma = (roles: unknown): roles is string[] =>
  Array.isArray(roles) && roles.length > 0 && roles.length <= rolesPermitidos.length &&
  roles.every((rol) => typeof rol === 'string' && rolesPermitidos.includes(rol)) &&
  new Set(roles).size === roles.length && (!roles.includes('DONANTE') || roles.length === 1);
const esUuid = (valor: unknown): valor is string => typeof valor === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);

export const modificarRolesCuentaPlataforma: RequestHandler = async (req, res) => {
  const { organizacionId, usuarioId } = req.params;
  const roles = req.body?.roles;
  if (!esUuid(organizacionId) || !esUuid(usuarioId) || !rolesValidosPlataforma(roles)) {
    res.status(400).json({ message: 'Organización, usuario o roles inválidos.' }); return;
  }
  try {
    const resultado = await actualizarRolesDesdePlataforma({
      organizacionId, usuarioId, roles, operadorId: req.auth!.sub,
    });
    switch (resultado.estado) {
      case 'CUENTA_INACTIVA':
        res.status(404).json({ message: 'La cuenta o su organización no están activas.' }); return;
      case 'CUENTA_PROTEGIDA':
        res.status(403).json({ message: 'La cuenta de plataforma no admite edición desde este módulo.' }); return;
      case 'ULTIMO_ADMINISTRADOR':
        res.status(409).json({ message: 'No se puede quitar el último administrador de una organización.' }); return;
      case 'ROLES_NO_DISPONIBLES':
        res.status(400).json({ message: 'Hay roles no disponibles.' }); return;
      case 'ACTUALIZADO':
        res.json({ roles: resultado.roles }); return;
    }
  } catch (error) {
    console.error('Error cambiando roles desde plataforma:',
      error instanceof Error ? error.message : 'ErrorDesconocido');
    res.status(500).json({ message: 'No fue posible cambiar los perfiles de la cuenta.' });
  }
};
