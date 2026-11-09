import { useEffect, useState, type FormEvent } from 'react';
import { guardarActividadProyecto, obtenerActividadesProyecto, type ActividadProyecto } from '../../lib/api';

const estados: Record<string, string> = {
  PLANIFICADA: 'Planificada',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

export default function ActividadesProyecto({ token, proyectoId, puedeGestionar }: {
  token: string;
  proyectoId: string;
  puedeGestionar: boolean;
}) {
  const [actividades, setActividades] = useState<ActividadProyecto[] | null>(null);
  const [formulario, setFormulario] = useState<ActividadProyecto | 'nueva' | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [recarga, setRecarga] = useState(0);
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
          {puedeGestionar && !formulario && (
            <button type="button" className="brigadas-accion"
              onClick={() => { setError(''); setMensaje(''); setFormulario(item); }}>Editar actividad</button>
          )}
        </article>
      ))}
    </section>
  );
}
