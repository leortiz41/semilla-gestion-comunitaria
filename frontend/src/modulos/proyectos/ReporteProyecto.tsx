import type { ActividadProyecto } from '../../lib/api';

const celda = (valor: string | number | null | undefined) => {
  const texto = String(valor ?? '');
  // Evita que una descripción/nombre ingresado por usuarios ejecute fórmulas en Excel.
  const seguro = /^[=+@\-]/.test(texto) ? "'" + texto : texto;
  return '"' + seguro.replace(/"/g, '""') + '"';
};

export default function ReporteProyecto({
  nombre, comunidad, actividades, estado,
}: {
  nombre: string;
  comunidad: string;
  actividades: ActividadProyecto[];
  estado: string;
}) {
  function descargar() {
    const encabezados = ['Proyecto', 'Comunidad', 'Estado', 'Actividad', 'Meta', 'Unidad',
      'Cantidad validada', 'Avance físico (%)', 'Fotografías', 'Última ejecución validada'];
    const filas = actividades.map((actividad) => [
      nombre, comunidad, estado, actividad.nombre, actividad.metaCantidad ?? 'Estimación',
      actividad.unidadMedida ?? '%', actividad.cantidadValidada, actividad.porcentajeResultado,
      actividad.avances.filter((avance) => avance.estadoRevision === 'VALIDADO')
        .reduce((total, avance) => total + (avance.cantidadEvidencias ?? 0), 0),
      actividad.ultimaEjecucionValidada ?? '',
    ]);
    const csv = [encabezados, ...filas].map((fila) => fila.map(celda).join(';')).join('\r\n');
    const archivo = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'semilla-resultados-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (estado !== 'FINALIZADO') return null;
  return (
    <section className="cierre-proyecto" aria-label="Informe del proyecto finalizado">
      <h3>Informe de resultados</h3>
      <p>Descargá las metas, cantidades validadas y evidencias registradas para este proyecto.
        El historial completo y las fotografías permanecen disponibles dentro de Semilla.</p>
      <button type="button" onClick={descargar}>Descargar reporte CSV</button>
    </section>
  );
}
