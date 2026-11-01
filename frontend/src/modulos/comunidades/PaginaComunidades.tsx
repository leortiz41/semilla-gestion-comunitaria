import '../../estilos/modulos/paginaModuloBase.css';

function PaginaComunidades() {
  return (
    <section className="pagina-modulo" aria-labelledby="titulo-comunidades">
      <div className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Gestión territorial</p>
        <h1 id="titulo-comunidades" className="pagina-modulo__titulo">
          Comunidades
        </h1>
        <p className="pagina-modulo__descripcion">
          Organiza las zonas y comunidades atendidas por Semilla y concentra su información general en un solo espacio.
        </p>
        <span className="pagina-modulo__estado">Diseño frontend en construcción</span>
      </div>
    </section>
  );
}

export default PaginaComunidades;
