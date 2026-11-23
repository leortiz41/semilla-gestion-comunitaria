import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { esUuid } from '../../domain/expediente.js';
import { validarPlanificacionActividad } from './planificacion-actividad.domain.js';
import { guardarPlanificacionActividad } from './planificacion-actividad.service.js';

/** Adaptador HTTP: la validación pura reside en domain y las decisiones en service. */
export const guardarActividadPlanificada: RequestHandler = async (req, res) => {
  const { proyectoId, actividadId } = req.params;
  const datos = validarPlanificacionActividad(req.body);
  if (!esUuid(proyectoId) || (actividadId !== undefined && !esUuid(actividadId)) || !datos) {
    res.status(400).json({
      message: 'Revisá el nombre, las metas, la unidad, los recursos, el responsable, el estado y las fechas de la actividad.',
    });
    return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const resultado = await guardarPlanificacionActividad(
      databasePool, proyectoId, actividadId ?? null, req.auth!.organizacionId, datos,
    );
    switch (resultado.tipo) {
      case 'NO_ENCONTRADO':
        res.status(404).json({ message: 'No se encontró el proyecto o la actividad.' });
        return;
      case 'PRESUPUESTO_INSUFICIENTE':
        res.status(400).json({
          message: 'El presupuesto estimado supera el saldo disponible del proyecto. Revisá las asignaciones de las demás actividades.',
        });
        return;
      case 'RESPONSABLE_INVALIDO':
        res.status(400).json({
          message: 'Revisá el responsable asignado: debe ser un usuario activo de esta organización.',
        });
        return;
      case 'OK':
        res.status(actividadId ? 200 : 201).json(resultado.actividad);
        return;
    }
  } catch (error) {
    console.error('Error guardando actividad:', error);
    res.status(500).json({ message: 'No fue posible guardar la actividad.' });
  }
};
