import { type FormEvent, useEffect, useState } from 'react';
import {
  guardarVisionDesarrollo,
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
  const [metaDesarrollo, setMetaDesarrollo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    obtenerVisionesDesarrollo(tokenAcceso, comunidadId)
      .then(({ visiones: visionesRegistradas }) => {
        if (activo) setVisiones(visionesRegistradas);
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
  }, [comunidadId, tokenAcceso]);

  function iniciarEdicion(area: AreaVisionDesarrollo) {
    const vision = visiones.find((item) => item.area === area);
    setSituacionActual(vision?.situacionActual ?? '');
    setPrioridad(vision?.prioridad ?? null);
    setMetaDesarrollo(vision?.metaDesarrollo ?? '');
    setError(null);
    setMensaje(null);
    setAreaEditando(area);
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!areaEditando) return;

    setError(null);
    setMensaje(null);
    setGuardando(true);

    try {
      const { vision } = await guardarVisionDesarrollo(tokenAcceso, comunidadId, areaEditando, {
        situacionActual: situacionActual.trim() || null,
        prioridad,
        metaDesarrollo: metaDesarrollo.trim() || null,
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
        <p>Registra cada área por separado: su situación actual, prioridad y meta de desarrollo.</p>
      </div>

      {mensaje && <div className="pagina-zonas__aviso pagina-zonas__aviso--exito">{mensaje}</div>}
      {error && !areaEditando && <div className="pagina-zonas__aviso pagina-zonas__aviso--error">{error}</div>}

      {cargando ? (
        <span className="expediente-comunidad__estado-seccion">Cargando…</span>
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
                  {!estaEditando && (
                    <button
                      className="listado-comunidades__boton-editar"
                      type="button"
                      onClick={() => iniciarEdicion(area.id)}
                    >
                      {vision ? 'Editar' : 'Completar'}
                    </button>
                  )}
                </div>

                {estaEditando ? (
                  <form className="expediente-comunidad__formulario" onSubmit={guardar}>
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
                    <label className="expediente-comunidad__campo-texto">
                      Visión o meta de desarrollo
                      <textarea
                        rows={3}
                        value={metaDesarrollo}
                        onChange={(event) => setMetaDesarrollo(event.target.value)}
                        placeholder="¿Cómo espera la comunidad avanzar en esta área?"
                        maxLength={2000}
                      />
                    </label>
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
                  </form>
                ) : vision ? (
                  <div className="vision-desarrollo__contenido">
                    <span className="vision-desarrollo__prioridad">Prioridad: {textoPrioridad(vision.prioridad)}</span>
                    <p><strong>Situación actual:</strong> {vision.situacionActual || 'Sin registrar'}</p>
                    <p><strong>Meta:</strong> {vision.metaDesarrollo || 'Sin registrar'}</p>
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
