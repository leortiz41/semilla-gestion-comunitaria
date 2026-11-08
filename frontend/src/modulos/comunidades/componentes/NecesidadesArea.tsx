import { useEffect, useState, type FormEvent } from 'react';
import {
  obtenerNecesidades,
  registrarNecesidad,
  type AreaVisionDesarrollo,
  type VisionDesarrolloComunitaria,
  type NecesidadComunitaria,
  type DatosNecesidad,
} from '../../../lib/api';
const prioridades = {
  POR_EVALUAR: 'Por evaluar',
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
};
export default function NecesidadesArea({
  comunidadId,
  area,
  tokenAcceso,
  vision,
  puedeEditar,
  bloqueado,
}: {
  comunidadId: string;
  area: AreaVisionDesarrollo;
  tokenAcceso: string;
  vision?: VisionDesarrolloComunitaria;
  puedeEditar: boolean;
  bloqueado: boolean;
}) {
  const [lista, setLista] = useState<NecesidadComunitaria[]>([]);
  const [cargando, setCargando] = useState(true),
    [cargado, setCargado] = useState(false),
    [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [mensaje, setMensaje] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [datos, setDatos] = useState<DatosNecesidad | null>(null);
  useEffect(() => {
    let activo = true;
    setCargando(true);
    setCargado(false);
    setError(null);
    obtenerNecesidades(tokenAcceso, comunidadId)
      .then((r) => {
        if (activo) {
          setLista(r.necesidades.filter((n) => n.area === area));
          setCargado(true);
        }
      })
      .catch((e) => {
        if (activo) setError(e.message);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [tokenAcceso, comunidadId, area, recarga]);
  function iniciar() {
    setError(null);
    setMensaje(null);
    setDatos({
      id: crypto.randomUUID(),
      area,
      metaId: null,
      titulo: '',
      descripcion: '',
      situacionInicial: '',
      poblacionAfectada: null,
      cantidadAfectada: null,
      resultadoEsperado: '',
      unidadMedida: null,
      cantidadObjetivo: null,
      prioridad: 'POR_EVALUAR',
      motivoPrioridad: '',
    });
  }
  function cambiar<K extends keyof DatosNecesidad>(k: K, v: DatosNecesidad[K]) {
    setDatos((d) => (d ? { ...d, [k]: v } : null));
  }
  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!datos || guardando) return;
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const r = await registrarNecesidad(tokenAcceso, comunidadId, datos);
      setLista((actual) => [r.necesidad, ...actual]);
      setDatos(null);
      setMensaje('Necesidad registrada. Su estado inicial es identificada.');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo registrar la necesidad.',
      );
    } finally {
      setGuardando(false);
    }
  }
  const meta = vision?.metas.find((m) => m.id === datos?.metaId);
  return (
    <div className="necesidades-area">
      <div className="vision-desarrollo__encabezado">
        <div>
          <h4>
            Necesidades identificadas{' '}
            {!cargando && cargado && `(${lista.length})`}
          </h4>
          <p>
            Registra el problema que debe atenderse para avanzar hacia las metas
            de esta área.
          </p>
        </div>
        {!datos && cargado && puedeEditar && (
          <button
            type="button"
            className="pagina-comunidades__boton-secundario"
            disabled={bloqueado}
            onClick={iniciar}
          >
            Agregar necesidad
          </button>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="pagina-zonas__aviso pagina-zonas__aviso--error"
        >
          {error}
        </div>
      )}
      {mensaje && (
        <div
          role="status"
          className="pagina-zonas__aviso pagina-zonas__aviso--exito"
        >
          {mensaje}
        </div>
      )}
      {cargando ? (
        <p role="status">Cargando necesidades…</p>
      ) : !cargado ? (
        <button
          type="button"
          className="pagina-comunidades__boton-secundario"
          onClick={() => setRecarga((x) => x + 1)}
        >
          Reintentar
        </button>
      ) : null}
      {datos && (
        <form onSubmit={guardar} className="necesidades-area__formulario">
          <fieldset
            className="expediente-campos vision-desarrollo__campos"
            disabled={guardando || bloqueado}
          >
            <label className="expediente-comunidad__campo-texto">
              Meta relacionada (opcional)
              <select
                value={datos.metaId ?? ''}
                onChange={(e) => cambiar('metaId', e.target.value || null)}
              >
                <option value="">Sin meta vinculada</option>
                {vision?.metas.map((m, i) => (
                  <option value={m.id} key={m.id}>
                    Meta {i + 1}: {m.descripcion.slice(0, 100)}
                  </option>
                ))}
              </select>
            </label>
            {(meta || vision?.situacionActual) && (
              <aside className="necesidades-area__referencia">
                <strong>Referencia del diagnóstico</strong>
                {meta && <p>{meta.descripcion}</p>}
                {vision?.situacionActual && (
                  <p>Situación actual: {vision.situacionActual}</p>
                )}
                <small>
                  Usa esta referencia para describir un problema concreto. El
                  diagnóstico original se conserva.
                </small>
              </aside>
            )}
            <label className="expediente-comunidad__campo-texto">
              Problema concreto
              <input
                required
                maxLength={180}
                value={datos.titulo}
                onChange={(e) => cambiar('titulo', e.target.value)}
                placeholder="Ej. Espacio insuficiente para atender a los estudiantes"
              />
            </label>
            {(
              [
                ['descripcion', 'Descripción del problema', 3000],
                [
                  'situacionInicial',
                  'Situación inicial y cómo se comprobó',
                  3000,
                ],
                ['poblacionAfectada', 'Población afectada (opcional)', 2000],
                ['resultadoEsperado', 'Resultado esperado', 3000],
              ] as const
            ).map(([clave, label, max]) => (
              <label className="expediente-comunidad__campo-texto" key={clave}>
                {label}
                <textarea
                  rows={3}
                  maxLength={max}
                  required={clave !== 'poblacionAfectada'}
                  value={datos[clave] ?? ''}
                  onChange={(e) => cambiar(clave, e.target.value)}
                />
              </label>
            ))}
            <div className="necesidades-area__medicion">
              <label className="expediente-comunidad__campo-texto">
                Personas afectadas (si se conoce)
                <input
                  type="number"
                  min={0}
                  max={2147483647}
                  step={1}
                  value={datos.cantidadAfectada ?? ''}
                  onChange={(e) =>
                    cambiar(
                      'cantidadAfectada',
                      e.target.value === '' ? null : Number(e.target.value),
                    )
                  }
                />
              </label>
              <label className="expediente-comunidad__campo-texto">
                Cantidad objetivo (opcional)
                <input
                  type="number"
                  min={0.01}
                  max={999999999999.99}
                  step="0.01"
                  value={datos.cantidadObjetivo ?? ''}
                  onChange={(e) =>
                    cambiar(
                      'cantidadObjetivo',
                      e.target.value === '' ? null : Number(e.target.value),
                    )
                  }
                />
              </label>
              <label className="expediente-comunidad__campo-texto">
                Unidad del objetivo
                <input
                  maxLength={80}
                  required={datos.cantidadObjetivo !== null}
                  value={datos.unidadMedida ?? ''}
                  onChange={(e) =>
                    cambiar('unidadMedida', e.target.value || null)
                  }
                  placeholder="Ej. aulas habilitadas"
                />
              </label>
            </div>
            <small>
              Deja las cantidades vacías si todavía no se conocen. Un dato
              desconocido no equivale a cero.
            </small>
            <label className="expediente-comunidad__campo-texto">
              Prioridad de esta necesidad
              <select
                value={datos.prioridad}
                onChange={(e) =>
                  cambiar(
                    'prioridad',
                    e.target.value as DatosNecesidad['prioridad'],
                  )
                }
              >
                {Object.entries(prioridades).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="expediente-comunidad__campo-texto">
              Justificación de la prioridad
              <textarea
                required
                maxLength={2000}
                rows={3}
                value={datos.motivoPrioridad}
                onChange={(e) => cambiar('motivoPrioridad', e.target.value)}
                placeholder="Explica la urgencia o qué información falta para evaluarla."
              />
            </label>
            <p>
              Se registrará como identificada. La prioridad no se hereda del
              área.
            </p>
            <div className="expediente-comunidad__acciones-formulario">
              <button className="pagina-comunidades__boton-nuevo" type="submit">
                {guardando ? 'Guardando…' : 'Registrar necesidad'}
              </button>
              <button
                type="button"
                className="pagina-comunidades__boton-secundario"
                onClick={() => {
                  setDatos(null);
                  setError(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {!cargando && cargado && lista.length === 0 && (
        <p>Todavía no hay necesidades registradas en esta área.</p>
      )}
      <div className="necesidades-area__lista">
        {lista.map((n) => (
          <article className="necesidades-area__tarjeta" key={n.id}>
            <h4>{n.titulo}</h4>
            <div className="necesidades-area__etiquetas">
              <span>Prioridad: {prioridades[n.prioridad]}</span>
              <span>
                Estado:{' '}
                {n.estado === 'IDENTIFICADA'
                  ? 'Identificada'
                  : n.estado.replaceAll('_', ' ').toLowerCase()}
              </span>
            </div>
            <p>{n.descripcion}</p>
            <dl>
              <dt>Situación inicial</dt>
              <dd>{n.situacionInicial}</dd>
              <dt>Resultado esperado</dt>
              <dd>{n.resultadoEsperado}</dd>
              <dt>Justificación de prioridad</dt>
              <dd>{n.motivoPrioridad}</dd>
              <dt>Población afectada</dt>
              <dd>
                {n.poblacionAfectada || 'Pendiente de identificar'}
                {n.cantidadAfectada !== null &&
                  ` · ${n.cantidadAfectada} personas`}
              </dd>
              <dt>Objetivo medible</dt>
              <dd>
                {n.cantidadObjetivo === null
                  ? 'Pendiente de definir'
                  : `${n.cantidadObjetivo} ${n.unidadMedida}`}
              </dd>
              <dt>Meta relacionada</dt>
              <dd>
                {n.metaDescripcion || 'Sin meta vinculada'}
                {n.metaActiva === false && ' (archivada)'}
              </dd>
            </dl>
          </article>
        ))}
      </div>
      {!datos && cargado && (
        <button
          className="pagina-comunidades__boton-secundario"
          type="button"
          onClick={() => {
            setMensaje(null);
            setRecarga((x) => x + 1);
          }}
        >
          Actualizar necesidades
        </button>
      )}
    </div>
  );
}
