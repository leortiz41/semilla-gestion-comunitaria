import '../../estilos/estructura/encabezadoAdministrativo.css';

interface PropiedadesEncabezadoAdministrativo {
  correoUsuario: string;
  procesando?: boolean;
  alAbrirPerfil?: () => void;
  alCerrarSesion: () => void;
}

function EncabezadoAdministrativo({
  correoUsuario,
  procesando = false,
  alAbrirPerfil,
  alCerrarSesion,
}: PropiedadesEncabezadoAdministrativo) {
  return (
    <div className="encabezado-administrativo">
      <div>
        <p className="encabezado-administrativo__etiqueta">Área administrativa</p>
        <strong className="encabezado-administrativo__titulo">Semilla</strong>
      </div>

      <div className="encabezado-administrativo__acciones">
        <button
          className="encabezado-administrativo__usuario"
          type="button"
          onClick={alAbrirPerfil}
          disabled={!alAbrirPerfil}
          title="Abrir perfil y seguridad"
        >
          {correoUsuario}
        </button>
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
