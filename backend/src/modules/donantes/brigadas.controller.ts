import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { esUuid } from '../../domain/expediente.js';
import { validarBrigada } from './brigadas.domain.js';
import { guardarBrigada } from './brigadas.service.js';

/** Adaptador HTTP; permisos exigidos por el router administrativo. */
export const guardarBrigadaDonante: RequestHandler = async (req, res) => {
  const { id, brigadaId } = req.params;
  const datos = validarBrigada(req.body);
  if (!esUuid(id) || (brigadaId !== undefined && !esUuid(brigadaId)) || !datos) {
    res.status(400).json({ message: 'Revisá la zona, las comunidades y los datos del viaje.' });
    return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const resultado = await guardarBrigada(
      databasePool, id, brigadaId ?? null, req.auth!.organizacionId, datos,
    );
    if (resultado === 'BRIGADA_NO_ENCONTRADA') {
      res.status(404).json({ message: 'No se encontró la brigada.' });
      return;
    }
    if (resultado === 'RELACIONES_INVALIDAS') {
      res.status(404).json({ message: 'La zona, las comunidades o el proyecto no corresponden a la selección.' });
      return;
    }
    res.sendStatus(204);
  } catch {
    res.status(500).json({ message: 'No fue posible guardar la brigada.' });
  }
};
