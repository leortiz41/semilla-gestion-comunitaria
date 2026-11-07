import { useEffect, useState, type FormEvent } from 'react';
import {
  listarZonas,
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
  const consulta = Boolean(comunidadId);
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
    ])
      .then(([z, r]) => {
        if (vigente) {
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
      await crearExpediente(tokenAcceso, datos);
      alGuardar?.();
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
      <input
        value={datos[k]}
        maxLength={max}
        required={required}
        onChange={(e) => cambiar(k, e.target.value)}
      />
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
    <label className="pagina-comunidades__campo" key={k}>
      {label}
      <textarea
        rows={4}
        value={datos[k].join('\n')}
        onChange={(e) => cambiar(k, e.target.value.split('\n'))}
        onBlur={() => cambiar(k, datos[k].map((x) => x.trim()).filter(Boolean))}
      />
      <small>
        Un elemento por línea, máximo 50; hasta 150 caracteres por elemento.
      </small>
    </label>
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
          <h2>{consulta ? 'Expediente comunitario' : 'Nueva comunidad'}</h2>
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
                      .filter((z) => consulta || z.activo)
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
              disabled={guardando || !zonas.some((z) => z.activo)}
            >
              {guardando ? 'Guardando…' : 'Guardar comunidad y expediente'}
            </button>
          )}
        </>
      )}
    </form>
  );
}
