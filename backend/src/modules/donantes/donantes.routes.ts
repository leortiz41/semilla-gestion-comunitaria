import { Router } from 'express';
import { authenticateAccessToken, requirePermission, requireRole } from '../../middleware/auth.middleware.js';
import { obtenerAdministracionDonantes, guardarFichaDonante, modificarEstadoDonante } from './administracion-donantes.controller.js';
import { guardarBrigadaDonante } from './brigadas.controller.js';
import { crearCuentaAccesoDonante, actualizarAsignacionProyectoDonante, actualizarVisibilidadEvidenciaDonante, obtenerFichasDonantes } from './accesos-donantes.controller.js';
import { listarProyectosAutorizadosDonante, obtenerMapaAutorizadoDonante, obtenerImpactoFamiliarAutorizado } from './portal-donantes.controller.js';

export const donantesRouter = Router();

// Consultas del portal: únicamente para donantes autorizados por middleware.
donantesRouter.get('/proyectos', authenticateAccessToken,
  requireRole('DONANTE'), requirePermission('proyectos.ver'), listarProyectosAutorizadosDonante);
donantesRouter.get('/mapa/proyectos/:proyectoId', authenticateAccessToken,
  requireRole('DONANTE'), requirePermission('proyectos.ver'), obtenerMapaAutorizadoDonante);
donantesRouter.get('/mapa/proyectos/:proyectoId/familias', authenticateAccessToken,
  requireRole('DONANTE'), requirePermission('proyectos.ver'), obtenerImpactoFamiliarAutorizado);

const administracionDonantes = Router();

administracionDonantes.use(
  authenticateAccessToken,
  requireRole('ADMINISTRADOR'),
  requirePermission('usuarios.gestionar'),
  requirePermission('proyectos.gestionar'),
  requirePermission('evidencias.gestionar'),
);

administracionDonantes.post('/cuentas', crearCuentaAccesoDonante);

administracionDonantes.get('/', obtenerAdministracionDonantes);

administracionDonantes.put('/proyectos/:proyectoId/donantes/:donanteId', actualizarAsignacionProyectoDonante);

administracionDonantes.put('/proyectos/:proyectoId/evidencias/:evidenciaId', actualizarVisibilidadEvidenciaDonante);

administracionDonantes.get('/fichas', obtenerFichasDonantes);

administracionDonantes.post('/fichas', guardarFichaDonante);

administracionDonantes.post('/fichas/:id/brigadas', guardarBrigadaDonante);
administracionDonantes.put('/fichas/:id/brigadas/:brigadaId', guardarBrigadaDonante);

administracionDonantes.put('/fichas/:id/estado', modificarEstadoDonante);
administracionDonantes.put('/fichas/:id/brigadas/:brigadaId/estado', modificarEstadoDonante);

donantesRouter.use('/administracion', administracionDonantes);
