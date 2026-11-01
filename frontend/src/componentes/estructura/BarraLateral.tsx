import logoSemilla from '../../assets/logo-semilla-sidebar.svg';

interface OpcionNavegacion {
  clave: string;
  etiqueta: string;
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

function BarraLateral() {
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
          {opcionesNavegacion.map((opcion) => (
            <li key={opcion.clave} className="barra-lateral__elemento">
              <span className="barra-lateral__opcion">{opcion.etiqueta}</span>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default BarraLateral;
