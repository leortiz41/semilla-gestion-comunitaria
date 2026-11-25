import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import {
  consultarSuperadministradorVigente,
  consultarDashboardPlataforma,
  consultarOrganizacionesPlataforma,
} from './plataforma.repository.js';

function obtenerPool(pool: Pool | null): Pool {
  if (!pool) throw new Error('Gestión de plataforma no disponible.');
  return pool;
}

export async function superadministradorVigente(
  usuarioId: string, pool: Pool | null = databasePool,
): Promise<boolean> {
  const { rows } = await consultarSuperadministradorVigente(obtenerPool(pool), usuarioId);
  return rows.length > 0;
}

export async function listarOrganizacionesPlataforma(pool: Pool | null = databasePool) {
  const { rows } = await consultarOrganizacionesPlataforma(obtenerPool(pool));
  return rows;
}

export async function obtenerResumenPlataforma(pool: Pool | null = databasePool) {
  const { rows } = await consultarDashboardPlataforma(obtenerPool(pool));
  const totales = rows.reduce((ac: {
    organizaciones: number; activas: number; suspendidas: number;
    usuariosVigentes: number; usuariosActivos: number; usuariosRetirados: number;
    comunidades: number; proyectos: number; evidencias: number;
  }, fila: Record<string, unknown>) => {
    ac.organizaciones += 1;
    if (fila.activo) ac.activas += 1; else ac.suspendidas += 1;
    for (const campo of ['usuariosVigentes','usuariosActivos','usuariosRetirados','comunidades','proyectos','evidencias'] as const) {
      ac[campo] += Number(fila[campo] ?? 0);
    }
    return ac;
  }, {organizaciones:0,activas:0,suspendidas:0,usuariosVigentes:0,
      usuariosActivos:0,usuariosRetirados:0,comunidades:0,proyectos:0,evidencias:0});
  return { totales, organizaciones: rows };
}
