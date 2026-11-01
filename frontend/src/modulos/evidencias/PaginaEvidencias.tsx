import '../../estilos/modulos/paginaModuloBase.css';

function PaginaEvidencias() {
  return (
    <section className="pagina-modulo" aria-labelledby="titulo-evidencias">
      <div className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Seguimiento documental</p>
        <h1 id="titulo-evidencias" className="pagina-modulo__titulo">
          Evidencias
        </h1>
        <p className="pagina-modulo__descripcion">
          Documenta avances, actividades y resultados mediante fotografías, archivos, observaciones y otros respaldos de campo.
        </p>
        <span className="pagina-modulo__estado">Diseño frontend en construcción</span>
      </div>
    </section>
  );
}

export default PaginaEvidencias;
