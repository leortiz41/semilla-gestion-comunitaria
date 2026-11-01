import logoSemilla from '../../assets/logo-semilla-app.png';
import type { SeccionBarraLateral, SubseccionComunidades } from '../../tipos/navegacion';

interface OpcionNavegacion {
  clave: SeccionBarraLateral;
  etiqueta: string;
}

interface PropiedadesBarraLateral {
  seccionActiva?: SeccionBarraLateral;
  subseccionComunidades: SubseccionComunidades;
  alCambiarSeccion: (seccion: SeccionBarraLateral) => void;
  alCambiarSubseccionComunidades: (subseccion: SubseccionComunidades) => void;
}

const opcionesNavegacion: OpcionNavegacion[] = [
  { clave: 'dashboard', etiqueta: 'Dashboard' },
  { clave: 'comunidades', etiqueta: 'Comunidades' },
  { clave: 'familias', etiqueta: 'Familias' },
  { clave: 'proyectos', etiqueta: 'Proyectos' },
  { clave: 'evidencias', etiqueta: 'Evidencias' },
  { clave: 'pagos', etiqueta: 'Pagos' },
  { clave: 'usuarios', etiqueta: 'Usuarios' },
  { clave: 'auditoria', etiqueta: 'Auditoría' },
];

function BarraLateral({
  seccionActiva,
  subseccionComunidades,
  alCambiarSeccion,
  alCambiarSubseccionComunidades,
}: PropiedadesBarraLateral) {
  function abrirComunidades(subseccion: SubseccionComunidades) {
    alCambiarSeccion('comunidades');
    alCambiarSubseccionComunidades(subseccion);
  }

  return (
    <div className="barra-lateral">
      <div className="barra-lateral__marca">
        <img
          className="barra-lateral__simbolo"
          src={logoSemilla}
          alt="Logo de Semilla"
        />
        <div>
          <strong>Semilla</strong>
          <span>Gestión comunitaria</span>
        </div>
      </div>

      <nav className="barra-lateral__navegacion" aria-label="Navegación administrativa">
        <p className="barra-lateral__titulo">Módulos</p>
        <ul className="barra-lateral__lista">
          {opcionesNavegacion.map((opcion) => {
            const estaActiva = seccionActiva === opcion.clave;
            const esComunidades = opcion.clave === 'comunidades';

            return (
              <li key={opcion.clave} className="barra-lateral__elemento">
                <button
                  className={`barra-lateral__opcion${estaActiva ? ' barra-lateral__opcion--activa' : ''}`}
                  type="button"
                  onClick={() => {
                    alCambiarSeccion(opcion.clave);
                    if (esComunidades) alCambiarSubseccionComunidades('listado');
                  }}
                  aria-current={estaActiva ? 'page' : undefined}
                >
                  {opcion.etiqueta}
                </button>

                {esComunidades && estaActiva && (
                  <div className="barra-lateral__subnavegacion" aria-label="Opciones de comunidades">
                    <button
                      className={`barra-lateral__subopcion${subseccionComunidades === 'listado' ? ' barra-lateral__subopcion--activa' : ''}`}
                      type="button"
                      onClick={() => abrirComunidades('listado')}
                    >
                      Listado
                    </button>
                    <button
                      className={`barra-lateral__subopcion${subseccionComunidades === 'nueva' ? ' barra-lateral__subopcion--activa' : ''}`}
                      type="button"
                      onClick={() => abrirComunidades('nueva')}
                    >
                      Nueva comunidad
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export default BarraLateral;
