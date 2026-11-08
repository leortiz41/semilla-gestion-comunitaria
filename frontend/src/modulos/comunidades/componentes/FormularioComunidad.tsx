import { useEffect, useState, type FormEvent } from 'react';
import {
  listarZonas,
  actualizarDiagnostico,
  obtenerUsuario,
  crearExpediente,
  consultarExpediente,
  type ZonaResumen,
  type ExpedienteComunidad,
} from '../../../lib/api';

const categorias = [
  'Evangelismo',
  'Educación formal',
  'Educación comunitaria',
  'Infraestructura',
];
const vacio: ExpedienteComunidad = {
  nombre: '',
  zonaId: '',
  municipio: '',
  departamento: '',
  latitud: null,
  longitud: null,
  poblacion: null,
  viviendas: null,
  viviendasIntervencion: null,
  tiposVivienda: [],
  visiones: [],
  organizaciones: [],
  actividadesProductivas: [],
  productosServicios: [],
  observacionesOrganizaciones: '',
  potencialProductivo: '',
};
interface Props {
  tokenAcceso: string;
  comunidadId?: string;
  alCerrar: () => void;
  alGuardar?: () => void;
}

export default function FormularioComunidad({
  tokenAcceso,
  comunidadId,
  alCerrar,
  alGuardar,
}: Props) {
  const [datos, setDatos] = useState<ExpedienteComunidad>(vacio);
  const [zonas, setZonas] = useState<ZonaResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargaCompleta, setCargaCompleta] = useState(false);
  const [fecha, setFecha] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [diagnosticoId, setDiagnosticoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const consulta = Boolean(comunidadId) && !editando;
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setCargaCompleta(false);
    setError(null);
    Promise.all([
      listarZonas(tokenAcceso),
      comunidadId
        ? consultarExpediente(tokenAcceso, comunidadId)
        : Promise.resolve(null),
      obtenerUsuario(tokenAcceso),
    ])
      .then(([z, r, sesion]) => {
        if (vigente) {
          setPuedeEditar(
            sesion.usuario.permisos.includes('comunidades.gestionar'),
          );
          setDiagnosticoId(r?.expediente.diagnosticoId ?? null);
          setCargaCompleta(true);
          setZonas(z.zonas);
          setDatos(r?.expediente ?? vacio);
          setFecha(r?.expediente.fechaDiagnostico ?? null);
        }
      })
      .catch((e) => {
        if (vigente)
          setError(
            e instanceof Error ? e.message : 'No se pudo cargar el expediente.',
          );
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [tokenAcceso, comunidadId]);
  function cambiar<K extends keyof ExpedienteComunidad>(
    k: K,
    v: ExpedienteComunidad[K],
  ) {
    setDatos((d) => ({ ...d, [k]: v }));
  }
  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (guardando || consulta) return;
    setError(null);
    if ((datos.latitud === null) !== (datos.longitud === null)) {
      setError('Registra ambas coordenadas o deja ambas vacías.');
      return;
    }
    if (
      datos.viviendasIntervencion !== null &&
      (datos.viviendas === null ||
        datos.viviendasIntervencion > datos.viviendas)
    ) {
      setError('Las viviendas por intervenir no pueden superar el total.');
      return;
    }
    if (
      datos.visiones.some(
        (v) => !v.situacion.trim() || !v.meta.trim() || !v.prioridad,
      )
    ) {
      setError('Completa situación, meta y prioridad de cada área iniciada.');
      return;
    }
    setGuardando(true);
    try {
      if (comunidadId) {
        await actualizarDiagnostico(
          tokenAcceso,
          comunidadId,
          datos,
          diagnosticoId,
        );
        const r = await consultarExpediente(tokenAcceso, comunidadId);
        setDatos(r.expediente);
        setDiagnosticoId(r.expediente.diagnosticoId);
        setFecha(r.expediente.fechaDiagnostico);
        setEditando(false);
        setMensaje('Diagnóstico actualizado. La versión anterior se conserva.');
      } else {
        await crearExpediente(tokenAcceso, datos);
        alGuardar?.();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo guardar el expediente.',
      );
    } finally {
      setGuardando(false);
    }
  }
  const texto = (
    k:
      | 'nombre'
      | 'municipio'
      | 'departamento'
      | 'observacionesOrganizaciones'
      | 'potencialProductivo',
    label: string,
    max: number,
    required = false,
  ) => (
    <label className="pagina-comunidades__campo" key={k}>
      {label}
      {max > 150 ? (
        <textarea
          rows={3}
          value={datos[k]}
          maxLength={max}
          onChange={(e) => cambiar(k, e.target.value)}
        />
      ) : (
        <input
          value={datos[k]}
          maxLength={max}
          required={required}
          onChange={(e) => cambiar(k, e.target.value)}
        />
      )}
    </label>
  );
  const numero = (
    k:
      | 'latitud'
      | 'longitud'
      | 'poblacion'
      | 'viviendas'
      | 'viviendasIntervencion',
    label: string,
    min: number,
    max: number,
    step: string,
  ) => (
    <label className="pagina-comunidades__campo" key={k}>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={datos[k] ?? ''}
        onChange={(e) =>
          cambiar(k, e.target.value === '' ? null : e.target.valueAsNumber)
        }
      />
    </label>
  );
  const lista = (
    k:
      | 'tiposVivienda'
      | 'organizaciones'
      | 'actividadesProductivas'
      | 'productosServicios',
    label: string,
  ) => (
    <fieldset className="expediente-lista" key={k}>
      <legend>{label}</legend>
      {datos[k].length === 0 && <p>Sin información registrada.</p>}
      {datos[k].map((valor, indice) => (
        <div className="expediente-lista__fila" key={indice}>
          <input
            aria-label={`${label} ${indice + 1}`}
            required
            maxLength={150}
            value={valor}
            onChange={(e) =>
              cambiar(
                k,
                datos[k].map((x, i) => (i === indice ? e.target.value : x)),
              )
            }
          />
          {!consulta && (
            <button
              type="button"
              aria-label={`Quitar ${label} ${indice + 1}`}
              onClick={() =>
                cambiar(
                  k,
                  datos[k].filter((_, i) => i !== indice),
                )
              }
            >
              Quitar
            </button>
          )}
        </div>
      ))}
      {!consulta && (
        <button
          type="button"
          disabled={datos[k].length >= 50}
          onClick={() => cambiar(k, [...datos[k], ''])}
        >
          Agregar elemento
        </button>
      )}
      {!consulta && (
        <small>
          Hasta 50 elementos de 150 caracteres. Registra cada organización,
          actividad o producto por separado.
        </small>
      )}
    </fieldset>
  );

  return (
    <form
      className="formulario-comunidad"
      onSubmit={guardar}
      onInvalidCapture={(e) => {
        const detalle = (e.target as HTMLElement).closest('details');
        if (detalle) detalle.open = true;
      }}
    >
      <div className="formulario-comunidad__encabezado">
        <div>
          <h2>{comunidadId ? 'Expediente comunitario' : 'Nueva comunidad'}</h2>
          <p>
            {consulta
              ? 'Consulta de la información registrada.'
              : 'Completa los datos generales y las secciones que conozcas. Deja vacíos los datos aún no disponibles.'}
          </p>
        </div>
        <button
          type="button"
          className="formulario-comunidad__cerrar"
          disabled={guardando}
          onClick={alCerrar}
          aria-label="Cerrar expediente"
        >
          ×
        </button>
      </div>
      {mensaje && <p role="status">{mensaje}</p>}
      {consulta && cargaCompleta && puedeEditar && (
        <button
          type="button"
          className="pagina-comunidades__boton-nuevo"
          onClick={() => {
            setEditando(true);
            setMensaje(null);
          }}
        >
          Completar o editar diagnóstico
        </button>
      )}
      {error && (
        <p role="alert" className="formulario-comunidad__aviso">
          {error}
        </p>
      )}
      {cargando ? (
        <p role="status">Cargando expediente…</p>
      ) : !cargaCompleta ? (
        <p>Cierra y vuelve a abrir el expediente para reintentar.</p>
      ) : (
        <>
          {consulta && (
            <p>
              {fecha
                ? `Diagnóstico registrado: ${new Date(fecha).toLocaleDateString('es-HN')}`
                : 'Esta comunidad tiene un registro básico; todavía no tiene diagnóstico completo.'}
            </p>
          )}
          <fieldset
            disabled={consulta || guardando}
            className="expediente-campos"
          >
            <details className="formulario-comunidad__acordeon" open>
              <summary>01 · Información general y ubicación</summary>
              <fieldset
                disabled={Boolean(comunidadId)}
                className="expediente-campos"
              >
                <div className="formulario-comunidad__acordeon-contenido formulario-comunidad__campos formulario-comunidad__campos--dos">
                  {texto('nombre', 'Nombre de la comunidad', 150, true)}
                  <label className="pagina-comunidades__campo">
                    Zona
                    <select
                      required
                      value={datos.zonaId ?? ''}
                      onChange={(e) => cambiar('zonaId', e.target.value)}
                    >
                      <option value="">Seleccionar zona</option>
                      {zonas
                        .filter((z) => Boolean(comunidadId) || z.activo)
                        .map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.nombre}
                            {!z.activo ? ' (inactiva)' : ''}
                          </option>
                        ))}
                    </select>
                  </label>
                  {texto('municipio', 'Municipio', 120, true)}
                  {texto('departamento', 'Departamento', 120, true)}
                  {numero('latitud', 'Latitud', -90, 90, '0.000001')}
                  {numero('longitud', 'Longitud', -180, 180, '0.000001')}
                </div>
              </fieldset>
            </details>
            <details className="formulario-comunidad__acordeon" open>
              <summary>02 · Población y vivienda</summary>
              <div className="formulario-comunidad__acordeon-contenido">
                <div className="formulario-comunidad__campos formulario-comunidad__campos--tres">
                  {numero(
                    'poblacion',
                    'Población aproximada',
                    0,
                    2147483647,
                    '1',
                  )}
                  {numero(
                    'viviendas',
                    'Viviendas aproximadas',
                    0,
                    2147483647,
                    '1',
                  )}
                  {numero(
                    'viviendasIntervencion',
                    'Viviendas por intervenir',
                    0,
                    2147483647,
                    '1',
                  )}
                </div>
                {lista('tiposVivienda', 'Tipos de vivienda predominantes')}
              </div>
            </details>
            <details className="formulario-comunidad__acordeon" open>
              <summary>03 · Visión de desarrollo</summary>
              <div className="formulario-comunidad__acordeon-contenido">
                {categorias.map((categoria) => {
                  const v = datos.visiones.find(
                    (v) => v.categoria === categoria,
                  ) ?? { categoria, situacion: '', meta: '', prioridad: '' };
                  const actualizar = (
                    campo: 'situacion' | 'meta' | 'prioridad',
                    valor: string,
                  ) => {
                    const nuevo = { ...v, [campo]: valor };
                    cambiar('visiones', [
                      ...datos.visiones.filter(
                        (v) => v.categoria !== categoria,
                      ),
                      ...(nuevo.situacion || nuevo.meta || nuevo.prioridad
                        ? [nuevo]
                        : []),
                    ]);
                  };
                  return (
                    <article
                      className="formulario-comunidad__vision-item"
                      key={categoria}
                    >
                      <h3>{categoria}</h3>
                      <label className="pagina-comunidades__campo">
                        Situación actual
                        <textarea
                          maxLength={3000}
                          value={v.situacion}
                          onChange={(e) =>
                            actualizar('situacion', e.target.value)
                          }
                        />
                      </label>
                      <label className="pagina-comunidades__campo">
                        Visión o meta
                        <textarea
                          maxLength={3000}
                          value={v.meta}
                          onChange={(e) => actualizar('meta', e.target.value)}
                        />
                      </label>
                      <label className="pagina-comunidades__campo">
                        Prioridad
                        <select
                          value={v.prioridad}
                          onChange={(e) =>
                            actualizar('prioridad', e.target.value)
                          }
                        >
                          <option value="">Sin registrar</option>
                          <option value="alta">Alta</option>
                          <option value="media">Media</option>
                          <option value="baja">Baja</option>
                        </select>
                      </label>
                    </article>
                  );
                })}
              </div>
            </details>
            <details className="formulario-comunidad__acordeon" open>
              <summary>04 · Organizaciones comunitarias</summary>
              <div className="formulario-comunidad__acordeon-contenido">
                {lista(
                  'organizaciones',
                  'Organizaciones activas (por ejemplo, patronato o junta de agua)',
                )}
                {texto(
                  'observacionesOrganizaciones',
                  'Observaciones de las organizaciones',
                  3000,
                )}
              </div>
            </details>
            <details className="formulario-comunidad__acordeon" open>
              <summary>05 · Productividad local</summary>
              <div className="formulario-comunidad__acordeon-contenido">
                {lista('actividadesProductivas', 'Actividades económicas')}
                {lista(
                  'productosServicios',
                  'Productos o servicios principales',
                )}
                {texto(
                  'potencialProductivo',
                  'Oportunidades de desarrollo productivo',
                  3000,
                )}
              </div>
            </details>
          </fieldset>
          {!consulta && (
            <button
              type="submit"
              className="pagina-comunidades__boton-nuevo"
              disabled={
                guardando || (!comunidadId && !zonas.some((z) => z.activo))
              }
            >
              {guardando
                ? 'Guardando…'
                : comunidadId
                  ? 'Guardar diagnóstico'
                  : 'Guardar comunidad y expediente'}
            </button>
          )}
        </>
      )}
    </form>
  );
}
