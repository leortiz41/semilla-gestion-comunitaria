import { useEffect, useMemo, useState } from 'react';
import {
  Archive, BadgeCheck, Camera, ChevronRight, ClipboardCheck, Clock3,
  FileSearch, Filter, FolderOpen, Image as ImageIcon, RefreshCcw,
  Search, ShieldCheck, TriangleAlert, UserRound, RotateCcw,
} from 'lucide-react';
import {
  obtenerActividadesProyecto, obtenerIndiceFotografias,
  type ActividadProyecto, type AvanceConFotografias,
} from '../../lib/api';
import FotografiasAvance from '../proyectos/FotografiasAvance';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/evidencias.css';

type Estado = AvanceConFotografias['estadoRevision'];
const estados: Record<Estado, string> = {
  BORRADOR: 'Borrador', ENVIADO: 'En revisión',
  VALIDADO: 'Validado', DEVUELTO: 'Devuelto',
};
function fechaCorta(valor: string | null | undefined) {
  if (!valor) return 'Sin registrar';
  const fecha = valor.slice(0, 10);
  const partes = fecha.split('-');
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : valor;
}

export default function PaginaEvidencias({
  token, usuarioEmail, puedeGestionar = false,
}: {
  token: string; usuarioEmail: string; puedeGestionar?: boolean;
}) {
  const [indice, setIndice] = useState<AvanceConFotografias[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [comunidad, setComunidad] = useState('');
  const [proyecto, setProyecto] = useState('');
  const [estado, setEstado] = useState('');
  const [respaldo, setRespaldo] = useState('todos');
  const [vista, setVista] = useState<'seguimiento' | 'finalizados'>('seguimiento');
  const [seleccionId, setSeleccionId] = useState('');
  const [actividades, setActividades] = useState<ActividadProyecto[]>([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState('');

  useEffect(() => {
    let activo = true;
    setCargando(true);
    obtenerIndiceFotografias(token).then(({ avances }) => {
      if (activo) { setIndice(avances); setError(''); }
    }).catch((fallo: Error) => { if (activo) setError(fallo.message); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [token, recarga]);

  const enVista = useMemo(() => indice.filter((i) =>
    vista === 'finalizados' ? i.estadoProyecto === 'FINALIZADO' : i.estadoProyecto !== 'FINALIZADO',
  ), [indice, vista]);
  const totalFinalizados = useMemo(() => new Set(indice
    .filter((i) => i.estadoProyecto === 'FINALIZADO').map((i) => i.proyectoId)).size, [indice]);
  const comunidades = useMemo(() =>
    [...new Set(enVista.map((i) => i.comunidad))].sort((a, b) => a.localeCompare(b, 'es')), [enVista]);
  const proyectos = useMemo(() => [...new Map(enVista
    .filter((i) => !comunidad || i.comunidad === comunidad)
    .map((i) => [i.proyectoId, { id: i.proyectoId, nombre: i.proyecto, comunidad: i.comunidad }])).values()]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [enVista, comunidad]);
  const archivos = useMemo(() => proyectos.map((p) => {
    const expedientes = enVista.filter((i) => i.proyectoId === p.id);
    return { ...p, cantidad: expedientes.length,
      fotos: expedientes.reduce((total, i) => total + i.cantidadEvidencias, 0) };
  }), [enVista, proyectos]);
  const visibles = useMemo(() => enVista.filter((i) => {
    if (vista === 'finalizados' && !proyecto) return false;
    if (comunidad && i.comunidad !== comunidad) return false;
    if (proyecto && i.proyectoId !== proyecto) return false;
    if (estado && i.estadoRevision !== estado) return false;
    if (respaldo === 'con' && i.cantidadEvidencias === 0) return false;
    if (respaldo === 'sin' && i.cantidadEvidencias > 0) return false;
    const texto = `${i.proyecto} ${i.comunidad} ${i.actividad} ${i.descripcion ?? ''} ${i.observaciones ?? ''} ${i.responsable ?? ''}`;
    return texto.toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es'));
  }), [enVista, vista, comunidad, proyecto, estado, respaldo, busqueda]);

  const seleccionado = enVista.find((x) => x.avanceId === seleccionId) ?? null;
  const fotosTotal = enVista.reduce((total, i) => total + i.cantidadEvidencias, 0);
  const validados = enVista.filter((i) => i.estadoRevision === 'VALIDADO');
  const sinRespaldo = enVista.filter((i) => i.cantidadEvidencias === 0);
  const porRevisar = enVista.filter((i) => i.estadoRevision === 'ENVIADO');

  function cambiarVista(siguiente: 'seguimiento' | 'finalizados') {
    if (siguiente === vista) return;
    setVista(siguiente);
    setBusqueda('');
    setComunidad('');
    setProyecto('');
    setEstado('');
    setRespaldo('todos');
    setSeleccionId('');
  }

  useEffect(() => {
    if (!seleccionado) { setActividades([]); setErrorDetalle(''); return; }
    let activo = true;
    setCargandoDetalle(true);
    setErrorDetalle('');
    obtenerActividadesProyecto(token, seleccionado.proyectoId)
      .then(({ actividades: registros }) => { if (activo) setActividades(registros); })
      .catch((fallo: Error) => { if (activo) setErrorDetalle(fallo.message); })
      .finally(() => { if (activo) setCargandoDetalle(false); });
    return () => { activo = false; };
  }, [token, seleccionado?.proyectoId, recarga]);

  const actividadActual = actividades.find((a) => a.id === seleccionado?.actividadId);
  const avanceActual = actividadActual?.avances.find((a) => a.id === seleccionado?.avanceId);
  const permitirCarga = Boolean(puedeGestionar && seleccionado && avanceActual &&
    avanceActual.responsable?.toLowerCase() === usuarioEmail.toLowerCase() &&
    (avanceActual.estadoRevision === 'BORRADOR' || avanceActual.estadoRevision === 'DEVUELTO'));

  return (
    <section className="pagina-modulo evidencias-centro" aria-labelledby="titulo-evidencias">
      <header className="pagina-modulo__encabezado evidencias-centro__encabezado">
        <div>
          <p className="pagina-modulo__etiqueta">Semilla · Control documental</p>
          <h1 id="titulo-evidencias" className="pagina-modulo__titulo">Centro de Evidencias</h1>
          <p className="pagina-modulo__descripcion">
            Verificá el respaldo de cada avance, consultá responsables y revisión, y encontrá
            la documentación fotográfica sin recorrer proyecto por proyecto.
          </p>
        </div>
        <button className="evidencias-centro__actualizar" type="button"
          disabled={cargando} onClick={() => setRecarga((n) => n + 1)}>
          <RefreshCcw size={16} aria-hidden="true" /> Actualizar
        </button>
      </header>

      <nav className="evidencias-centro__vistas" aria-label="Organización de expedientes">
        <button type="button" className={vista === 'seguimiento' ? 'activo' : ''}
          aria-current={vista === 'seguimiento' ? 'page' : undefined}
          onClick={() => cambiarVista('seguimiento')}>
          <FolderOpen size={17} aria-hidden="true" /> En seguimiento
        </button>
        <button type="button" className={vista === 'finalizados' ? 'activo' : ''}
          aria-current={vista === 'finalizados' ? 'page' : undefined}
          onClick={() => cambiarVista('finalizados')}>
          <Archive size={17} aria-hidden="true" /> Proyectos finalizados
          <span className="evidencias-centro__vistas-cantidad">{totalFinalizados}</span>
        </button>
      </nav>
      <div className="evidencias-centro__indicadores" aria-label="Resumen de evidencias de la vista seleccionada">
        <div className="evidencias-centro__indicador">
          <FolderOpen size={19} aria-hidden="true" />
          <div><strong>{enVista.length}</strong><span>Avances en esta vista</span></div>
        </div>
        <div className="evidencias-centro__indicador">
          <Camera size={19} aria-hidden="true" />
          <div><strong>{fotosTotal}</strong><span>Fotografías de respaldo</span></div>
        </div>
        <div className="evidencias-centro__indicador">
          <BadgeCheck size={19} aria-hidden="true" />
          <div><strong>{validados.length}</strong><span>Avances validados</span></div>
        </div>
        <div className="evidencias-centro__indicador evidencias-centro__indicador--atencion">
          <TriangleAlert size={19} aria-hidden="true" />
          <div><strong>{sinRespaldo.length}</strong><span>Sin fotografías</span></div>
        </div>
        <div className="evidencias-centro__indicador">
          <Clock3 size={19} aria-hidden="true" />
          <div><strong>{porRevisar.length}</strong><span>En revisión</span></div>
        </div>
      </div>
      <p className="evidencias-centro__aclaracion">
        Los indicadores corresponden a avances de la pestaña seleccionada, no a proyectos completos.
        «Sin fotografías» indica falta de respaldo fotográfico, no necesariamente ausencia de otros documentos.
        La validación del avance no equivale a una auditoría documental independiente.
      </p>

      {vista === 'finalizados' && (
        <section className="evidencias-centro__archivo" aria-label="Archivo de proyectos finalizados">
          <div className="evidencias-centro__seccion-titulo">
            <div>
              <h2>Archivo histórico de proyectos</h2>
              <p>Elegí un proyecto finalizado para consultar sus expedientes de avance y fotografías.</p>
            </div>
            {proyecto && <button type="button" className="evidencias-centro__volver-archivo"
              onClick={() => { setProyecto(''); setSeleccionId(''); }}>
              Volver a proyectos
            </button>}
          </div>
          {!archivos.length && !cargando &&
            <p className="evidencias-centro__vacio">
              No hay proyectos finalizados con expedientes registrados en esta comunidad.
            </p>}
          <div className="evidencias-centro__archivo-lista">
            {archivos.map((item) => (
              <button key={item.id} type="button"
                aria-pressed={proyecto === item.id}
                onClick={() => { setProyecto(item.id); setSeleccionId(''); }}>
                <Archive size={19} aria-hidden="true" />
                <strong>{item.nombre}</strong>
                <small>{item.comunidad}</small>
                <span>{item.cantidad} avances · {item.fotos} fotografías</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="evidencias-centro__filtros" aria-label="Filtros del expediente documental">
        <label><Search size={15} aria-hidden="true"/> Buscar
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Actividad, descripción, responsable…" />
        </label>
        <label><Filter size={15} aria-hidden="true"/> Comunidad
          <select value={comunidad} onChange={(e) => { setComunidad(e.target.value); setProyecto(''); }}>
            <option value="">Todas</option>
            {comunidades.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Proyecto
          <select value={proyecto} onChange={(e) => setProyecto(e.target.value)}>
            <option value="">Todos</option>
            {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {p.comunidad}</option>)}
          </select>
        </label>
        <label>Revisión
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(estados).map(([valor, nombre]) =>
              <option value={valor} key={valor}>{nombre}</option>)}
          </select>
        </label>
        <label>Respaldo
          <select value={respaldo} onChange={(e) => setRespaldo(e.target.value)}>
            <option value="todos">Todos los avances</option>
            <option value="con">Con fotografías</option>
            <option value="sin">Sin fotografías</option>
          </select>
        </label>
        <div className="evidencias-centro__limpiar-filtros">
          <button type="button" onClick={() => {
            setBusqueda('');
            setComunidad('');
            setProyecto('');
            setEstado('');
            setRespaldo('todos');
          }} disabled={!busqueda && !comunidad && !proyecto && !estado && respaldo === 'todos'}>
            <RotateCcw size={16} aria-hidden="true" /> Limpiar filtros
          </button>
        </div>
      </div>

      {error && <p className="evidencias-explorador__error" role="alert">{error}</p>}
      <div className="evidencias-centro__contenido">
        <section className="evidencias-centro__listado" aria-label="Expedientes de avances">
          <div className="evidencias-centro__seccion-titulo">
            <div><h2>{vista === 'finalizados' ? 'Expedientes del proyecto finalizado' : 'Expedientes en seguimiento'}</h2>
              <p>{vista === 'finalizados' && !proyecto
                ? 'Elegí un proyecto del archivo histórico para consultar sus avances.'
                : 'Seleccioná un registro para revisar su respaldo y trazabilidad.'}</p></div>
            <span>{visibles.length} resultados</span>
          </div>
          {cargando && <p role="status" className="evidencias-centro__vacio">Consultando expedientes…</p>}
          {!cargando && visibles.length === 0 && !error &&
            <p className="evidencias-centro__vacio" role="status">
              {vista === 'finalizados' && !proyecto
                ? 'Elegí un proyecto finalizado arriba para mostrar sus expedientes.'
                : enVista.length ? 'No hay avances con estos filtros.' : 'Todavía no existen avances en esta sección.'}
            </p>}
          <div className="evidencias-centro__registros">
            {visibles.map((registro) => (
              <button key={registro.avanceId} type="button"
                className="evidencias-centro__registro" onClick={() => setSeleccionId(registro.avanceId)}
                aria-pressed={seleccionId === registro.avanceId}>
                <div className="evidencias-centro__registro-superior">
                  <strong>{registro.actividad}</strong>
                  <span className={`evidencias-centro__estado evidencias-centro__estado--${registro.estadoRevision.toLowerCase()}`}>
                    {estados[registro.estadoRevision]}</span>
                </div>
                <span className="evidencias-centro__ubicacion">{registro.proyecto} · {registro.comunidad}</span>
                <span className="evidencias-centro__descripcion">
                  {registro.descripcion?.trim() || registro.observaciones?.trim() || 'Sin descripción del trabajo registrado'}
                </span>
                <div className="evidencias-centro__registro-pie">
                  <span><Clock3 size={13} aria-hidden="true"/>{fechaCorta(registro.fecha)}</span>
                  <span className={registro.cantidadEvidencias ? 'evidencias-centro__con-fotos' : 'evidencias-centro__sin-fotos'}>
                    <ImageIcon size={14} aria-hidden="true"/>
                    {registro.cantidadEvidencias
                      ? `${registro.cantidadEvidencias} ${registro.cantidadEvidencias === 1 ? 'foto' : 'fotos'}`
                      : 'Sin fotos'}
                  </span>
                  <ChevronRight size={17} aria-hidden="true"/>
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="evidencias-centro__expediente" aria-label="Detalle documental del avance">
          {!seleccionado ? <div className="evidencias-centro__sin-seleccion">
            <FileSearch size={32} strokeWidth={1.5} aria-hidden="true"/>
            <h2>Expediente documental</h2>
            <p>Seleccioná un avance de la lista para conocer qué se realizó,
              quién lo reportó, cómo se revisó y qué fotografías lo respaldan.</p>
          </div> : <>
            <div className="evidencias-centro__seccion-titulo">
              <div><p className="evidencias-centro__sobretitulo">Expediente del avance</p>
                <h2>{seleccionado.actividad}</h2></div>
              <span className={`evidencias-centro__estado evidencias-centro__estado--${seleccionado.estadoRevision.toLowerCase()}`}>
                {estados[seleccionado.estadoRevision]}</span>
            </div>
            <p className="evidencias-centro__ruta">{seleccionado.comunidad} / {seleccionado.proyecto}</p>
            <div className="evidencias-centro__bloque">
              <h3><ClipboardCheck size={17} aria-hidden="true"/> Trabajo reportado</h3>
              <p>{seleccionado.descripcion?.trim() || 'Sin descripción registrada.'}</p>
              {seleccionado.observaciones?.trim() && <p><strong>Observaciones:</strong> {seleccionado.observaciones}</p>}
              <div className="evidencias-centro__datos">
                <span>Fecha de avance <strong>{fechaCorta(seleccionado.fecha)}</strong></span>
                {seleccionado.cantidadReportada !== null && <span>Cantidad reportada <strong>{seleccionado.cantidadReportada}</strong></span>}
                {seleccionado.porcentajeAvance !== null && <span>Avance informado <strong>{seleccionado.porcentajeAvance}%</strong></span>}
              </div>
            </div>
            <div className="evidencias-centro__bloque">
              <h3><ShieldCheck size={17} aria-hidden="true"/> Responsable y revisión</h3>
              <div className="evidencias-centro__datos">
                <span><UserRound size={13} aria-hidden="true"/> Responsable <strong>{seleccionado.responsable || 'No registrado'}</strong></span>
                <span>Revisor <strong>{seleccionado.revisor || 'Pendiente'}</strong></span>
                <span>Fecha de revisión <strong>{fechaCorta(seleccionado.revisadoEn)}</strong></span>
              </div>
              {seleccionado.motivoDevolucion && <p className="evidencias-centro__observacion">
                Motivo de devolución: {seleccionado.motivoDevolucion}
              </p>}
            </div>
            {actividadActual && (
              <div className="evidencias-centro__bloque">
                <h3><ClipboardCheck size={17} aria-hidden="true"/> Meta y contexto de la actividad</h3>
                <p>{actividadActual.descripcion || 'Actividad sin descripción adicional.'}</p>
                <div className="evidencias-centro__datos">
                  {actividadActual.metaCantidad !== null &&
                    <span>Meta planificada <strong>{actividadActual.metaCantidad} {actividadActual.unidadMedida || ''}</strong></span>}
                  {actividadActual.metaCantidad !== null &&
                    <span>Cantidad validada de la actividad <strong>{actividadActual.cantidadValidada} {actividadActual.unidadMedida || ''}</strong></span>}
                  <span>Resultado informado <strong>{actividadActual.porcentajeResultado}%</strong></span>
                </div>
              </div>
            )}
            {avanceActual && avanceActual.historial.length > 0 && (
              <div className="evidencias-centro__bloque">
                <h3><Clock3 size={17} aria-hidden="true"/> Historial de revisión</h3>
                <ol className="evidencias-centro__historial">
                  {avanceActual.historial.slice(-8).reverse().map((evento, index) =>
                    <li key={`${evento.fecha}-${evento.accion}-${index}`}>
                      <strong>{evento.accion.replaceAll('_', ' ')}</strong>
                      <span>{evento.actor || 'Sistema'} · {evento.fecha ? new Date(evento.fecha).toLocaleString('es-HN') : 'Sin fecha'}</span>
                    </li>)}
                </ol>
              </div>
            )}
            <div className="evidencias-centro__bloque">
              <h3><Archive size={17} aria-hidden="true"/> Respaldo fotográfico
                <span className="evidencias-centro__contador">{seleccionado.cantidadEvidencias}</span></h3>
              {cargandoDetalle ? <p role="status">Consultando las fotografías…</p>
                : errorDetalle ? <p className="evidencias-explorador__error" role="alert">{errorDetalle}</p>
                  : avanceActual ?
                  <FotografiasAvance key={avanceActual.id} token={token}
                    proyectoId={seleccionado.proyectoId} actividadId={seleccionado.actividadId}
                    avanceId={avanceActual.id} permitirCarga={permitirCarga}
                    onCambio={() => setRecarga((n) => n + 1)} />
                  : <p>No se pudo encontrar el avance en las actividades del proyecto.</p>}
              {!permitirCarga && <p className="evidencias-centro__permisos">
                {seleccionado.estadoRevision === 'BORRADOR' || seleccionado.estadoRevision === 'DEVUELTO'
                  ? 'Solo su responsable autorizado puede agregar fotografías durante esta etapa.'
                  : 'Avance enviado o validado: fotografías disponibles para consulta, sin nuevas cargas.'}
              </p>}
            </div>
          </>}
        </aside>
      </div>
    </section>
  );
}
