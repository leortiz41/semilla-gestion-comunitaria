import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { esUuid } from '../../domain/expediente.js';
import { listarBrigadasElegibles, asignarBrigadaFamiliar } from './asignaciones-familias.service.js';

/** Conserva la validación HTTP y los contratos JSON anteriores. */
export const consultarBrigadasFamiliares: RequestHandler = async (req, res) => {
  const { familiaId, perfilId } = req.params;
  if (!esUuid(familiaId) || !esUuid(perfilId)) {
    res.status(400).json({ message: 'Expediente inválido.' }); return;
  }
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const rows = await listarBrigadasElegibles(familiaId, perfilId, req.auth!.organizacionId);
    res.set('Cache-Control', 'no-store');
    res.json({ brigadas: rows });
  } catch (error) {
    console.error('Error consultando brigadas elegibles de familia:', error);
    res.status(500).json({ message: 'No fue posible consultar las brigadas.' });
  }
};

export const actualizarBrigadaFamiliar: RequestHandler = async (req, res) => {
  const { familiaId, perfilId } = req.params;
  const brigadaId = req.body?.brigadaId;
  if (!esUuid(familiaId) || !esUuid(perfilId) || (brigadaId !== null && !esUuid(brigadaId))) {
    res.status(400).json({ message: 'Familia, perfil o brigada inválidos.' }); return;
  }
  if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
  try {
    const resultado = await asignarBrigadaFamiliar(
      familiaId, perfilId, brigadaId, req.auth!.sub, req.auth!.organizacionId,
    );
    if (resultado.estado === 'PERFIL_NO_DISPONIBLE') {
      res.status(404).json({ message: 'Perfil familiar no disponible.' }); return;
    }
    if (resultado.estado === 'BRIGADA_NO_ELEGIBLE') {
      res.status(409).json({ message: 'La brigada no patrocina este proyecto o no pertenece a la organización.' }); return;
    }
    res.json({ perfilId: resultado.perfilId, brigadaId: resultado.brigadaId });
  } catch (error) {
    console.error('Error asignando brigada familiar:', error);
    res.status(500).json({ message: 'No fue posible asignar la brigada.' });
  }
};
