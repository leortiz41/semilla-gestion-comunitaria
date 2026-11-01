import { databasePool } from '../config/database.js';

export interface ResumenDashboard {
  comunidadesRegistradas: number;
  comunidadesActivas: number;
}

interface ResumenComunidadesFila {
  total: number;
  activas: number;
}

function obtenerPool() {
  if (!databasePool) {
    throw new Error('La base de datos no está configurada.');
  }

  return databasePool;
}

export async function obtenerResumenDashboard(): Promise<ResumenDashboard> {
  const pool = obtenerPool();

  const resultado = await pool.query<ResumenComunidadesFila>(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE activo = true)::int AS activas
    FROM comunidades
  `);

  const resumenComunidades = resultado.rows[0];

  return {
    comunidadesRegistradas: resumenComunidades?.total ?? 0,
    comunidadesActivas: resumenComunidades?.activas ?? 0,
  };
}
