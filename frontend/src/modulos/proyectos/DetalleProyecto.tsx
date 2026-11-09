import { useEffect, useState, type FormEvent } from 'react';
import {
  corregirAvanceValidadoProyecto,
  editarAvanceActividadProyecto,
  enviarAvanceActividadProyecto,
  guardarActividadProyecto,
  obtenerActividadesProyecto,
  obtenerResponsablesProyecto,
  registrarAvanceActividadProyecto,
  revisarAvanceActividadProyecto,
  type ActividadProyecto,
  type AvanceActividadProyecto,
  type DatosAvanceActividadProyecto,
} from '../../lib/api';

const estadosActividad: Record<string, string> = {
  PLANIFICADA: 'Planificada',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

const estadosRevision: Record<AvanceActividadProyecto['estadoRevision'], string> = {
  BORRADOR: 'Borrador',
  ENVIADO: 'En revisión',
  VALIDADO: 'Validado',
  DEVUELTO: 'Devuelto',
};

const fechaLocalHoy = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
};

const nuevaClaveIdempotencia = () => globalThis.crypto.randomUUID();

export default function DetalleProyecto({
  token,
  proyectoId,
  usuarioEmail,
  presupuestoProyecto,
  moneda,
  puedeGestionar,
  puedeRegistrarAvance,
  puedeRevisarAvance,
  puedeCorregirAvance,
}: {
  token: string;
  proyectoId: string;
  usuarioEmail: string;
  presupuestoProyecto: number;
  moneda: string;
  puedeGestionar: boolean;
  puedeRegistrarAvance: boolean;
  puedeRevisarAvance: boolean;
  puedeCorregirAvance: boolean;
}) {
  const [actividades, setActividades] = useState<ActividadProyecto[] | null>(null);
  const [porcentajeProyecto, setPorcentajeProyecto] = useState<number | null>(null);
  const [pesoConfigurado, setPesoConfigurado] = useState(0);
  const [responsables, setResponsables] = useState<{ id: string; nombre: string }[]>([]);
  const [vista, setVista] = useState<'planificacion' | 'ejecucion' | 'resultados'>('planificacion');
  const [formularioActividad, setFormularioActividad] = useState<ActividadProyecto | 'nueva' | null>(null);
  const [avanceFormulario, setAvanceFormulario] = useState<{ actividad: ActividadProyecto; avance?: AvanceActividadProyecto; corregir?: boolean } | null>(null);
  const [devolucion, setDevolucion] = useState<{ actividad: ActividadProyecto; avance: AvanceActividadProyecto } | null>(null);
  const [claveIdempotencia, setClaveIdempotencia] = useState(nuevaClaveIdempotencia);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorPlanificacion, setErrorPlanificacion] = useState('');
  const [erroresCamposPlan, setErroresCamposPlan] = useState<Record<string, string>>({});
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    obtenerActividadesProyecto(token, proyectoId).then(
      (datos) => {
        if (!vigente) return;
        setActividades(datos.actividades);
        setPorcentajeProyecto(datos.porcentajeProyecto);
        setPesoConfigurado(datos.pesoConfigurado);
      },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    );
    if (puedeGestionar) {
      obtenerResponsablesProyecto(token, proyectoId).then(
        (datos) => { if (vigente) setResponsables(datos.responsables); },
        (fallo: Error) => { if (vigente) setError(fallo.message); },
      );
    }
    return () => { vigente = false; };
  }, [token, proyectoId, puedeGestionar, recarga]);

  function refrescar() {
    setActividades(null);
    setRecarga((actual) => actual + 1);
  }

  async function guardarActividad(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando || !puedeGestionar) return;
    const formulario = evento.currentTarget;
    const campos = new FormData(formulario);
    const valor = (campo: string) => String(campos.get(campo) ?? '').trim();
    const errores: Record<string, string> = {};
    // Aceptar coma o punto decimal y enviar números JSON válidos.
    const leerNumero = (campo: string, decimales: number, minimo: number, maximo?: number): number | null => {
      const texto = valor(campo);
      if (!texto) return null;
      const normalizado = texto.replace(',', '.');
      const patron = new RegExp(`^\\d+(?:\\.\\d{1,${decimales}})?import { useEffect, useState, type FormEvent } from 'react';
import {
  corregirAvanceValidadoProyecto,
  editarAvanceActividadProyecto,
  enviarAvanceActividadProyecto,
  guardarActividadProyecto,
  obtenerActividadesProyecto,
  obtenerResponsablesProyecto,
  registrarAvanceActividadProyecto,
  revisarAvanceActividadProyecto,
  type ActividadProyecto,
  type AvanceActividadProyecto,
  type DatosAvanceActividadProyecto,
} from '../../lib/api';

const estadosActividad: Record<string, string> = {
  PLANIFICADA: 'Planificada',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

const estadosRevision: Record<AvanceActividadProyecto['estadoRevision'], string> = {
  BORRADOR: 'Borrador',
  ENVIADO: 'En revisión',
  VALIDADO: 'Validado',
  DEVUELTO: 'Devuelto',
};

const fechaLocalHoy = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
};

const nuevaClaveIdempotencia = () => globalThis.crypto.randomUUID();

export default function DetalleProyecto({
  token,
  proyectoId,
  usuarioEmail,
  presupuestoProyecto,
  moneda,
  puedeGestionar,
  puedeRegistrarAvance,
  puedeRevisarAvance,
  puedeCorregirAvance,
}: {
  token: string;
  proyectoId: string;
  usuarioEmail: string;
  presupuestoProyecto: number;
  moneda: string;
  puedeGestionar: boolean;
  puedeRegistrarAvance: boolean;
  puedeRevisarAvance: boolean;
  puedeCorregirAvance: boolean;
}) {
  const [actividades, setActividades] = useState<ActividadProyecto[] | null>(null);
  const [porcentajeProyecto, setPorcentajeProyecto] = useState<number | null>(null);
  const [pesoConfigurado, setPesoConfigurado] = useState(0);
  const [responsables, setResponsables] = useState<{ id: string; nombre: string }[]>([]);
  const [vista, setVista] = useState<'planificacion' | 'ejecucion' | 'resultados'>('planificacion');
  const [formularioActividad, setFormularioActividad] = useState<ActividadProyecto | 'nueva' | null>(null);
  const [avanceFormulario, setAvanceFormulario] = useState<{ actividad: ActividadProyecto; avance?: AvanceActividadProyecto; corregir?: boolean } | null>(null);
  const [devolucion, setDevolucion] = useState<{ actividad: ActividadProyecto; avance: AvanceActividadProyecto } | null>(null);
  const [claveIdempotencia, setClaveIdempotencia] = useState(nuevaClaveIdempotencia);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorPlanificacion, setErrorPlanificacion] = useState('');
  const [erroresCamposPlan, setErroresCamposPlan] = useState<Record<string, string>>({});
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    obtenerActividadesProyecto(token, proyectoId).then(
      (datos) => {
        if (!vigente) return;
        setActividades(datos.actividades);
        setPorcentajeProyecto(datos.porcentajeProyecto);
        setPesoConfigurado(datos.pesoConfigurado);
      },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    );
    if (puedeGestionar) {
      obtenerResponsablesProyecto(token, proyectoId).then(
        (datos) => { if (vigente) setResponsables(datos.responsables); },
        (fallo: Error) => { if (vigente) setError(fallo.message); },
      );
    }
    return () => { vigente = false; };
  }, [token, proyectoId, puedeGestionar, recarga]);

  function refrescar() {
    setActividades(null);
    setRecarga((actual) => actual + 1);
  }

  async function guardarActividad(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando || !puedeGestionar) return;
);
      const numero = Number(normalizado);
      if (!patron.test(normalizado) || !Number.isFinite(numero) || numero < minimo ||
          (maximo !== undefined && numero > maximo)) {
        errores[campo] = `Ingresá un número válido de al menos ${minimo}${maximo === undefined ? '' : ` y como máximo ${maximo}`}, con hasta ${decimales} decimales.`;
        return null;
      }
      return numero;
    };
    const nombre = valor('nombre');
    if (!nombre) errores.nombre = 'El nombre de la actividad es obligatorio.';
    if (nombre.length > 180) errores.nombre = 'El nombre no debe superar 180 caracteres.';
    const fechaInicio = valor('fechaInicio');
    const fechaFin = valor('fechaFin');
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      errores.fechaFin = 'La finalización no puede ser anterior al inicio previsto.';
    }
    const metaCantidad = leerNumero('metaCantidad', 3, 0.001, 99999999999);
    const unidadMedida = valor('unidadMedida');
    if (metaCantidad !== null && !unidadMedida) errores.unidadMedida = 'Indicá la unidad de la meta (ej. viviendas).';
    if (metaCantidad === null && unidadMedida && !errores.metaCantidad)
      errores.metaCantidad = 'Indicá una meta cuantificable o quitá la unidad de medida.';
    const presupuestoEstimado = leerNumero('presupuestoEstimado', 2, 0, presupuestoProyecto);
    const pesoResultado = leerNumero('pesoResultado', 2, 0, 100);
    // Mensajes nativos reemplazados por avisos visibles; incluye longitud máxima y fechas.
    for (const elemento of Array.from(formulario.elements)) {
      if (!(elemento instanceof HTMLInputElement || elemento instanceof HTMLSelectElement ||
        elemento instanceof HTMLTextAreaElement)) continue;
      if (!elemento.name || errores[elemento.name] || elemento.checkValidity()) continue;
      errores[elemento.name] = elemento.validationMessage || 'Revisá este campo.';
    }
    setErroresCamposPlan(errores);
    if (Object.keys(errores).length) {
      setErrorPlanificacion('Revisá los campos señalados. La actividad todavía no se ha guardado.');
      const primero = formulario.elements.namedItem(Object.keys(errores)[0]);
      if (primero instanceof HTMLElement) primero.focus();
      return;
    }
    setGuardando(true);
    setError('');
    setErrorPlanificacion('');
    setMensaje('');
    try {
      await guardarActividadProyecto(token, proyectoId, {
        nombre,
        descripcion: valor('descripcion'),
        estado: valor('estado'),
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null,
        responsableAsignadoId: valor('responsableAsignadoId') || null,
        metaCantidad,
        unidadMedida: unidadMedida || null,
        presupuestoEstimado,
        pesoResultado,
      }, formularioActividad !== 'nueva' ? formularioActividad?.id : undefined);
      setMensaje(formularioActividad === 'nueva' ? 'Actividad planificada.' : 'Plan de actividad actualizado.');
      setFormularioActividad(null);
      setErrorPlanificacion('');
      setErroresCamposPlan({});
      refrescar();
    } catch (fallo) {
      const mensajeError = fallo instanceof Error ? fallo.message : 'No fue posible guardar la planificación.';
      setErrorPlanificacion(mensajeError);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarAvance(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!avanceFormulario || guardando ||
        (!puedeRegistrarAvance && !(avanceFormulario.corregir && puedeCorregirAvance))) return;
    const campos = new FormData(evento.currentTarget);
    const meta = avanceFormulario.actividad.metaCantidad;
    const datos: DatosAvanceActividadProyecto = {
      cantidadReportada: meta === null ? null : Number(campos.get('cantidadReportada')),
      porcentajeAvance: meta === null ? Number(campos.get('porcentajeAvance')) : null,
      fecha: String(campos.get('fecha') ?? ''),
      descripcion: String(campos.get('descripcion') ?? ''),
      observaciones: String(campos.get('observaciones') ?? '').trim() || null,
      claveIdempotencia,
    };
    const motivoCorreccion = String(campos.get('motivoCorreccion') ?? '').trim();
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      if (avanceFormulario.corregir && avanceFormulario.avance) {
        await corregirAvanceValidadoProyecto(
          token, proyectoId, avanceFormulario.actividad.id, avanceFormulario.avance.id, datos, motivoCorreccion,
        );
        setMensaje('Corrección enviada a revisión; el valor anterior permanece en el historial.');
      } else if (avanceFormulario.avance) {
        await editarAvanceActividadProyecto(
          token, proyectoId, avanceFormulario.actividad.id, avanceFormulario.avance.id, datos,
        );
        setMensaje('Borrador actualizado.');
      } else {
        await registrarAvanceActividadProyecto(token, proyectoId, avanceFormulario.actividad.id, datos);
        setMensaje('Borrador guardado. Envíalo a revisión cuando esté listo.');
      }
      setAvanceFormulario(null);
      if (!avanceFormulario.avance) setClaveIdempotencia(nuevaClaveIdempotencia());
      refrescar();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible guardar el avance.');
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutarAccion(
    actividad: ActividadProyecto,
    avance: AvanceActividadProyecto,
    accion: 'enviar' | 'validar' | 'devolver',
    motivo?: string,
  ) {
    if (guardando) return;
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      if (accion === 'enviar') {
        await enviarAvanceActividadProyecto(token, proyectoId, actividad.id, avance.id);
        setMensaje('Avance enviado a revisión.');
      } else {
        await revisarAvanceActividadProyecto(token, proyectoId, actividad.id, avance.id, accion, motivo);
        setMensaje(accion === 'validar' ? 'Avance validado.' : 'Avance devuelto con observaciones.');
      }
      setDevolucion(null);
      refrescar();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible actualizar el estado del avance.');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarDevolucion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!devolucion) return;
    const motivo = String(new FormData(evento.currentTarget).get('motivo') ?? '').trim();
    await ejecutarAccion(devolucion.actividad, devolucion.avance, 'devolver', motivo);
  }

  function formularioActividadUI(actividad: ActividadProyecto | null) {
    return (
      <form className="actividad-plan-form" onSubmit={guardarActividad} noValidate
        onChange={() => { if (errorPlanificacion) setErrorPlanificacion(''); }}>
        <fieldset disabled={guardando}>
          <legend>{actividad ? 'Editar planificación' : 'Nueva actividad'}</legend>
          {errorPlanificacion && <p className="actividad-plan-form__error" role="alert">{errorPlanificacion}</p>}
          <div className="donantes-campos">
            <label>Nombre<input name="nombre" required maxLength={180} defaultValue={actividad?.nombre}
                aria-invalid={Boolean(erroresCamposPlan.nombre)} />
              {erroresCamposPlan.nombre && <small className="actividad-plan-form__campo-error">{erroresCamposPlan.nombre}</small>}</label>
            <label>Responsable asignado
              <select name="responsableAsignadoId" defaultValue={actividad?.responsableAsignadoId ?? ''}>
                <option value="">Sin asignar</option>
                {responsables.map((responsable) => (
                  <option key={responsable.id} value={responsable.id}>{responsable.nombre}</option>
                ))}
              </select>
            </label>
            <label>Inicio previsto<input name="fechaInicio" type="date" defaultValue={actividad?.fechaInicio ?? ''} /></label>
            <label>Finalización prevista<input name="fechaFin" type="date" defaultValue={actividad?.fechaFin ?? ''}
                aria-invalid={Boolean(erroresCamposPlan.fechaFin)} />
              {erroresCamposPlan.fechaFin && <small className="actividad-plan-form__campo-error">{erroresCamposPlan.fechaFin}</small></label>
            <label>Meta cuantificable (opcional)
              <input name="metaCantidad" type="text" inputMode="decimal" defaultValue={actividad?.metaCantidad ?? ''}
                aria-invalid={Boolean(erroresCamposPlan.metaCantidad)} placeholder="Ej. 3 o 3,5" />
              {erroresCamposPlan.metaCantidad && <small className="actividad-plan-form__campo-error">{erroresCamposPlan.metaCantidad}</small>}
            </label>
            <label>Unidad de medida
              <input name="unidadMedida" maxLength={80} placeholder="Ej. viviendas, talleres" defaultValue={actividad?.unidadMedida ?? ''}
                aria-invalid={Boolean(erroresCamposPlan.unidadMedida)} />
              {erroresCamposPlan.unidadMedida && <small className="actividad-plan-form__campo-error">{erroresCamposPlan.unidadMedida}</small>}
            </label>
            <label>Asignación estimada ({moneda})
              <input name="presupuestoEstimado" type="text" inputMode="decimal" defaultValue={actividad?.presupuestoEstimado ?? ''}
                aria-invalid={Boolean(erroresCamposPlan.presupuestoEstimado)} placeholder="Ej. 10000,50" />
              {erroresCamposPlan.presupuestoEstimado && <small className="actividad-plan-form__campo-error">{erroresCamposPlan.presupuestoEstimado}</small>}
            </label>
            <label>Peso para el resultado del proyecto (%)
              <input name="pesoResultado" type="text" inputMode="decimal" defaultValue={actividad?.pesoResultado ?? ''}
                aria-invalid={Boolean(erroresCamposPlan.pesoResultado)} placeholder="Ej. 9,56" />
              {erroresCamposPlan.pesoResultado && <small className="actividad-plan-form__campo-error">{erroresCamposPlan.pesoResultado}</small>
            </label>
            <label>Estado operativo
              <select name="estado" defaultValue={actividad?.estado ?? 'PLANIFICADA'}>
                {Object.entries(estadosActividad).map(([codigo, etiqueta]) => (
                  <option key={codigo} value={codigo}>{etiqueta}</option>
                ))}
              </select>
            </label>
            <label className="actividad-plan-form__descripcion">Descripción
              <textarea name="descripcion" maxLength={3000} defaultValue={actividad?.descripcion ?? ''} />
            </label>
          </div>
          <p>La asignación es parte del presupuesto total del proyecto; los pesos se normalizan entre actividades y no representan dinero.</p>
          <div className="actividad-avance-form__acciones">
            <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar planificación'}</button>
            <button type="button" className="brigadas-accion" disabled={guardando}
              onClick={() => { setFormularioActividad(null); setErrorPlanificacion(''); setErroresCamposPlan({}); }}>Cancelar</button>
          </div>
        </fieldset>
      </form>
    );
  }

  function formularioAvanceUI(actividad: ActividadProyecto, avance?: AvanceActividadProyecto, corregir = false) {
    return (
      <form key={avance?.id ?? `${actividad.id}-nuevo`} className="actividad-avance-form" onSubmit={guardarAvance}>
        <fieldset disabled={guardando}>
          <legend>{corregir ? 'Corregir avance validado' : avance ? 'Editar avance' : 'Registrar avance'}</legend>
          <div className="donantes-campos">
            {actividad.metaCantidad !== null ? (
              <label>Cantidad ejecutada en este avance (incremental)
                <input name="cantidadReportada" type="number" min="0.001" step="0.001"
                  defaultValue={avance?.cantidadReportada ?? ''} required />
              </label>
            ) : (
              <label>Estimación acumulada de ejecución (%)
                <input name="porcentajeAvance" type="number" min="0" max="100" step="0.01"
                  defaultValue={avance?.porcentajeAvance ?? ''} required />
              </label>
            )}
            <label>Fecha de ejecución
              <input name="fecha" type="date" defaultValue={avance?.fecha ?? fechaLocalHoy()} required />
            </label>
            <label>Descripción del trabajo
              <textarea name="descripcion" maxLength={3000} defaultValue={avance?.descripcion ?? ''} required />
            </label>
            <label>Observaciones{actividad.metaCantidad === null ? ' / justificación de la estimación' : ''}
              <textarea name="observaciones" maxLength={3000}
                defaultValue={avance?.observaciones ?? ''} required={actividad.metaCantidad === null} />
            </label>
            {corregir && (
              <label>Motivo de corrección
                <textarea name="motivoCorreccion" maxLength={3000} minLength={3} required />
              </label>
            )}
          </div>
          <p>El usuario de la sesión queda como responsable del registro. Un avance guardado como borrador no afecta resultados.</p>
          <div className="actividad-avance-form__acciones">
            <button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : corregir ? 'Guardar corrección y enviar' : avance ? 'Guardar cambios' : 'Guardar borrador'}
            </button>
            <button type="button" className="brigadas-accion" disabled={guardando}
              onClick={() => setAvanceFormulario(null)}>Cancelar</button>
          </div>
        </fieldset>
      </form>
    );
  }

  function tarjetaActividad(actividad: ActividadProyecto, vistaActiva: 'planificacion' | 'ejecucion') {
    return (
      <article className="brigadas-tarjeta actividad-detalle" key={actividad.id}>
        <header className="actividad-detalle__encabezado">
          <div>
            <h4>{actividad.nombre}</h4>
            <span className="pagina-modulo__estado">{estadosActividad[actividad.estado] ?? actividad.estado}</span>
          </div>
          {vistaActiva === 'ejecucion' && actividad.metaCantidad !== null && (
            <strong>{actividad.cantidadValidada} / {actividad.metaCantidad} {actividad.unidadMedida}</strong>
          )}
        </header>
        <p>{actividad.fechaInicio ?? 'Inicio por definir'}{actividad.fechaFin && ` · Fin ${actividad.fechaFin}`}</p>
        {actividad.descripcion && <p>{actividad.descripcion}</p>}
        {vistaActiva === 'planificacion' ? (
          <>
            <dl className="actividad-plan-resumen">
              <div><dt>Responsable</dt><dd>{actividad.responsableAsignado ?? 'Sin asignar'}</dd></div>
              <div><dt>Meta</dt><dd>{actividad.metaCantidad === null ? 'No cuantificable' : `${actividad.metaCantidad} ${actividad.unidadMedida}`}</dd></div>
              <div><dt>Recursos</dt><dd>{actividad.presupuestoEstimado === null ? 'Sin asignación' : `${actividad.presupuestoEstimado.toLocaleString('es-HN')} ${moneda}`}</dd></div>
              <div><dt>Peso</dt><dd>{actividad.pesoResultado === null ? 'Pendiente' : `${actividad.pesoResultado}%`}</dd></div>
            </dl>
            {puedeGestionar && !formularioActividad && (
              <button type="button" className="brigadas-accion" onClick={() => { setFormularioActividad(actividad); setErrorPlanificacion(''); setErroresCamposPlan({}); }}>
                Editar planificación
              </button>
            )}
          </>
        ) : (
          <>
            <section className="actividad-avances" aria-label={`Historial de avances de ${actividad.nombre}`}>
              <header className="actividad-avances__encabezado"><h5>Registro de ejecución</h5><span>{actividad.avances.length}</span></header>
              {!actividad.avances.length && <p className="actividad-avances__vacio">Aún no hay avances registrados.</p>}
              <ol className="actividad-avances__lista">
                {actividad.avances.map((avance) => (
                  <li key={avance.id} className={`actividad-avance actividad-avance--${avance.estadoRevision.toLowerCase()}`}>
                    <div className="actividad-avances__detalle">
                      <strong>{avance.cantidadReportada !== null
                        ? `${avance.cantidadReportada} ${actividad.unidadMedida}`
                        : `${avance.porcentajeAvance ?? 0}%`}</strong>
                      <time dateTime={avance.fecha}>{avance.fecha}</time>
                    </div>
                    <span className="actividad-avance__estado">{estadosRevision[avance.estadoRevision]}</span>
                    <p>{avance.descripcion}</p>
                    {avance.observaciones && <p><strong>Observaciones:</strong> {avance.observaciones}</p>}
                    <span>Responsable · {avance.responsable ?? 'No identificado'}</span>
                    {avance.estadoRevision === 'DEVUELTO' && avance.motivoDevolucion && (
                      <p className="actividad-avance__devolucion"><strong>Devolución:</strong> {avance.motivoDevolucion}</p>
                    )}
                    {avance.revisor && <span>Revisó · {avance.revisor}{avance.revisadoEn && ` · ${avance.revisadoEn}`}</span>}
                    <details className="actividad-avance__historial">
                      <summary>Historial de cambios y validaciones</summary>
                      <ol>
                        {avance.historial.map((evento, indice) => (
                          <li key={`${evento.fecha}-${indice}`}>
                            <strong>{evento.accion.replaceAll('_', ' ')}</strong>
                            <span>{evento.actor ?? 'Sistema'} · {new Date(evento.fecha).toLocaleString('es-HN')}</span>
                          </li>
                        ))}
                      </ol>
                    </details>
                    <div className="actividad-avance__acciones">
                      {puedeRegistrarAvance && avance.responsable === usuarioEmail &&
                        ['BORRADOR', 'DEVUELTO'].includes(avance.estadoRevision) && (
                          <>
                            <button type="button" className="brigadas-accion"
                              onClick={() => setAvanceFormulario({ actividad, avance })}>Editar</button>
                            <button type="button" className="brigadas-accion" disabled={guardando}
                              onClick={() => void ejecutarAccion(actividad, avance, 'enviar')}>Enviar a revisión</button>
                          </>
                        )}
                      {puedeRevisarAvance && avance.estadoRevision === 'ENVIADO' && (
                          <>
                            <button type="button" disabled={guardando}
                              onClick={() => void ejecutarAccion(actividad, avance, 'validar')}>Validar</button>
                            <button type="button" className="brigadas-accion" disabled={guardando}
                              onClick={() => setDevolucion({ actividad, avance })}>Devolver</button>
                          </>
                        )}
                      {puedeCorregirAvance && avance.estadoRevision === 'VALIDADO' && (
                        <button type="button" className="brigadas-accion"
                          onClick={() => setAvanceFormulario({ actividad, avance, corregir: true })}>
                          Corregir con motivo
                        </button>
                      )}
                    </div>
                    {devolucion?.avance.id === avance.id && (
                      <form className="actividad-devolucion-form" onSubmit={guardarDevolucion}>
                        <label>Motivo de devolución
                          <textarea name="motivo" minLength={1} maxLength={3000} required />
                        </label>
                        <button type="submit" disabled={guardando}>Confirmar devolución</button>
                        <button type="button" className="brigadas-accion" disabled={guardando}
                          onClick={() => setDevolucion(null)}>Cancelar</button>
                      </form>
                    )}
                  </li>
                ))}
              </ol>
            </section>
            {puedeRegistrarAvance && !avanceFormulario && (
              <button type="button" className="brigadas-accion"
                onClick={() => { setClaveIdempotencia(nuevaClaveIdempotencia()); setAvanceFormulario({ actividad }); }}>
                + Registrar avance
              </button>
            )}
            {avanceFormulario?.actividad.id === actividad.id && (
              <div>{formularioAvanceUI(actividad, avanceFormulario.avance, avanceFormulario.corregir)}</div>
            )}
          </>
        )}
      </article>
    );
  }

  return (
    <section className="proyecto-detalle" aria-label="Detalle del proyecto">
      {error && <p role="alert">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      {!actividades && !error && <p role="status">Cargando detalle del proyecto…</p>}
      {!actividades && error && (
        <button type="button" className="brigadas-accion" onClick={() => { setError(''); refrescar(); }}>
          Volver a cargar
        </button>
      )}
      {actividades && (
        <>
          <div className="proyecto-detalle__pestanas" role="tablist" aria-label="Secciones del proyecto">
            {([
              ['planificacion', 'Planificación'],
              ['ejecucion', 'Ejecución'],
              ['resultados', 'Resultados'],
            ] as const).map(([id, etiqueta]) => (
              <button key={id} type="button" role="tab" id={`proyecto-tab-${id}`}
                aria-selected={vista === id} aria-controls={`proyecto-panel-${id}`}
                tabIndex={vista === id ? 0 : -1} onClick={() => setVista(id)}>
                {etiqueta}
              </button>
            ))}
          </div>
          <section id={`proyecto-panel-${vista}`} role="tabpanel"
            aria-labelledby={`proyecto-tab-${vista}`} className="proyecto-detalle__panel">
            {vista === 'planificacion' && (
              <>
                <header className="proyecto-detalle__resumen">
                  <h3>Planificación</h3>
                  {puedeGestionar && !formularioActividad && (
                    <button type="button" className="brigadas-accion"
                      onClick={() => { setFormularioActividad('nueva'); setErrorPlanificacion(''); setErroresCamposPlan({}); }}>+ Nueva actividad</button>
                  )}
                </header>
                <p>El presupuesto por actividad es una asignación estimada dentro del presupuesto del proyecto.</p>
                {formularioActividad !== null && formularioActividad !== 'nueva' && formularioActividadUI(formularioActividad)}
                {formularioActividad === 'nueva' && formularioActividadUI(null)}
                {!actividades.length && <p>Todavía no hay actividades planificadas.</p>}
                <div className="proyecto-detalle__lista">
                  {actividades.map((actividad) => tarjetaActividad(actividad, 'planificacion'))}
                </div>
              </>
            )}
            {vista === 'ejecucion' && (
              <>
                <h3>Ejecución</h3>
                <p>Las cantidades son incrementales. Las estimaciones no cuantificables son acumuladas y justificadas.</p>
                <div className="proyecto-detalle__lista">
                  {actividades.map((actividad) => tarjetaActividad(actividad, 'ejecucion'))}
                </div>
              </>
            )}
            {vista === 'resultados' && (
              <>
                <h3>Resultados</h3>
                <article className="resultado-proyecto">
                  <span>Avance ponderado del proyecto</span>
                  <strong>{porcentajeProyecto === null ? 'Pendiente de ponderación' : `${porcentajeProyecto.toLocaleString('es-HN', { maximumFractionDigits: 2 })}%`}</strong>
                  <p>Peso configurado: {pesoConfigurado.toLocaleString('es-HN', { maximumFractionDigits: 2 })}. Las actividades canceladas conservan su peso con resultado cero.</p>
                </article>
                {!actividades.length && <p>El proyecto todavía no tiene actividades.</p>}
                <div className="proyecto-detalle__lista">
                  {actividades.map((actividad) => (
                    <article className="brigadas-tarjeta resultado-actividad" key={actividad.id}>
                      <h4>{actividad.nombre}</h4>
                      <span className="pagina-modulo__estado">{estadosActividad[actividad.estado] ?? actividad.estado}</span>
                      {actividad.metaCantidad === null ? (
                        <p>Estimación validada · {actividad.porcentajeResultado}%</p>
                      ) : (
                        <p>Meta · {actividad.cantidadValidada} / {actividad.metaCantidad} {actividad.unidadMedida}</p>
                      )}
                      <label>Avance físico
                        <progress value={actividad.porcentajeResultado} max={100} />
                        <strong>{actividad.porcentajeResultado.toLocaleString('es-HN', { maximumFractionDigits: 2 })}%</strong>
                      </label>
                      <p>Peso del proyecto · {actividad.pesoResultado ?? 'Pendiente'}</p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
