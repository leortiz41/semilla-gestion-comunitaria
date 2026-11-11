import { useEffect, useRef, type ReactNode } from 'react';
import { GridStack, type GridStackWidget } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

type Posicion = { id: string; x: number; y: number; w: number; h: number };
const inicial: Posicion[] = [
  { id: 'diagrama', x: 0, y: 0, w: 9, h: 7 },
  { id: 'detalle', x: 9, y: 0, w: 3, h: 7 },
];

export default function EspacioMapaGrid({
  usuarioId, proyectoId, mapa, detalle,
}: {
  usuarioId: string;
  proyectoId: string;
  mapa: ReactNode;
  detalle: ReactNode;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const instancia = useRef<GridStack | null>(null);
  const llave = `semilla:mapa-impacto:grid:v1:${usuarioId}:${proyectoId}`;

  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento) return;
    const grid = GridStack.init({
      column: 12, cellHeight: 78, margin: 10, animate: true,
      draggable: { handle: '.mapa-impacto__panel-arrastre' },
      resizable: { handles: 'e,se,s,sw,w' },
    }, elemento);
    if (!grid) return;
    instancia.current = grid;
    try {
      const guardadas = JSON.parse(localStorage.getItem(llave) || '[]') as Posicion[];
      if (Array.isArray(guardadas) && guardadas.length === inicial.length &&
        guardadas.every((p) => inicial.some((i) => i.id === p.id) &&
          Number.isInteger(p.x) && Number.isInteger(p.y) && Number.isInteger(p.w) &&
          Number.isInteger(p.h) && p.x >= 0 && p.x < 12 &&
          p.y >= 0 && p.y < 80 && p.w > 0 && p.w <= 12 &&
          p.h >= 4 && p.h <= 14 && p.x + p.w <= 12)) {
        grid.batchUpdate();
        guardadas.forEach((p) => {
          const item = Array.from(elemento.children).find((n) => n.getAttribute('gs-id') === p.id);
          if (item) grid.update(item as HTMLElement, { x: p.x, y: p.y, w: p.w, h: p.h });
        });
        grid.batchUpdate(false);
      }
    } catch { /* Un diseño corrupto no impide consultar el mapa. */ }

    const guardar = () => {
      if (elemento.clientWidth < 850) return;
      const posiciones = (grid.save(false) as GridStackWidget[])
        .filter((w) => w.id).map((w) => ({
          id: w.id!, x: w.x ?? 0, y: w.y ?? 0, w: w.w ?? 3, h: w.h ?? 7,
        }));
      try { localStorage.setItem(llave, JSON.stringify(posiciones)); } catch { /* Sin almacenamiento */ }
    };
    grid.on('dragstop', guardar);
    grid.on('resizestop', guardar);
    const adaptar = () => {
      const movil = elemento.clientWidth < 850;
      grid.column(movil ? 1 : 12);
      grid.enableMove(!movil);
      grid.enableResize(!movil);
    };
    const observador = new ResizeObserver(adaptar);
    observador.observe(elemento);
    adaptar();
    return () => {
      // Nunca sobrescribir el diseño al salir del módulo.
      observador.disconnect();
      grid.off('dragstop');
      grid.off('resizestop');
      grid.destroy(false);
      instancia.current = null;
    };
  }, [llave]);

  function restablecer() {
    const grid = instancia.current;
    const elemento = contenedor.current;
    if (!grid || !elemento) return;
    try { localStorage.removeItem(llave); } catch { /* Sin almacenamiento */ }
    grid.batchUpdate();
    inicial.forEach((p) => {
      const item = Array.from(elemento.children).find((n) => n.getAttribute('gs-id') === p.id);
      if (item) grid.update(item as HTMLElement, { x: p.x, y: p.y, w: p.w, h: p.h });
    });
    grid.batchUpdate(false);
  }

  return (
    <section className="mapa-impacto__espacio-grid" aria-label="Espacio visual personalizable">
      <div className="mapa-impacto__layout-tools">
        <span>Arrastrá la cabecera de cada panel para reorganizarlo o ajustá su borde para cambiar el tamaño.</span>
        <button type="button" onClick={restablecer}>Restablecer paneles</button>
      </div>
      <div ref={contenedor} className="grid-stack mapa-impacto__grid">
        <div className="grid-stack-item" gs-id="diagrama" gs-x="0" gs-y="0" gs-w="9" gs-h="7">
          <div className="grid-stack-item-content mapa-impacto__panel-grid">
            <div className="mapa-impacto__panel-arrastre"><strong>Diagrama interactivo</strong><span aria-hidden="true">⠿</span></div>
            <div className="mapa-impacto__panel-cuerpo">{mapa}</div>
          </div>
        </div>
        <div className="grid-stack-item" gs-id="detalle" gs-x="9" gs-y="0" gs-w="3" gs-h="7">
          <div className="grid-stack-item-content mapa-impacto__panel-grid">
            <div className="mapa-impacto__panel-arrastre"><strong>Información seleccionada</strong><span aria-hidden="true">⠿</span></div>
            <div className="mapa-impacto__panel-cuerpo">{detalle}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
