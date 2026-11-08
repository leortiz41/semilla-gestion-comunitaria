import '../../../estilos/modulos/comunidades/listadoComunidades.css';
import type { ComunidadResumen } from '../../../lib/api';

interface PropiedadesListadoComunidades {
  comunidades: ComunidadResumen[];
  cargando?: boolean;
  alEditar?: (comunidad: ComunidadResumen) => void;
  alVerExpediente?: (comunidad: ComunidadResumen) => void;
  alCambiarEstado?: (comunidad: ComunidadResumen) => void;
  comunidadProcesandoId?: string | null;
}

function obtenerEstadoVisual(comunidad: ComunidadResumen) {
  if (!comunidad.activo) {
    return { clase: 'inactiva', etiqueta: 'Inactiva' };
  }

  if (comunidad.zonaActiva === false) {
    return { clase: 'zona-inactiva', etiqueta: 'Zona inactiva' };
  }

  return { clase: 'activa', etiqueta: 'Activa' };
}

function ListadoComunidades({
  comunidades,
  cargando = false,
  alEditar,
  alVerExpediente,
  alCambiarEstado,
  comunidadProcesandoId,
}: PropiedadesListadoComunidades) {
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

      {cargando ? (
        <div className="listado-comunidades__vacio">
          <strong>Actualizando comunidades…</strong>
          <span>Consultando la información registrada en la base de datos.</span>
        </div>
      ) : comunidades.length === 0 ? (
        <div className="listado-comunidades__vacio">
          <strong>No encontramos comunidades con esos filtros.</strong>
          <span>Prueba cambiando la búsqueda, la zona o el estado.</span>
        </div>
      ) : (
        <div className="listado-comunidades__tabla" role="table" aria-label="Listado de comunidades">
          <div className="listado-comunidades__fila listado-comunidades__fila--encabezado" role="row">
            <span role="columnheader">Comunidad</span>
            <span role="columnheader">Zona</span>
            <span role="columnheader">Municipio</span>
            <span role="columnheader">Departamento</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader">Acciones</span>
          </div>

          {comunidades.map((comunidad) => {
            const estadoVisual = obtenerEstadoVisual(comunidad);
            const procesando = comunidadProcesandoId === comunidad.id;

            return (
              <div className="listado-comunidades__fila" role="row" key={comunidad.id}>
                <div className="listado-comunidades__nombre" role="cell">
                  <strong>{comunidad.nombre}</strong>
                  <span>Expediente comunitario</span>
                </div>
                <span role="cell">
                  {comunidad.nombreZona || 'Sin zona'}
                  {comunidad.zonaActiva === false ? ' · Inactiva' : ''}
                </span>
                <span role="cell">{comunidad.municipio}</span>
                <span role="cell">{comunidad.departamento}</span>
                <span role="cell">
                  <span className={`listado-comunidades__estado listado-comunidades__estado--${estadoVisual.clase}`}>
                    {estadoVisual.etiqueta}
                  </span>
                </span>
                <span role="cell" className="listado-comunidades__acciones">
                  {alVerExpediente && (
                    <button
                      className="listado-comunidades__boton-editar listado-comunidades__boton-editar--expediente"
                      type="button"
                      disabled={procesando}
                      onClick={() => alVerExpediente(comunidad)}
                    >
                      Expediente
                    </button>
                  )}
                  {alEditar && (
                    <button
                      className="listado-comunidades__boton-editar"
                      type="button"
                      disabled={procesando}
                      onClick={() => alEditar(comunidad)}
                    >
                      Editar
                    </button>
                  )}
                  {alCambiarEstado && (
                    <button
                      className={
                        comunidad.activo
                          ? 'listado-comunidades__boton-editar listado-comunidades__boton-editar--desactivar'
                          : 'listado-comunidades__boton-editar listado-comunidades__boton-editar--reactivar'
                      }
                      type="button"
                      disabled={procesando}
                      onClick={() => alCambiarEstado(comunidad)}
                    >
                      {procesando
                        ? 'Guardando…'
                        : comunidad.activo
                          ? 'Desactivar'
                          : 'Reactivar'}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ListadoComunidades;
