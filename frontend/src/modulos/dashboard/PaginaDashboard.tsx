import '../../estilos/modulos/dashboard/dashboard.css';

function PaginaDashboard() {
  return (
    <section className="pagina-dashboard" aria-labelledby="titulo-dashboard">
      <p className="pagina-dashboard__etiqueta">Dashboard</p>
      <h1 id="titulo-dashboard" className="pagina-dashboard__titulo">
        Resumen general
      </h1>
      <p className="pagina-dashboard__descripcion">
        Este módulo mostrará una vista resumida del estado de la gestión comunitaria.
      </p>
    </section>
  );
}

export default PaginaDashboard;
