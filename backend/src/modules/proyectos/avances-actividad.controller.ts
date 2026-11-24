import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { esUuid } from '../../domain/expediente.js';
import { validarAvanceActividad } from './avances-actividad.domain.js';
import { consultarMetaActividad } from './proyectos.repository.js';
import { registrarAvanceActividad, editarAvanceActividad, transicionarAvanceActividad } from './avances-actividad.service.js';

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
        const contexto = { rows: await consultarMetaActividad(pool, proyectoId, actividadId, req.auth!.organizacionId) };
        if (!contexto.rows.length) {
          res.status(404).json({ message: 'No se encontró la actividad del proyecto en la organización activa.' });
          return;
        }
        const cuantificable = contexto.rows[0].meta_cantidad !== null;
        if (cuantificable !== (datos.cantidadReportada !== null)) {
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
  return { registrar, editar, enviar, corregir };
}
