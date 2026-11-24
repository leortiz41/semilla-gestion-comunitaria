import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { esUuid } from '../../domain/expediente.js';
import { validarAvanceActividad } from './avances-actividad.domain.js';
import { registrarAvanceActividad, editarAvanceActividad, transicionarAvanceActividad, comprobarTipoDeMetaAvance, consultarExcesoDeMeta } from './avances-actividad.service.js';

/** Adaptadores HTTP de avances: reciben el pool por inyección para conservar pruebas y compatibilidad. */
export function crearControladoresAvances(pool: Pool | null = databasePool) {
  const registrar: RequestHandler = async (req, res) => {
      const { proyectoId, actividadId } = req.params;
      const datos = validarAvanceActividad(req.body);
      if (!esUuid(proyectoId) || !esUuid(actividadId) || !datos) {
        res.status(400).json({ message: 'Revisá la actividad, el porcentaje, la fecha y la descripción del avance.' });
        return;
      }
      try {
        if (!pool) throw new Error('Base de datos no disponible');
        const tipoMeta = await comprobarTipoDeMetaAvance(
          pool, proyectoId, actividadId, req.auth!.organizacionId, datos,
        );
        if (tipoMeta === 'NO_ENCONTRADO') {
          res.status(404).json({ message: 'No se encontró la actividad del proyecto en la organización activa.' });
          return;
        }
        if (tipoMeta === 'TIPO_INCORRECTO') {
          res.status(400).json({ message: 'El avance debe reportar una cantidad para esta meta o una estimación justificada.' });
          return;
        }
        const avance = await registrarAvanceActividad(
          pool,
          proyectoId,
          actividadId,
          req.auth!.organizacionId,
          req.auth!.sub,
          datos,
        );
        if (!avance) {
          res.status(409).json({ message: 'No se pudo crear el avance. Es posible que la meta ya esté alcanzada, que la actividad esté cerrada o que el envío se haya registrado anteriormente. Actualizá la ejecución y revisá el historial antes de reintentar.' });
          return;
        }
        res.status(201).json(avance);
      } catch (error) {
        console.error('Error registrando avance de actividad:', error);
        res.status(500).json({ message: 'No fue posible registrar el avance de la actividad.' });
      }
    };

  const editar: RequestHandler = async (req, res) => {
      const { proyectoId, actividadId, avanceId } = req.params;
      const datos = validarAvanceActividad(req.body);
      if (!esUuid(proyectoId) || !esUuid(actividadId) || !esUuid(avanceId) || !datos) {
        res.status(400).json({ message: 'Revisá los datos del avance antes de guardarlo.' });
        return;
      }
      try {
        if (!pool) throw new Error('Base de datos no disponible');
        const actualizado = await editarAvanceActividad(
          pool, proyectoId, actividadId, avanceId, req.auth!.organizacionId,
          req.auth!.sub, datos,
        );
        if (!actualizado) {
          res.status(409).json({ message: 'Solo podés editar un borrador o un avance devuelto de tu organización.' });
          return;
        }
        res.sendStatus(204);
      } catch (error) {
        console.error('Error editando borrador de avance:', error);
        res.status(500).json({ message: 'No fue posible guardar los cambios del avance.' });
      }
    };

  const enviar: RequestHandler = async (req, res) => {
      const { proyectoId, actividadId, avanceId } = req.params;
      if (!esUuid(proyectoId) || !esUuid(actividadId) || !esUuid(avanceId)) {
        res.status(400).json({ message: 'Seleccioná un avance válido.' });
        return;
      }
      try {
        if (!pool) throw new Error('Base de datos no disponible');
        const enviado = await transicionarAvanceActividad(
          pool, proyectoId, actividadId, avanceId, req.auth!.organizacionId,
          req.auth!.sub, 'ENVIAR',
        );
        if (!enviado) {
          res.status(409).json({ message: 'El avance no está disponible para enviar en su estado actual.' });
          return;
        }
        res.sendStatus(204);
      } catch (error) {
        console.error('Error enviando avance a revisión:', error);
        res.status(500).json({ message: 'No fue posible enviar el avance a revisión.' });
      }
    };

  const corregir: RequestHandler = async (req, res) => {
      const { proyectoId, actividadId, avanceId } = req.params;
      const datos = validarAvanceActividad(req.body);
      const motivo = req.body?.motivoCorreccion;
      if (!esUuid(proyectoId) || !esUuid(actividadId) || !esUuid(avanceId) || !datos ||
          typeof motivo !== 'string' || motivo.trim().length < 3 || motivo.trim().length > 3000) {
        res.status(400).json({ message: 'La corrección debe incluir datos válidos y un motivo.' });
        return;
      }
      try {
        if (!pool) throw new Error('Base de datos no disponible');
        const corregido = await editarAvanceActividad(
          pool, proyectoId, actividadId, avanceId, req.auth!.organizacionId,
          req.auth!.sub, datos, true, motivo.trim(),
        );
        if (!corregido) {
          res.status(409).json({ message: 'Solo se puede corregir explícitamente un avance validado del proyecto.' });
          return;
        }
        res.sendStatus(204);
      } catch (error) {
        console.error('Error corrigiendo avance validado:', error);
        res.status(500).json({ message: 'No fue posible corregir el avance validado.' });
      }
    };
  const revisar = (accion: 'validar' | 'devolver'): RequestHandler => async (req, res) => {
        const { proyectoId, actividadId, avanceId } = req.params;
        const motivo = req.body?.motivo;
        if (!esUuid(proyectoId) || !esUuid(actividadId) || !esUuid(avanceId) ||
            (accion === 'devolver' && (typeof motivo !== 'string' || !motivo.trim() || motivo.trim().length > 3000))) {
          res.status(400).json({ message: 'Revisá el avance y el motivo de devolución.' });
          return;
        }
        try {
          if (!pool) throw new Error('Base de datos no disponible');
          const actualizado = await transicionarAvanceActividad(
            pool, proyectoId, actividadId, avanceId, req.auth!.organizacionId,
            req.auth!.sub, accion === 'validar' ? 'VALIDAR' : 'DEVOLVER',
            accion === 'devolver' ? motivo.trim() : undefined,
            req.auth!.roles.some((rol) => rol === 'ADMINISTRADOR' || rol === 'COORDINADOR'),
          );
          if (!actualizado) {
            if (accion === 'validar') {
              const limite = await consultarExcesoDeMeta(pool, avanceId, actividadId,
                proyectoId, req.auth!.organizacionId);
              if (limite) {
                res.status(409).json({
                  message: `No se puede validar: el total reportado (${limite.total} ${limite.unidad ?? 'unidades'}) supera la meta planificada (${limite.meta}). Corregí la planificación o devolvé el avance.`,
                });
                return;
              }
            }
            res.status(409).json({ message: 'El avance no está disponible para esta revisión o no tenés autorización para revisarlo.' });
            return;
          }
          res.sendStatus(204);
        } catch (error) {
          console.error(`Error al ${accion} avance:`, error);
          res.status(500).json({ message: `No fue posible ${accion} el avance.` });
        }
      };

  return { registrar, editar, enviar, corregir, revisar };
}
