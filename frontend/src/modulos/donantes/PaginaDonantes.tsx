import PlanBrigada, { type ComunidadBrigada, type ProyectoBrigada } from './PlanBrigada';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  actualizarEstadoDonante, guardarFichaDonante, obtenerAdministracionDonantes, obtenerFichasDonantes, type FichaDonante,
} from '../../lib/api';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/roles.css';
import './donantes.css';

const tarjetasPorPagina = 6;
type Brigada = FichaDonante['brigadas'][number];
type VentanaBrigada = { tipo: 'alta'; fichaId: string; brigada?: Brigada } |
  { tipo: 'detalle'; brigada: Brigada; donante: string };

export default function PaginaDonantes({ token }: { token: string }) {
  const [fichas, setFichas] = useState<FichaDonante[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoBrigada[]>([]);
  const [zonas, setZonas] = useState<{ id: string; nombre: string }[]>([]);
  const [comunidades, setComunidades] = useState<ComunidadBrigada[]>([]);
  const [paginas, setPaginas] = useState<Record<string, number>>({});
  const [ventana, setVentana] = useState<VentanaBrigada | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const elemento = dialogo.current;
    if (ventana && elemento && !elemento.open) elemento.showModal();
    if (!ventana && elemento?.open) elemento.close();
  }, [ventana]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    Promise.all([obtenerFichasDonantes(token), obtenerAdministracionDonantes(token)])
      .then(([registro, catalogo]) => {
        if (!vigente) return;
        setFichas(registro.fichas);
        setComunidades(registro.comunidades);
        setZonas(registro.zonas);
        setProyectos(catalogo.proyectos);
      })
      .catch((fallo: Error) => { if (vigente) setError(fallo.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [token]);

  function abrirAlta(fichaId: string, brigada?: Brigada) {
    setError('');
    setVentana({ tipo: 'alta', fichaId, brigada });
  }

  async function guardar(evento: FormEvent<HTMLFormElement>, fichaId?: string, brigadaId?: string) {
    evento.preventDefault();
    if (ocupado) return;
    const formulario = evento.currentTarget;
    const datos: Record<string, string | number | string[]> = {};
    const campos = new FormData(formulario);
    for (const [clave, valor] of campos) {
      datos[clave] = clave === 'miembros' ? Number(valor) : String(valor);
    }
    if (fichaId) {
      for (const campo of ['actividades', 'contrataciones', 'comunidadIds', 'proyectoIds']) {
        datos[campo] = campos.getAll(campo).map((valor) => String(valor).trim());
      }
    }
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await guardarFichaDonante(token, datos, fichaId, brigadaId);
      formulario.reset();
      if (fichaId) {
        setPaginas((actual) => ({ ...actual, [fichaId]: 0 }));
        setVentana(null);
      }
      setMensaje(brigadaId ? 'Brigada actualizada.' : fichaId ? 'Brigada registrada.' : 'Donante registrado.');
      setFichas((await obtenerFichasDonantes(token)).fichas);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible completar la operación.');
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarEstado(ficha: FichaDonante, brigada?: Brigada) {
    if (ocupado) return;
    const activo = !(brigada?.activo ?? ficha.activo);
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await actualizarEstadoDonante(token, ficha.id, activo, brigada?.id);
      setFichas((actual) => actual.map((item) => {
        if (item.id !== ficha.id) return item;
        if (!brigada) return { ...item, activo };
        return {
          ...item,
          brigadas: item.brigadas.map((registro) => registro.id === brigada.id
            ? { ...registro, activo } : registro),
        };
      }));
      setMensaje(activo ? 'Registro reactivado.' : 'Registro desactivado.');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible cambiar el estado.');
    } finally {
      setOcupado(false);
    }
  }

  const donantesActivos = fichas.filter((ficha) => ficha.activo);

  return (
    <section className="pagina-modulo donantes-modulo">
      <header className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Coordinación comunitaria</p>
        <h1 className="pagina-modulo__titulo">Donantes y brigadas</h1>
        <p className="pagina-modulo__descripcion">Registrá organizaciones e iglesias y planificá sus viajes.</p>
      </header>
      {error && !ventana && <p role="alert">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      {cargando && <p role="status">Cargando donantes…</p>}
      <form className="roles-panel__tarjeta" onSubmit={guardar}>
        <fieldset disabled={ocupado || cargando}>
          <legend>Nueva ficha de donante</legend>
          <div className="donantes-campos">
            <label>Organización o iglesia<input name="nombre" required maxLength={180} /></label>
            <label>Correo de contacto<input name="correo" type="email" required maxLength={150} /></label>
            <label>Teléfono opcional<input name="telefono" type="tel" maxLength={50} /></label>
          </div>
          <button type="submit">Registrar donante</button>
        </fieldset>
      </form>
      {fichas.map((ficha) => {
        const pagina = paginas[ficha.id] ?? 0;
        const total = Math.ceil(ficha.brigadas.length / tarjetasPorPagina);
        const inicio = pagina * tarjetasPorPagina;
        const cambiarPagina = (nueva: number) => setPaginas((actual) => ({ ...actual, [ficha.id]: nueva }));

        return (
          <article className="roles-panel__tarjeta" key={ficha.id}>
            <header className="brigadas-encabezado">
              <div>
                <h2>{ficha.nombre}</h2>
                <span className="pagina-modulo__estado">{ficha.activo ? 'Activo' : 'Inactivo'}</span>
                <p>{ficha.correo}{ficha.telefono && ` · ${ficha.telefono}`}</p>
              </div>
              <button type="button" className="brigadas-accion" disabled={ocupado || !ficha.activo} onClick={() => abrirAlta(ficha.id)}>
                + Agregar brigada
              </button>
              <button type="button" className="brigadas-accion" disabled={ocupado}
                onClick={() => void cambiarEstado(ficha)}>
                {ficha.activo ? 'Desactivar donante' : 'Reactivar donante'}
              </button>
            </header>
            <p><strong>Proyectos asociados</strong> · {ficha.proyectos.join(", ") || "Por asignar"}</p>
            <h3>Brigadas registradas · {ficha.brigadas.length}</h3>
            {!total && <p>Todavía no hay brigadas registradas.</p>}
            <div className="brigadas-tarjetas">
              {ficha.brigadas.slice(inicio, inicio + tarjetasPorPagina).map((brigada) => (
                <article className="brigadas-tarjeta" key={brigada.id}>
                  <h4>{brigada.lider}</h4>
                  <span className="pagina-modulo__estado">{brigada.activo ? 'Activa' : 'Inactiva'}</span>
                  <p>{brigada.miembros} integrantes · {brigada.llegada ?? 'Fecha por definir'}</p>
                  <p>{brigada.zona ?? 'Zona por asignar'} · {brigada.comunidades.length} comunidades</p>
                  <button type="button" className="brigadas-accion" aria-label={`Ver brigada de ${brigada.lider}`}
                    onClick={() => setVentana({ tipo: 'detalle', brigada, donante: ficha.nombre })}>
                    Ver detalles
                  </button>
                  {' '}<button type="button" className="brigadas-accion" disabled={ocupado}
                    onClick={() => abrirAlta(ficha.id, brigada)}>Editar</button>
                  {' '}<button type="button" className="brigadas-accion" disabled={ocupado}
                    onClick={() => void cambiarEstado(ficha, brigada)}>{brigada.activo ? 'Desactivar' : 'Reactivar'}</button>
                </article>
              ))}
            </div>
            {total > 1 && (
              <nav className="brigadas-paginacion" aria-label={`Páginas de brigadas de ${ficha.nombre}`}>
                <button type="button" disabled={pagina === 0} onClick={() => cambiarPagina(pagina - 1)}>Anterior</button>
                <span role="status">Página {pagina + 1} de {total}</span>
                <button type="button" disabled={pagina + 1 >= total} onClick={() => cambiarPagina(pagina + 1)}>Siguiente</button>
              </nav>
            )}
          </article>
        );
      })}
      {donantesActivos.length > 0 && (
        <button type="button" className="brigadas-accion brigadas-flotante"
          onClick={() => abrirAlta(donantesActivos.length === 1 ? donantesActivos[0].id : '')}>
          + Agregar brigada
        </button>
      )}
      <dialog ref={dialogo} className="brigadas-dialogo" aria-labelledby="titulo-ventana-brigada"
        onClose={() => setVentana(null)} onCancel={(evento) => { if (ocupado) evento.preventDefault(); }}>
        {ventana && (
          <>
            <header className="brigadas-encabezado">
              <h2 id="titulo-ventana-brigada">
                {ventana.tipo === 'alta' ? (ventana.brigada ? 'Editar brigada' : 'Agregar brigada') : `Brigada de ${ventana.brigada.lider}`}
              </h2>
              <button type="button" disabled={ocupado} onClick={() => setVentana(null)}>Cerrar</button>
            </header>
            {ventana.tipo === 'alta' ? (
              <>
                {error && <p role="alert">{error}</p>}
                <label className="brigadas-selector">
                  Donante
                  <select value={ventana.fichaId} disabled={ocupado || Boolean(ventana.brigada)}
                    onChange={(evento) => setVentana({ tipo: 'alta', fichaId: evento.target.value })}>
                    <option value="">Seleccioná un donante</option>
                    {(ventana.brigada ? fichas : donantesActivos).map((ficha) => <option key={ficha.id} value={ficha.id}>{ficha.nombre}</option>)}
                  </select>
                </label>
                <form onSubmit={(evento) => void guardar(evento, ventana.fichaId, ventana.brigada?.id)}>
                  <fieldset disabled={ocupado || !ventana.fichaId}>
                    <legend>Plan del viaje</legend>
                    <div className="donantes-campos">
                      <label>Líder del grupo<input name="lider" defaultValue={ventana.brigada?.lider ?? ''} required maxLength={180} /></label>
                      <label>Cantidad de integrantes<input name="miembros" defaultValue={ventana.brigada?.miembros ?? ''} type="number" required min={1} max={100000} /></label>
                      <label>Llegada tentativa<input name="llegada" defaultValue={ventana.brigada?.llegada ?? ''} type="date" /></label>
                      <label>Salida tentativa<input name="salida" defaultValue={ventana.brigada?.salida ?? ''} type="date" /></label>
                      <label>Observaciones<textarea name="observaciones" defaultValue={ventana.brigada?.observaciones ?? ''} maxLength={3000} /></label>
                    </div>
                    <PlanBrigada inicial={ventana.brigada} zonas={zonas} comunidades={comunidades} proyectos={proyectos} />
                    {!zonas.length && <p>Registrá una zona activa antes de guardar la brigada.</p>}
                    <button type="submit" disabled={!zonas.length || !ventana.fichaId}>Guardar brigada</button>
                  </fieldset>
                </form>
              </>
            ) : (
              <>
                <p>{ventana.donante} · {ventana.brigada.miembros} integrantes</p>
                <p>Llegada: {ventana.brigada.llegada ?? 'Por definir'}</p>
                <p>Zona: {ventana.brigada.zona ?? 'Por asignar'}</p>
                <p>Comunidades: {ventana.brigada.comunidades.join(', ') || 'Por definir'}</p>
                <p>Salida: {ventana.brigada.salida ?? 'Por definir'}</p>
                <p><strong>Proyectos</strong> · {ventana.brigada.proyectos.join(', ') || 'Por asignar'}</p>
                {ventana.brigada.actividades.length > 0 && (
                  <><h4>Actividades</h4><ul>{ventana.brigada.actividades.map((texto, indice) => <li key={indice}>{texto}</li>)}</ul></>
                )}
                {ventana.brigada.contrataciones.length > 0 && (
                  <><h4>Contrataciones</h4><ul>{ventana.brigada.contrataciones.map((texto, indice) => <li key={indice}>{texto}</li>)}</ul></>
                )}
                {ventana.brigada.observaciones && <p>Observaciones: {ventana.brigada.observaciones}</p>}
              </>
            )}
          </>
        )}
      </dialog>
    </section>
  );
}
