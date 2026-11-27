import { useEffect, useState, type FormEvent } from 'react';
import '../../estilos/modulos/proyectos/brigadas-recursos.css';
import {
  guardarBrigadaRecursoProyecto, obtenerBrigadasRecursosProyecto,
  type ActividadProyecto, type BrigadaRecursoProyecto, type DatosBrigadaRecursoProyecto,
} from '../../lib/api';

interface Props {
  token: string;
  proyectoId: string;
  actividades: ActividadProyecto[];
  moneda: string;
  puedeGestionar: boolean;
}

const formatear = (valor: number) => valor.toLocaleString('es-HN', { maximumFractionDigits: 2 });

export default function BrigadasRecursosProyecto({ token, proyectoId, actividades, moneda, puedeGestionar }: Props) {
  const [brigadas, setBrigadas] = useState<BrigadaRecursoProyecto[]>([]);
  const [seleccionada, setSeleccionada] = useState('');
  const [datos, setDatos] = useState<DatosBrigadaRecursoProyecto>({
    vinculada: true, montoComprometido: 0, montoRecibido: 0,
    voluntariosPrevistos: 0, materialesComprometidos: null,
    materialesEntregados: null, observaciones: null, actividadIds: [],
  });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    obtenerBrigadasRecursosProyecto(token, proyectoId).then(
      ({ brigadas: lista }) => {
        if (activo) {
          setBrigadas(lista);
          setError('');
          setCargando(false);
        }
      },
      (fallo: Error) => {
        if (activo) {
          setError(fallo.message);
          setCargando(false);
        }
      },
    );
    return () => { activo = false; };
  }, [token, proyectoId, recarga]);

  const vinculadas = brigadas.filter((brigada) => brigada.vinculada);
  const totalComprometido = vinculadas.reduce((total, brigada) => total + brigada.montoComprometido, 0);
  const totalRecibido = vinculadas.reduce((total, brigada) => total + brigada.montoRecibido, 0);

  function seleccionar(id: string) {
    setSeleccionada(id);
    setError('');
    setMensaje('');
    const brigada = brigadas.find((item) => item.id === id);
    if (brigada) {
      setDatos({
        vinculada: true,
        montoComprometido: brigada.montoComprometido,
        montoRecibido: brigada.montoRecibido,
        voluntariosPrevistos: brigada.voluntariosPrevistos,
        materialesComprometidos: brigada.materialesComprometidos,
        materialesEntregados: brigada.materialesEntregados,
        observaciones: brigada.observaciones,
        actividadIds: brigada.actividadIds,
      });
    }
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!seleccionada || guardando) return;
    if (datos.montoRecibido > datos.montoComprometido) {
      setError('El dinero recibido no puede superar el monto comprometido.');
      return;
    }
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await guardarBrigadaRecursoProyecto(token, proyectoId, seleccionada, datos);
      setSeleccionada('');
      setMensaje('Se actualizaron los compromisos y asignaciones de la brigada.');
      setRecarga((numero) => numero + 1);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible guardar los recursos.');
    } finally {
      setGuardando(false);
    }
  }

  async function desvincular(brigada: BrigadaRecursoProyecto) {
    if (guardando || !window.confirm(`¿Desvincular a ${brigada.donante} del proyecto? Se eliminarán sus compromisos asociados a este proyecto.`)) return;
    setGuardando(true);
    setError('');
    try {
      await guardarBrigadaRecursoProyecto(token, proyectoId, brigada.id, {
        vinculada: false, montoComprometido: 0, montoRecibido: 0,
        voluntariosPrevistos: 0, materialesComprometidos: null,
        materialesEntregados: null, observaciones: null, actividadIds: [],
      });
      setMensaje('Brigada desvinculada del proyecto.');
      setRecarga((numero) => numero + 1);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible desvincular la brigada.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="proyecto-brigadas-recursos" aria-label="Brigadas y recursos del proyecto">
      <header className="proyecto-detalle__resumen">
        <h3>Brigadas y recursos</h3>
        <p>Vinculá brigadas, registrá lo que prometieron y lo que realmente entregaron. Los aportes no modifican el avance físico.</p>
      </header>
      {mensaje && <p role="status">{mensaje}</p>}
      {error && <p role="alert">{error}</p>}
      {cargando ? <p role="status">Consultando brigadas…</p> : (
        <>
          <div className="proyecto-resumen__indicadores">
            <div><span>Brigadas participantes</span><strong>{vinculadas.length}</strong></div>
            <div><span>Dinero comprometido</span><strong>{formatear(totalComprometido)} {moneda}</strong></div>
            <div><span>Dinero recibido</span><strong>{formatear(totalRecibido)} {moneda}</strong></div>
            <div><span>Pendiente de recibir</span><strong>{formatear(totalComprometido - totalRecibido)} {moneda}</strong></div>
          </div>
          <div className="proyecto-detalle__lista proyecto-brigadas-recursos__lista">
            {vinculadas.map((brigada) => (
              <article key={brigada.id} className="brigadas-tarjeta proyecto-brigadas-recursos__tarjeta">
                <h4>{brigada.donante}</h4>
                <p>Líder: {brigada.lider} · {brigada.voluntariosPrevistos} voluntarios previstos</p>
                <p>Comprometido: {formatear(brigada.montoComprometido)} {moneda} · Recibido: {formatear(brigada.montoRecibido)} {moneda}</p>
                <p>Materiales comprometidos: {brigada.materialesComprometidos || 'No registrados'}</p>
                <p>Materiales entregados: {brigada.materialesEntregados || 'No registrados'}</p>
                <p>Actividades: {brigada.actividadIds.length
                  ? brigada.actividadIds.map((id) => actividades.find((a) => a.id === id)?.nombre ?? 'Actividad no disponible').join(', ')
                  : 'Apoyo general al proyecto'}</p>
                {puedeGestionar && (
                  <div className="actividad-avance__acciones">
                    <button type="button" className="brigadas-accion" onClick={() => seleccionar(brigada.id)}>Editar aportes</button>
                    <button type="button" className="brigadas-accion" disabled={guardando} onClick={() => void desvincular(brigada)}>Desvincular</button>
                  </div>
                )}
              </article>
            ))}
            {!vinculadas.length && <p>No hay brigadas vinculadas a este proyecto.</p>}
          </div>
          {puedeGestionar && (
            <form className="actividad-plan-form proyecto-brigadas-recursos__formulario" onSubmit={(evento) => void guardar(evento)}>
              <fieldset disabled={guardando}>
                <legend>{seleccionada && brigadas.find((b) => b.id === seleccionada)?.vinculada ? 'Actualizar brigada' : 'Vincular nueva brigada'}</legend>
                <div className="proyecto-brigadas-recursos__campos">
                  <label className="proyecto-brigadas-recursos__campo proyecto-brigadas-recursos__campo--completo">Seleccioná una brigada registrada
                    <select value={seleccionada} required onChange={(evento) => seleccionar(evento.target.value)}>
                      <option value="">Elegir brigada…</option>
                      {brigadas.map((brigada) => (
                        <option key={brigada.id} value={brigada.id}>{brigada.donante} · {brigada.lider}{brigada.vinculada ? ' (ya vinculada)' : ''}</option>
                      ))}
                    </select>
                    <small>Las brigadas se crean una sola vez en Donantes y pueden participar en varios proyectos.</small>
                  </label>
                  <label className="proyecto-brigadas-recursos__campo">Dinero comprometido ({moneda})
                    <input type="number" min="0" step="0.01" value={datos.montoComprometido}
                      onChange={(evento) => setDatos((actual) => ({ ...actual, montoComprometido: Number(evento.target.value) }))} />
                  </label>
                  <label className="proyecto-brigadas-recursos__campo">Dinero recibido ({moneda})
                    <input type="number" min="0" step="0.01" max={datos.montoComprometido} value={datos.montoRecibido}
                      onChange={(evento) => setDatos((actual) => ({ ...actual, montoRecibido: Number(evento.target.value) }))} />
                    <small>Registrá únicamente el dinero efectivamente entregado.</small>
                  </label>
                  <label className="proyecto-brigadas-recursos__campo">Voluntarios previstos
                    <input type="number" min="0" step="1" value={datos.voluntariosPrevistos}
                      onChange={(evento) => setDatos((actual) => ({ ...actual, voluntariosPrevistos: Number(evento.target.value) }))} />
                  </label>
                  <label className="proyecto-brigadas-recursos__campo">Materiales comprometidos
                    <textarea maxLength={3000} value={datos.materialesComprometidos ?? ''}
                      onChange={(evento) => setDatos((actual) => ({ ...actual, materialesComprometidos: evento.target.value || null }))}
                      placeholder="Ej. 100 bolsas de cemento, 20 láminas" />
                  </label>
                  <label className="proyecto-brigadas-recursos__campo">Materiales entregados
                    <textarea maxLength={3000} value={datos.materialesEntregados ?? ''}
                      onChange={(evento) => setDatos((actual) => ({ ...actual, materialesEntregados: evento.target.value || null }))}
                      placeholder="Ej. 60 bolsas de cemento recibidas" />
                  </label>
                </div>
                <section className="actividad-plan-form__grupo proyecto-brigadas-recursos__actividades">
                  <h4>Actividades que apoyará</h4>
                  <p>Dejá todas sin seleccionar si la brigada brindará apoyo general al proyecto.</p>
                  {actividades.map((actividad) => (
                    <label key={actividad.id} className="proyecto-brigadas-recursos__actividad">
                      <input type="checkbox" checked={datos.actividadIds.includes(actividad.id)}
                        onChange={(evento) => setDatos((actual) => ({
                          ...actual,
                          actividadIds: evento.target.checked
                            ? [...actual.actividadIds, actividad.id]
                            : actual.actividadIds.filter((id) => id !== actividad.id),
                        }))} />
                      {' '}{actividad.nombre}
                    </label>
                  ))}
                </section>
                <label className="proyecto-brigadas-recursos__campo proyecto-brigadas-recursos__observaciones">Observaciones
                  <textarea maxLength={3000} value={datos.observaciones ?? ''}
                    onChange={(evento) => setDatos((actual) => ({ ...actual, observaciones: evento.target.value || null }))} />
                </label>
                <div className="actividad-plan-form__acciones proyecto-brigadas-recursos__acciones">
                  <button type="submit" disabled={!seleccionada || guardando}>{guardando ? 'Guardando…' : 'Guardar brigada y recursos'}</button>
                  {seleccionada && <button type="button" className="brigadas-accion" onClick={() => setSeleccionada('')}>Cancelar</button>}
                </div>
              </fieldset>
            </form>
          )}
        </>
      )}
    </section>
  );
}
