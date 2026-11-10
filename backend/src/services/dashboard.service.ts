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

export async function obtenerResumenDashboard(
  organizacionId: string,
): Promise<ResumenDashboard> {
  const pool = obtenerPool();

  const resultado = await pool.query<ResumenComunidadesFila>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE activo = true)::int AS activas
     FROM comunidades
     WHERE organizacion_id = $1`,
    [organizacionId],
  );

  const resumenComunidades = resultado.rows[0];

  return {
    comunidadesRegistradas: resumenComunidades?.total ?? 0,
    comunidadesActivas: resumenComunidades?.activas ?? 0,
  };
}

export interface EstadisticasDashboard {
  moneda: string;
  proyectosTotales: number;
  proyectosActivos: number;
  proyectosFinalizados: number;
  presupuestoAsignado: number;
  evidenciasRegistradas: number;
  avancesValidados: number;
  proyectosPorEstado: { estado: string; cantidad: number }[];
  avancesPorMes: { mes: string; validados: number; enviados: number }[];
  proyectosPorArea: { area: string; cantidad: number }[];
}

export async function obtenerEstadisticasDashboard(organizacionId: string): Promise<EstadisticasDashboard> {
  const pool = obtenerPool();
  // Todas las métricas se calculan dentro de la organización autenticada.
  // Presupuesto asignado NO equivale a gasto ejecutado o donaciones recibidas.
  const [totales, estados, meses, areas, organizacion] = await Promise.all([
    pool.query<{
      proyectosTotales: number; proyectosActivos: number; proyectosFinalizados: number;
      presupuestoAsignado: number; evidenciasRegistradas: number; avancesValidados: number;
    }>(`SELECT
        (SELECT COUNT(*)::int FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
          WHERE c.organizacion_id=$1) AS "proyectosTotales",
        (SELECT COUNT(*)::int FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
          WHERE c.organizacion_id=$1 AND p.estado NOT IN ('FINALIZADO','CANCELADO')) AS "proyectosActivos",
        (SELECT COUNT(*)::int FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
          WHERE c.organizacion_id=$1 AND p.estado='FINALIZADO') AS "proyectosFinalizados",
        (SELECT COALESCE(SUM(p.presupuesto_asignado),0)::double precision
          FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
          WHERE c.organizacion_id=$1 AND p.estado<>'CANCELADO') AS "presupuestoAsignado",
        (SELECT COUNT(*)::int FROM evidencias e JOIN proyectos p ON p.id=e.proyecto_id
          JOIN comunidades c ON c.id=p.comunidad_id
          WHERE c.organizacion_id=$1 AND e.tipo_mime IN ('image/jpeg','image/png','image/webp'))
          AS "evidenciasRegistradas",
        (SELECT COUNT(*)::int FROM avances_proyecto av JOIN proyectos p ON p.id=av.proyecto_id
          JOIN comunidades c ON c.id=p.comunidad_id
          WHERE c.organizacion_id=$1 AND av.estado_revision='VALIDADO') AS "avancesValidados"`,
      [organizacionId]),
    pool.query<{ estado: string; cantidad: number }>(`SELECT p.estado, COUNT(*)::int AS cantidad
      FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
      WHERE c.organizacion_id=$1 GROUP BY p.estado ORDER BY p.estado`, [organizacionId]),
    pool.query<{ mes: string; validados: number; enviados: number }>(`SELECT
      to_char(date_trunc('month',av.fecha_avance), 'YYYY-MM') AS mes,
      COUNT(*) FILTER (WHERE av.estado_revision='VALIDADO')::int AS validados,
      COUNT(*) FILTER (WHERE av.estado_revision='ENVIADO')::int AS enviados
      FROM avances_proyecto av JOIN proyectos p ON p.id=av.proyecto_id
      JOIN comunidades c ON c.id=p.comunidad_id
      WHERE c.organizacion_id=$1 AND av.fecha_avance >= (CURRENT_DATE - INTERVAL '11 months')
      GROUP BY date_trunc('month',av.fecha_avance) ORDER BY mes`, [organizacionId]),
    pool.query<{ area: string; cantidad: number }>(`SELECT p.tipo AS area, COUNT(*)::int AS cantidad
      FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
      WHERE c.organizacion_id=$1 GROUP BY p.tipo ORDER BY cantidad DESC, p.tipo`, [organizacionId]),
    pool.query<{ moneda: string }>('SELECT moneda FROM organizaciones WHERE id=$1', [organizacionId]),
  ]);
  return {
    moneda: organizacion.rows[0]?.moneda ?? 'HNL',
    proyectosTotales: totales.rows[0]?.proyectosTotales ?? 0,
    proyectosActivos: totales.rows[0]?.proyectosActivos ?? 0,
    proyectosFinalizados: totales.rows[0]?.proyectosFinalizados ?? 0,
    presupuestoAsignado: totales.rows[0]?.presupuestoAsignado ?? 0,
    evidenciasRegistradas: totales.rows[0]?.evidenciasRegistradas ?? 0,
    avancesValidados: totales.rows[0]?.avancesValidados ?? 0,
    proyectosPorEstado: estados.rows,
    avancesPorMes: meses.rows,
    proyectosPorArea: areas.rows,
  };
}
