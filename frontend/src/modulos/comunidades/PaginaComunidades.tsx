import { useState } from 'react';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/comunidades/comunidades.css';
import FormularioComunidad from './componentes/FormularioComunidad';

const resumenVisual = [
  {
    etiqueta: 'Comunidades',
    valor: '6',
    detalle: 'Total registrado para validar la distribución visual.',
  },
  {
    etiqueta: 'Activas',
    valor: '6',
    detalle: 'Comunidades actualmente consideradas activas.',
  },
  {
    etiqueta: 'Zonas',
    valor: '2',
    detalle: 'Agrupaciones territoriales para organizar comunidades.',
  },
  {
    etiqueta: 'Familias vinculadas',
    valor: '—',
    detalle: 'Se conectará con el módulo de Familias en la fase backend.',
  },
];

function PaginaComunidades() {
  const [busqueda, setBusqueda] = useState('');
  const [zona, setZona] = useState('todas');
  const [estado, setEstado] = useState('todos');
  const [mostrarRegistro, setMostrarRegistro] = useState(false);

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
            <option value="activas">Activas</option>
            <option value="inactivas">Inactivas</option>
          </select>
        </div>
      </div>

      {mostrarRegistro && (
        <FormularioComunidad alCerrar={() => setMostrarRegistro(false)} />
      )}
    </section>
  );
}

export default PaginaComunidades;
