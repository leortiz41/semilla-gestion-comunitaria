import '../../estilos/modulos/paginaModuloBase.css';

function PaginaAuditoria() {
  return (
    <section className="pagina-modulo" aria-labelledby="titulo-auditoria">
      <div className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Trazabilidad del sistema</p>
        <h1 id="titulo-auditoria" className="pagina-modulo__titulo">
          Auditoría
        </h1>
        <p className="pagina-modulo__descripcion">
          Consulta la trazabilidad de acciones relevantes realizadas dentro de Semilla para apoyar el control y la supervisión administrativa.
        </p>
        <span className="pagina-modulo__estado">Diseño frontend en construcción</span>
      </div>
    </section>
  );
}

export default PaginaAuditoria;
