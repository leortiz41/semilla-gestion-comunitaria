import { Router } from 'express';
import { authenticateAccessToken } from '../middleware/auth.middleware.js';
import { superadminActual } from '../modules/plataforma/plataforma.middleware.js';
import { obtenerDashboardPlataforma, obtenerOrganizacionesPlataforma } from '../modules/plataforma/plataforma.controller.js';
import { registrarOrganizacion, modificarEstadoOrganizacion } from '../modules/plataforma/organizaciones.controller.js';
import { obtenerCuentasPlataforma, registrarCuentaPlataforma, modificarEstadoCuentaPlataforma } from '../modules/plataforma/cuentas-plataforma.controller.js';
import { modificarRolesCuentaPlataforma } from '../modules/plataforma/roles-cuentas.controller.js';
import { editarNombreCuentaPlataforma, editarEmailCuentaPlataforma, retirarCuentaPlataformaController } from '../modules/plataforma/edicion-cuentas.controller.js';
import { reemitirCredencialCuentaPlataforma } from '../modules/plataforma/credenciales-cuentas.controller.js';
import { consultarAccesosTenant, actualizarPermisosCuentaTenant, actualizarPermisosRolTenant } from '../modules/plataforma/permisos-tenant.controller.js';

export const plataformaRouter = Router();
plataformaRouter.use(authenticateAccessToken, superadminActual);

// Resumen de la plataforma para superadministradores, con estadísticas reales.
// Los conteos por tenant se derivan de sus relaciones y no incluyen datos personales.
plataformaRouter.get('/dashboard', obtenerDashboardPlataforma);

plataformaRouter.get('/organizaciones/:organizacionId/accesos', consultarAccesosTenant);
plataformaRouter.put('/organizaciones/:organizacionId/accesos/cuentas/:usuarioId/permisos', actualizarPermisosCuentaTenant);
plataformaRouter.put('/organizaciones/:organizacionId/accesos/roles/:nombre/permisos', actualizarPermisosRolTenant);

plataformaRouter.get('/organizaciones', obtenerOrganizacionesPlataforma);

plataformaRouter.post('/organizaciones', registrarOrganizacion);

// Desactivar un tenant suspende su acceso sin borrar sus datos; reactivar lo restaura.
plataformaRouter.patch('/organizaciones/:organizacionId/estado', modificarEstadoOrganizacion);

// Suspender una cuenta conserva su historial, documentos y roles asignados.
plataformaRouter.patch('/organizaciones/:organizacionId/cuentas/:usuarioId/estado', modificarEstadoCuentaPlataforma);

plataformaRouter.get('/organizaciones/:organizacionId/cuentas', obtenerCuentasPlataforma);

plataformaRouter.post('/organizaciones/:organizacionId/cuentas', registrarCuentaPlataforma);

// Nunca se recupera una contraseña anterior: se invalida y se emite una nueva.
plataformaRouter.post('/organizaciones/:organizacionId/cuentas/:usuarioId/credencial-temporal',
  reemitirCredencialCuentaPlataforma);

// El superadministrador puede mantener la identidad visible de cualquier cuenta activa
// de una organización sin cambiar su correo, fotografía ni credenciales.
plataformaRouter.put('/organizaciones/:organizacionId/cuentas/:usuarioId/nombre', editarNombreCuentaPlataforma);

// Retiro por soporte de plataforma: baja lógica auditada que no elimina relaciones históricas.
plataformaRouter.post('/organizaciones/:organizacionId/cuentas/:usuarioId/retirar', retirarCuentaPlataformaController);

// El superadministrador puede corregir correos de cuentas de organizaciones, nunca el suyo.
plataformaRouter.put('/organizaciones/:organizacionId/cuentas/:usuarioId/email', editarEmailCuentaPlataforma);

plataformaRouter.put('/organizaciones/:organizacionId/cuentas/:usuarioId/roles',
  modificarRolesCuentaPlataforma);
