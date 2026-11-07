import { validarExpediente, esUuid, ErrorExpediente } from '../domain/expediente.js';
import { guardarExpediente, obtenerExpediente } from '../services/expedientes.service.js';
import { Router } from 'express';
import {
  authenticateAccessToken,
  requirePermission,
} from '../middleware/auth.middleware.js';
import {
  type AreaVisionDesarrollo,
  cambiarEstadoComunidad,
  crearComunidadBasica,
  editarComunidadBasica,
  guardarDiagnosticoPoblacionVivienda,
  guardarVisionDesarrolloComunitaria,
  listarComunidadesPorOrganizacion,
  obtenerDiagnosticoPoblacionVivienda,
  obtenerVisionesDesarrolloComunitaria,
} from '../services/comunidades.service.js';

export const comunidadesRouter = Router();

function esEnteroNoNegativoONulo(valor: unknown): valor is number | null {
  return valor === null || (typeof valor === 'number' && Number.isInteger(valor) && valor >= 0);
}

const areasVisionDesarrollo: AreaVisionDesarrollo[] = [
  'EVANGELISMO',
  'EDUCACION_FORMAL',
  'EDUCACION_COMUNITARIA',
  'INFRAESTRUCTURA',
];

function esAreaVisionDesarrollo(valor: unknown): valor is AreaVisionDesarrollo {
  return typeof valor === 'string' && areasVisionDesarrollo.includes(valor as AreaVisionDesarrollo);
}

function esPrioridadVision(valor: unknown): valor is 'ALTA' | 'MEDIA' | 'BAJA' | null {
  return valor === null || valor === 'ALTA' || valor === 'MEDIA' || valor === 'BAJA';
}

comunidadesRouter.get(
  '/',
  authenticateAccessToken,
  requirePermission('comunidades.ver'),
  async (req, res) => {
    try {
      if (!req.auth?.organizacionId) {
        res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
        return;
      }

      const comunidades = await listarComunidadesPorOrganizacion(req.auth.organizacionId);
      res.json({ comunidades });
    } catch (error) {
      console.error('Error obteniendo comunidades:', error);
      res.status(500).json({
        message: 'No fue posible obtener las comunidades.',
      });
    }
  },
);

comunidadesRouter.post(
  '/',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }

    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const zonaId = typeof req.body?.zonaId === 'string' ? req.body.zonaId.trim() : '';
    const municipio = typeof req.body?.municipio === 'string' ? req.body.municipio.trim() : '';
    const departamento =
      typeof req.body?.departamento === 'string' ? req.body.departamento.trim() : '';

    if (!nombre || !zonaId || !municipio || !departamento) {
      res.status(400).json({
        message: 'Nombre, zona, municipio y departamento son obligatorios.',
      });
      return;
    }

    if (nombre.length > 150 || municipio.length > 120 || departamento.length > 120) {
      res.status(400).json({ message: 'Uno de los campos supera la longitud permitida.' });
      return;
    }

    try {
      const comunidad = await crearComunidadBasica(req.auth.organizacionId, {
        nombre,
        zonaId,
        municipio,
        departamento,
      });

      if (!comunidad) {
        res.status(400).json({
          message: 'La zona seleccionada no existe, está inactiva o no pertenece a la organización.',
        });
        return;
      }

      res.status(201).json({ comunidad });
    } catch (error) {
      const codigo =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : null;

      if (codigo === '23505') {
        res.status(409).json({
          message: 'Ya existe una comunidad con ese nombre, municipio y departamento en la organización.',
        });
        return;
      }

      console.error('Error creando comunidad:', error);
      res.status(500).json({ message: 'No fue posible registrar la comunidad.' });
    }
  },
);

comunidadesRouter.get(
  '/:id/expediente/poblacion-vivienda',
  authenticateAccessToken,
  requirePermission('comunidades.ver'),
  async (req, res) => {
    const comunidadId = typeof req.params.id === 'string' ? req.params.id : null;

    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }

    if (!comunidadId) {
      res.status(400).json({ message: 'El identificador de la comunidad no es válido.' });
      return;
    }

    try {
      const diagnostico = await obtenerDiagnosticoPoblacionVivienda(
        req.auth.organizacionId,
        comunidadId,
      );

      if (diagnostico === undefined) {
        res.status(404).json({ message: 'La comunidad no existe en la organización activa.' });
        return;
      }

      res.json({ diagnostico });
    } catch (error) {
      console.error('Error obteniendo diagnóstico comunitario:', error);
      res.status(500).json({ message: 'No fue posible obtener el diagnóstico comunitario.' });
    }
  },
);

comunidadesRouter.put(
  '/:id/expediente/poblacion-vivienda',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    const comunidadId = typeof req.params.id === 'string' ? req.params.id : null;

    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }

    if (!comunidadId) {
      res.status(400).json({ message: 'El identificador de la comunidad no es válido.' });
      return;
    }

    const poblacionAproximada = req.body?.poblacionAproximada ?? null;
    const viviendasAproximadas = req.body?.viviendasAproximadas ?? null;
    const viviendasIntervencion = req.body?.viviendasIntervencion ?? null;
    const tiposVivienda =
      typeof req.body?.tiposVivienda === 'string' ? req.body.tiposVivienda.trim() || null : null;

    if (
      !esEnteroNoNegativoONulo(poblacionAproximada) ||
      !esEnteroNoNegativoONulo(viviendasAproximadas) ||
      !esEnteroNoNegativoONulo(viviendasIntervencion)
    ) {
      res.status(400).json({ message: 'Las cantidades deben ser números enteros iguales o mayores a cero.' });
      return;
    }

    if (tiposVivienda?.length > 2000) {
      res.status(400).json({ message: 'La descripción de viviendas no puede superar 2000 caracteres.' });
      return;
    }

    try {
      const diagnostico = await guardarDiagnosticoPoblacionVivienda(
        req.auth.organizacionId,
        comunidadId,
        {
          poblacionAproximada,
          viviendasAproximadas,
          viviendasIntervencion,
          tiposVivienda,
        },
      );

      if (!diagnostico) {
        res.status(404).json({ message: 'La comunidad no existe en la organización activa.' });
        return;
      }

      res.json({ diagnostico });
    } catch (error) {
      console.error('Error guardando diagnóstico comunitario:', error);
      res.status(500).json({ message: 'No fue posible guardar el diagnóstico comunitario.' });
    }
  },
);

comunidadesRouter.get(
  '/:id/expediente/vision-desarrollo',
  authenticateAccessToken,
  requirePermission('comunidades.ver'),
  async (req, res) => {
    const comunidadId = typeof req.params.id === 'string' ? req.params.id : null;

    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }

    if (!comunidadId) {
      res.status(400).json({ message: 'El identificador de la comunidad no es válido.' });
      return;
    }

    try {
      const visiones = await obtenerVisionesDesarrolloComunitaria(
        req.auth.organizacionId,
        comunidadId,
      );

      if (visiones === undefined) {
        res.status(404).json({ message: 'La comunidad no existe en la organización activa.' });
        return;
      }

      res.json({ visiones });
    } catch (error) {
      console.error('Error obteniendo visión de desarrollo:', error);
      res.status(500).json({ message: 'No fue posible obtener la visión de desarrollo.' });
    }
  },
);

comunidadesRouter.put(
  '/:id/expediente/vision-desarrollo/:area',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    const comunidadId = typeof req.params.id === 'string' ? req.params.id : null;
    const areaParametro = req.params.area;
    const area = typeof areaParametro === 'string' ? areaParametro.toUpperCase() : null;

    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }

    if (!comunidadId || !esAreaVisionDesarrollo(area)) {
      res.status(400).json({ message: 'La comunidad o el área de desarrollo no son válidas.' });
      return;
    }

    const situacionActual =
      typeof req.body?.situacionActual === 'string' ? req.body.situacionActual.trim() || null : null;
    const metaDesarrollo =
      typeof req.body?.metaDesarrollo === 'string' ? req.body.metaDesarrollo.trim() || null : null;
    const prioridad = req.body?.prioridad ?? null;

    if (!esPrioridadVision(prioridad)) {
      res.status(400).json({ message: 'La prioridad debe ser alta, media o baja.' });
      return;
    }

    if (situacionActual?.length > 2000 || metaDesarrollo?.length > 2000) {
      res.status(400).json({ message: 'Cada descripción puede contener hasta 2000 caracteres.' });
      return;
    }

    try {
      const vision = await guardarVisionDesarrolloComunitaria(
        req.auth.organizacionId,
        comunidadId,
        { area, situacionActual, prioridad, metaDesarrollo },
      );

      if (!vision) {
        res.status(404).json({ message: 'La comunidad no existe en la organización activa.' });
        return;
      }

      res.json({ vision });
    } catch (error) {
      console.error('Error guardando visión de desarrollo:', error);
      res.status(500).json({ message: 'No fue posible guardar la visión de desarrollo.' });
    }
  },
);

comunidadesRouter.patch(
  '/:id',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    const comunidadId = typeof req.params.id === 'string' ? req.params.id : null;

    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }

    if (!comunidadId) {
      res.status(400).json({ message: 'El identificador de la comunidad no es válido.' });
      return;
    }

    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const zonaId = typeof req.body?.zonaId === 'string' ? req.body.zonaId.trim() : '';
    const municipio = typeof req.body?.municipio === 'string' ? req.body.municipio.trim() : '';
    const departamento =
      typeof req.body?.departamento === 'string' ? req.body.departamento.trim() : '';

    if (!nombre || !zonaId || !municipio || !departamento) {
      res.status(400).json({
        message: 'Nombre, zona, municipio y departamento son obligatorios.',
      });
      return;
    }

    if (nombre.length > 150 || municipio.length > 120 || departamento.length > 120) {
      res.status(400).json({ message: 'Uno de los campos supera la longitud permitida.' });
      return;
    }

    try {
      const comunidad = await editarComunidadBasica(req.auth.organizacionId, comunidadId, {
        nombre,
        zonaId,
        municipio,
        departamento,
      });

      if (!comunidad) {
        res.status(400).json({
          message: 'La comunidad no existe o la zona seleccionada está inactiva o no pertenece a la organización.',
        });
        return;
      }

      res.json({ comunidad });
    } catch (error) {
      const codigo =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : null;

      if (codigo === '23505') {
        res.status(409).json({
          message: 'Ya existe una comunidad con ese nombre, municipio y departamento en la organización.',
        });
        return;
      }

      console.error('Error editando comunidad:', error);
      res.status(500).json({ message: 'No fue posible actualizar la comunidad.' });
    }
  },
);

comunidadesRouter.patch(
  '/:id/estado',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    const comunidadId = typeof req.params.id === 'string' ? req.params.id : null;

    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }

    if (!comunidadId) {
      res.status(400).json({ message: 'El identificador de la comunidad no es válido.' });
      return;
    }

    if (typeof req.body?.activo !== 'boolean') {
      res.status(400).json({ message: 'El estado de la comunidad debe ser verdadero o falso.' });
      return;
    }

    try {
      const comunidad = await cambiarEstadoComunidad(
        req.auth.organizacionId,
        comunidadId,
        req.body.activo,
      );

      if (!comunidad) {
        res.status(404).json({ message: 'La comunidad no existe en la organización activa.' });
        return;
      }

      res.json({ comunidad });
    } catch (error) {
      console.error('Error cambiando estado de comunidad:', error);
      res.status(500).json({ message: 'No fue posible cambiar el estado de la comunidad.' });
    }
  },
);

// El registro básico permanece compatible; este endpoint guarda todas las secciones.
comunidadesRouter.post(
  '/expedientes',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'Sesión sin organización.' });
      return;
    }
    try {
      const datos = validarExpediente(req.body);
      const comunidad = await guardarExpediente(
        req.auth.organizacionId,
        req.auth.sub,
        datos,
      );
      res.status(201).json({ comunidad });
    } catch (e) {
      if (e instanceof ErrorExpediente) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        e.code === '23505'
      ) {
        res.status(409).json({
          message: 'Ya existe una comunidad con ese nombre y ubicación.',
        });
        return;
      }
      console.error('Error guardando expediente:', e);
      res.status(500).json({
        message:
          'No fue posible guardar el expediente. No se guardaron cambios parciales.',
      });
    }
  },
);
comunidadesRouter.get(
  '/:id/expediente',
  authenticateAccessToken,
  requirePermission('comunidades.ver'),
  async (req, res) => {
    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'Sesión sin organización.' });
      return;
    }
    if (!esUuid(req.params.id)) {
      res.status(400).json({ message: 'Identificador de comunidad inválido.' });
      return;
    }
    try {
      const expediente = await obtenerExpediente(
        req.auth.organizacionId,
        req.params.id,
      );
      if (!expediente) {
        res.status(404).json({ message: 'Comunidad no encontrada.' });
        return;
      }
      res.json({ expediente });
    } catch (e) {
      console.error('Error consultando expediente:', e);
      res
        .status(500)
        .json({ message: 'No fue posible consultar el expediente.' });
    }
  },
);

comunidadesRouter.put(
  '/:id/diagnostico',
  authenticateAccessToken,
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'Sesión sin organización.' });
      return;
    }
    if (
      !esUuid(req.params.id) ||
      !(
        req.body?.diagnosticoAnteriorId === null ||
        esUuid(req.body?.diagnosticoAnteriorId)
      )
    ) {
      res
        .status(400)
        .json({
          message:
            'Identificador de comunidad o versión del diagnóstico inválido.',
        });
      return;
    }
    try {
      const datos = validarExpediente({
        ...req.body,
        nombre: 'Diagnóstico',
        municipio: 'Sin cambio',
        departamento: 'Sin cambio',
        zonaId: '00000000-0000-0000-0000-000000000000',
        latitud: null,
        longitud: null,
      });
      const comunidad = await guardarExpediente(
        req.auth.organizacionId,
        req.auth.sub,
        datos,
        undefined,
        {
          comunidadId: req.params.id,
          diagnosticoAnteriorId: req.body.diagnosticoAnteriorId,
        },
      );
      res.json({ comunidad });
    } catch (e) {
      if (e instanceof ErrorExpediente) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      console.error('Error actualizando diagnóstico:', e);
      res
        .status(500)
        .json({
          message:
            'No se pudo actualizar el diagnóstico. No se guardaron cambios parciales.',
        });
    }
  },
);
