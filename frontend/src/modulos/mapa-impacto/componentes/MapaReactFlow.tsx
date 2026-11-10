import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, MarkerType,
  type Edge, type Node, type NodeMouseHandler, type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DetalleImpacto } from '../../../servicios/mapa-impacto/servicioMapaImpacto';

type TipoNodo = 'comunidad' | 'proyecto' | 'actividad' | 'avance' | 'evidencia';
type NivelMapa = 'resumen' | 'completo';

const colores: Record<TipoNodo, { fondo: string; borde: string; simbolo: string; nombre: string }> = {
  comunidad: { fondo: '#e5f1df', borde: '#8bb69a', simbolo: '🏘️', nombre: 'Comunidad' },
  proyecto: { fondo: '#d4ead9', borde: '#52865d', simbolo: '📁', nombre: 'Proyecto' },
  actividad: { fondo: '#eaf4e8', borde: '#a1c1a0', simbolo: '🗓️', nombre: 'Actividad' },
  avance: { fondo: '#fff3dc', borde: '#cfaa68', simbolo: '📋', nombre: 'Avance' },
  evidencia: { fondo: '#e4f0fb', borde: '#83abc9', simbolo: '📷', nombre: 'Fotografía' },
};
const nombreEstado: Record<string, string> = {
  VALIDADO: 'Validado', ENVIADO: 'En revisión', BORRADOR: 'Borrador',
  DEVUELTO: 'Devuelto', EN_EJECUCION: 'En ejecución',
};

function estilo(tipo: TipoNodo, seleccionado: boolean, coincide: boolean): Node['style'] {
  return {
    width: tipo === 'proyecto' ? 235 : 215,
    background: colores[tipo].fondo,
    border: `${seleccionado ? 3 : 1.5}px solid ${seleccionado ? '#ce9346' : colores[tipo].borde}`,
    borderRadius: 14,
    padding: '13px 15px',
    color: '#284b37',
    fontWeight: 650,
    fontSize: 14,
    boxShadow: seleccionado ? '0 0 0 4px #e7b96c55, 0 10px 22px #244f3520' : '0 7px 18px #244f3512',
    opacity: coincide ? 1 : 0.38,
  };
}

export default function MapaReactFlow({
  datos, seleccion, seleccionar,
}: {
  datos: DetalleImpacto;
  seleccion: { tipo: string; id: string } | null;
  seleccionar: (tipo: string, id: string) => void;
}) {
  // Mostrar solo los primeros niveles evita que la vista inicial se reduzca a nodos diminutos.
  const [nivel, setNivel] = useState<NivelMapa>('resumen');
  const [actividadesAbiertas, setActividadesAbiertas] = useState<string[]>([]);
  const [avancesAbiertos, setAvancesAbiertos] = useState<string[]>([]);
  const [busquedaNodo, setBusquedaNodo] = useState('');
  const [instancia, setInstancia] = useState<ReactFlowInstance | null>(null);

  const { nodes, edges, omitidos, encontrados } = useMemo(() => {
    const actividades = datos.actividades.slice(0, 24);
    const idsActividades = new Set(actividades.map((a) => a.id));
    const avances = datos.avances.filter((av) => idsActividades.has(av.actividadId)).slice(0, 72);
    const idsAvances = new Set(avances.map((av) => av.id));
    const evidencias = datos.evidencias.filter((ev) => idsAvances.has(ev.avanceId)).slice(0, 100);
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const termino = busquedaNodo.trim().toLocaleLowerCase('es');
    let encontrados = 0;
    const agregar = (id: string, tipo: TipoNodo, titulo: string, subtitulo: string, x: number, y: number) => {
      const coincide = !termino || `${titulo} ${subtitulo} ${colores[tipo].nombre}`.toLocaleLowerCase('es').includes(termino);
      if (termino && coincide) encontrados++;
      const seleccionado = seleccion?.tipo + ':' + seleccion?.id === id;
      nodes.push({
        id, position: { x, y },
        data: { label: `${colores[tipo].simbolo} ${titulo}${subtitulo ? ' · ' + subtitulo : ''}` },
        style: estilo(tipo, seleccionado, coincide),
        className: 'mapa-impacto__nodo',
        draggable: false, selectable: true, connectable: false,
      });
    };
    const unir = (origen: string, destino: string) => edges.push({
      id: `e-${origen}-${destino}`,
      source: origen, target: destino, type: 'smoothstep',
      style: { stroke: '#96b6a0', strokeWidth: 1.7 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#96b6a0' },
    });

    let siguienteY = 50;
    const centros: number[] = [];
    actividades.forEach((actividad) => {
      const idActividad = 'actividad:' + actividad.id;
      const abierta = nivel === 'completo' || actividadesAbiertas.includes(actividad.id);
      const avancesActividad = avances.filter((av) => av.actividadId === actividad.id);
      const inicioRama = siguienteY;
      if (abierta && avancesActividad.length) {
        avancesActividad.forEach((avance) => {
          const fotos = evidencias.filter((ev) => ev.avanceId === avance.id);
          const mostrarFotos = nivel === 'completo' || avancesAbiertos.includes(avance.id);
          const altura = mostrarFotos && fotos.length ? Math.max(94, fotos.length * 85) : 105;
          const yAvance = siguienteY + (altura - 65) / 2;
          agregar('avance:' + avance.id, 'avance', avance.fecha,
            nombreEstado[avance.estado] || avance.estado, 810, yAvance);
          unir(idActividad, 'avance:' + avance.id);
          if (mostrarFotos) fotos.forEach((foto, index) => {
            agregar('evidencia:' + foto.id, 'evidencia', foto.titulo || 'Fotografía',
              'Ver evidencia', 1080, siguienteY + index * 85);
            unir('avance:' + avance.id, 'evidencia:' + foto.id);
          });
          siguienteY += altura + 25;
        });
      } else siguienteY += 110;
      const centro = inicioRama + (siguienteY - inicioRama - 70) / 2;
      agregar(idActividad, 'actividad', actividad.nombre,
        abierta ? `${avancesActividad.length} avances · ocultar al pulsar` :
          `${avancesActividad.length} avances · pulsar para explorar`, 550, centro);
      unir('proyecto:' + datos.proyecto.id, idActividad);
      centros.push(centro);
      siguienteY += 35;
    });

    const centro = centros.length ? (centros[0] + centros[centros.length - 1]) / 2 : 55;
    agregar('comunidad:' + datos.proyecto.comunidadId, 'comunidad', datos.proyecto.comunidad, '', 0, centro);
    agregar('proyecto:' + datos.proyecto.id, 'proyecto', datos.proyecto.nombre,
      `${actividades.length} actividades`, 270, centro);
    unir('comunidad:' + datos.proyecto.comunidadId, 'proyecto:' + datos.proyecto.id);
    const omitidos = datos.actividades.length - actividades.length +
      datos.avances.length - avances.length + datos.evidencias.length - evidencias.length;
    return { nodes, edges, omitidos, encontrados };
  }, [datos, nivel, actividadesAbiertas, avancesAbiertos, busquedaNodo, seleccion]);

  const ajustarVista = useCallback(() => {
    if (instancia) void instancia.fitView({ padding: 0.2, duration: 400, maxZoom: 1.05 });
  }, [instancia]);

  useEffect(() => {
    // El proyecto nuevo comienza con una vista legible de sus relaciones principales.
    setNivel('resumen');
    setActividadesAbiertas([]);
    setAvancesAbiertos([]);
    setBusquedaNodo('');
  }, [datos.proyecto.id]);

  useEffect(() => {
    if (!instancia) return;
    const identificador = window.requestAnimationFrame(() => {
      void instancia.fitView({ padding: 0.2, duration: 260, maxZoom: 1.05 });
    });
    return () => window.cancelAnimationFrame(identificador);
  }, [instancia, nivel, actividadesAbiertas, avancesAbiertos, datos.proyecto.id]);

  const alSeleccionar: NodeMouseHandler = (_evento, nodo) => {
    const separador = nodo.id.indexOf(':');
    const tipo = nodo.id.slice(0, separador);
    const id = nodo.id.slice(separador + 1);
    seleccionar(tipo, id);
    if (nivel === 'resumen') {
      if (tipo === 'actividad') {
        setActividadesAbiertas((actual) => actual.includes(id) ?
          actual.filter((v) => v !== id) : [...actual, id]);
      } else if (tipo === 'avance') {
        setAvancesAbiertos((actual) => actual.includes(id) ?
          actual.filter((v) => v !== id) : [...actual, id]);
      }
    }
  };

  function mostrarTodo() {
    setNivel('completo');
    setBusquedaNodo('');
  }
  function verResumen() {
    setNivel('resumen');
    setActividadesAbiertas([]);
    setAvancesAbiertos([]);
    setBusquedaNodo('');
  }

  return (
    <div className="mapa-impacto__lienzo">
      <div className="mapa-impacto__barra-mapa" aria-label="Controles de navegación del mapa">
        <div className="mapa-impacto__niveles">
          <button type="button" className={nivel === 'resumen' ? 'activo' : ''}
            aria-pressed={nivel === 'resumen'} onClick={verResumen}>Explorar por niveles</button>
          <button type="button" className={nivel === 'completo' ? 'activo' : ''}
            aria-pressed={nivel === 'completo'} onClick={mostrarTodo}>Ver mapa completo</button>
        </div>
        <label className="mapa-impacto__buscar-nodo">
          <span className="sr-only">Buscar un nodo del mapa</span>
          <input value={busquedaNodo} onChange={(e) => setBusquedaNodo(e.target.value)}
            placeholder="Buscar nodo…" aria-label="Buscar nodo del mapa" />
        </label>
        <button type="button" className="mapa-impacto__centrar" onClick={ajustarVista}>Centrar mapa</button>
      </div>
      <ReactFlow nodes={nodes} edges={edges}
        onInit={setInstancia} onNodeClick={alSeleccionar}
        nodesDraggable={false} nodesConnectable={false}
        fitView fitViewOptions={{ padding: 0.2, maxZoom: 1.05 }}
        minZoom={0.12} maxZoom={2}
        proOptions={{ hideAttribution: false }}>
        <Background color="#d6e5d9" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable
          nodeColor={(n) => n.id.startsWith('evidencia:') ? '#83abc9'
            : n.id.startsWith('avance:') ? '#cfaa68' : '#72a782'} />
      </ReactFlow>
      <div className="mapa-impacto__leyenda">
        {Object.entries(colores).map(([tipo, color]) =>
          <span key={tipo}><i style={{ backgroundColor: color.borde }} />{color.nombre}</span>)}
      </div>
      {busquedaNodo.trim() && <p className="mapa-impacto__coincidencias" role="status">
        {encontrados} coincidencias entre los nodos visibles.
        {nivel === 'resumen' && ' Abrí las actividades para buscar en los niveles internos.'}
      </p>}
      {omitidos > 0 && <p className="mapa-impacto__limite">
        {omitidos} registros fuera de la selección por rendimiento. Consultá el historial completo en los módulos originales.
      </p>}
    </div>
  );
}
