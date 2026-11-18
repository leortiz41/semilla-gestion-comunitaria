import { useState, type ReactNode } from 'react';
import '../../estilos/estructura/estructuraAdministrativa.css';

interface PropiedadesEstructuraAdministrativa {
  barraLateral?: ReactNode;
  encabezado?: ReactNode;
  contenido: ReactNode;
}

function EstructuraAdministrativa({
  barraLateral,
  encabezado,
  contenido,
}: PropiedadesEstructuraAdministrativa) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="estructura-administrativa">
      {barraLateral && (
        <>
          <div className="estructura-administrativa__navegacion-movil">
            <button
              type="button"
              className="estructura-administrativa__alternar-menu"
              aria-controls="navegacion-institucional"
              aria-expanded={menuAbierto}
              onClick={() => setMenuAbierto((actual) => !actual)}
            >
              <span aria-hidden="true">{menuAbierto ? '✕' : '☰'}</span>
              {menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            </button>
            <span className="estructura-administrativa__modulo-actual">Navegación</span>
          </div>
          <aside
            id="navegacion-institucional"
            className={`estructura-administrativa__lateral${menuAbierto ? ' estructura-administrativa__lateral--abierta' : ''}`}
            onClick={(evento) => {
              if ((evento.target as HTMLElement).closest('button')) setMenuAbierto(false);
            }}
            onKeyDown={(evento) => {
              if (evento.key === 'Escape') setMenuAbierto(false);
            }}
          >
            {barraLateral}
          </aside>
        </>
      )}

      <div className="estructura-administrativa__principal">
        {encabezado && (
          <header className="estructura-administrativa__encabezado">
            {encabezado}
          </header>
        )}

        <section className="estructura-administrativa__contenido">
          {contenido}
        </section>
      </div>
    </div>
  );
}

export default EstructuraAdministrativa;
