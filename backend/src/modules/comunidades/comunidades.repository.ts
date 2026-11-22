import type { Pool } from 'pg';

// Fila SQL interna: no representa el contrato JSON de la API.
export interface ComunidadFila {
  id: string;
  zona_id: string | null;
  nombre: string;
  barrio_colonia: string | null;
  localidad: string | null;
  municipio: string;
  departamento: string;
  activo: boolean;
  nombre_zona: string | null;
  zona_activa: boolean | null;
}

/** Consulta de comunidades limitada a la organización autenticada. */
export async function consultarComunidadesPorOrganizacion(pool: Pool, organizacionId: string): Promise<ComunidadFila[]> {
  const resultado = await pool.query<ComunidadFila>(
    `SELECT
       c.id,
       c.zona_id,
       c.nombre,
       c.barrio_colonia,
       c.localidad,
       c.municipio,
       c.departamento,
       c.activo,
       z.nombre AS nombre_zona,
       z.activo AS zona_activa
     FROM comunidades c
     LEFT JOIN zonas z
       ON z.id = c.zona_id
      AND z.organizacion_id = c.organizacion_id
     WHERE c.organizacion_id = $1
     ORDER BY c.nombre ASC`,
    [organizacionId],
  );
  return resultado.rows;
}
