import type { RequestHandler } from 'express';
import { prepararNuevaOrganizacion, esUuidOrganizacion } from './organizaciones.domain.js';
import { crearOrganizacion, cambiarEstadoOrganizacion } from './organizaciones.service.js';

const errorHttp = (error: unknown) => error instanceof Error ? error.message : 'ErrorDesconocido';

export const registrarOrganizacion: RequestHandler = async (req, res) => {
  const datos = prepararNuevaOrganizacion(req.body);
  if (!datos) {
    res.status(400).json({ message: 'Nombre, slug o correo de contacto inválidos.' }); return;
  }
  try {
    const organizacion = await crearOrganizacion(datos, req.auth!.sub);
    res.status(201).json({ organizacion });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ message: 'Ya existe una organización con ese slug.' }); return;
    }
    console.error('Error creando organización:', errorHttp(error));
    res.status(500).json({ message: 'No fue posible crear la organización.' });
  }
};

export const modificarEstadoOrganizacion: RequestHandler = async (req, res) => {
  const organizacionId = req.params.organizacionId;
  const activo = req.body?.activo;
  if (!esUuidOrganizacion(organizacionId) || typeof activo !== 'boolean') {
    res.status(400).json({ message: 'Organización o estado inválido.' }); return;
  }
  try {
    const resultado = await cambiarEstadoOrganizacion(organizacionId, activo, req.auth!.sub);
    if (resultado.estado === 'NO_ENCONTRADA') {
      res.status(404).json({ message: 'Organización no encontrada.' }); return;
    }
    if (resultado.estado === 'ORGANIZACION_GLOBAL_PROTEGIDA') {
      res.status(409).json({ message: 'No podés desactivar la organización asociada a tu cuenta global.' }); return;
    }
    res.set('Cache-Control', 'no-store');
    res.json({ id: organizacionId, activo });
  } catch (error) {
    console.error('Error actualizando estado de organización:', errorHttp(error));
    res.status(500).json({ message: 'No se pudo modificar el estado de la organización.' });
  }
};
