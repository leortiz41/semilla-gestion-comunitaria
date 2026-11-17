import { useEffect, useMemo, useState, type FormEvent } from 'react';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/familias/familias.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Comunidad {
  id: string;
  nombre: string;
  municipio: string;
}
interface Familia {
  id: string;
  comunidadId: string;
  comunidad: string;
  nombreReferencia: string;
  numeroCasa: string | null;
  direccionReferencia: string | null;
  activo: boolean;
  integrantesRegistrados: number;
  evaluacionesRegistradas: number;
  actualizadoEn: string;
}
type DatosFamilia = {
  comunidadId: string;
  nombreReferencia: string;
  numeroCasa: string;
  direccionReferencia: string;
  activo: boolean;
};
const vacia: DatosFamilia = {
  comunidadId: '', nombreReferencia: '', numeroCasa: '', direccionReferencia: '', activo: true,
};

async function solicitar<T>(ruta: string, token: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`${API}/familias${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opciones.headers },
    cache: 'no-store',
  });
  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({})) as { message?: string };
    throw new Error(error.message || 'No fue posible completar la operación.');
  }
  return respuesta.status === 204 ? undefined as T : respuesta.json() as Promise<T>;
}

export default function PaginaFamilias({
  token, puedeGestionar,
}: { token: string; puedeGestionar: boolean }) {
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [comunidades, setComunidades] = useState<Comunidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [comunidad, setComunidad] = useState('');
  const [estado, setEstado] = useState<'activas' | 'inactivas' | 'todas'>('activas');
  const [formulario, setFormulario] = useState<DatosFamilia | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    Promise.all([
      solicitar<{ familias: Familia[] }>('', token),
      solicitar<{ comunidades: Comunidad[] }>('/comunidades', token),
    ]).then(([resultado, lista]) => {
      if (!vigente) return;
      setFamilias(resultado.familias);
      setComunidades(lista.comunidades);
    }).catch((fallo: Error) => {
      if (vigente) setError(fallo.message);
    }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [token, recarga]);

  const visibles = useMemo(() => familias.filter((familia) => {
    const texto = `${familia.nombreReferencia} ${familia.numeroCasa ?? ''} ${familia.comunidad}`.toLocaleLowerCase('es');
    return (estado === 'todas' || familia.activo === (estado === 'activas')) &&
      (!comunidad || familia.comunidadId === comunidad) &&
      texto.includes(busqueda.trim().toLocaleLowerCase('es'));
  }), [familias, estado, comunidad, busqueda]);

  function abrir(familia?: Familia) {
    setError('');
    setMensaje('');
    setEditandoId(familia?.id ?? null);
    setFormulario(familia ? {
      comunidadId: familia.comunidadId,
      nombreReferencia: familia.nombreReferencia ?? '',
      numeroCasa: familia.numeroCasa ?? '',
      direccionReferencia: familia.direccionReferencia ?? '',
      activo: familia.activo,
    } : { ...vacia });
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!formulario || guardando) return;
    setGuardando(true);
    setError('');
    try {
      await solicitar(editandoId ? `/${editandoId}` : '/', token, {
        method: editandoId ? 'PUT' : 'POST',
        body: JSON.stringify(formulario),
      });
      setMensaje(editandoId ? 'Expediente actualizado correctamente.' : 'Familia registrada. Completá su evaluación y documentación antes de aprobar el apoyo.');
      setFormulario(null);
      setEditandoId(null);
      setRecarga((n) => n + 1);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'Error al guardar.');
    } finally { setGuardando(false); }
  }

  return (
    <section className="pagina-modulo familias-pagina" aria-labelledby="titulo-familias">
      <header className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Gestión social · Programa de vivienda</p>
        <h1 id="titulo-familias" className="pagina-modulo__titulo">Familias beneficiarias</h1>
        <p className="pagina-modulo__descripcion">
          Registrá y consultá los expedientes de las familias acompañadas. El registro inicial
          no implica aprobación ni entrega de vivienda.
        </p>
      </header>

      <div className="familias-resumen" aria-label="Resumen de familias">
        <article><span>Familias activas</span><strong>{familias.filter((f) => f.activo).length}</strong></article>
        <article><span>Con evaluaciones</span><strong>{familias.filter((f) => f.evaluacionesRegistradas > 0).length}</strong></article>
        <article><span>Comunidades registradas</span><strong>{new Set(familias.map((f) => f.comunidadId)).size}</strong></article>
      </div>

      <div className="familias-barra">
        <label>Buscar familia
          <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, comunidad o número de casa" />
        </label>
        <label>Comunidad
          <select value={comunidad} onChange={(e) => setComunidad(e.target.value)}>
            <option value="">Todas</option>
            {comunidades.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.municipio}</option>)}
          </select>
        </label>
        <label>Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
            <option value="activas">Activas</option>
            <option value="inactivas">Inactivas</option>
            <option value="todas">Todas</option>
          </select>
        </label>
        {puedeGestionar && <button type="button" className="familias-boton-principal"
          onClick={() => abrir()}>+ Registrar familia</button>}
      </div>

      {mensaje && <p role="status" className="familias-aviso">{mensaje}</p>}
      {error && <p role="alert" className="familias-error">{error}</p>}
      {cargando && <p role="status">Cargando expedientes familiares…</p>}
      {!cargando && !error && !visibles.length && (
        <div className="familias-vacio">No hay familias que coincidan con los filtros.</div>
      )}

      <div className="familias-lista" aria-label="Expedientes familiares">
        {visibles.map((familia) => (
          <article key={familia.id} className="familias-tarjeta">
            <header>
              <div>
                <span className="familias-tarjeta__etiqueta">Expediente familiar</span>
                <h2>{familia.nombreReferencia}</h2>
              </div>
              <span className={familia.activo ? 'familias-estado familias-estado--activo' : 'familias-estado'}>
                {familia.activo ? 'Activo' : 'Inactivo'}
              </span>
            </header>
            <p>{familia.comunidad} {familia.numeroCasa ? `· Casa ${familia.numeroCasa}` : ''}</p>
            {familia.direccionReferencia && <p className="familias-direccion">{familia.direccionReferencia}</p>}
            <dl>
              <div><dt>Integrantes registrados</dt><dd>{familia.integrantesRegistrados}</dd></div>
              <div><dt>Evaluaciones</dt><dd>{familia.evaluacionesRegistradas}</dd></div>
            </dl>
            <div className="familias-acciones">
              {puedeGestionar && <button type="button" onClick={() => abrir(familia)}>Editar datos generales</button>}
              <span>Documentos y evaluación: siguiente etapa del expediente</span>
            </div>
          </article>
        ))}
      </div>

      {formulario && puedeGestionar && (
        <div className="familias-modal-fondo" role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !guardando) setFormulario(null); }}>
          <section className="familias-modal" role="dialog" aria-modal="true" aria-labelledby="familias-form-titulo">
            <header>
              <div>
                <span className="familias-tarjeta__etiqueta">Ficha inicial</span>
                <h2 id="familias-form-titulo">{editandoId ? 'Editar familia' : 'Registrar familia'}</h2>
              </div>
              <button type="button" onClick={() => setFormulario(null)} disabled={guardando}
                aria-label="Cerrar formulario">✕</button>
            </header>
            <form onSubmit={(e) => void guardar(e)}>
              <label>Comunidad *
                <select required value={formulario.comunidadId} onChange={(e) =>
                  setFormulario({ ...formulario, comunidadId: e.target.value })}>
                  <option value="">Seleccionar comunidad</option>
                  {comunidades.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.municipio}</option>)}
                </select>
              </label>
              <label>Nombre de referencia de la familia *
                <input required maxLength={180} value={formulario.nombreReferencia}
                  onChange={(e) => setFormulario({ ...formulario, nombreReferencia: e.target.value })}
                  placeholder="Ej. Familia Hernández" />
              </label>
              <label>Número de vivienda / casa
                <input maxLength={60} value={formulario.numeroCasa}
                  onChange={(e) => setFormulario({ ...formulario, numeroCasa: e.target.value })}
                  placeholder="Si está asignado" />
              </label>
              <label>Dirección o referencia del domicilio
                <textarea rows={3} maxLength={1200} value={formulario.direccionReferencia}
                  onChange={(e) => setFormulario({ ...formulario, direccionReferencia: e.target.value })} />
              </label>
              {editandoId && <label className="familias-casilla">
                <input type="checkbox" checked={formulario.activo}
                  onChange={(e) => setFormulario({ ...formulario, activo: e.target.checked })} />
                Expediente activo
              </label>}
              <p className="familias-nota">No ingresés números de identidad ni documentos personales en observaciones. La documentación tendrá una sección protegida.</p>
              <footer>
                <button type="button" onClick={() => setFormulario(null)} disabled={guardando}>Cancelar</button>
                <button type="submit" className="familias-boton-principal" disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar expediente'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
