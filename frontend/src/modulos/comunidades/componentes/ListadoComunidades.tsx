import '../../../estilos/modulos/comunidades/listadoComunidades.css';
import type { ComunidadVisual } from '../../../tipos/comunidades';

interface PropiedadesListadoComunidades {
  comunidades: ComunidadVisual[];
}

function ListadoComunidades({ comunidades }: PropiedadesListadoComunidades) {
  return (
    <section className="listado-comunidades" aria-labelledby="titulo-listado-comunidades">
      <div className="listado-comunidades__encabezado">
        <div>
          <p className="listado-comunidades__etiqueta">Directorio comunitario</p>
          <h2 id="titulo-listado-comunidades">Comunidades registradas</h2>
        </div>
        <span className="listado-comunidades__conteo">
          {comunidades.length} {comunidades.length === 1 ? 'resultado' : 'resultados'}
        </span>
      </div>

      {comunidades.length === 0 ? (
        <div className="listado-comunidades__vacio">
          <strong>No encontramos comunidades con esos filtros.</strong>
          <span>Prueba cambiando la búsqueda, la zona o el estado.</span>
        </div>
      ) : (
        <div className="listado-comunidades__tabla" role="table" aria-label="Listado de comunidades">
          <div className="listado-comunidades__fila listado-comunidades__fila--encabezado" role="row">
            <span role="columnheader">Comunidad</span>
            <span role="columnheader">Zona</span>
            <span role="columnheader">Estado</span>
          </div>

          {comunidades.map((comunidad) => (
            <div className="listado-comunidades__fila" role="row" key={comunidad.id}>
              <div className="listado-comunidades__nombre" role="cell">
                <strong>{comunidad.nombre}</strong>
                <span>Expediente comunitario</span>
              </div>
              <span role="cell">{comunidad.nombreZona}</span>
              <span role="cell">
                <span className={`listado-comunidades__estado listado-comunidades__estado--${comunidad.estado}`}>
                  {comunidad.estado === 'activa' ? 'Activa' : 'Inactiva'}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default ListadoComunidades;
