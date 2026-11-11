import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, MarkerType,
  type Edge, type Node, type NodeMouseHandler, type ReactFlowInstance, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { MapPinned, FolderKanban, ListChecks, ClipboardCheck, Image as ImageIcon } from 'lucide-react';
import type { DetalleImpacto, PosicionesNodosMapa } from '../../../servicios/mapa-impacto/servicioMapaImpacto';

type TipoNodo = 'comunidad' | 'proyecto' | 'actividad' | 'avance' | 'evidencia';
type NivelMapa = 'resumen' | 'completo';

const iconos = {
  comunidad: MapPinned,
  proyecto: FolderKanban,
  actividad: ListChecks,
  avance: ClipboardCheck,
  evidencia: ImageIcon,
} satisfies Record<TipoNodo, typeof MapPinned>;

const colores: Record<TipoNodo, { fondo: string; borde: string; nombre: string }> = {
  comunidad: { fondo: '#ffffff', borde: '#318b72', nombre: 'Comunidad' },
  proyecto: { fondo: '#ffffff', borde: '#245b82', nombre: 'Proyecto' },
  actividad: { fondo: '#ffffff', borde: '#428c54', nombre: 'Actividad' },
  avance: { fondo: '#ffffff', borde: '#b87825', nombre: 'Avance' },
  evidencia: { fondo: '#ffffff', borde: '#456cba', nombre: 'Fotografía' },
};
const nombreEstado: Record<string, string> = {
  VALIDADO: 'Validado', ENVIADO: 'En revisión', BORRADOR: 'Borrador',
  DEVUELTO: 'Devuelto', EN_EJECUCION: 'En ejecución',
};

function estilo(tipo: TipoNodo, seleccionado: boolean, coincide: boolean): Node['style'] {
  return {
    width: tipo === 'proyecto' ? 235 : 215,
    background: colores[tipo].fondo,
    border: `1px solid ${seleccionado ? '#c88a32' : '#d8e0e7'}`,
    borderLeft: `5px solid ${colores[tipo].borde}`,
    borderRadius: 14,
    padding: '12px 13px',
    color: '#213c47',
    fontWeight: 650,
    fontSize: 13,
    boxShadow: seleccionado ? '0 0 0 3px #daa35450, 0 12px 24px #152b4130' : '0 6px 17px #20364d17',
    opacity: coincide ? 1 : 0.38,
  };
}

export default function MapaReactFlow({
  datos, usuarioId, seleccion, seleccionar, posicionesIniciales, onGuardar,
}: {
  datos: DetalleImpacto;
  usuarioId: string;
  seleccion: { tipo: string; id: string } | null;
  seleccionar: (tipo: string, id: string) => void;
  posicionesIniciales?: PosicionesNodosMapa;
  onGuardar?: (posiciones: PosicionesNodosMapa) => void;
}) {
  // Mostrar solo los primeros niveles evita que la vista inicial se reduzca a nodos diminutos.
  const [nivel, setNivel] = useState<NivelMapa>('resumen');
  const [actividadesAbiertas, setActividadesAbiertas] = useState<string[]>([]);
  const [avancesAbiertos, setAvancesAbiertos] = useState<string[]>([]);
  const [busquedaNodo, setBusquedaNodo] = useState('');
  const [instancia, setInstancia] = useState<ReactFlowInstance | null>(null);
  const llavePosiciones = `semilla:mapa-impacto:posiciones:v1:${usuarioId}:${datos.proyecto.id}`;
  const [posiciones, setPosiciones] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const valor = posicionesIniciales ?? JSON.parse(localStorage.getItem(llavePosiciones) || '{}') as PosicionesNodosMapa;
      return valor && !Array.isArray(valor) && typeof valor === 'object' ? valor : {};
    } catch { return {}; }
  });
  const [edicionVisual, setEdicionVisual] = useState(true);
  const [mostrarMinimapa, setMostrarMinimapa] = useState(true);

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
      const guardada = posiciones[id];
      const posicion = guardada && Number.isFinite(guardada.x) && Number.isFinite(guardada.y) &&
        Math.abs(guardada.x) < 20000 && Math.abs(guardada.y) < 20000
        ? guardada : { x, y };
      const coincide = !termino || `${titulo} ${subtitulo} ${colores[tipo].nombre}`.toLocaleLowerCase('es').includes(termino);
      if (termino && coincide) encontrados++;
      const seleccionado = seleccion?.tipo + ':' + seleccion?.id === id;
      const Icono = iconos[tipo];
      nodes.push({
        id, position: posicion,
        data: {
          label: (
            <div className="mapa-impacto__nodo-contenido" title={titulo}>
              <span className="mapa-impacto__nodo-icono"
                style={{ color: colores[tipo].borde, backgroundColor: colores[tipo].borde + '12' }}>
                <Icono size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="mapa-impacto__nodo-textos">
                <span className="mapa-impacto__nodo-titulo">{titulo}</span>
                {subtitulo && <span className="mapa-impacto__nodo-subtitulo">{subtitulo}</span>}
              </span>
            </div>
          ),
        },
        style: estilo(tipo, seleccionado, coincide),
        className: 'mapa-impacto__nodo',
        draggable: edicionVisual, selectable: true, connectable: false,
      });
    };
    const unir = (origen: string, destino: string) => edges.push({
      id: `e-${origen}-${destino}`,
      source: origen, target: destino, type: 'smoothstep',
      style: { stroke: '#8195a8', strokeWidth: 1.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#8195a8' },
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
  }, [datos, nivel, actividadesAbiertas, avancesAbiertos, busquedaNodo, seleccion, posiciones, edicionVisual]);

  const ajustarVista = useCallback(() => {
    if (instancia) void instancia.fitView({ padding: 0.2, duration: 400, maxZoom: 1.05 });
  }, [instancia]);

  useEffect(() => {
    // El proyecto nuevo comienza con una vista legible de sus relaciones principales.
    setNivel('resumen');
    setActividadesAbiertas([]);
    setAvancesAbiertos([]);
    setBusquedaNodo('');
    try {
      const valor = posicionesIniciales ?? JSON.parse(localStorage.getItem(llavePosiciones) || '{}') as PosicionesNodosMapa;
      setPosiciones(valor && !Array.isArray(valor) && typeof valor === 'object' ? valor : {});
    } catch { setPosiciones({}); }
  }, [datos.proyecto.id, llavePosiciones]);

  useEffect(() => {
    if (!instancia) return;
    const identificador = window.requestAnimationFrame(() => {
      void instancia.fitView({ padding: 0.2, duration: 260, maxZoom: 1.05 });
    });
    return () => window.cancelAnimationFrame(identificador);
  }, [instancia, nivel, actividadesAbiertas, avancesAbiertos, datos.proyecto.id]);

  const cambiarPosiciones = useCallback((cambios: NodeChange[]) => {
    const cambiosPosicion = cambios.filter((c): c is NodeChange & {
      type: 'position'; position: { x: number; y: number };
    } => c.type === 'position' && !!c.position);
    if (!cambiosPosicion.length) return;
    setPosiciones((actual) => {
      const siguiente = { ...actual };
      cambiosPosicion.forEach((c) => {
        if (Number.isFinite(c.position.x) && Number.isFinite(c.position.y)) {
          siguiente[c.id] = { x: c.position.x, y: c.position.y };
        }
      });
      return siguiente;
    });
  }, []);

  const guardarPosiciones = useCallback((_evento: unknown, nodo: Node) => {
    const siguientes = {
      ...posiciones,
      [nodo.id]: { x: nodo.position.x, y: nodo.position.y },
    };
    setPosiciones(siguientes);
    try { localStorage.setItem(llavePosiciones, JSON.stringify(siguientes)); }
    catch { /* El navegador puede bloquear almacenamiento. */ }
    onGuardar?.(siguientes);
  }, [llavePosiciones, onGuardar, posiciones]);

  function restablecerDisposicion() {
    setPosiciones({});
    try { localStorage.removeItem(llavePosiciones); } catch { /* Sin almacenamiento. */ }
    onGuardar?.({});
    if (instancia) window.requestAnimationFrame(() => void instancia.fitView({
      padding: 0.23, maxZoom: 1, duration: 380,
    }));
  }

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
          <span>Buscar nodo</span>
          <input value={busquedaNodo} onChange={(e) => setBusquedaNodo(e.target.value)}
            placeholder="Buscar nodo…" aria-label="Buscar nodo del mapa" />
        </label>
        <div className="mapa-impacto__acciones-mapa">
          <button type="button" className={edicionVisual ? 'mapa-impacto__modo-activo' : ''}
            aria-pressed={edicionVisual} onClick={() => setEdicionVisual((valor) => !valor)}>
            {edicionVisual ? 'Mover nodos: activo' : 'Mover nodos: inactivo'}
          </button>
          <button type="button" className="mapa-impacto__centrar" onClick={ajustarVista}>Centrar</button>
          <button type="button" aria-pressed={mostrarMinimapa}
            onClick={() => setMostrarMinimapa((actual) => !actual)}>
            {mostrarMinimapa ? 'Ocultar minimapa' : 'Mostrar minimapa'}
          </button>
          <button type="button" onClick={restablecerDisposicion}>Restablecer posiciones</button>
        </div>
      </div>
      <div className="mapa-impacto__visor">
        <ReactFlow nodes={nodes} edges={edges}
          onInit={setInstancia} onNodeClick={alSeleccionar}
          onNodesChange={cambiarPosiciones} onNodeDragStop={guardarPosiciones}
          nodesDraggable={edicionVisual} nodesConnectable={false}
          fitView fitViewOptions={{ padding: 0.2, maxZoom: 1.05 }}
          minZoom={0.12} maxZoom={2}
          proOptions={{ hideAttribution: false }}>
          <Background color="#becbd8" gap={22} size={1} />
          <Controls showInteractive={false} />
          {mostrarMinimapa && <MiniMap pannable zoomable
            style={{ width: 120, height: 80 }}
            nodeColor={(n) => n.id.startsWith('evidencia:') ? '#456cba'
              : n.id.startsWith('avance:') ? '#b87825' : '#318b72'} />}
        </ReactFlow>
      </div>
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
