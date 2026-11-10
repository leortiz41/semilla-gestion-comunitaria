const catalogo = [
  { id: 'proyectos', titulo: 'Proyectos en curso', descripcion: 'Total de proyectos activos en el filtro' },
  { id: 'actividades', titulo: 'Avances validados', descripcion: 'Registros de ejecución aprobados' },
  { id: 'presupuesto', titulo: 'Presupuesto asignado', descripcion: 'Recursos asignados, no gastos' },
  { id: 'evidencias', titulo: 'Fotografías guardadas', descripcion: 'Evidencias registradas por proyecto' },
  { id: 'estados', titulo: 'Proyectos por estado', descripcion: 'Distribución de proyectos' },
  { id: 'areas', titulo: 'Proyectos por área', descripcion: 'Clasificación de proyectos comunitarios' },
  { id: 'avances', titulo: 'Avances registrados por mes', descripcion: 'Historial de validaciones y revisiones' },
] as const;

export const idsWidgets = catalogo.map((widget) => widget.id);

export default function CatalogoWidgets({
  visibles, alCambiar,
}: {
  visibles: string[];
  alCambiar: (visibles: string[]) => void;
}) {
  return (
    <details className="dashboard-catalogo">
      <summary>Personalizar widgets <span>{visibles.length} de {catalogo.length} activos</span></summary>
      <div className="dashboard-catalogo__contenido">
        <p>Elegí los indicadores que querés ver. Podés volver a activar cualquier panel cuando lo necesités.</p>
        <div className="dashboard-catalogo__lista">
          {catalogo.map((widget) => (
            <label key={widget.id} className="dashboard-catalogo__opcion">
              <input type="checkbox" checked={visibles.includes(widget.id)}
                onChange={(evento) => alCambiar(evento.target.checked
                  ? idsWidgets.filter((id) => id === widget.id || visibles.includes(id))
                  : visibles.filter((id) => id !== widget.id))} />
              <span><strong>{widget.titulo}</strong><small>{widget.descripcion}</small></span>
            </label>
          ))}
        </div>
        <div className="dashboard-catalogo__acciones">
          <button type="button" onClick={() => alCambiar([...idsWidgets])}>Mostrar todos</button>
          <button type="button" onClick={() => alCambiar([])}>Ocultar todos</button>
        </div>
      </div>
    </details>
  );
}
