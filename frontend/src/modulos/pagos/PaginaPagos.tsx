import '../../estilos/modulos/paginaModuloBase.css';

function PaginaPagos() {
  return (
    <section className="pagina-modulo" aria-labelledby="titulo-pagos">
      <div className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Gestión financiera</p>
        <h1 id="titulo-pagos" className="pagina-modulo__titulo">
          Pagos
        </h1>
        <p className="pagina-modulo__descripcion">
          Registra y consulta los movimientos de pago relacionados con actividades, proveedores, personal y recursos de los proyectos.
        </p>
        <span className="pagina-modulo__estado">Diseño frontend en construcción</span>
      </div>
    </section>
  );
}

export default PaginaPagos;
