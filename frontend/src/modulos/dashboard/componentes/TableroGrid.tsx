import { useEffect, useRef, type ReactNode } from 'react';
import { GridStack, type GridStackWidget } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

type Posicion = { id: string; x: number; y: number; w: number; h: number };
const posicionesIniciales: Posicion[] = [
  { id: 'proyectos', x: 0, y: 0, w: 3, h: 2 },
  { id: 'actividades', x: 3, y: 0, w: 3, h: 2 },
  { id: 'presupuesto', x: 6, y: 0, w: 3, h: 2 },
  { id: 'evidencias', x: 9, y: 0, w: 3, h: 2 },
  { id: 'estados', x: 0, y: 2, w: 6, h: 4 },
  { id: 'areas', x: 6, y: 2, w: 6, h: 4 },
  { id: 'avances', x: 0, y: 6, w: 12, h: 4 },
];

export default function TableroGrid({
  usuario, contenido, visibles,
}: {
  usuario: string;
  contenido: Record<string, { titulo: string; contenido: ReactNode }>;
  visibles: string[];
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const cuadricula = useRef<GridStack | null>(null);
  const llave = 'semilla:dashboard:layout:v1:' + usuario;
  const activos = posicionesIniciales.filter((p) => visibles.includes(p.id));

  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento) return;
    const grid = GridStack.init({
      column: 12,
      cellHeight: 76,
      margin: 12,
      mode: 'top',
      draggable: { handle: '.dashboard-widget__handle' },
      resizable: { handles: 'e,se,s,sw,w' },
      animate: true,
    }, elemento);
    if (!grid) return;
    cuadricula.current = grid;
    try {
      const guardado = localStorage.getItem(llave);
      if (guardado) {
        const posiciones = JSON.parse(guardado) as Posicion[];
        if (Array.isArray(posiciones) &&
            posiciones.every((p) => posicionesIniciales.some((v) => v.id === p.id) &&
              Number.isInteger(p.x) && p.x >= 0 && p.x < 12 &&
              Number.isInteger(p.y) && p.y >= 0 && p.y < 100 &&
              Number.isInteger(p.w) && p.w > 0 && p.w <= 12 &&
              Number.isInteger(p.h) && p.h > 0 && p.h < 15)) {
          grid.batchUpdate();
          posiciones.forEach((p) => {
            const item = Array.from(elemento.children).find(
              (n) => n.getAttribute('gs-id') === p.id,
            );
            if (item) grid.update(item as HTMLElement, { x: p.x, y: p.y, w: p.w, h: p.h });
          });
          grid.batchUpdate(false);
        }
      }
    } catch {
      // Una configuración local corrupta nunca debe impedir abrir el Dashboard.
    }
    const guardar = () => {
      if (elemento.clientWidth < 800) return;
      const posiciones = (grid.save(false) as GridStackWidget[]).filter((w) => w.id).map(
        (w) => ({ id: w.id!, x: w.x ?? 0, y: w.y ?? 0, w: w.w ?? 3, h: w.h ?? 2 }),
      );
      try {
        const anterior = JSON.parse(localStorage.getItem(llave) || '[]') as Posicion[];
        const ocultos = Array.isArray(anterior)
          ? anterior.filter((p) => posicionesIniciales.some((base) => base.id === p.id) &&
            !posiciones.some((actual) => actual.id === p.id))
          : [];
        localStorage.setItem(llave, JSON.stringify([...ocultos, ...posiciones]));
      } catch { /* Almacenamiento no disponible */ }
    };
    grid.on('dragstop', guardar);
    grid.on('resizestop', guardar);
    const adaptar = () => {
      const movil = elemento.clientWidth < 800;
      grid.column(movil ? 1 : 12);
      grid.enableMove(!movil);
      grid.enableResize(!movil);
    };
    const observador = new ResizeObserver(adaptar);
    observador.observe(elemento);
    adaptar();
    return () => {
      guardar();
      observador.disconnect();
      grid.off('dragstop');
      grid.off('resizestop');
      grid.destroy(false);
      cuadricula.current = null;
    };
  }, [llave, visibles.join('|')]);

  function restablecer() {
    const grid = cuadricula.current;
    const elemento = contenedor.current;
    if (!grid || !elemento) return;
    try { localStorage.removeItem(llave); } catch { /* Almacenamiento no disponible */ }
    grid.batchUpdate();
    posicionesIniciales.forEach((p) => {
      const item = Array.from(elemento.children).find((n) => n.getAttribute('gs-id') === p.id);
      if (item) grid.update(item as HTMLElement, { x: p.x, y: p.y, w: p.w, h: p.h });
    });
    grid.batchUpdate(false);
  }

  return (
    <section className="dashboard-tablero" aria-label="Paneles personalizables">
      <div className="dashboard-tablero__herramientas">
        <p>En computadora podés arrastrar los títulos y ajustar los paneles. La disposición se guarda en este navegador.</p>
        <button type="button" onClick={restablecer}>Restablecer distribución</button>
      </div>
      {activos.length === 0 && <p className="dashboard-vacio">No hay paneles activos. Agregá widgets desde el catálogo.</p>}
      <div ref={contenedor} className="grid-stack dashboard-grid">
        {activos.map((p) => (
          <div key={p.id} className="grid-stack-item"
            {...{ 'gs-id': p.id, 'gs-x': p.x, 'gs-y': p.y, 'gs-w': p.w, 'gs-h': p.h }}>
            <div className="grid-stack-item-content dashboard-widget">
              <div className="dashboard-widget__handle" aria-label={'Mover panel ' + contenido[p.id].titulo}>
                <h2>{contenido[p.id].titulo}</h2><span aria-hidden="true">⠿</span>
              </div>
              <div className="dashboard-widget__contenido">{contenido[p.id].contenido}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
