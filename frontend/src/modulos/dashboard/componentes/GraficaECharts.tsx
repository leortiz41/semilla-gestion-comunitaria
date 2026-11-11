import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export default function GraficaECharts({
  opcion, descripcion,
}: {
  opcion: EChartsCoreOption;
  descripcion: string;
}) {
  const referencia = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const contenedor = referencia.current;
    if (!contenedor) return;
    const grafica = echarts.init(contenedor, undefined, { renderer: 'canvas' });
    grafica.setOption(opcion);
    const observador = new ResizeObserver(() => grafica.resize());
    observador.observe(contenedor);
    return () => {
      observador.disconnect();
      grafica.dispose();
    };
  }, [opcion]);
  return <div ref={referencia} className="dashboard-grafica" role="img" aria-label={descripcion} />;
}
