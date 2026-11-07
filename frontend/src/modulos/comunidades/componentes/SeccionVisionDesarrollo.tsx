import { type FormEvent, useEffect, useState } from 'react';
import {
  guardarVisionDesarrollo,
  obtenerUsuario,
  obtenerVisionesDesarrollo,
  type AreaVisionDesarrollo,
  type VisionDesarrolloComunitaria,
} from '../../../lib/api';

interface PropiedadesSeccionVisionDesarrollo {
  comunidadId: string;
  tokenAcceso: string;
}

const areas: Array<{ id: AreaVisionDesarrollo; nombre: string; descripcion: string }> = [
  {
    id: 'EVANGELISMO',
    nombre: 'Evangelismo',
    descripcion: 'Necesidades y metas para el acompañamiento espiritual de la comunidad.',
  },
  {
    id: 'EDUCACION_FORMAL',
    nombre: 'Educación formal',
    descripcion: 'Situación y proyección de la educación escolar.',
  },
  {
    id: 'EDUCACION_COMUNITARIA',
    nombre: 'Educación comunitaria',
    descripcion: 'Formación, talleres y aprendizajes que fortalecen a la comunidad.',
  },
  {
    id: 'INFRAESTRUCTURA',
    nombre: 'Infraestructura',
    descripcion: 'Condiciones, necesidades y metas de infraestructura comunitaria.',
  },
];

function textoPrioridad(prioridad: VisionDesarrolloComunitaria['prioridad']) {
  if (!prioridad) return 'Sin prioridad definida';
  return prioridad.charAt(0) + prioridad.slice(1).toLowerCase();
}

function SeccionVisionDesarrollo({ comunidadId, tokenAcceso }: PropiedadesSeccionVisionDesarrollo) {
  const [visiones, setVisiones] = useState<VisionDesarrolloComunitaria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [areaEditando, setAreaEditando] = useState<AreaVisionDesarrollo | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [situacionActual, setSituacionActual] = useState('');
  const [prioridad, setPrioridad] = useState<VisionDesarrolloComunitaria['prioridad']>(null);
  const [metas, setMetas] = useState<VisionDesarrolloComunitaria['metas']>([]);
  const [revision, setRevision] = useState(0);
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [cargaCompleta, setCargaCompleta] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    setCargando(true);
    setCargaCompleta(false);
    setAreaEditando(null);
    setError(null);
    setMensaje(null);
    Promise.all([obtenerVisionesDesarrollo(tokenAcceso, comunidadId), obtenerUsuario(tokenAcceso)])
      .then(([{visiones: visionesRegistradas}, {usuario}]) => {
        if (activo) { setVisiones(visionesRegistradas); setPuedeEditar(usuario.permisos.includes('comunidades.gestionar')); setCargaCompleta(true); }
      })
      .catch((err) => {
        if (activo) {
          setError(err instanceof Error ? err.message : 'No fue posible cargar esta sección.');
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [comunidadId, tokenAcceso, recarga]);

  function iniciarEdicion(area: AreaVisionDesarrollo) {
    const vision = visiones.find((item) => item.area === area);
    setSituacionActual(vision?.situacionActual ?? '');
    setPrioridad(vision?.prioridad ?? null);
    setMetas(vision?.metas ?? []);
    setRevision(vision?.revision ?? 0);
    setError(null);
    setMensaje(null);
    setAreaEditando(area);
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!areaEditando || guardando) return;
    const limpias = metas.map(m => ({...m, descripcion: m.descripcion.trim()}));
    if (limpias.some(m => !m.descripcion) || new Set(limpias.map(m => m.descripcion.toLocaleLowerCase('es'))).size !== limpias.length) {
      setError('Completa cada meta y evita descripciones repetidas.'); return;
    }

    setError(null);
    setMensaje(null);
    setGuardando(true);

    try {
      const { vision } = await guardarVisionDesarrollo(tokenAcceso, comunidadId, areaEditando, {
        situacionActual: situacionActual.trim() || null,
        prioridad,
        metaDesarrollo: null,
        metas: limpias,
        revision,
      });

      setVisiones((actuales) => {
        const sinArea = actuales.filter((item) => item.area !== vision.area);
        return [...sinArea, vision];
      });
      setAreaEditando(null);
      setMensaje('Área de visión de desarrollo guardada correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar esta área.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <article className="expediente-comunidad__seccion expediente-comunidad__seccion--vision">
      <div>
        <p className="expediente-comunidad__etiqueta">03 · Planificación</p>
        <h2>Visión de desarrollo</h2>
        <p>Registra cada área por separado: su situación actual, prioridad y cada una de sus metas de desarrollo.</p>
      </div>

      {!areaEditando && !cargando && <button type="button" className="pagina-comunidades__boton-secundario vision-desarrollo__recargar" onClick={() => setRecarga(x => x+1)}>Actualizar sección</button>}
      {mensaje && <div className="pagina-zonas__aviso pagina-zonas__aviso--exito">{mensaje}</div>}
      {error && !areaEditando && <div className="pagina-zonas__aviso pagina-zonas__aviso--error">{error}</div>}

      {cargando ? (
        <span className="expediente-comunidad__estado-seccion">Cargando…</span>
      ) : !cargaCompleta ? (
        <button type="button" className="pagina-comunidades__boton-secundario" onClick={() => setRecarga(x => x+1)}>Reintentar</button>
      ) : (
        <div className="vision-desarrollo__areas">
          {areas.map((area) => {
            const vision = visiones.find((item) => item.area === area.id);
            const estaEditando = areaEditando === area.id;

            return (
              <section className="vision-desarrollo__area" key={area.id}>
                <div className="vision-desarrollo__encabezado">
                  <div>
                    <h3>{area.nombre}</h3>
                    <p>{area.descripcion}</p>
                  </div>
                  {!estaEditando && puedeEditar && (
                    <button
                      className="listado-comunidades__boton-editar"
                      type="button"
                      disabled={guardando || areaEditando !== null}
                      onClick={() => iniciarEdicion(area.id)}
                    >
                      {vision ? 'Editar' : 'Completar'}
                    </button>
                  )}
                </div>

                {estaEditando ? (
                  <form className="expediente-comunidad__formulario" onSubmit={guardar}>
                    <fieldset className="expediente-campos vision-desarrollo__campos" disabled={guardando}>
                    {error && <div className="pagina-zonas__aviso pagina-zonas__aviso--error">{error}</div>}
                    <label className="expediente-comunidad__campo-texto">
                      Situación actual
                      <textarea
                        rows={3}
                        value={situacionActual}
                        onChange={(event) => setSituacionActual(event.target.value)}
                        placeholder="Describe brevemente la situación actual."
                        maxLength={2000}
                      />
                    </label>
                    <label className="expediente-comunidad__campo-texto">
                      Prioridad
                      <select
                        value={prioridad ?? ''}
                        onChange={(event) => {
                          const valor = event.target.value;
                          setPrioridad(
                            valor === '' ? null : (valor as NonNullable<VisionDesarrolloComunitaria['prioridad']>),
                          );
                        }}
                      >
                        <option value="">Sin definir</option>
                        <option value="ALTA">Alta</option>
                        <option value="MEDIA">Media</option>
                        <option value="BAJA">Baja</option>
                      </select>
                    </label>
                    <fieldset className="vision-desarrollo__metas">
                      <legend>Metas de desarrollo <span className="capacidades-locales__contador">{metas.length}/50</span></legend>
                      <p>Registra una meta por tarjeta. Describe qué se espera lograr en esta área.</p>
                      {metas.map((meta, indice) => (
                        <div className="vision-desarrollo__meta" key={meta.id}>
                          <label className="expediente-comunidad__campo-texto">
                            Meta {indice + 1}
                            <textarea rows={3} required maxLength={2000} value={meta.descripcion}
                              placeholder="Ej. Construir un aula para ampliar la atención escolar."
                              onChange={e => setMetas(actuales => actuales.map(m => m.id === meta.id ? {...m, descripcion: e.target.value} : m))} />
                          </label>
                          <button type="button" className="vision-desarrollo__quitar" aria-label={`Quitar meta ${indice + 1}`}
                            onClick={() => setMetas(actuales => actuales.filter(m => m.id !== meta.id))}>Quitar meta</button>
                        </div>
                      ))}
                      {metas.length === 0 && <p>Sin metas registradas. Agrega la primera cuando cuentes con la información.</p>}
                      <button type="button" className="pagina-comunidades__boton-secundario" disabled={metas.length >= 50}
                        onClick={() => setMetas(actuales => [...actuales, {id: crypto.randomUUID(), descripcion: ''}])}>Agregar meta</button>
                      <small>Los cambios se aplican al guardar el área. Quitar una meta conserva su registro archivado.</small>
                    </fieldset>
                    <div className="expediente-comunidad__acciones-formulario">
                      <button className="pagina-comunidades__boton-nuevo" type="submit" disabled={guardando}>
                        {guardando ? 'Guardando…' : 'Guardar área'}
                      </button>
                      <button
                        className="pagina-comunidades__boton-secundario"
                        type="button"
                        disabled={guardando}
                        onClick={() => setAreaEditando(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                    </fieldset>
                  </form>
                ) : vision ? (
                  <div className="vision-desarrollo__contenido">
                    <span className="vision-desarrollo__prioridad">Prioridad: {textoPrioridad(vision.prioridad)}</span>
                    <p><strong>Situación actual:</strong> {vision.situacionActual || 'Sin registrar'}</p>
                    <div className="vision-desarrollo__metas-lectura">
                      <h4>Metas de desarrollo ({vision.metas.length})</h4>
                      {vision.metas.length ? <ol>{vision.metas.map(meta => <li key={meta.id}>{meta.descripcion}</li>)}</ol> : <p>Sin metas registradas.</p>}
                    </div>
                  </div>
                ) : (
                  <span className="expediente-comunidad__estado-seccion">Sin datos registrados</span>
                )}
              </section>
            );
          })}
        </div>
      )}
    </article>
  );
}

export default SeccionVisionDesarrollo;
