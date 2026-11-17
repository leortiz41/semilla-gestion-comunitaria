import { useEffect, useState, type FormEvent } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

type Proyecto = {
  id: string;
  nombre: string;
  comunidadId: string;
  comunidad: string;
};
type Perfil = {
  id: string;
  familiaId: string;
  proyectoId: string;
  proyecto: string;
  numeroIntegrantes: number;
  nivelRiesgo: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  numeroHabitaciones: number;
  areaUtilConstruccion: number | null;
  tipoVivienda: string | null;
  ingresoMensual: number | null;
  observaciones: string | null;
  condicionTerreno: string | null;
  tieneElectricidad: boolean | null;
  tieneAgua: boolean | null;
  tienePila: boolean | null;
  tieneFosa: boolean | null;
  estadoCivil: string | null;
  telefonoContacto: string | null;
  fuenteIngresos: string | null;
  estado: 'PENDIENTE' | 'EVALUADO' | 'SELECCIONADO' | 'DESCARTADO' | 'FINALIZADO';
  fechaPerfil: string;
  motivoRevision: string | null;
};
type Formulario = {
  proyectoId: string;
  numeroIntegrantes: number;
  nivelRiesgo: Perfil['nivelRiesgo'];
  numeroHabitaciones: number;
  areaUtilConstruccion: string;
  tipoVivienda: string;
  ingresoMensual: string;
  observaciones: string;
  condicionTerreno: string;
  tieneElectricidad: string;
  tieneAgua: string;
  tienePila: string;
  tieneFosa: string;
  estadoCivil: string;
  telefonoContacto: string;
  fuenteIngresos: string;
};
const inicial: Formulario = {
  proyectoId: '', numeroIntegrantes: 1, nivelRiesgo: 'MEDIO', numeroHabitaciones: 0,
  areaUtilConstruccion: '', tipoVivienda: '', ingresoMensual: '', observaciones: '',
  condicionTerreno: '', tieneElectricidad: '', tieneAgua: '', tienePila: '',
  tieneFosa: '', estadoCivil: '', telefonoContacto: '', fuenteIngresos: '',
};
const estados: Record<Perfil['estado'], string> = {
  PENDIENTE: 'Pendiente de evaluación', EVALUADO: 'Evaluado',
  SELECCIONADO: 'Seleccionado para apoyo', DESCARTADO: 'No seleccionado',
  FINALIZADO: 'Vivienda entregada / expediente finalizado',
};
const siNo = (v: string) => v === '' ? null : v === 'si';
const aSiNo = (v: boolean | null) => v === null ? '' : v ? 'si' : 'no';

async function pedir<T>(ruta: string, token: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`${API}/familias${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opciones.headers },
    cache: 'no-store',
  });
  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({})) as { message?: string };
    throw new Error(error.message || 'Error consultando el expediente.');
  }
  return respuesta.json() as Promise<T>;
}

export default function EvaluacionFamilia({
  token, familiaId, comunidadId, nombreFamilia, puedeGestionar, onCerrar, onActualizacion,
}: {
  token: string;
  familiaId: string;
  comunidadId: string;
  nombreFamilia: string;
  puedeGestionar: boolean;
  onCerrar: () => void;
  onActualizacion: () => void;
}) {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  useEffect(() => {
    let vigente = true;
    setError('');
    setCargando(true);
    Promise.all([
      pedir<{ perfiles: Perfil[] }>(`/${familiaId}/perfiles`, token),
      pedir<{ proyectos: Proyecto[] }>('/opciones/proyectos', token),
    ]).then(([datos, opciones]) => {
      if (!vigente) return;
      setPerfiles(datos.perfiles);
      setProyectos(opciones.proyectos.filter((p) => p.comunidadId === comunidadId));
    }).catch((e: Error) => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [familiaId, comunidadId, token, recarga]);

  function editar(perfil?: Perfil) {
    setError('');
    setFormulario(perfil ? {
      proyectoId: perfil.proyectoId,
      numeroIntegrantes: perfil.numeroIntegrantes,
      nivelRiesgo: perfil.nivelRiesgo,
      numeroHabitaciones: perfil.numeroHabitaciones,
      areaUtilConstruccion: perfil.areaUtilConstruccion?.toString() ?? '',
      tipoVivienda: perfil.tipoVivienda ?? '',
      ingresoMensual: perfil.ingresoMensual?.toString() ?? '',
      observaciones: perfil.observaciones ?? '',
      condicionTerreno: perfil.condicionTerreno ?? '',
      tieneElectricidad: aSiNo(perfil.tieneElectricidad),
      tieneAgua: aSiNo(perfil.tieneAgua),
      tienePila: aSiNo(perfil.tienePila),
      tieneFosa: aSiNo(perfil.tieneFosa),
      estadoCivil: perfil.estadoCivil ?? '',
      telefonoContacto: perfil.telefonoContacto ?? '',
      fuenteIngresos: perfil.fuenteIngresos ?? '',
    } : { ...inicial, proyectoId: proyectos[0]?.id ?? '' });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!formulario || !formulario.proyectoId || guardando) return;
    setGuardando(true); setError(''); setMensaje('');
    try {
      await pedir(`/${familiaId}/perfiles/${formulario.proyectoId}`, token, {
        method: 'PUT',
        body: JSON.stringify({
          ...formulario,
          areaUtilConstruccion: formulario.areaUtilConstruccion === '' ? null : Number(formulario.areaUtilConstruccion),
          ingresoMensual: formulario.ingresoMensual === '' ? null : Number(formulario.ingresoMensual),
          tieneElectricidad: siNo(formulario.tieneElectricidad),
          tieneAgua: siNo(formulario.tieneAgua),
          tienePila: siNo(formulario.tienePila),
          tieneFosa: siNo(formulario.tieneFosa),
        }),
      });
      setFormulario(null);
      setMensaje('Evaluación guardada como pendiente. Requiere revisión antes de seleccionar a la familia.');
      setRecarga((n) => n + 1);
      onActualizacion();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    finally { setGuardando(false); }
  }

  async function revisar(perfil: Perfil, estado: Perfil['estado']) {
    if (guardando) return;
    setGuardando(true); setError(''); setMensaje('');
    try {
      await pedir(`/${familiaId}/perfiles/${perfil.id}/revisar`, token, {
        method: 'POST', body: JSON.stringify({ estado, motivo: motivos[perfil.id] ?? '' }),
      });
      setMensaje('Estado de evaluación actualizado.');
      setRecarga((n) => n + 1);
      onActualizacion();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo revisar.'); }
    finally { setGuardando(false); }
  }

  const campo = (nombre: keyof Formulario, valor: string | number) =>
    setFormulario((actual) => actual ? { ...actual, [nombre]: valor } : null);

  return (
    <div className="familias-modal-fondo" role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <section className="familias-modal familias-modal--amplio" role="dialog" aria-modal="true"
        aria-labelledby="perfil-familia-titulo">
        <header>
          <div>
            <span className="familias-tarjeta__etiqueta">Expediente de vivienda</span>
            <h2 id="perfil-familia-titulo">{nombreFamilia}</h2>
          </div>
          <button type="button" onClick={onCerrar}>Cerrar ×</button>
        </header>
        <p className="familias-nota">La evaluación se vincula al proyecto y a la comunidad de la familia.
          El registro no otorga automáticamente una vivienda.</p>
        {error && <p role="alert" className="familias-error">{error}</p>}
        {mensaje && <p role="status" className="familias-aviso">{mensaje}</p>}
        {cargando && <p role="status">Cargando evaluaciones…</p>}
        {!cargando && !perfiles.length && <p>Aún no hay evaluaciones registradas para esta familia.</p>}

        <div className="familias-lista">
          {perfiles.map((p) => (
            <article className="familias-tarjeta" key={p.id}>
              <header><div><h3>{p.proyecto}</h3><small>{p.fechaPerfil}</small></div>
                <span className="familias-estado">{estados[p.estado]}</span></header>
              <dl>
                <div><dt>Integrantes</dt><dd>{p.numeroIntegrantes}</dd></div>
                <div><dt>Ingreso mensual</dt><dd>{p.ingresoMensual === null ? 'Pendiente' : `L ${p.ingresoMensual.toLocaleString('es-HN')}`}</dd></div>
                <div><dt>Riesgo</dt><dd>{p.nivelRiesgo}</dd></div>
              </dl>
              {p.observaciones && <p>{p.observaciones}</p>}
              {p.motivoRevision && <p>Motivo de revisión: {p.motivoRevision}</p>}
              {puedeGestionar && <div className="familias-acciones">
                {['PENDIENTE', 'EVALUADO'].includes(p.estado) && (
                  <button type="button" onClick={() => editar(p)}>Editar evaluación</button>)}
                {p.estado === 'PENDIENTE' && (
                  <button type="button" disabled={guardando}
                    onClick={() => void revisar(p, 'EVALUADO')}>Marcar evaluado</button>)}
                {p.estado === 'EVALUADO' && (
                  <button type="button" disabled={guardando}
                    onClick={() => void revisar(p, 'SELECCIONADO')}>Seleccionar familia</button>)}
                {p.estado === 'SELECCIONADO' && (
                  <button type="button" disabled={guardando}
                    onClick={() => void revisar(p, 'FINALIZADO')}>Registrar expediente finalizado</button>)}
                {['PENDIENTE','EVALUADO'].includes(p.estado) && (
                  <>
                    <input value={motivos[p.id] ?? ''} maxLength={2000}
                      aria-label={`Motivo de no selección de ${p.proyecto}`}
                      placeholder="Motivo de no selección"
                      onChange={(e) => setMotivos({ ...motivos, [p.id]: e.target.value })}/>
                    <button type="button" disabled={guardando || !motivos[p.id]?.trim()}
                      onClick={() => void revisar(p, 'DESCARTADO')}>No seleccionar</button>
                  </>
                )}
              </div>}
            </article>
          ))}
        </div>

        {puedeGestionar && !formulario && proyectos.length > 0 && (
          <button className="familias-boton-principal" type="button" onClick={() => editar()}>
            + Nueva evaluación de vivienda
          </button>
        )}

        {formulario && <form className="familias-evaluacion" onSubmit={(e) => void guardar(e)}>
          <h3>Evaluación socioeconómica y habitacional</h3>
          <label>Proyecto de vivienda *
            <select required value={formulario.proyectoId}
              onChange={(e) => campo('proyectoId', e.target.value)}>
              <option value="">Seleccionar proyecto</option>
              {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <div className="familias-campos-dos">
            <label>Número de integrantes *
              <input type="number" min={1} max={100} required value={formulario.numeroIntegrantes}
                onChange={(e) => campo('numeroIntegrantes', Number(e.target.value))}/>
            </label>
            <label>Nivel de riesgo *
              <select value={formulario.nivelRiesgo}
                onChange={(e) => campo('nivelRiesgo', e.target.value)}>
                <option value="BAJO">Bajo</option><option value="MEDIO">Medio</option>
                <option value="ALTO">Alto</option><option value="CRITICO">Crítico</option>
              </select>
            </label>
            <label>Habitaciones actuales
              <input type="number" min={0} max={50} required value={formulario.numeroHabitaciones}
                onChange={(e) => campo('numeroHabitaciones', Number(e.target.value))}/>
            </label>
            <label>Área útil estimada (m²)
              <input type="number" min={0} step=".01" value={formulario.areaUtilConstruccion}
                onChange={(e) => campo('areaUtilConstruccion', e.target.value)}/>
            </label>
            <label>Ingreso mensual estimado (L)
              <input type="number" min={0} step=".01" value={formulario.ingresoMensual}
                onChange={(e) => campo('ingresoMensual', e.target.value)}/>
            </label>
            <label>Fuente de ingresos
              <input maxLength={200} value={formulario.fuenteIngresos}
                onChange={(e) => campo('fuenteIngresos', e.target.value)}/>
            </label>
            <label>Tipo de vivienda actual
              <input maxLength={150} value={formulario.tipoVivienda}
                onChange={(e) => campo('tipoVivienda', e.target.value)}/>
            </label>
            <label>Condición del terreno
              <input maxLength={120} value={formulario.condicionTerreno}
                onChange={(e) => campo('condicionTerreno', e.target.value)}/>
            </label>
            <label>Estado civil (opcional)
              <input maxLength={80} value={formulario.estadoCivil}
                onChange={(e) => campo('estadoCivil', e.target.value)}/>
            </label>
            <label>Teléfono de contacto
              <input maxLength={50} value={formulario.telefonoContacto}
                onChange={(e) => campo('telefonoContacto', e.target.value)}/>
            </label>
          </div>
          <div className="familias-campos-dos">
            {([
              ['tieneElectricidad','Electricidad'],['tieneAgua','Agua'],
              ['tienePila','Pila de almacenamiento'],['tieneFosa','Fosa / saneamiento'],
            ] as const).map(([clave,etiqueta]) => (
              <label key={clave}>{etiqueta}
                <select value={formulario[clave]} onChange={(e) => campo(clave,e.target.value)}>
                  <option value="">Sin determinar</option>
                  <option value="si">Sí</option><option value="no">No</option>
                </select>
              </label>
            ))}
          </div>
          <label>Observaciones de campo
            <textarea rows={4} maxLength={3000} value={formulario.observaciones}
              onChange={(e) => campo('observaciones', e.target.value)}/>
          </label>
          <footer>
            <button type="button" disabled={guardando} onClick={() => setFormulario(null)}>Cancelar</button>
            <button type="submit" disabled={guardando} className="familias-boton-principal">
              {guardando ? 'Guardando…' : 'Guardar evaluación'}
            </button>
          </footer>
        </form>}
        <section className="familias-documentos-aviso" aria-label="Documentación de respaldo">
          <h3>Documentos PDF acreditativos</h3>
          <p>El expediente documental será privado. La carga y revisión de PDF quedará
            habilitada cuando resolvamos el rechazo de subida de Cloudflare R2;
            no se aceptarán documentos sin confirmar su almacenamiento.</p>
        </section>
      </section>
    </div>
  );
}
