import { useState } from 'react';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/comunidades/comunidades.css';

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
        <div className="pagina-comunidades__registro">
          <div className="pagina-comunidades__registro-encabezado">
            <div>
              <h2>Nueva comunidad</h2>
              <p>
                Estamos preparando la estructura visual del registro antes de conectarla con la base de datos.
              </p>
            </div>
            <button
              className="pagina-comunidades__cerrar"
              type="button"
              onClick={() => setMostrarRegistro(false)}
              aria-label="Cerrar registro de comunidad"
            >
              ×
            </button>
          </div>

          <div className="pagina-comunidades__registro-campos">
            <div className="pagina-comunidades__campo">
              <label htmlFor="nombre-comunidad">Nombre de la comunidad</label>
              <input id="nombre-comunidad" type="text" placeholder="Ej. Agua Azul Rancho" />
            </div>

            <div className="pagina-comunidades__campo">
              <label htmlFor="zona-comunidad">Zona</label>
              <select id="zona-comunidad" defaultValue="">
                <option value="" disabled>Seleccionar zona</option>
                <option value="zona-1">Zona 1</option>
                <option value="zona-2">Zona 2</option>
              </select>
            </div>
          </div>

          <p className="pagina-comunidades__registro-aviso">
            Este formulario todavía es visual. El guardado se habilitará cuando trabajemos el backend del módulo.
          </p>
        </div>
      )}
    </section>
  );
}

export default PaginaComunidades;
