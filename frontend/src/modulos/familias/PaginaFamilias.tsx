import '../../estilos/modulos/paginaModuloBase.css';

function PaginaFamilias() {
  return (
    <section className="pagina-modulo" aria-labelledby="titulo-familias">
      <div className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Gestión social</p>
        <h1 id="titulo-familias" className="pagina-modulo__titulo">
          Familias
        </h1>
        <p className="pagina-modulo__descripcion">
          Centraliza la información de las familias acompañadas, sus integrantes y los datos necesarios para dar seguimiento a su proceso comunitario.
        </p>
        <span className="pagina-modulo__estado">Diseño frontend en construcción</span>
      </div>
    </section>
  );
}

export default PaginaFamilias;
