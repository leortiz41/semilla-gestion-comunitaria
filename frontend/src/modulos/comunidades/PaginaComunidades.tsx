import { useCallback, useEffect, useMemo, useState } from 'react';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/comunidades/comunidades.css';
import {
  listarComunidades,
  listarZonas,
  type ComunidadResumen,
  type ZonaResumen,
} from '../../lib/api';
import type { SubseccionComunidades } from '../../tipos/navegacion';
import FormularioRegistroBasicoComunidad from './componentes/FormularioRegistroBasicoComunidad';
import ListadoComunidades from './componentes/ListadoComunidades';
import PaginaZonas from './PaginaZonas';

interface PropiedadesPaginaComunidades {
  subseccion: SubseccionComunidades;
  tokenAcceso: string;
  alCambiarSubseccion: (subseccion: SubseccionComunidades) => void;
}

function normalizarTexto(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function obtenerEstadoEfectivo(comunidad: ComunidadResumen) {
  if (!comunidad.activo) return 'inactiva';
  if (comunidad.zonaActiva === false) return 'zona-inactiva';
  return 'activa';
}

function PaginaComunidades({ subseccion, tokenAcceso, alCambiarSubseccion }: PropiedadesPaginaComunidades) {
  const [comunidades, setComunidades] = useState<ComunidadResumen[]>([]);
  const [zonas, setZonas] = useState<ZonaResumen[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [zona, setZona] = useState('todas');
  const [estado, setEstado] = useState('todos');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comunidadEditando, setComunidadEditando] = useState<ComunidadResumen | null>(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const [respuestaComunidades, respuestaZonas] = await Promise.all([
        listarComunidades(tokenAcceso),
        listarZonas(tokenAcceso),
      ]);

      setComunidades(respuestaComunidades.comunidades);
      setZonas(respuestaZonas.zonas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible actualizar la información territorial.');
    } finally {
      setCargando(false);
    }
  }, [tokenAcceso]);

  useEffect(() => {
    if (subseccion === 'listado') {
      void cargarDatos();
    }
  }, [subseccion, cargarDatos]);

  const comunidadesFiltradas = useMemo(
    () =>
      comunidades.filter((comunidad) => {
        const coincideBusqueda = normalizarTexto(comunidad.nombre).includes(normalizarTexto(busqueda));
        const coincideZona = zona === 'todas' || comunidad.zonaId === zona;
        const estadoEfectivo = obtenerEstadoEfectivo(comunidad);
        const coincideEstado = estado === 'todos' || estadoEfectivo === estado;

        return coincideBusqueda && coincideZona && coincideEstado;
      }),
    [comunidades, busqueda, zona, estado],
  );

  const totalActivas = comunidades.filter((comunidad) => obtenerEstadoEfectivo(comunidad) === 'activa').length;
  const totalZonasActivas = zonas.filter((zonaRegistrada) => zonaRegistrada.activo).length;

  const resumenVisual = [
    {
      etiqueta: 'Comunidades',
      valor: String(comunidades.length),
      detalle: 'Total de comunidades registradas en la organización.',
    },
    {
      etiqueta: 'Activas',
      valor: String(totalActivas),
      detalle: 'Comunidades activas y ubicadas en zonas habilitadas.',
    },
    {
      etiqueta: 'Zonas',
      valor: String(totalZonasActivas),
      detalle: 'Zonas territoriales activas disponibles para nuevas comunidades.',
    },
    {
      etiqueta: 'Familias vinculadas',
      valor: '—',
      detalle: 'Se conectará con el módulo de Familias en una fase posterior.',
    },
  ];

  if (subseccion === 'zonas') {
    return <PaginaZonas tokenAcceso={tokenAcceso} />;
  }

  if (subseccion === 'nueva') {
    return (
      <section className="pagina-modulo pagina-comunidades" aria-labelledby="titulo-nueva-comunidad">
        <div className="pagina-comunidades__vista-superior">
          <div>
            <p className="pagina-modulo__etiqueta">Comunidades / Registro</p>
            <h1 id="titulo-nueva-comunidad" className="pagina-modulo__titulo">
              Nueva comunidad
            </h1>
            <p className="pagina-modulo__descripcion">
              Crea primero el registro territorial básico. Después completaremos el expediente comunitario por secciones.
            </p>
          </div>

          <button
            className="pagina-comunidades__boton-secundario"
            type="button"
            onClick={() => alCambiarSubseccion('listado')}
          >
            ← Volver al listado
          </button>
        </div>

        <FormularioRegistroBasicoComunidad
          tokenAcceso={tokenAcceso}
          alCerrar={() => alCambiarSubseccion('listado')}
          alGuardar={() => alCambiarSubseccion('listado')}
        />
      </section>
    );
  }

  return (
    <section className="pagina-modulo pagina-comunidades" aria-labelledby="titulo-comunidades">
      <div className="pagina-comunidades__superior">
        <div className="pagina-modulo__encabezado">
          <p className="pagina-modulo__etiqueta">Gestión territorial</p>
          <h1 id="titulo-comunidades" className="pagina-modulo__titulo">
            Comunidades
          </h1>
          <p className="pagina-modulo__descripcion">
            Organiza las zonas y comunidades atendidas por Semilla y consulta la información territorial registrada en PostgreSQL.
          </p>
        </div>

        <div className="pagina-comunidades__acciones">
          <button
            className="pagina-comunidades__boton-secundario"
            type="button"
            onClick={() => void cargarDatos()}
            disabled={cargando}
          >
            {cargando ? 'Actualizando…' : '↻ Actualizar'}
          </button>
          <button
            className="pagina-comunidades__boton-nuevo"
            type="button"
            onClick={() => alCambiarSubseccion('nueva')}
          >
            + Nueva comunidad
          </button>
        </div>
      </div>

      {error && <div className="pagina-zonas__aviso pagina-zonas__aviso--error">{error}</div>}

      {comunidadEditando && (
        <FormularioRegistroBasicoComunidad
          key={comunidadEditando.id}
          comunidad={comunidadEditando}
          tokenAcceso={tokenAcceso}
          alCerrar={() => setComunidadEditando(null)}
          alGuardar={() => {
            setComunidadEditando(null);
            void cargarDatos();
          }}
        />
      )}

      <div className="pagina-comunidades__resumen" aria-label="Resumen de comunidades">
        {resumenVisual.map((indicador) => (
          <article className="pagina-comunidades__tarjeta" key={indicador.etiqueta}>
            <p className="pagina-comunidades__tarjeta-etiqueta">{indicador.etiqueta}</p>
            <strong className="pagina-comunidades__tarjeta-valor">{indicador.valor}</strong>
            <p className="pagina-comunidades__tarjeta-detalle">{indicador.detalle}</p>
          </article>
        ))}
      </div>

      <div className="pagina-comunidades__herramientas" aria-label="Filtros de comunidades">
        <div className="pagina-comunidades__campo">
          <label htmlFor="buscar-comunidad">Buscar comunidad</label>
          <input
            id="buscar-comunidad"
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Nombre de la comunidad"
          />
        </div>

        <div className="pagina-comunidades__campo">
          <label htmlFor="filtro-zona">Zona</label>
          <select
            id="filtro-zona"
            value={zona}
            onChange={(event) => setZona(event.target.value)}
          >
            <option value="todas">Todas las zonas</option>
            {zonas.map((zonaRegistrada) => (
              <option value={zonaRegistrada.id} key={zonaRegistrada.id}>
                {zonaRegistrada.nombre}{zonaRegistrada.activo ? '' : ' (inactiva)'}
              </option>
            ))}
          </select>
        </div>

        <div className="pagina-comunidades__campo">
          <label htmlFor="filtro-estado">Estado</label>
          <select
            id="filtro-estado"
            value={estado}
            onChange={(event) => setEstado(event.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="activa">Activas</option>
            <option value="inactiva">Inactivas</option>
            <option value="zona-inactiva">Zona inactiva</option>
          </select>
        </div>
      </div>

      <ListadoComunidades
        comunidades={comunidadesFiltradas}
        cargando={cargando}
        alEditar={setComunidadEditando}
      />
    </section>
  );
}

export default PaginaComunidades;
