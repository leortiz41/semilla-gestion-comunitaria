import { useEffect, useRef, useState } from 'react';
import MapaReactFlow from './componentes/MapaReactFlow';
import GaleriaFlotanteMapa from './componentes/GaleriaFlotanteMapa';
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
  const [galeriaAvanceId, setGaleriaAvanceId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [comunidadFiltro, setComunidadFiltro] = useState('');
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
      const cfg = { ...local(), ...(resultado.configuracion ?? {}) };
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
    if (!proyectoId) { setDatos(null); setSeleccion(null); setCargando(false); return; }
    let activo = true;
    setCargando(true); setError(''); setDatos(null); setSeleccion(null);
    setPreferenciasProyecto(''); setGaleriaAvanceId(null);
    obtenerMapaProyecto(token, proyectoId).then((respuesta) => {
      if (!activo) return;
      if (respuesta.proyecto.id !== proyectoId) throw new Error('El proyecto recuperado no coincide con la selección.');
      setDatos(respuesta);
      setSeleccion({ tipo: 'proyecto', id: respuesta.proyecto.id });
    }).catch((fallo: Error) => { if (activo) setError(fallo.message); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [token, proyectoId, recarga]);

  const comunidades = Array.from(new Set(proyectos.map((p) => p.comunidad))).sort(
    (a, b) => a.localeCompare(b, 'es'),
  );
  const seleccionados = proyectos.filter((p) =>
    (!comunidadFiltro || p.comunidad === comunidadFiltro) &&
    `${p.nombre} ${p.comunidad} ${p.tipo}`.toLocaleLowerCase('es')
      .includes(busqueda.trim().toLocaleLowerCase('es')));
  const proyectoElegidoVisible = seleccionados.some((p) => p.id === proyectoId);
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
        return av ? {
          titulo: 'Avance · ' + av.fecha,
          descripcion: [av.descripcion, av.observaciones].filter((texto) => !!texto?.trim()).join(' · ')
            || 'Sin descripción registrada.',
          estado: av.estado, foto: null as string | null,
        } : null;
      })() :
    seleccion.tipo === 'evidencias' ?
      (() => {
        const fotos = datos.evidencias.filter((v) => v.avanceId === seleccion.id);
        return fotos.length ? {
          titulo: 'Evidencias del avance',
          descripcion: 'Documentación fotográfica vinculada a este avance. Seleccioná una imagen para verla ampliada.',
          estado: `${fotos.length} ${fotos.length === 1 ? 'fotografía' : 'fotografías'}`,
          foto: null as string | null,
        } : null;
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
        <label>Comunidad
          <select value={comunidadFiltro} onChange={(e) => {
            const comunidad = e.target.value;
            setComunidadFiltro(comunidad);
            const encontrados = proyectos.filter((p) =>
              (!comunidad || p.comunidad === comunidad) &&
              `${p.nombre} ${p.comunidad} ${p.tipo}`.toLocaleLowerCase('es')
                .includes(busqueda.trim().toLocaleLowerCase('es')));
            if (encontrados.length && !encontrados.some((p) => p.id === proyectoId)) {
              setProyectoId(encontrados[0].id);
            }
          }}>
            <option value="">Todas las comunidades</option>
            {comunidades.map((comunidad) =>
              <option key={comunidad} value={comunidad}>{comunidad}</option>)}
          </select>
        </label>
        <label>Buscar proyectos
          <input value={busqueda} onChange={(e) => {
            const texto = e.target.value;
            setBusqueda(texto);
            const encontrados = proyectos.filter((p) =>
              (!comunidadFiltro || p.comunidad === comunidadFiltro) &&
              `${p.nombre} ${p.comunidad} ${p.tipo}`.toLocaleLowerCase('es')
                .includes(texto.trim().toLocaleLowerCase('es')));
            if (encontrados.length && !encontrados.some((p) => p.id === proyectoId)) {
              setProyectoId(encontrados[0].id);
            }
          }} placeholder="Nombre, comunidad o tipo de proyecto" />
        </label>
        <label>Proyecto a explorar
          <select value={proyectoElegidoVisible ? proyectoId : ''}
            onChange={(e) => {
              if (e.target.value) setProyectoId(e.target.value);
            }}>
            {!proyectoElegidoVisible && <option value="">
              {seleccionados.length ? 'Seleccioná un proyecto' : 'Sin coincidencias'}
            </option>}
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
      {!cargando && seleccionados.length === 0 && proyectos.length > 0 &&
        <p role="status" className="mapa-impacto__vacio">
          No hay proyectos que coincidan con los filtros. Cambiá la comunidad o el texto de búsqueda.
        </p>}
      {!cargando && proyectos.length === 0 && !error &&
        <p className="mapa-impacto__vacio">Todavía no hay proyectos registrados en tu organización.</p>}
      {datos && !cargando && proyectoElegidoVisible && datos.proyecto.id === proyectoId &&
        preferenciasProyecto === proyectoId && (
        <>
          <div className="mapa-impacto__resumen">
            <span><strong>{datos.proyecto.nombre}</strong> · {datos.proyecto.comunidad}</span>
            <span><strong>{datos.actividades.length}</strong> actividades</span>
            <span><strong>{datos.avances.length}</strong> avances</span>
            <span><strong>{datos.evidencias.length}</strong> fotografías</span>
            <span><strong>{datos.proyecto.comunidad}</strong> comunidad</span>
          </div>
          {datos.actividades.length === 0 && <p role="status" className="mapa-impacto__vacio">
            Este proyecto todavía no tiene actividades registradas. El mapa mostrará la comunidad y el proyecto.
          </p>}
          <EspacioMapaGrid key={datos.proyecto.id} usuarioId={usuarioId} proyectoId={datos.proyecto.id}
            posicionesIniciales={preferencias?.paneles}
            onGuardar={(paneles) => persistirDiseño(datos.proyecto.id, 'paneles', paneles)}
            mapa={<MapaReactFlow datos={datos} usuarioId={usuarioId} seleccion={seleccion}
              posicionesIniciales={preferencias?.nodos}
              onGuardar={(nodos) => persistirDiseño(datos.proyecto.id, 'nodos', nodos)}
              seleccionar={(tipo, id) => {
                setSeleccion({ tipo, id });
                if (tipo === 'evidencias') setGaleriaAvanceId(id);
              }} />}
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
                  {seleccion?.tipo === 'avance' && (() => {
                    const avance = datos.avances.find((a) => a.id === seleccion.id);
                    return avance && (avance.cantidadReportada !== null || avance.porcentajeAvance !== null)
                      ? <div className="mapa-impacto__metricas-avance">
                          {avance.cantidadReportada !== null &&
                            <span>Cantidad reportada: <strong>{avance.cantidadReportada}</strong></span>}
                          {avance.porcentajeAvance !== null &&
                            <span>Avance informado: <strong>{avance.porcentajeAvance}%</strong></span>}
                        </div> : null;
                  })()}
                  {seleccion?.tipo === 'avance' && <p>
                    Evidencias asociadas: {datos.evidencias.filter((f) => f.avanceId === seleccion.id).length}.
                    {' '}Seleccioná el nodo de Evidencias para abrir la galería.
                  </p>}
                  {seleccion?.tipo === 'evidencias' && (
                    <button type="button" className="mapa-impacto__abrir-galeria"
                      onClick={() => setGaleriaAvanceId(seleccion.id)}>
                      Ver galería flotante
                    </button>
                  )}
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
      {datos && datos.proyecto.id === proyectoId && galeriaAvanceId && (
        <GaleriaFlotanteMapa token={token} proyectoId={datos.proyecto.id}
          fotos={datos.evidencias.filter((foto) => foto.avanceId === galeriaAvanceId)}
          cerrar={() => setGaleriaAvanceId(null)} />
      )}
      <p className="mapa-impacto__nota">Podés organizar paneles y nodos a tu gusto: su distribución se guarda por usuario y proyecto en Neon, con una copia local de respaldo. Las conexiones y los registros reales no cambian.
        La visualización para donantes tendrá permisos y datos específicos en una fase posterior.</p>
    </section>
  );
}
