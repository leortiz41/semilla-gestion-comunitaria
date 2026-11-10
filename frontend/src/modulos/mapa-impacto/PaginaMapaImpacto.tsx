import { useEffect, useState } from 'react';
import MapaReactFlow from './componentes/MapaReactFlow';
import {
  listarProyectosMapa, obtenerMapaProyecto,
  type DetalleImpacto, type ProyectoMapa,
} from '../../servicios/mapa-impacto/servicioMapaImpacto';
import '../../estilos/modulos/mapa-impacto/mapaImpacto.css';

type Seleccion = { tipo: string; id: string } | null;

export default function PaginaMapaImpacto({ token }: { token: string }) {
  const [proyectos, setProyectos] = useState<ProyectoMapa[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [datos, setDatos] = useState<DetalleImpacto | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [recarga, setRecarga] = useState(0);

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
        <span className="mapa-impacto__modo">Modo exploración · Solo lectura</span>
      </div>

      {error && <p role="alert" className="mapa-impacto__error">{error}</p>}
      {cargando && <p role="status">Construyendo el mapa con los datos de Neon…</p>}
      {!cargando && proyectos.length === 0 && !error &&
        <p className="mapa-impacto__vacio">Todavía no hay proyectos registrados en tu organización.</p>}
      {datos && !cargando && (
        <>
          <div className="mapa-impacto__resumen">
            <span><strong>{datos.actividades.length}</strong> actividades</span>
            <span><strong>{datos.avances.length}</strong> avances</span>
            <span><strong>{datos.evidencias.length}</strong> fotografías</span>
            <span><strong>{datos.proyecto.comunidad}</strong> comunidad</span>
          </div>
          <div className="mapa-impacto__espacio">
            <MapaReactFlow datos={datos} seleccion={seleccion}
              seleccionar={(tipo, id) => setSeleccion({ tipo, id })} />
            <aside className="mapa-impacto__detalle" aria-live="polite">
              <div className="mapa-impacto__detalle-titulo">
                <h2>Detalle del elemento</h2>
                {seleccion && <button type="button" onClick={() => setSeleccion(null)}>Cerrar</button>}
              </div>
              {item ? (
                <>
                  <strong>{item.titulo}</strong>
                  <span className="mapa-impacto__estado">{item.estado}</span>
                  <p>{item.descripcion}</p>
                  {item.foto && <a href={item.foto} target="_blank" rel="noopener noreferrer"
                    className="mapa-impacto__enlace-foto">
                    <img src={item.foto} alt={item.titulo} />
                    Abrir fotografía
                  </a>}
                  {seleccion?.tipo === 'avance' && <>
                    <p>Fotografías de este avance: {datos.evidencias.filter((f) => f.avanceId === seleccion.id).length}</p>
                    <div className="mapa-impacto__galeria">
                      {datos.evidencias.filter((f) => f.avanceId === seleccion.id).map((foto) =>
                        foto.url ? <a key={foto.id} href={foto.url} target="_blank" rel="noopener noreferrer"
                          title={foto.titulo || 'Abrir fotografía'}>
                          <img src={foto.url} alt={foto.titulo || 'Fotografía del avance'} loading="lazy" />
                        </a> : <span key={foto.id}>Imagen temporalmente no disponible</span>)}
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
            </aside>
          </div>
        </>
      )}
      <p className="mapa-impacto__nota">Este mapa solo representa registros existentes. Desplazar nodos no modifica sus relaciones.
        La visualización para donantes tendrá permisos y datos específicos en una fase posterior.</p>
    </section>
  );
}
