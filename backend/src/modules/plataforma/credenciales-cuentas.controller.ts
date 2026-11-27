import type { RequestHandler } from 'express';
import { ErrorCredencialTemporal } from '../../services/credenciales-temporales.service.js';
import { reemitirCredencialDesdePlataforma } from './credenciales-cuentas.service.js';

const esUuid = (valor: unknown): valor is string => typeof valor === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);

/** Conserva el contrato HTTP y la verificación global de las rutas de plataforma. */
export const reemitirCredencialCuentaPlataforma: RequestHandler = async (req, res) => {
  const { organizacionId, usuarioId } = req.params;
  if (!esUuid(organizacionId) || !esUuid(usuarioId)) {
    res.status(400).json({ message: 'Organización o cuenta inválida.' }); return;
  }
  try {
    const respuesta = await reemitirCredencialDesdePlataforma(
      organizacionId, usuarioId, req.auth!.sub,
    );
    res.set('Cache-Control', 'no-store');
    res.status(201).json(respuesta);
  } catch (error) {
    if (error instanceof ErrorCredencialTemporal) {
      res.status(error.codigoEstado).json({ message: error.message }); return;
    }
    console.error('Error reemitiendo credencial temporal:',
      error instanceof Error ? error.message : 'ErrorDesconocido');
    res.status(500).json({ message: 'No fue posible emitir una nueva credencial temporal.' });
  }
};
