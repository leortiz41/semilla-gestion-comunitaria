import '../../estilos/modulos/paginaModuloBase.css';

function PaginaProyectos() {
  return (
    <section className="pagina-modulo" aria-labelledby="titulo-proyectos">
      <div className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Gestión de iniciativas</p>
        <h1 id="titulo-proyectos" className="pagina-modulo__titulo">
          Proyectos
        </h1>
        <p className="pagina-modulo__descripcion">
          Planifica y da seguimiento a las iniciativas comunitarias, sus objetivos, responsables, etapas y resultados esperados.
        </p>
        <span className="pagina-modulo__estado">Diseño frontend en construcción</span>
      </div>
    </section>
  );
}

export default PaginaProyectos;
