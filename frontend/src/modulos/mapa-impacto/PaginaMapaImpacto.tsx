import { useEffect, useRef, useState } from 'react';
import MapaReactFlow from './componentes/MapaReactFlow';
import FotografiaPrivadaMapa from './componentes/FotografiaPrivadaMapa';
import EspacioMapaGrid from './componentes/EspacioMapaGrid';
import {
  listarProyectosMapa, obtenerMapaProyecto, obtenerPreferenciasMapa, guardarPreferenciasMapa,
  type DetalleImpacto, type ProyectoMapa, type PreferenciasMapaImpacto,
  type PosicionPanelMapa, type PosicionesNodosMapa,
} from '../../servicios/mapa-impacto/servicioMapaImpacto';
import '../../estilos/modulos/mapa-impacto/mapaImpacto.css';

type Seleccion = { tipo: string; id: string } | null;

export default function PaginaMapaImpacto({ token, usuarioId }: { token: string; usuarioId: string }) {
  const [proyectos, setProyectos] = useState<ProyectoMapa[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [datos, setDatos] = useState<DetalleImpacto | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [preferencias, setPreferencias] = useState<PreferenciasMapaImpacto | null>(null);
  const [preferenciasProyecto, setPreferenciasProyecto] = useState('');
  const [avisoPreferencias, setAvisoPreferencias] = useState('');
  const guardados = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!datos || datos.proyecto.id !== proyectoId) return;
    let activo = true;
    setPreferenciasProyecto('');
    const local = (): PreferenciasMapaImpacto => {
      try {
        const paneles = JSON.parse(localStorage.getItem(
          `semilla:mapa-impacto:grid:v1:${usuarioId}:${proyectoId}`) || 'null') as PosicionPanelMapa[] | null;
        const nodos = JSON.parse(localStorage.getItem(
          `semilla:mapa-impacto:posiciones:v1:${usuarioId}:${proyectoId}`) || '{}') as PosicionesNodosMapa;
        return {
          paneles: Array.isArray(paneles) ? paneles : undefined,
          nodos: nodos && typeof nodos === 'object' && !Array.isArray(nodos) ? nodos : {},
        };
      } catch { return {}; }
    };
    obtenerPreferenciasMapa(token, proyectoId).then((resultado) => {
      if (!activo) return;
      const cfg = resultado.configuracion ?? local();
      setPreferencias(cfg);
      setAvisoPreferencias('');
      // Mantener una copia de la configuración de Neon en el navegador.
      try {
        if (cfg.paneles) localStorage.setItem(
          `semilla:mapa-impacto:grid:v1:${usuarioId}:${proyectoId}`, JSON.stringify(cfg.paneles));
        if (cfg.nodos) localStorage.setItem(
          `semilla:mapa-impacto:posiciones:v1:${usuarioId}:${proyectoId}`, JSON.stringify(cfg.nodos));
      } catch { /* almacenamiento local opcional */ }
    }).catch(() => {
      if (!activo) return;
      setPreferencias(local());
      setAvisoPreferencias('No se pudieron cargar las preferencias de Neon; se utiliza la copia local.');
    }).finally(() => { if (activo) setPreferenciasProyecto(proyectoId); });
    return () => { activo = false; };
  }, [token, usuarioId, proyectoId, datos]);

  function persistirDiseño(
    idProyecto: string, tipo: 'paneles' | 'nodos', valor: PosicionPanelMapa[] | PosicionesNodosMapa,
  ) {
    guardados.current = guardados.current.catch(() => undefined).then(async () => {
      await guardarPreferenciasMapa(token, idProyecto, tipo, valor);
      setAvisoPreferencias('');
    }).catch(() => {
      setAvisoPreferencias('No se pudo guardar el diseño en Neon. Se conserva la copia local del navegador.');
    });
  }

  useEffect(() => {
    let activo = true;
    listarProyectosMapa(token).then((respuesta) => {
      if (!activo) return;
      setProyectos(respuesta.proyectos);
      setProyectoId((actual) => respuesta.proyectos.some((p) => p.id === actual)
        ? actual : (respuesta.proyectos[0]?.id ?? ''));
    }).catch((fallo: Error) => { if (activo) setError(fallo.message); });
    return () => { activo = false; };
  }, [token]);

  useEffect(() => {
    if (!proyectoId) { setDatos(null); setSeleccion(null); return; }
    let activo = true;
    setCargando(true); setError(''); setDatos(null); setSeleccion(null);
    obtenerMapaProyecto(token, proyectoId).then((respuesta) => {
      if (activo) {
        setDatos(respuesta);
        setSeleccion({ tipo: 'proyecto', id: respuesta.proyecto.id });
      }
    }).catch((fallo: Error) => { if (activo) setError(fallo.message); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [token, proyectoId, recarga]);

  const seleccionados = proyectos.filter((p) =>
    `${p.nombre} ${p.comunidad} ${p.tipo}`.toLowerCase().includes(busqueda.toLowerCase().trim()));
  const item = !datos || !seleccion ? null :
    seleccion.tipo === 'comunidad' ? {
      titulo: datos.proyecto.comunidad, descripcion: 'Comunidad asociada al proyecto.',
      estado: 'Comunidad', foto: null as string | null,
    } : seleccion.tipo === 'proyecto' ? {
      titulo: datos.proyecto.nombre, descripcion: datos.proyecto.descripcion || 'Sin descripción.',
      estado: datos.proyecto.estado, foto: null as string | null,
    } : seleccion.tipo === 'actividad' ?
      (() => {
        const a = datos.actividades.find((v) => v.id === seleccion.id);
        return a ? { titulo: a.nombre, descripcion: a.descripcion || 'Sin descripción.',
          estado: a.estado, foto: null as string | null } : null;
      })() :
    seleccion.tipo === 'avance' ?
      (() => {
        const av = datos.avances.find((v) => v.id === seleccion.id);
        return av ? { titulo: 'Avance · ' + av.fecha, descripcion: av.descripcion || 'Sin observaciones.',
          estado: av.estado, foto: null as string | null } : null;
      })() :
    seleccion.tipo === 'evidencia' ?
      (() => {
        const ev = datos.evidencias.find((v) => v.id === seleccion.id);
        return ev ? { titulo: ev.titulo || 'Fotografía de evidencia',
          descripcion: ev.descripcion || 'Evidencia documental del avance.',
          estado: 'Fotografía', foto: ev.url } : null;
      })() : null;

  return (
    <section className="pagina-mapa-impacto" aria-labelledby="titulo-mapa-impacto">
      <header className="mapa-impacto__encabezado">
        <div>
          <p className="mapa-impacto__etiqueta">Semilla · Inteligencia de desarrollo</p>
          <h1 id="titulo-mapa-impacto">Mapa de Impacto</h1>
          <p>Explorá las conexiones entre comunidades, proyectos, actividades, avances y fotografías.</p>
        </div>
        <button type="button" onClick={() => setRecarga((n) => n + 1)}
          disabled={!proyectoId || cargando}>{cargando ? 'Actualizando…' : 'Actualizar mapa'}</button>
      </header>
      <div className="mapa-impacto__herramientas">
        <label>Buscar proyectos
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, comunidad o área" />
        </label>
        <label>Proyecto a explorar
          <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
            {seleccionados.length === 0 && <option value={proyectoId}>Sin coincidencias</option>}
            {seleccionados.map((p) => <option key={p.id} value={p.id}>
              {p.nombre} · {p.comunidad}
            </option>)}
          </select>
        </label>
        <span className="mapa-impacto__modo">Diseño libre · Datos protegidos</span>
      </div>

      {error && <p role="alert" className="mapa-impacto__error">{error}</p>}
      {avisoPreferencias && <p role="status" className="mapa-impacto__aviso">{avisoPreferencias}</p>}
      {cargando && <p role="status">Construyendo el mapa con los datos de Neon…</p>}
      {!cargando && proyectos.length === 0 && !error &&
        <p className="mapa-impacto__vacio">Todavía no hay proyectos registrados en tu organización.</p>}
      {datos && !cargando && preferenciasProyecto === datos.proyecto.id && (
        <>
          <div className="mapa-impacto__resumen">
            <span><strong>{datos.actividades.length}</strong> actividades</span>
            <span><strong>{datos.avances.length}</strong> avances</span>
            <span><strong>{datos.evidencias.length}</strong> fotografías</span>
            <span><strong>{datos.proyecto.comunidad}</strong> comunidad</span>
          </div>
          <EspacioMapaGrid key={datos.proyecto.id} usuarioId={usuarioId} proyectoId={datos.proyecto.id}
            posicionesIniciales={preferencias?.paneles}
            onGuardar={(paneles) => persistirDiseño(datos.proyecto.id, 'paneles', paneles)}
            mapa={<MapaReactFlow datos={datos} usuarioId={usuarioId} seleccion={seleccion}
              posicionesIniciales={preferencias?.nodos}
              onGuardar={(nodos) => persistirDiseño(datos.proyecto.id, 'nodos', nodos)}
              seleccionar={(tipo, id) => setSeleccion({ tipo, id })} />}
            detalle={<aside className="mapa-impacto__detalle" aria-live="polite">
              <div className="mapa-impacto__detalle-titulo">
                <h2>Detalle del elemento</h2>
                {seleccion && <button type="button" onClick={() => setSeleccion(null)}>Cerrar</button>}
              </div>
              {item ? (
                <>
                  <strong>{item.titulo}</strong>
                  <span className="mapa-impacto__estado">{item.estado}</span>
                  <p>{item.descripcion}</p>
                  {seleccion?.tipo === 'evidencia' && item.foto &&
                    <FotografiaPrivadaMapa key={seleccion.id} token={token}
                      proyectoId={datos.proyecto.id} evidenciaId={seleccion.id}
                      titulo={item.titulo} />}
                  {seleccion?.tipo === 'avance' && <>
                    <p>Fotografías de este avance: {datos.evidencias.filter((f) => f.avanceId === seleccion.id).length}</p>
                    <div className="mapa-impacto__galeria">
                      {datos.evidencias.filter((f) => f.avanceId === seleccion.id).map((foto) =>
                        <FotografiaPrivadaMapa key={foto.id} token={token}
                          proyectoId={datos.proyecto.id} evidenciaId={foto.id}
                          titulo={foto.titulo || 'Fotografía del avance'} compacta />)}
                    </div>
                  </>}
                  {seleccion?.tipo === 'actividad' && <div className="mapa-impacto__atajos">
                    <p>Avances asociados:</p>
                    {datos.avances.filter((v) => v.actividadId === seleccion.id).map((avance) =>
                      <button key={avance.id} type="button"
                        onClick={() => setSeleccion({ tipo: 'avance', id: avance.id })}>
                        {avance.fecha} · {avance.estado}
                      </button>)}
                  </div>}
                </>
              ) : <p>Seleccioná un nodo para consultar su información y, cuando corresponda, abrir sus fotografías.</p>}
            </aside>} />
        </>
      )}
      <p className="mapa-impacto__nota">Podés organizar paneles y nodos a tu gusto: su distribución se guarda por usuario y proyecto en Neon, con una copia local de respaldo. Las conexiones y los registros reales no cambian.
        La visualización para donantes tendrá permisos y datos específicos en una fase posterior.</p>
    </section>
  );
}
