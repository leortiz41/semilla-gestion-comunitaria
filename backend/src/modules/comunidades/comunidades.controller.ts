import type { RequestHandler } from 'express';
import { ErrorExpediente, esUuid } from '../../domain/expediente.js';
import { validarMetasVision } from './metas-vision.domain.js';
import { listarComunidadesPorOrganizacion, crearComunidadBasica, obtenerDiagnosticoPoblacionVivienda, guardarDiagnosticoPoblacionVivienda, obtenerVisionesDesarrolloComunitaria, guardarVisionDesarrolloComunitaria, type AreaVisionDesarrollo, editarComunidadBasica, cambiarEstadoComunidad } from './comunidades.service.js';

/** Adaptadores HTTP para listado y alta de comunidades; permisos en rutas. */
export const listarComunidades: RequestHandler = async (req, res) => {
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
  };

export const crearComunidad: RequestHandler = async (req, res) => {
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
  };

function esEnteroNoNegativoONulo(valor: unknown): valor is number | null {
  return valor === null || (typeof valor === 'number' && Number.isInteger(valor) && valor >= 0);
}

export const obtenerDiagnosticoComunidad: RequestHandler = async (req, res) => {
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
  };

export const guardarDiagnosticoComunidad: RequestHandler = async (req, res) => {
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
  };

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


export const obtenerVisionDesarrolloComunidad: RequestHandler = async (req, res) => {
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
  };

export const guardarVisionDesarrolloComunidad: RequestHandler = async (req, res) => {
    const comunidadId = typeof req.params.id === 'string' ? req.params.id : null;
    const areaParametro = req.params.area;
    const area = typeof areaParametro === 'string' ? areaParametro.toUpperCase() : null;

    if (!req.auth?.organizacionId) {
      res.status(401).json({ message: 'La sesión no contiene una organización válida.' });
      return;
    }

    if (!esUuid(comunidadId) || !esAreaVisionDesarrollo(area)) {
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
      const metasValidadas = validarMetasVision(req.body?.metas, req.body?.revision);
      const vision = await guardarVisionDesarrolloComunitaria(
        req.auth.organizacionId,
        comunidadId,
        { area, situacionActual, prioridad, metaDesarrollo, ...metasValidadas },
        req.auth.sub,
      );

      if (!vision) {
        res.status(404).json({ message: 'La comunidad no existe en la organización activa.' });
        return;
      }

      res.json({ vision });
    } catch (error) {
      if (error instanceof ErrorExpediente) { res.status(error.status).json({message: error.message}); return; }
      console.error('Error guardando visión de desarrollo:', error);
      res.status(500).json({ message: 'No fue posible guardar la visión de desarrollo.' });
    }
  };

export const editarComunidad: RequestHandler = async (req, res) => {
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
  };

export const actualizarEstadoComunidad: RequestHandler = async (req, res) => {
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
  };
