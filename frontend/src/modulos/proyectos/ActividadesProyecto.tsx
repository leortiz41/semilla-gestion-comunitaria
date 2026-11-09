import { useEffect, useState, type FormEvent } from 'react';
import {
  guardarActividadProyecto,
  obtenerActividadesProyecto,
  registrarAvanceActividadProyecto,
  type ActividadProyecto,
} from '../../lib/api';

const estados: Record<string, string> = {
  PLANIFICADA: 'Planificada',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

function fechaLocalHoy() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

export default function ActividadesProyecto({ token, proyectoId, puedeGestionar, puedeRegistrarAvance }: {
  token: string;
  proyectoId: string;
  puedeGestionar: boolean;
  puedeRegistrarAvance: boolean;
}) {
  const [actividades, setActividades] = useState<ActividadProyecto[] | null>(null);
  const [formulario, setFormulario] = useState<ActividadProyecto | 'nueva' | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [actividadAvance, setActividadAvance] = useState<string | null>(null);
  const [guardandoAvance, setGuardandoAvance] = useState(false);
  const actividad = formulario === 'nueva' ? null : formulario;

  useEffect(() => {
    let vigente = true;
    obtenerActividadesProyecto(token, proyectoId).then(
      (datos) => { if (vigente) setActividades(datos.actividades); },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    );
    return () => { vigente = false; };
  }, [token, proyectoId, recarga]);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;
    const campos = new FormData(evento.currentTarget);
    const valor = (campo: string) => String(campos.get(campo) ?? '');
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await guardarActividadProyecto(token, proyectoId, {
        nombre: valor('nombre'),
        descripcion: valor('descripcion'),
        estado: valor('estado'),
        fechaInicio: valor('fechaInicio') || null,
        fechaFin: valor('fechaFin') || null,
      }, actividad?.id);
      setMensaje(actividad ? 'Actividad actualizada.' : 'Actividad registrada.');
      setFormulario(null);
      setActividades(null);
      setRecarga((actual) => actual + 1);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible guardar la actividad.');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarAvance(evento: FormEvent<HTMLFormElement>, item: ActividadProyecto) {
    evento.preventDefault();
    if (guardandoAvance || !puedeRegistrarAvance) return;
    const campos = new FormData(evento.currentTarget);
    setGuardandoAvance(true);
    setError('');
    setMensaje('');
    try {
      await registrarAvanceActividadProyecto(token, proyectoId, item.id, {
        porcentajeAvance: Number(campos.get('porcentajeAvance')),
        fecha: String(campos.get('fecha') ?? ''),
        descripcion: String(campos.get('descripcion') ?? ''),
      });
      setMensaje('Avance registrado en el historial de la actividad.');
      setActividadAvance(null);
      setActividades(null);
      setRecarga((actual) => actual + 1);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible registrar el avance.');
    } finally {
      setGuardandoAvance(false);
    }
  }

  return (
    <section aria-label="Actividades del proyecto">
      <h3>Actividades del proyecto</h3>
      {error && <p role="alert">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      {!actividades && !error && <p role="status">Cargando actividades…</p>}
      {!actividades && error && (
        <button type="button" className="brigadas-accion"
          onClick={() => { setError(''); setRecarga((actual) => actual + 1); }}>
          Volver a cargar
        </button>
      )}
      {actividades?.length === 0 && <p>Todavía no hay actividades registradas.</p>}
      {puedeGestionar && actividades && !formulario && (
        <button type="button" className="brigadas-accion"
          onClick={() => { setError(''); setMensaje(''); setFormulario('nueva'); }}>
          + Nueva actividad
        </button>
      )}
      {puedeGestionar && formulario && (
        <form key={actividad?.id ?? 'nueva'} onSubmit={guardar}>
          <fieldset disabled={guardando}>
            <legend>{actividad ? 'Editar actividad' : 'Nueva actividad'}</legend>
            <div className="donantes-campos">
              <label>Nombre<input name="nombre" required maxLength={180} defaultValue={actividad?.nombre} /></label>
              <label>Estado
                <select name="estado" defaultValue={actividad?.estado ?? 'PLANIFICADA'}>
                  {Object.entries(estados).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                </select>
              </label>
              <label>Fecha de inicio<input name="fechaInicio" type="date" defaultValue={actividad?.fechaInicio ?? ''} /></label>
              <label>Fecha de fin<input name="fechaFin" type="date" defaultValue={actividad?.fechaFin ?? ''} /></label>
              <label>Descripción<textarea name="descripcion" maxLength={3000} defaultValue={actividad?.descripcion ?? ''} /></label>
            </div>
            <button type="submit">{guardando ? 'Guardando…' : 'Guardar actividad'}</button>{' '}
            <button type="button" className="brigadas-accion"
              onClick={() => { setError(''); setFormulario(null); }}>Cancelar</button>
          </fieldset>
        </form>
      )}
      {actividades?.map((item) => (
        <article className="brigadas-tarjeta" key={item.id}>
          <h4>{item.nombre}</h4>
          <span className="pagina-modulo__estado">{estados[item.estado] ?? item.estado}</span>
          <p>{item.fechaInicio ?? 'Inicio por definir'}{item.fechaFin && ` · Fin ${item.fechaFin}`}</p>
          {item.descripcion && <p>{item.descripcion}</p>}
          <section className="actividad-avances" aria-label={`Historial de avances de ${item.nombre}`}>
            <header className="actividad-avances__encabezado">
              <h5>Avances de ejecución</h5>
              <span>{item.avances?.length ?? 0}</span>
            </header>
            {!item.avances?.length && (
              <p className="actividad-avances__vacio">Aún no se han registrado avances para esta actividad.</p>
            )}
            {Boolean(item.avances?.length) && (
              <ol className="actividad-avances__lista">
                {item.avances.map((avance) => (
                  <li key={avance.id}>
                    <div className="actividad-avances__detalle">
                      <strong>{avance.porcentajeAvance.toLocaleString('es-HN', { maximumFractionDigits: 2 })}%</strong>
                      <time dateTime={avance.fecha}>{avance.fecha}</time>
                    </div>
                    <p>{avance.descripcion}</p>
                    <span>Responsable · {avance.responsable}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {puedeRegistrarAvance && !formulario && actividadAvance !== item.id && (
            <button type="button" className="brigadas-accion"
              onClick={() => { setError(''); setMensaje(''); setActividadAvance(item.id); }}>
              + Registrar avance
            </button>
          )}
          {puedeRegistrarAvance && actividadAvance === item.id && (
            <form className="actividad-avance-form" onSubmit={(evento) => void guardarAvance(evento, item)}>
              <fieldset disabled={guardandoAvance}>
                <legend>Registrar avance</legend>
                <div className="donantes-campos">
                  <label>Avance acumulado (%)
                    <input name="porcentajeAvance" type="number" min="0" max="100" step="0.01"
                      defaultValue="0" required />
                  </label>
                  <label>Fecha de ejecución
                    <input name="fecha" type="date" defaultValue={fechaLocalHoy()} required />
                  </label>
                  <label className="actividad-avance-form__descripcion">Descripción de lo ejecutado
                    <textarea name="descripcion" maxLength={3000} required />
                  </label>
                </div>
                <p className="actividad-avance-form__responsable">
                  El usuario de tu sesión quedará registrado como responsable de este avance.
                </p>
                <div className="actividad-avance-form__acciones">
                  <button type="submit" disabled={guardandoAvance}>
                    {guardandoAvance ? 'Guardando…' : 'Guardar avance'}
                  </button>
                  <button type="button" className="brigadas-accion" disabled={guardandoAvance}
                    onClick={() => { setError(''); setActividadAvance(null); }}>
                    Cancelar
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          {puedeGestionar && !formulario && (
            <button type="button" className="brigadas-accion"
              onClick={() => { setError(''); setMensaje(''); setFormulario(item); }}>Editar actividad</button>
          )}
        </article>
      ))}
    </section>
  );
}
