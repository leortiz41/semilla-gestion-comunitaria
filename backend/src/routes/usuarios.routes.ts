import { Router } from 'express';
import { authenticateAccessToken, requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { obtenerRolesUsuarios, obtenerCuentasUsuarios } from '../modules/usuarios/usuarios.controller.js';
import { registrarCuentaOrganizacion } from '../modules/usuarios/cuentas.controller.js';
import { actualizarRolesUsuario } from '../modules/usuarios/roles.controller.js';
import { editarNombreCuenta, editarEmailCuenta } from '../modules/usuarios/edicion-cuentas.controller.js';
import { retirarCuentaUsuario } from '../modules/usuarios/retiro-cuentas.controller.js';
import { reemitirCredencialCuenta } from '../modules/usuarios/credenciales-cuentas.controller.js';

export const usuariosRouter = Router();

usuariosRouter.get('/roles', authenticateAccessToken, requirePermission('usuarios.ver'), obtenerRolesUsuarios);

// Cada administrador gestiona solamente cuentas de su propia organización.
// Los roles son perfiles del catálogo existente, no permisos globales editables.
usuariosRouter.get('/cuentas', authenticateAccessToken, requireRole('ADMINISTRADOR'),
  requirePermission('usuarios.gestionar'), obtenerCuentasUsuarios);

usuariosRouter.post('/cuentas', authenticateAccessToken, requireRole('ADMINISTRADOR'),
  requirePermission('usuarios.gestionar'), registrarCuentaOrganizacion);

// Retirada lógica: preserva datos relacionados e impide reactivar desde paneles.
usuariosRouter.post('/cuentas/:usuarioId/retirar', authenticateAccessToken,
  requireRole('ADMINISTRADOR'), requirePermission('usuarios.gestionar'), retirarCuentaUsuario);

// Los administradores reemiten una contraseña temporal solo para cuentas de su organización.
usuariosRouter.post('/cuentas/:usuarioId/credencial-temporal', authenticateAccessToken,
  requireRole('ADMINISTRADOR'), requirePermission('usuarios.gestionar'), reemitirCredencialCuenta);

// La edición del nombre visible conserva fotografía, credenciales y roles.
usuariosRouter.put('/cuentas/:usuarioId/nombre', authenticateAccessToken,
  requireRole('ADMINISTRADOR'), requirePermission('usuarios.gestionar'), editarNombreCuenta);

// La corrección del correo no modifica roles ni credenciales.
usuariosRouter.put('/cuentas/:usuarioId/email', authenticateAccessToken,
  requireRole('ADMINISTRADOR'), requirePermission('usuarios.gestionar'), editarEmailCuenta);

usuariosRouter.put('/cuentas/:usuarioId/roles', authenticateAccessToken,
  requireRole('ADMINISTRADOR'), requirePermission('usuarios.gestionar'), actualizarRolesUsuario);
