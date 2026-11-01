import { useState } from 'react';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/comunidades/comunidades.css';
import type { ComunidadVisual } from '../../tipos/comunidades';
import FormularioComunidad from './componentes/FormularioComunidad';
import ListadoComunidades from './componentes/ListadoComunidades';

const comunidadesVisuales: ComunidadVisual[] = [
  { id: 'agua-azul-rancho', nombre: 'Agua Azul Rancho', zona: 'zona-1', nombreZona: 'Zona 1', estado: 'activa' },
  { id: 'agua-amarilla', nombre: 'Agua Amarilla', zona: 'zona-1', nombreZona: 'Zona 1', estado: 'activa' },
  { id: 'el-bambu', nombre: 'El Bambú', zona: 'zona-1', nombreZona: 'Zona 1', estado: 'activa' },
  { id: 'las-marias', nombre: 'Las Marías', zona: 'zona-2', nombreZona: 'Zona 2', estado: 'activa' },
  { id: 'el-novillo', nombre: 'El Novillo', zona: 'zona-2', nombreZona: 'Zona 2', estado: 'activa' },
  { id: 'los-cocos', nombre: 'Los Cocos', zona: 'zona-2', nombreZona: 'Zona 2', estado: 'activa' },
];

function normalizarTexto(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function PaginaComunidades() {
  const [busqueda, setBusqueda] = useState('');
  const [zona, setZona] = useState('todas');
  const [estado, setEstado] = useState('todos');
  const [mostrarRegistro, setMostrarRegistro] = useState(false);

  const comunidadesFiltradas = comunidadesVisuales.filter((comunidad) => {
    const coincideBusqueda = normalizarTexto(comunidad.nombre).includes(normalizarTexto(busqueda));
    const coincideZona = zona === 'todas' || comunidad.zona === zona;
    const coincideEstado = estado === 'todos' || comunidad.estado === estado;

    return coincideBusqueda && coincideZona && coincideEstado;
  });

  const totalActivas = comunidadesVisuales.filter((comunidad) => comunidad.estado === 'activa').length;
  const totalZonas = new Set(comunidadesVisuales.map((comunidad) => comunidad.zona)).size;

  const resumenVisual = [
    {
      etiqueta: 'Comunidades',
      valor: String(comunidadesVisuales.length),
      detalle: 'Total registrado para validar la distribución visual.',
    },
    {
      etiqueta: 'Activas',
      valor: String(totalActivas),
      detalle: 'Comunidades actualmente consideradas activas.',
    },
    {
      etiqueta: 'Zonas',
      valor: String(totalZonas),
      detalle: 'Agrupaciones territoriales para organizar comunidades.',
    },
    {
      etiqueta: 'Familias vinculadas',
      valor: '—',
      detalle: 'Se conectará con el módulo de Familias en la fase backend.',
    },
  ];

  return (
    <section className="pagina-modulo pagina-comunidades" aria-labelledby="titulo-comunidades">
      <div className="pagina-comunidades__superior">
        <div className="pagina-modulo__encabezado">
          <p className="pagina-modulo__etiqueta">Gestión territorial</p>
          <h1 id="titulo-comunidades" className="pagina-modulo__titulo">
            Comunidades
          </h1>
          <p className="pagina-modulo__descripcion">
            Organiza las zonas y comunidades atendidas por Semilla y concentra su información general en un solo espacio.
          </p>
        </div>

        <div className="pagina-comunidades__acciones">
          <button
            className="pagina-comunidades__boton-nuevo"
            type="button"
            onClick={() => setMostrarRegistro(true)}
          >
            + Nueva comunidad
          </button>
        </div>
      </div>

      <div className="pagina-comunidades__resumen" aria-label="Resumen visual de comunidades">
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
            <option value="zona-1">Zona 1</option>
            <option value="zona-2">Zona 2</option>
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
          </select>
        </div>
      </div>

      <ListadoComunidades comunidades={comunidadesFiltradas} />

      {mostrarRegistro && (
        <FormularioComunidad alCerrar={() => setMostrarRegistro(false)} />
      )}
    </section>
  );
}

export default PaginaComunidades;
