import { useEffect, useState, type FormEvent } from 'react';
import {
  obtenerCapacidades,
  guardarCapacidades,
  obtenerUsuario,
  type CapacidadesComunidad,
} from '../../../lib/api';
const vacio: CapacidadesComunidad = {
  revision: 0,
  organizaciones: [],
  actividadesProductivas: [],
  productosServicios: [],
  observacionesOrganizaciones: '',
  potencialProductivo: '',
};
const grupos = [
  [
    'organizaciones',
    'Organizaciones comunitarias activas',
    'Ej. Junta de agua',
  ],
  ['actividadesProductivas', 'Actividades económicas', 'Ej. Agricultura'],
  ['productosServicios', 'Productos o servicios principales', 'Ej. Café'],
] as const;
export default function SeccionOrganizacionProductividad({
  comunidadId,
  tokenAcceso,
}: {
  comunidadId: string;
  tokenAcceso: string;
}) {
  const [datos, setDatos] = useState<CapacidadesComunidad>(vacio),
    [borrador, setBorrador] = useState<CapacidadesComunidad>(vacio);
  const [cargando, setCargando] = useState(true),
    [guardando, setGuardando] = useState(false),
    [editando, setEditando] = useState(false),
    [puedeEditar, setPuedeEditar] = useState(false),
    [cargaCompleta, setCargaCompleta] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [mensaje, setMensaje] = useState<string | null>(null),
    [recarga, setRecarga] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setCargaCompleta(false);
    setEditando(false);
    setError(null);
    setMensaje(null);
    Promise.all([
      obtenerCapacidades(tokenAcceso, comunidadId),
      obtenerUsuario(tokenAcceso),
    ])
      .then(([r, u]) => {
        if (vigente) {
          setDatos(r.capacidades);
          setBorrador(r.capacidades);
          setPuedeEditar(u.usuario.permisos.includes('comunidades.gestionar'));
          setCargaCompleta(true);
        }
      })
      .catch((e) => {
        if (vigente)
          setError(
            e instanceof Error
              ? e.message
              : 'No fue posible cargar la sección.',
          );
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [comunidadId, tokenAcceso, recarga]);
  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setError(null);
    setMensaje(null);
    const limpio = { ...borrador };
    for (const [clave] of grupos) {
      limpio[clave] = borrador[clave].map((s) => s.trim());
      if (
        limpio[clave].some((s) => !s || s.length > 150) ||
        limpio[clave].length > 50 ||
        new Set(limpio[clave].map((s) => s.toLocaleLowerCase('es'))).size !==
          limpio[clave].length
      ) {
        setError(
          'Completa cada fila, elimina las vacías y evita elementos repetidos.',
        );
        return;
      }
    }
    setGuardando(true);
    try {
      const r = await guardarCapacidades(tokenAcceso, comunidadId, limpio);
      setDatos(r.capacidades);
      setBorrador(r.capacidades);
      setEditando(false);
      setMensaje('Organización y productividad guardadas correctamente.');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo guardar la sección.',
      );
    } finally {
      setGuardando(false);
    }
  }
  return (
    <article className="expediente-comunidad__seccion">
      <div>
        <p className="expediente-comunidad__etiqueta">
          04 · Capacidades locales
        </p>
        <h2>Organización y productividad</h2>
        <p>
          Registra las organizaciones presentes, las actividades económicas y
          las oportunidades de desarrollo.
        </p>
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
        <p role="status">Cargando…</p>
      ) : !cargaCompleta ? (
        <button type="button" onClick={() => setRecarga((x) => x + 1)}>
          Reintentar
        </button>
      ) : editando ? (
        <form className="expediente-comunidad__formulario" onSubmit={guardar}>
          <fieldset className="expediente-campos" disabled={guardando}>
            {grupos.map(([clave, titulo, ejemplo]) => (
              <fieldset className="expediente-lista" key={clave}>
                <legend>{titulo}</legend>
                {borrador[clave].map((valor, i) => (
                  <div className="expediente-lista__fila" key={i}>
                    <input
                      aria-label={`${titulo} ${i + 1}`}
                      required
                      maxLength={150}
                      placeholder={ejemplo}
                      value={valor}
                      onChange={(e) =>
                        setBorrador((b) => ({
                          ...b,
                          [clave]: b[clave].map((s, j) =>
                            j === i ? e.target.value : s,
                          ),
                        }))
                      }
                    />
                    <button
                      type="button"
                      aria-label={`Quitar ${titulo} ${i + 1}`}
                      onClick={() =>
                        setBorrador((b) => ({
                          ...b,
                          [clave]: b[clave].filter((_, j) => j !== i),
                        }))
                      }
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={borrador[clave].length >= 50}
                  onClick={() =>
                    setBorrador((b) => ({ ...b, [clave]: [...b[clave], ''] }))
                  }
                >
                  Agregar{' '}
                  {clave === 'organizaciones'
                    ? 'organización'
                    : clave === 'actividadesProductivas'
                      ? 'actividad'
                      : 'producto o servicio'}
                </button>
                <small>
                  Un elemento por fila, hasta 50. Deja la lista vacía si todavía
                  no cuentas con esa información.
                </small>
              </fieldset>
            ))}
            <label className="expediente-comunidad__campo-texto">
              Observaciones de las organizaciones
              <textarea
                rows={3}
                maxLength={3000}
                value={borrador.observacionesOrganizaciones}
                onChange={(e) =>
                  setBorrador((b) => ({
                    ...b,
                    observacionesOrganizaciones: e.target.value,
                  }))
                }
              />
            </label>
            <label className="expediente-comunidad__campo-texto">
              Potencial y oportunidades productivas
              <textarea
                rows={3}
                maxLength={3000}
                value={borrador.potencialProductivo}
                onChange={(e) =>
                  setBorrador((b) => ({
                    ...b,
                    potencialProductivo: e.target.value,
                  }))
                }
              />
            </label>
            <div className="expediente-comunidad__acciones-formulario">
              <button type="submit" className="pagina-comunidades__boton-nuevo">
                {guardando ? 'Guardando…' : 'Guardar sección'}
              </button>
              <button
                type="button"
                className="pagina-comunidades__boton-secundario"
                onClick={() => {
                  setBorrador(datos);
                  setEditando(false);
                  setError(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <div className="expediente-comunidad__contenido-seccion">
          {grupos.map(([clave, titulo]) => (
            <div key={clave}>
              <h3>{titulo}</h3>
              {datos[clave].length ? (
                <ul>
                  {datos[clave].map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p>Sin información registrada.</p>
              )}
            </div>
          ))}
          <div>
            <h3>Observaciones de las organizaciones</h3>
            <p className="expediente-comunidad__detalle">
              {datos.observacionesOrganizaciones || 'Sin observaciones.'}
            </p>
          </div>
          <div>
            <h3>Potencial y oportunidades productivas</h3>
            <p className="expediente-comunidad__detalle">
              {datos.potencialProductivo || 'Sin información registrada.'}
            </p>
          </div>
          {puedeEditar && (
            <button
              type="button"
              className="listado-comunidades__boton-editar"
              onClick={() => {
                setBorrador(datos);
                setEditando(true);
                setError(null);
                setMensaje(null);
              }}
            >
              {datos.revision ? 'Editar sección' : 'Completar sección'}
            </button>
          )}
          <button
            type="button"
            className="pagina-comunidades__boton-secundario"
            onClick={() => setRecarga((x) => x + 1)}
          >
            Actualizar sección
          </button>
        </div>
      )}
    </article>
  );
}
