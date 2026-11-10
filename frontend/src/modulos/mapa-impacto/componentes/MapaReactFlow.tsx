import { useMemo } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap, MarkerType,
  type Edge, type Node, type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DetalleImpacto } from '../../../servicios/mapa-impacto/servicioMapaImpacto';

const colores: Record<string, { fondo: string; borde: string }> = {
  comunidad: { fondo: '#e5f1df', borde: '#8bb69a' },
  proyecto: { fondo: '#d4ead9', borde: '#52865d' },
  actividad: { fondo: '#eaf4e8', borde: '#a1c1a0' },
  avance: { fondo: '#fff3dc', borde: '#cfaa68' },
  evidencia: { fondo: '#e4f0fb', borde: '#83abc9' },
};

function estilo(tipo: keyof typeof colores): Node['style'] {
  return {
    width: tipo === 'proyecto' ? 220 : 190,
    background: colores[tipo].fondo,
    border: `1.5px solid ${colores[tipo].borde}`,
    borderRadius: 13,
    padding: '11px 13px',
    color: '#284b37',
    fontWeight: 650,
    fontSize: 12,
    boxShadow: '0 7px 18px #244f3512',
  };
}

export default function MapaReactFlow({
  datos, seleccionar,
}: {
  datos: DetalleImpacto;
  seleccionar: (tipo: string, id: string) => void;
}) {
  const { nodes, edges, omitidos } = useMemo(() => {
    // Límites visuales: no saturar el navegador; los datos completos se consultan en el panel.
    const actividades = datos.actividades.slice(0, 24);
    const idsActividades = new Set(actividades.map((a) => a.id));
    const avances = datos.avances.filter((av) => idsActividades.has(av.actividadId)).slice(0, 72);
    const idsAvances = new Set(avances.map((av) => av.id));
    const evidencias = datos.evidencias.filter((ev) => idsAvances.has(ev.avanceId)).slice(0, 100);
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const agregar = (id: string, tipo: keyof typeof colores, titulo: string, x: number, y: number) => {
      nodes.push({
        id,
        position: { x, y },
        data: { label: titulo },
        style: estilo(tipo),
        draggable: false,
        selectable: true,
        connectable: false,
      });
    };
    const unir = (origen: string, destino: string) => edges.push({
      id: `e-${origen}-${destino}`,
      source: origen,
      target: destino,
      type: 'smoothstep',
      style: { stroke: '#96b6a0', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#96b6a0' },
    });
    agregar('comunidad:' + datos.proyecto.comunidadId, 'comunidad',
      '🏘️ ' + datos.proyecto.comunidad, 0, 40);
    agregar('proyecto:' + datos.proyecto.id, 'proyecto',
      '📁 ' + datos.proyecto.nombre, 270, 40);
    unir('comunidad:' + datos.proyecto.comunidadId, 'proyecto:' + datos.proyecto.id);
    const coordenadas = new Map<string, number>();
    actividades.forEach((a, i) => {
      const y = i * 125 + 40;
      agregar('actividad:' + a.id, 'actividad', '🗓️ ' + a.nombre, 560, y);
      unir('proyecto:' + datos.proyecto.id, 'actividad:' + a.id);
      coordenadas.set(a.id, y);
    });
    const avancesPorActividad = new Map<string, number>();
    avances.forEach((av) => {
      const indice = avancesPorActividad.get(av.actividadId) ?? 0;
      avancesPorActividad.set(av.actividadId, indice + 1);
      const base = coordenadas.get(av.actividadId) ?? 40;
      const y = base + indice * 78;
      agregar('avance:' + av.id, 'avance', `📋 ${av.fecha} · ${av.estado}`, 810, y);
      unir('actividad:' + av.actividadId, 'avance:' + av.id);
      coordenadas.set(av.id, y);
    });
    const fotosPorAvance = new Map<string, number>();
    evidencias.forEach((foto) => {
      const indice = fotosPorAvance.get(foto.avanceId) ?? 0;
      fotosPorAvance.set(foto.avanceId, indice + 1);
      const y = (coordenadas.get(foto.avanceId) ?? 40) + indice * 62;
      agregar('evidencia:' + foto.id, 'evidencia', '📷 ' + (foto.titulo || 'Fotografía'), 1060, y);
      unir('avance:' + foto.avanceId, 'evidencia:' + foto.id);
    });
    const omitidos = datos.actividades.length - actividades.length +
      datos.avances.length - avances.length + datos.evidencias.length - evidencias.length;
    return { nodes, edges, omitidos };
  }, [datos]);

  const alSeleccionar: NodeMouseHandler = (_evento, nodo) => {
    const separador = nodo.id.indexOf(':');
    seleccionar(nodo.id.slice(0, separador), nodo.id.slice(separador + 1));
  };

  return (
    <div className="mapa-impacto__lienzo">
      <ReactFlow nodes={nodes} edges={edges}
        onNodeClick={alSeleccionar}
        nodesDraggable={false} nodesConnectable={false}
        elementsSelectable
        fitView fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
        minZoom={0.15} maxZoom={1.8}
        proOptions={{ hideAttribution: false }}>
        <Background color="#d6e5d9" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable
          nodeColor={(n) => n.id.startsWith('evidencia:') ? '#83abc9'
            : n.id.startsWith('avance:') ? '#cfaa68' : '#72a782'} />
      </ReactFlow>
      {omitidos > 0 && <p className="mapa-impacto__limite">
        Mostramos una selección de nodos ({omitidos} omitidos para mantener el rendimiento).
        El historial completo permanece disponible en los módulos originales.
      </p>}
    </div>
  );
}
