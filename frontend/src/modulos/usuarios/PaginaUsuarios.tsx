import '../../estilos/modulos/paginaModuloBase.css';

function PaginaUsuarios() {
  return (
    <section className="pagina-modulo" aria-labelledby="titulo-usuarios">
      <div className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Administración de acceso</p>
        <h1 id="titulo-usuarios" className="pagina-modulo__titulo">
          Usuarios
        </h1>
        <p className="pagina-modulo__descripcion">
          Administra las cuentas que acceden a Semilla y prepara la gestión visual de roles, permisos y estado de cada usuario.
        </p>
        <span className="pagina-modulo__estado">Diseño frontend en construcción</span>
      </div>
    </section>
  );
}

export default PaginaUsuarios;
