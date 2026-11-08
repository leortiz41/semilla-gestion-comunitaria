import { useEffect, useState, type FormEvent } from 'react';
import {
  guardarProyectoAdministrativo, obtenerProyectosAdministrativos, type ProyectoAdministrativo,
} from '../../lib/api';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/roles.css';
import '../donantes/donantes.css';

const estados: Record<string, string> = {
  PLANIFICADO: 'Planificado',
  EN_EJECUCION: 'En ejecución',
  PAUSADO: 'Pausado',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

function PaginaProyectos({ token, puedeVer, puedeGestionar }: {
  token: string;
  puedeVer: boolean;
  puedeGestionar: boolean;
}) {
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof obtenerProyectosAdministrativos>> | null>(null);
  const [formulario, setFormulario] = useState<ProyectoAdministrativo | 'nuevo' | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [recarga, setRecarga] = useState(0);
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
                  <label>Nombre<input name="nombre" required maxLength={200} defaultValue={proyecto?.nombre} /></label>
                  <label>Tipo<input name="tipo" required maxLength={60} defaultValue={proyecto?.tipo} /></label>
                  <label>Estado
                    <select name="estado" defaultValue={proyecto?.estado ?? 'PLANIFICADO'}>
                      {Object.entries(estados).map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre}</option>)}
                    </select>
                  </label>
                  <label>Fecha de inicio<input name="fechaInicio" type="date" required defaultValue={proyecto?.fechaInicio} /></label>
                  <label>Fecha de fin<input name="fechaFin" type="date" defaultValue={proyecto?.fechaFin ?? ''} /></label>
                  <label>Descripción<textarea name="descripcion" maxLength={3000} defaultValue={proyecto?.descripcion ?? ''} /></label>
                </div>
                <button type="submit">{guardando ? 'Guardando…' : 'Guardar proyecto'}</button>{' '}
                <button className="brigadas-accion" type="button" onClick={() => { setFormulario(null); setError(''); }}>Cancelar</button>
              </fieldset>
            </form>
          )}
          {!datos.proyectos.length && <p>Todavía no hay proyectos registrados.</p>}
          <div className="roles-panel">
            {datos.proyectos.map((item) => (
              <article className="roles-panel__tarjeta" key={item.id}>
                <h2>{item.nombre}</h2>
                <span className="pagina-modulo__estado">{estados[item.estado] ?? item.estado}</span>
                <p>{item.comunidad} · {item.tipo}</p>
                <p>{item.fechaInicio}{item.fechaFin && ` — ${item.fechaFin}`}</p>
                {item.descripcion && <p>{item.descripcion}</p>}
                {puedeGestionar && (
                  <button type="button" className="brigadas-accion" disabled={guardando}
                    onClick={() => { setError(''); setMensaje(''); setFormulario(item); }}>
                    Editar proyecto
                  </button>
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
