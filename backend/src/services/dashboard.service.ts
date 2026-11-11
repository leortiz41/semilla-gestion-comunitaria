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


export interface FiltrosDashboard {
  comunidades: { id: string; nombre: string }[];
  proyectos: { id: string; nombre: string; comunidadId: string; tipo: string }[];
  areas: string[];
}

export interface SeleccionDashboard {
  comunidadId?: string;
  proyectoId?: string;
  area?: string;
  meses?: 3 | 6 | 12;
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

export async function obtenerFiltrosDashboard(organizacionId: string): Promise<FiltrosDashboard> {
  const pool = obtenerPool();
  const [comunidades, proyectos, areas] = await Promise.all([
    pool.query<{ id: string; nombre: string }>(
      'SELECT id, nombre FROM comunidades WHERE organizacion_id=$1 ORDER BY nombre, id',
      [organizacionId],
    ),
    pool.query<{ id: string; nombre: string; comunidadId: string; tipo: string }>(
      `SELECT p.id, p.nombre, p.comunidad_id AS "comunidadId", p.tipo
       FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
       WHERE c.organizacion_id=$1 ORDER BY p.nombre, p.id`, [organizacionId],
    ),
    pool.query<{ area: string }>(
      `SELECT DISTINCT p.tipo AS area FROM proyectos p
       JOIN comunidades c ON c.id=p.comunidad_id
       WHERE c.organizacion_id=$1 AND p.tipo IS NOT NULL ORDER BY area`, [organizacionId],
    ),
  ]);
  return { comunidades: comunidades.rows, proyectos: proyectos.rows, areas: areas.rows.map((a) => a.area) };
}

export async function obtenerEstadisticasDashboard(
  organizacionId: string, filtros: SeleccionDashboard = {},
): Promise<EstadisticasDashboard> {
  const pool = obtenerPool();
  const params = [
    organizacionId,
    filtros.comunidadId ?? null,
    filtros.proyectoId ?? null,
    filtros.area ?? null,
    filtros.meses ?? null,
  ];
  // Filtros sobre proyecto/comunidad/área. El período filtra proyectos por fecha
  // de registro, evidencias por fecha de carga y avances por fecha de avance.
  // En el gráfico mensual "Todos" presenta 12 meses, aunque el total sea histórico.
  const condicionProyecto = `
    c.organizacion_id=$1
    AND ($2::uuid IS NULL OR p.comunidad_id=$2::uuid)
    AND ($3::uuid IS NULL OR p.id=$3::uuid)
    AND ($4::text IS NULL OR p.tipo=$4::text)`;
  const inicio = `(date_trunc('month', CURRENT_DATE) - (($5::int - 1) * INTERVAL '1 month'))`;
  const proyectoFiltrado = `WITH proyectos_filtrados AS (
    SELECT p.id, p.estado, p.tipo, p.presupuesto_asignado, p.creado_en
    FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
    WHERE ${condicionProyecto}
  )`;

  const [totales, estados, meses, areas, organizacion] = await Promise.all([
    pool.query<{
      proyectosTotales: number; proyectosActivos: number; proyectosFinalizados: number;
      presupuestoAsignado: number; evidenciasRegistradas: number; avancesValidados: number;
    }>(`${proyectoFiltrado}
      SELECT
        (SELECT COUNT(*)::int FROM proyectos_filtrados p
          WHERE $5::int IS NULL OR p.creado_en >= ${inicio}) AS "proyectosTotales",
        (SELECT COUNT(*)::int FROM proyectos_filtrados p
          WHERE p.estado NOT IN ('FINALIZADO','CANCELADO')
          AND ($5::int IS NULL OR p.creado_en >= ${inicio})) AS "proyectosActivos",
        (SELECT COUNT(*)::int FROM proyectos_filtrados p
          WHERE p.estado='FINALIZADO'
          AND ($5::int IS NULL OR p.creado_en >= ${inicio})) AS "proyectosFinalizados",
        (SELECT COALESCE(SUM(p.presupuesto_asignado),0)::double precision
          FROM proyectos_filtrados p WHERE p.estado<>'CANCELADO'
          AND ($5::int IS NULL OR p.creado_en >= ${inicio})) AS "presupuestoAsignado",
        (SELECT COUNT(*)::int FROM evidencias e JOIN proyectos_filtrados p ON p.id=e.proyecto_id
          WHERE e.tipo_mime IN ('image/jpeg','image/png','image/webp')
          AND ($5::int IS NULL OR e.creado_en >= ${inicio})) AS "evidenciasRegistradas",
        (SELECT COUNT(*)::int FROM avances_proyecto av JOIN proyectos_filtrados p ON p.id=av.proyecto_id
          WHERE av.estado_revision='VALIDADO'
          AND ($5::int IS NULL OR av.fecha_avance >= ${inicio})) AS "avancesValidados"`, params),
    pool.query<{ estado: string; cantidad: number }>(`${proyectoFiltrado}
      SELECT p.estado, COUNT(*)::int AS cantidad
      FROM proyectos_filtrados p WHERE $5::int IS NULL OR p.creado_en >= ${inicio}
      GROUP BY p.estado ORDER BY p.estado`, params),
    pool.query<{ mes: string; validados: number; enviados: number }>(`${proyectoFiltrado},
      calendario AS (
        SELECT generate_series(
          date_trunc('month',CURRENT_DATE) - ((COALESCE($5::int,12)-1) * INTERVAL '1 month'),
          date_trunc('month',CURRENT_DATE), INTERVAL '1 month'
        )::date AS mes
      )
      SELECT to_char(cal.mes, 'YYYY-MM') AS mes,
        COUNT(av.id) FILTER (WHERE av.estado_revision='VALIDADO')::int AS validados,
        COUNT(av.id) FILTER (WHERE av.estado_revision='ENVIADO')::int AS enviados
      FROM calendario cal
      LEFT JOIN avances_proyecto av ON av.fecha_avance >= cal.mes
        AND av.fecha_avance < (cal.mes + INTERVAL '1 month')
        AND EXISTS (SELECT 1 FROM proyectos_filtrados p WHERE p.id=av.proyecto_id)
      GROUP BY cal.mes ORDER BY cal.mes`, params),
    pool.query<{ area: string; cantidad: number }>(`${proyectoFiltrado}
      SELECT p.tipo AS area, COUNT(*)::int AS cantidad FROM proyectos_filtrados p
      WHERE $5::int IS NULL OR p.creado_en >= ${inicio}
      GROUP BY p.tipo ORDER BY cantidad DESC, p.tipo`, params),
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
