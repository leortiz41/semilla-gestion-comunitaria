import { databasePool } from '../config/database.js';

export interface ResumenDashboard {
  comunidadesRegistradas: number;
}

function obtenerPool() {
  if (!databasePool) {
    throw new Error('La base de datos no está configurada.');
  }

  return databasePool;
}

export async function obtenerResumenDashboard(): Promise<ResumenDashboard> {
  const pool = obtenerPool();

  const resultado = await pool.query<{ total: number }>(
    'SELECT COUNT(*)::int AS total FROM comunidades',
  );

  return {
    comunidadesRegistradas: resultado.rows[0]?.total ?? 0,
  };
}
