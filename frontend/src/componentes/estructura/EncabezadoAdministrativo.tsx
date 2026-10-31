import '../../estilos/estructura/encabezadoAdministrativo.css';

interface PropiedadesEncabezadoAdministrativo {
  correoUsuario: string;
  procesando?: boolean;
  alCerrarSesion: () => void;
}

function EncabezadoAdministrativo({
  correoUsuario,
  procesando = false,
  alCerrarSesion,
}: PropiedadesEncabezadoAdministrativo) {
  return (
    <div className="encabezado-administrativo">
      <div>
        <p className="encabezado-administrativo__etiqueta">Área administrativa</p>
        <strong className="encabezado-administrativo__titulo">Semilla</strong>
      </div>

      <div className="encabezado-administrativo__acciones">
        <span className="encabezado-administrativo__usuario">{correoUsuario}</span>
        <button
          className="encabezado-administrativo__cerrar-sesion"
          type="button"
          onClick={alCerrarSesion}
          disabled={procesando}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export default EncabezadoAdministrativo;
