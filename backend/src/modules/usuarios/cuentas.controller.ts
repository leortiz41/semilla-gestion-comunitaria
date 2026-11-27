import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { validarRoles, validarEmail, normalizarNombre, validarNombre } from './usuarios.domain.js';
import { AdministradorInactivoError, crearCuentaOrganizacion } from './cuentas.service.js';

export const registrarCuentaOrganizacion: RequestHandler = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const roles = validarRoles(req.body?.roles);
  const nombre = normalizarNombre(req.body?.nombre);
  const apellido = normalizarNombre(req.body?.apellido);
  const nombreVisible = [nombre, apellido].join(' ');
  if (!validarEmail(email) || !roles || !validarNombre(nombre) ||
      !validarNombre(apellido) || nombreVisible.length > 140) {
    res.status(400).json({ message: 'Revisá nombre, apellido, correo y roles seleccionados.' }); return;
  }
  if (!databasePool) { res.status(503).json({ message: 'Gestión de cuentas no disponible.' }); return; }
  try {
    const { cuenta, contrasenaTemporal } = await crearCuentaOrganizacion(
      { email, roles, nombreVisible }, req.auth!.sub, req.auth!.organizacionId,
    );
    res.set('Cache-Control', 'no-store');
    res.status(201).json({ cuenta, contrasenaTemporal });
  } catch (error) {
    if (error instanceof AdministradorInactivoError) {
      res.status(403).json({ message: 'El administrador debe estar activo en su organización.' }); return;
    }
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ message: 'Ese correo ya tiene una cuenta registrada.' }); return;
    }
    if ((error as Error).message === 'ROLES_NO_DISPONIBLES') {
      res.status(400).json({ message: 'Alguno de los roles seleccionados no está activo.' }); return;
    }
    console.error('Error creando usuario de la organización:', error);
    res.status(500).json({ message: 'No fue posible crear la cuenta.' });
  }
};
