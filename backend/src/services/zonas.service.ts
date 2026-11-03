import { databasePool } from '../config/database.js';

export interface ZonaResumen {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

interface ZonaFila {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

function obtenerPool() {
  if (!databasePool) {
    throw new Error('La base de datos no está configurada.');
  }

  return databasePool;
}

export async function listarZonas(organizacionId: string): Promise<ZonaResumen[]> {
  const pool = obtenerPool();

  const resultado = await pool.query<ZonaFila>(
    `SELECT id, nombre, descripcion, activo
       FROM zonas
      WHERE organizacion_id = $1
      ORDER BY activo DESC, nombre ASC`,
    [organizacionId],
  );

  return resultado.rows;
}

export async function crearZona(
  organizacionId: string,
  datos: { nombre: string; descripcion?: string | null },
): Promise<ZonaResumen> {
  const pool = obtenerPool();
  const nombre = datos.nombre.trim();
  const descripcion = datos.descripcion?.trim() || null;

  const resultado = await pool.query<ZonaFila>(
    `INSERT INTO zonas (organizacion_id, nombre, descripcion)
     VALUES ($1, $2, $3)
     RETURNING id, nombre, descripcion, activo`,
    [organizacionId, nombre, descripcion],
  );

  return resultado.rows[0];
}
