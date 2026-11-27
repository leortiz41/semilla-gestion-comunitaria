import type { RequestHandler } from 'express';
import { listarOrganizacionesPlataforma, obtenerResumenPlataforma } from './plataforma.service.js';

const errorHttp = (error: unknown) => error instanceof Error ? error.message : 'ErrorDesconocido';

export const obtenerDashboardPlataforma: RequestHandler = async (_req, res) => {
  try {
    const { totales, organizaciones } = await obtenerResumenPlataforma();
    res.set('Cache-Control','no-store');
    res.json({totales,organizaciones,consultadoEn:new Date().toISOString()});
  } catch (error) {
    console.error('Error consultando métricas SaaS:', errorHttp(error));
    res.status(500).json({message:'No fue posible consultar el dashboard de plataforma.'});
  }
};

export const obtenerOrganizacionesPlataforma: RequestHandler = async (_req, res) => {
  try {
    const rows = await listarOrganizacionesPlataforma();
    res.set('Cache-Control','no-store');
    res.json({ organizaciones: rows });
  } catch (error) {
    console.error('Error consultando organizaciones:', errorHttp(error));
    res.status(500).json({ message: 'No se pudieron consultar las organizaciones.' });
  }
};
