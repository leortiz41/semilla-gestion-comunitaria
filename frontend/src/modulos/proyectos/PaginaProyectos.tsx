import { useEffect, useState, type FormEvent } from 'react';
import {
  guardarProyectoAdministrativo, obtenerProyectosAdministrativos, obtenerAvancesPendientesRevision, revisarAvanceActividadProyecto,
  type AvancePendienteRevision, type ProyectoAdministrativo, type AreaVisionDesarrollo,
} from '../../lib/api';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/roles.css';
import '../donantes/donantes.css';
import ActividadesProyecto from './ActividadesProyecto';
import FotografiasAvance from './FotografiasAvance';
import '../../estilos/modulos/proyectos/centroRevision.css';
import '../../estilos/modulos/proyectos/proyectos.css';

const categorias: Record<AreaVisionDesarrollo, string> = {
  EVANGELISMO: 'Evangelismo',
  EDUCACION_FORMAL: 'Educación formal',
  EDUCACION_COMUNITARIA: 'Educación comunitaria',
  INFRAESTRUCTURA: 'Infraestructura',
};

const estados: Record<string, string> = {
  PLANIFICADO: 'Planificado',
  EN_EJECUCION: 'En ejecución',
  PAUSADO: 'Pausado',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

function PaginaProyectos({
  token, usuarioEmail, puedeVer, puedeGestionar, puedeRegistrarAvance, puedeRevisarAvance, puedeCorregirAvance,
}: {
  token: string;
  usuarioEmail: string;
  puedeVer: boolean;
  puedeGestionar: boolean;
  puedeRegistrarAvance: boolean;
  puedeRevisarAvance: boolean;
  puedeCorregirAvance: boolean;
}) {
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof obtenerProyectosAdministrativos>> | null>(null);
  const [formulario, setFormulario] = useState<ProyectoAdministrativo | 'nuevo' | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [proyectoAbierto, setProyectoAbierto] = useState<string | null>(null);
  const [verPendientes, setVerPendientes] = useState(false);
  const [pendientes, setPendientes] = useState<AvancePendienteRevision[]>([]);
  const [cargandoPendientes, setCargandoPendientes] = useState(false);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [busquedaRevision, setBusquedaRevision] = useState('');
  const [filtroRevision, setFiltroRevision] = useState('todos');
  const [avanceSeleccionadoId, setAvanceSeleccionadoId] = useState<string | null>(null);
  const [mostrarDevolucion, setMostrarDevolucion] = useState(false);
  const [confirmarRevision, setConfirmarRevision] = useState<'validar' | 'devolver' | null>(null);
  const pendientesFiltrados = pendientes.filter((item) => {
    const texto = `${item.actividad} ${item.proyecto} ${item.comunidad} ${item.responsable}`.toLowerCase();
    return texto.includes(busquedaRevision.toLowerCase().trim()) &&
      (filtroRevision === 'todos' || (filtroRevision === 'propios' ? item.esPropio : !item.esPropio));
  });
  const avanceSeleccionado = pendientesFiltrados.find((item) => item.id === avanceSeleccionadoId) ??
    pendientesFiltrados[0];

  const proyecto = formulario === 'nuevo' ? null : formulario;

  useEffect(() => {
    if (!puedeVer) return;
    let vigente = true;
    obtenerProyectosAdministrativos(token).then(
      (resultado) => { if (vigente) setDatos(resultado); },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    );
    return () => { vigente = false; };
  }, [token, puedeVer, recarga]);

  useEffect(() => {
    if (!verPendientes || !puedeRevisarAvance || !puedeVer) return;
    let vigente = true;
    setCargandoPendientes(true);
    obtenerAvancesPendientesRevision(token).then(
      ({ pendientes: lista }) => { if (vigente) { setPendientes(lista); setError(''); } },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    ).finally(() => { if (vigente) setCargandoPendientes(false); });
    return () => { vigente = false; };
  }, [token, puedeVer, puedeRevisarAvance, verPendientes, recarga]);

  async function decidirAvance(item: AvancePendienteRevision, accion: 'validar' | 'devolver') {
    if (guardando || !puedeRevisarAvance) return;
    const motivo = motivos[item.id]?.trim();
    if (accion === 'devolver' && !motivo) {
      setError('Escribí el motivo de devolución antes de continuar.');
      return;
    }
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await revisarAvanceActividadProyecto(token, item.proyectoId, item.actividadId,
        item.id, accion, accion === 'devolver' ? motivo : undefined);
      setMensaje(accion === 'validar' ? 'Avance validado.' : 'Avance devuelto.');
      setPendientes((actual) => actual.filter((avance) => avance.id !== item.id));
      setConfirmarRevision(null);
      setMostrarDevolucion(false);
      setRecarga((actual) => actual + 1);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible revisar el avance.');
    } finally {
      setGuardando(false);
    }
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando || !puedeGestionar) return;
    const campos = new FormData(evento.currentTarget);
    const valor = (campo: string) => String(campos.get(campo) ?? '');
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await guardarProyectoAdministrativo(token, {
        comunidadId: proyecto?.comunidadId ?? valor('comunidadId'),
        nombre: valor('nombre'),
        tipo: valor('tipo'),
        estado: valor('estado'),
        fechaInicio: valor('fechaInicio'),
        fechaFin: valor('fechaFin'),
        descripcion: valor('descripcion'),
        presupuesto: valor('presupuesto'),
        donanteIds: campos.getAll('donanteIds').map(String),
      }, proyecto?.id);
      setMensaje(proyecto ? 'Proyecto actualizado.' : 'Proyecto registrado.');
      setFormulario(null);
      setRecarga((actual) => actual + 1);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible guardar el proyecto.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="pagina-modulo donantes-modulo" aria-labelledby="titulo-proyectos">
      <header className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Gestión de iniciativas</p>
        <h1 id="titulo-proyectos" className="pagina-modulo__titulo">Proyectos</h1>
        <p className="pagina-modulo__descripcion">Registrá las intervenciones y consultá su estado por comunidad.</p>
      </header>
      {!puedeVer && <p>Tu cuenta no tiene permiso para consultar proyectos.</p>}
      {error && <p role="alert">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      {puedeVer && !datos && !error && <p role="status">Cargando proyectos…</p>}
      {puedeVer && error && !formulario && (
        <button className="brigadas-accion" type="button" onClick={() => {
          setError('');
          setRecarga((actual) => actual + 1);
        }}>Volver a cargar</button>
      )}
      {puedeVer && puedeRevisarAvance && (
        <section className="revision-centro" aria-label="Centro de revisión de avances">
          <div className="revision-centro__cabecera">
            <div>
              <span className="revision-centro__eyebrow">Seguimiento y control</span>
              <h2>Centro de revisión</h2>
            </div>
            <div className="revision-centro__acciones">
              <span className="revision-centro__contador">{verPendientes ? pendientes.length : '—'} pendientes</span>
              <button className="revision-centro__toggle" type="button"
                aria-expanded={verPendientes} onClick={() => setVerPendientes((anterior) => !anterior)}>
                {verPendientes ? 'Ocultar revisión' : 'Abrir revisiones'}
              </button>
            </div>
          </div>
          <p className="revision-centro__intro">
            Verificá los reportes de campo. Las autorrevisiones de coordinadores y administradores quedan registradas en Auditoría.
          </p>
          {verPendientes && (
            <>
              <div className="revision-centro__filtros">
                <label>Buscar avance
                  <input type="search" value={busquedaRevision} onChange={(evento) => setBusquedaRevision(evento.target.value)}
                    placeholder="Actividad, comunidad o responsable" />
                </label>
                <label>Mostrar
                  <select value={filtroRevision} onChange={(evento) => setFiltroRevision(evento.target.value)}>
                    <option value="todos">Todos los pendientes</option>
                    <option value="propios">Mis avances</option>
                    <option value="otros">Avances de otros</option>
                  </select>
                </label>
                <button className="revision-centro__neutral" type="button" disabled={cargandoPendientes}
                  onClick={() => setRecarga((actual) => actual + 1)}>Actualizar lista</button>
              </div>
              {cargandoPendientes && <p role="status">Cargando avances pendientes…</p>}
              {!cargandoPendientes && pendientes.length === 0 && <p role="status">No hay avances pendientes de revisión.</p>}
              {!cargandoPendientes && pendientes.length > 0 && pendientesFiltrados.length === 0 &&
                <p>No hay resultados para los filtros seleccionados.</p>}
              {pendientesFiltrados.length > 0 && (
                <div className="revision-centro__contenido">
                  <div className="revision-centro__lista" aria-label="Listado de avances">
                    {pendientesFiltrados.map((item) => (
                      <button type="button" key={item.id} className="revision-centro__item"
                        aria-pressed={avanceSeleccionado?.id === item.id}
                        onClick={() => { setAvanceSeleccionadoId(item.id); setMostrarDevolucion(false); setConfirmarRevision(null); }}>
                        <span className="revision-centro__item-top">
                          <strong>{item.actividad}</strong>
                          <span className="revision-centro__marca">En revisión</span>
                        </span>
                        <small>{item.proyecto} · {item.comunidad}</small>
                        <span>{item.cantidadReportada === null ? `${item.porcentajeAvance ?? 0}%`
                          : `${item.cantidadReportada} ${item.unidadMedida ?? ''}`}</span>
                        <small>{item.fecha}{item.esPropio ? ' · Autorrevisión' : ''}</small>
                      </button>
                    ))}
                  </div>
                  {avanceSeleccionado && (
                    <article className="revision-centro__detalle" aria-label="Detalle del avance seleccionado">
                      <span className="revision-centro__eyebrow">Detalle del avance</span>
                      <div className="revision-centro__titulo-detalle">
                        <h3>{avanceSeleccionado.actividad}</h3>
                        {avanceSeleccionado.esPropio && (
                          <span className="revision-centro__autorrevision"
                            title="Esta revisión quedará identificada en la bitácora de auditoría">
                            Autorrevisión
                          </span>
                        )}
                      </div>
                      <p className="revision-centro__muted">{avanceSeleccionado.proyecto} · {avanceSeleccionado.comunidad}</p>
                      <FotografiasAvance token={token} proyectoId={avanceSeleccionado.proyectoId}
                        actividadId={avanceSeleccionado.actividadId} avanceId={avanceSeleccionado.id} />
                      <dl className="revision-centro__meta">
                        <div><dt>Avance reportado</dt><dd>{avanceSeleccionado.cantidadReportada === null
                          ? `${avanceSeleccionado.porcentajeAvance ?? 0}%`
                          : `${avanceSeleccionado.cantidadReportada} ${avanceSeleccionado.unidadMedida ?? ''}`}</dd></div>
                        <div><dt>Fecha de ejecución</dt><dd>{avanceSeleccionado.fecha}</dd></div>
                        <div><dt>Responsable</dt><dd>{avanceSeleccionado.responsable}</dd></div>
                        <div><dt>Estado</dt><dd>Enviado a revisión</dd></div>
                      </dl>
                      <h4>Trabajo realizado</h4>
                      <p>{avanceSeleccionado.descripcion}</p>
                      {avanceSeleccionado.observaciones && <>
                        <h4>Observaciones de campo</h4>
                        <p>{avanceSeleccionado.observaciones}</p>
                      </>}
                      {mostrarDevolucion && (
                        <label className="revision-centro__devolucion">Motivo de devolución (obligatorio)
                          <textarea maxLength={3000} required value={motivos[avanceSeleccionado.id] ?? ''}
                            placeholder="Explicá qué debe corregirse antes de reenviar el avance…"
                            onChange={(evento) => setMotivos((actual) => ({
                              ...actual, [avanceSeleccionado.id]: evento.target.value,
                            }))} />
                        </label>
                      )}
                      {confirmarRevision && (
                        <div className="revision-centro__nota" role="group" aria-label="Confirmar decisión">
                          <strong>Confirmar {confirmarRevision === 'validar' ? 'validación' : 'devolución'}</strong>
                          <p>{confirmarRevision === 'validar'
                            ? 'Este avance contará en los resultados oficiales del proyecto.'
                            : 'El avance regresará al responsable para su corrección.'}</p>
                          <div className="revision-centro__acciones">
                            <button type="button" className="revision-centro__neutral"
                              onClick={() => setConfirmarRevision(null)}>Cancelar</button>
                            <button type="button" className="revision-centro__validar" disabled={guardando}
                              onClick={() => void decidirAvance(avanceSeleccionado, confirmarRevision)}>
                              {guardando ? 'Procesando…' : 'Confirmar decisión'}
                            </button>
                          </div>
                        </div>
                      )}
                      {!confirmarRevision && (
                        <div className="revision-centro__acciones">
                          {mostrarDevolucion && <button type="button" className="revision-centro__neutral"
                            onClick={() => setMostrarDevolucion(false)}>Cancelar</button>}
                          <button type="button" className="revision-centro__devolver" disabled={guardando}
                            onClick={() => {
                              if (!mostrarDevolucion) setMostrarDevolucion(true);
                              else if (motivos[avanceSeleccionado.id]?.trim()) setConfirmarRevision('devolver');
                            }}>
                            {mostrarDevolucion ? 'Continuar devolución' : 'Devolver avance'}
                          </button>
                          <button type="button" className="revision-centro__validar" disabled={guardando}
                            onClick={() => { setMostrarDevolucion(false); setConfirmarRevision('validar'); }}>
                            Validar avance
                          </button>
                        </div>
                      )}
                    </article>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}
      {puedeVer && datos && (
        <>
          {puedeGestionar && !formulario && (
            <>
              <button className="brigadas-accion" type="button" disabled={!datos.comunidades.length}
                onClick={() => { setError(''); setMensaje(''); setFormulario('nuevo'); }}>
                + Nuevo proyecto
              </button>
              {!datos.comunidades.length && <p>Registrá una comunidad activa para crear un proyecto.</p>}
            </>
          )}
          {puedeGestionar && formulario && (
            <form key={proyecto?.id ?? 'nuevo'} className="roles-panel__tarjeta" onSubmit={guardar}>
              <fieldset disabled={guardando}>
                <legend>{proyecto ? 'Editar proyecto' : 'Nuevo proyecto'}</legend>
                <div className="donantes-campos">
                  {proyecto ? <p>Comunidad: {proyecto.comunidad}</p> : (
                    <label>Comunidad
                      <select name="comunidadId" required defaultValue="">
                        <option value="">Seleccioná una comunidad</option>
                        {datos.comunidades.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.municipio}</option>)}
                      </select>
                    </label>
                  )}
                  <label>Título del proyecto
                    <input name="nombre" required maxLength={200} placeholder="Ej. Construcción de tres viviendas"
                      defaultValue={proyecto?.nombre} />
                  </label>
                  <label>Área del diagnóstico
                    <select name="tipo" required defaultValue={proyecto?.tipo ?? ''}>
                      <option value="">Seleccioná un área</option>
                      {proyecto && !Object.hasOwn(categorias, proyecto.tipo) &&
                        <option value={proyecto.tipo}>{proyecto.tipo} (tipo anterior)</option>}
                      {Object.entries(categorias).map(([codigo, etiqueta]) => (
                        <option key={codigo} value={codigo}>{etiqueta}</option>
                      ))}
                    </select>
                  </label>
                  <label>Presupuesto asignado ({datos.moneda})
                    <input name="presupuesto" type="number" required min="0" max="999999999999.99" step="0.01"
                      defaultValue={proyecto?.presupuesto ?? '0'} />
                  </label>
                  <label>Estado
                    <select name="estado" defaultValue={proyecto?.estado ?? 'PLANIFICADO'}>
                      {Object.entries(estados).map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre}</option>)}
                    </select>
                  </label>
                  <label>Fecha de inicio<input name="fechaInicio" type="date" required defaultValue={proyecto?.fechaInicio} /></label>
                  <label>Fecha de fin<input name="fechaFin" type="date" defaultValue={proyecto?.fechaFin ?? ''} /></label>
                  <label>Descripción<textarea name="descripcion" maxLength={3000} defaultValue={proyecto?.descripcion ?? ''} /></label>
                </div>
                <fieldset>
                  <legend>Donantes vinculados directamente</legend>
                  <p>Seleccioná las organizaciones o iglesias que apoyan el proyecto. El acceso al portal se administra en Usuarios.</p>
                  {datos.donantes.filter((d) => d.activo || proyecto?.donanteIds.includes(d.id)).map((d) => (
                    <div key={d.id}>
                      <label><input type="checkbox" name="donanteIds" value={d.id}
                        defaultChecked={proyecto?.donanteIds.includes(d.id)} />{' '}
                        {d.nombre}{!d.activo && ' (inactivo)'}
                      </label>
                    </div>
                  ))}
                  {!datos.donantes.some((d) => d.activo || proyecto?.donanteIds.includes(d.id)) &&
                    <p>Registrá una ficha activa en Donantes para vincularla.</p>}
                </fieldset>
                <button type="submit">{guardando ? 'Guardando…' : 'Guardar proyecto'}</button>{' '}
                <button className="brigadas-accion" type="button" onClick={() => { setFormulario(null); setError(''); }}>Cancelar</button>
              </fieldset>
            </form>
          )}
          {!datos.proyectos.length && <p>Todavía no hay proyectos registrados.</p>}
          <div className="roles-panel proyectos-lista">
            {datos.proyectos.map((item) => (
              <article className={`roles-panel__tarjeta proyectos-tarjeta${proyectoAbierto === item.id ? ' proyectos-tarjeta--abierta' : ''}`} key={item.id}>
                <h2>{item.nombre}</h2>
                <span className="pagina-modulo__estado">{estados[item.estado] ?? item.estado}</span>
                <p>{item.comunidad} · {categorias[item.tipo as AreaVisionDesarrollo] ?? item.tipo}</p>
                <p><strong>Presupuesto</strong> · {new Intl.NumberFormat('es-HN', {
                  minimumFractionDigits: 2, maximumFractionDigits: 2,
                }).format(Number(item.presupuesto))} {datos.moneda}</p>
                <p><strong>Donantes asociados</strong> · {item.donantes.join(', ') || 'Por asignar'}</p>
                <p>{item.fechaInicio}{item.fechaFin && ` — ${item.fechaFin}`}</p>
                {item.descripcion && <p>{item.descripcion}</p>}
                {puedeGestionar && (
                  <button type="button" className="brigadas-accion" disabled={guardando}
                    onClick={() => { setError(''); setMensaje(''); setFormulario(item); }}>
                    Editar proyecto
                  </button>
                )}
                {' '}<button type="button" className="brigadas-accion" aria-expanded={proyectoAbierto === item.id}
                  onClick={() => setProyectoAbierto((actual) => actual === item.id ? null : item.id)}>
                  {proyectoAbierto === item.id ? 'Ocultar actividades' : 'Ver actividades'}
                </button>
                {proyectoAbierto === item.id && (
                  <ActividadesProyecto
                    token={token}
                    proyectoId={item.id}
                    usuarioEmail={usuarioEmail}
                    presupuestoProyecto={Number(item.presupuesto)}
                    moneda={datos.moneda}
                    puedeGestionar={puedeGestionar}
                    puedeRegistrarAvance={puedeRegistrarAvance}
                    puedeRevisarAvance={puedeRevisarAvance}
                    puedeCorregirAvance={puedeCorregirAvance}
                  />
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default PaginaProyectos;
