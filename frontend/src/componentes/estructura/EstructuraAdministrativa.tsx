import type { ReactNode } from 'react';
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
  return (
    <div className="estructura-administrativa">
      {barraLateral && (
        <aside className="estructura-administrativa__lateral">
          {barraLateral}
        </aside>
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
