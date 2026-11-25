import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { esUuid } from '../../domain/expediente.js';
import { camposFamilia } from './familias.domain.js';
import { listarComunidadesFamilia, listarFamilias, obtenerFamilia, crearFamilia, actualizarFamilia } from './familias.service.js';

export const listarComunidadesPermitidas: RequestHandler = async (req, res) => {
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const rows = await listarComunidadesFamilia(req.auth!.organizacionId);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ comunidades: rows });
  } catch (error) {
    console.error('Error consultando comunidades de familias:', error);
    res.status(500).json({ message: 'No fue posible consultar comunidades.' });
  }
};

export const listarExpedientesFamiliares: RequestHandler = async (req, res) => {
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const rows = await listarFamilias(req.auth!.organizacionId);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ familias: rows });
  } catch (error) {
    console.error('Error consultando familias:', error);
    res.status(500).json({ message: 'No fue posible consultar las familias.' });
  }
};

export const consultarExpedienteFamiliar: RequestHandler = async (req, res) => {
  if (!esUuid(req.params.familiaId)) { res.status(400).json({ message: 'Familia no válida.' }); return; }
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const familia = await obtenerFamilia(req.params.familiaId, req.auth!.organizacionId);
    const rows = familia ? [familia] : [];
    if (!rows.length) { res.status(404).json({ message: 'Familia no encontrada.' }); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ familia: rows[0] });
  } catch (error) {
    console.error('Error consultando perfil familiar:', error);
    res.status(500).json({ message: 'No fue posible recuperar el perfil.' });
  }
};

export const registrarFamilia: RequestHandler = async (req, res) => {
  const datos = camposFamilia(req.body);
  if (!datos.comunidadId || !esUuid(datos.comunidadId) ||
      !datos.nombreReferencia || datos.nombreReferencia.length > 180 ||
      datos.numeroCasa === null || datos.direccionReferencia === null) {
    res.status(400).json({ message: 'Revisá la comunidad, el nombre y la dirección de referencia.' }); return;
  }
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const familiaCreada = await crearFamilia(datos, req.auth!.organizacionId);
    const rows = familiaCreada ? [familiaCreada] : [];
    if (!rows.length) { res.status(404).json({ message: 'Comunidad no autorizada o inactiva.' }); return; }
    res.status(201).json({ id: rows[0].id });
  } catch (error) {
    console.error('Error registrando familia:', error);
    res.status(500).json({ message: 'No fue posible registrar la familia.' });
  }
};

export const modificarFamilia: RequestHandler = async (req, res) => {
  const datos = camposFamilia(req.body);
  const activo = req.body?.activo;
  if (!esUuid(req.params.familiaId) || !datos.comunidadId || !esUuid(datos.comunidadId) ||
      !datos.nombreReferencia || datos.numeroCasa === null || datos.direccionReferencia === null ||
      typeof activo !== 'boolean') {
    res.status(400).json({ message: 'Datos del expediente no válidos.' }); return;
  }
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const rowCount = await actualizarFamilia(req.params.familiaId, datos, activo, req.auth!.organizacionId);
    if (!rowCount) { res.status(404).json({ message: 'Familia o comunidad no disponible.' }); return; }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error actualizando familia:', error);
    res.status(500).json({ message: 'No fue posible actualizar la familia.' });
  }
};
