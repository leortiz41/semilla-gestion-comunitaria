import { useEffect, useMemo, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import '../../estilos/modulos/dashboard/dashboard.css';
import {
  obtenerResumenDashboard, obtenerEstadisticasDashboard,
  type ResumenDashboard, type EstadisticasDashboard,
} from '../../servicios/dashboard/servicioDashboard';
import GraficaECharts from './componentes/GraficaECharts';
import TableroGrid from './componentes/TableroGrid';

const etiquetasEstado: Record<string, string> = {
  PLANIFICADO: 'Planificación',
  EN_EJECUCION: 'En ejecución',
  PAUSADO: 'Pausado',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};
const etiquetasArea: Record<string, string> = {
  EVANGELISMO: 'Evangelismo',
  EDUCACION_FORMAL: 'Educación formal',
  EDUCACION_COMUNITARIA: 'Educación comunitaria',
  INFRAESTRUCTURA: 'Infraestructura',
};
const colores = ['#377c54', '#82b68b', '#e1aa58', '#749bb4', '#b8c4af', '#c28076'];

export default function PaginaDashboard({
  tokenAcceso, usuarioEmail = 'sesion',
}: {
  tokenAcceso?: string | null;
  usuarioEmail?: string;
}) {
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [estadisticas, setEstadisticas] = useState<EstadisticasDashboard | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorResumen, setErrorResumen] = useState('');
  const [errorEstadisticas, setErrorEstadisticas] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!tokenAcceso) { setResumen(null); setEstadisticas(null); return; }
    let activo = true;
    setCargando(true);
    setErrorResumen('');
    setErrorEstadisticas('');
    Promise.allSettled([
      obtenerResumenDashboard(tokenAcceso),
      obtenerEstadisticasDashboard(tokenAcceso),
    ]).then(([comunidades, proyectos]) => {
      if (!activo) return;
      if (comunidades.status === 'fulfilled') setResumen(comunidades.value);
      else { setResumen(null); setErrorResumen(comunidades.reason instanceof Error ? comunidades.reason.message : 'Error de comunidades.'); }
      if (proyectos.status === 'fulfilled') setEstadisticas(proyectos.value);
      else { setEstadisticas(null); setErrorEstadisticas(proyectos.reason instanceof Error ? proyectos.reason.message : 'Error de estadísticas.'); }
    }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [tokenAcceso, recarga]);

  const graficoEstados = useMemo<EChartsCoreOption>(() => ({
    color: colores,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll', textStyle: { color: '#49624f' } },
    series: [{
      type: 'pie', radius: ['53%', '72%'], center: ['50%', '43%'],
      itemStyle: { borderWidth: 3, borderColor: '#fff', borderRadius: 6 },
      label: { show: false },
      data: (estadisticas?.proyectosPorEstado ?? []).map((item) => ({
        name: etiquetasEstado[item.estado] ?? item.estado,
        value: item.cantidad,
      })),
    }],
  }), [estadisticas]);

  const graficoAreas = useMemo<EChartsCoreOption>(() => ({
    color: ['#47875b'],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 10, bottom: 30, left: 25, right: 20, containLabel: true },
    xAxis: { type: 'value', min: 0, minInterval: 1, axisLabel: { color: '#738174' } },
    yAxis: {
      type: 'category',
      data: (estadisticas?.proyectosPorArea ?? []).map((item) => etiquetasArea[item.area] ?? item.area),
      axisLabel: { color: '#526955', width: 140, overflow: 'truncate' },
    },
    series: [{
      type: 'bar', barMaxWidth: 28, data: (estadisticas?.proyectosPorArea ?? []).map((item) => item.cantidad),
      itemStyle: { borderRadius: [0, 5, 5, 0] },
    }],
  }), [estadisticas]);

  const graficoAvances = useMemo<EChartsCoreOption>(() => ({
    color: ['#398253', '#dda357'],
    tooltip: { trigger: 'axis' },
    legend: { top: 5 },
    grid: { top: 52, bottom: 32, left: 22, right: 18, containLabel: true },
    xAxis: { type: 'category', data: (estadisticas?.avancesPorMes ?? []).map((item) => item.mes), axisLabel: { color: '#687968' } },
    yAxis: { type: 'value', min: 0, minInterval: 1, axisLabel: { color: '#687968' } },
    series: [
      { name: 'Validados', type: 'line', smooth: true, symbolSize: 7,
        data: (estadisticas?.avancesPorMes ?? []).map((item) => item.validados) },
      { name: 'En revisión', type: 'line', smooth: true, symbolSize: 7,
        data: (estadisticas?.avancesPorMes ?? []).map((item) => item.enviados) },
    ],
  }), [estadisticas]);

  const moneda = estadisticas?.moneda ?? 'HNL';
  const dinero = (importe: number) => `${new Intl.NumberFormat('es-HN', {
    maximumFractionDigits: 0,
  }).format(importe)} ${moneda}`;

  const indicador = (valor: string | number, detalle: string) => (
    <div className="dashboard-indicador">
      <strong>{valor}</strong>
      <p>{detalle}</p>
    </div>
  );

  const mensajeSinDatos = <p className="dashboard-vacio">Todavía no hay registros suficientes para mostrar esta gráfica.</p>;
  const contenido = {
    proyectos: { titulo: 'Proyectos en curso', contenido: indicador(estadisticas?.proyectosActivos ?? '—', 'No incluye proyectos finalizados ni cancelados') },
    actividades: { titulo: 'Avances validados', contenido: indicador(estadisticas?.avancesValidados ?? '—', 'Registros revisados y aprobados') },
    presupuesto: { titulo: 'Presupuesto asignado', contenido: indicador(estadisticas ? dinero(estadisticas.presupuestoAsignado) : '—', 'No representa dinero gastado') },
    evidencias: { titulo: 'Fotografías guardadas', contenido: indicador(estadisticas?.evidenciasRegistradas ?? '—', 'Evidencias vinculadas a proyectos') },
    estados: { titulo: 'Proyectos por estado', contenido: (estadisticas?.proyectosPorEstado.length ?? 0) > 0
      ? <GraficaECharts opcion={graficoEstados} descripcion="Distribución de proyectos por estado administrativo" /> : mensajeSinDatos },
    areas: { titulo: 'Proyectos por área', contenido: (estadisticas?.proyectosPorArea.length ?? 0) > 0
      ? <GraficaECharts opcion={graficoAreas} descripcion="Cantidad de proyectos por área del diagnóstico" /> : mensajeSinDatos },
    avances: { titulo: 'Avances registrados por mes', contenido: (estadisticas?.avancesPorMes.length ?? 0) > 0
      ? <GraficaECharts opcion={graficoAvances} descripcion="Avances validados y enviados a revisión por mes" /> : mensajeSinDatos },
  };

  return (
    <section className="pagina-dashboard" aria-labelledby="titulo-dashboard">
      <header className="dashboard-cabecera">
        <div>
          <p className="pagina-dashboard__etiqueta">Semilla · Inteligencia de gestión</p>
          <h1 id="titulo-dashboard" className="pagina-dashboard__titulo">Dashboard</h1>
          <p className="pagina-dashboard__descripcion">Indicadores institucionales basados en registros reales, con paneles organizables.</p>
        </div>
        <button type="button" disabled={cargando || !tokenAcceso} onClick={() => setRecarga((n) => n + 1)}>
          {cargando ? 'Actualizando…' : 'Actualizar indicadores'}
        </button>
      </header>
      {errorResumen && <p role="alert" className="dashboard-error">Comunidades: {errorResumen}</p>}
      {errorEstadisticas && <p role="alert" className="dashboard-error">Proyectos: {errorEstadisticas}</p>}
      <div className="dashboard-comunidades">
        <div><span>Comunidades registradas</span><strong>{resumen?.comunidadesRegistradas ?? '—'}</strong></div>
        <div><span>Comunidades activas</span><strong>{resumen?.comunidadesActivas ?? '—'}</strong></div>
        <div><span>Proyectos finalizados</span><strong>{estadisticas?.proyectosFinalizados ?? '—'}</strong></div>
        <div><span>Total de proyectos</span><strong>{estadisticas?.proyectosTotales ?? '—'}</strong></div>
      </div>
      {cargando && !estadisticas && <p role="status">Consultando indicadores institucionales…</p>}
      {estadisticas && <TableroGrid usuario={usuarioEmail} contenido={contenido} />}
      {!estadisticas && !cargando && !errorEstadisticas &&
        <p className="dashboard-vacio">Iniciá sesión para consultar los indicadores.</p>}
      <p className="dashboard-nota">
        Las estadísticas se calculan por organización. El avance reportado no equivale automáticamente a gasto,
        y las fotografías privadas no se publican por mostrarse en este tablero.
      </p>
    </section>
  );
}
