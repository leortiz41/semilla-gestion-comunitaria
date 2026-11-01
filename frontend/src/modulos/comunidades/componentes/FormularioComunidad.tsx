interface PropiedadesFormularioComunidad {
  alCerrar: () => void;
}

function FormularioComunidad({ alCerrar }: PropiedadesFormularioComunidad) {
  return (
    <form className="formulario-comunidad">
      <div className="formulario-comunidad__encabezado">
        <div>
          <p className="formulario-comunidad__etiqueta">Registro comunitario</p>
          <h2>Nueva comunidad</h2>
          <p>
            Registra la información general y territorial que servirá como base para el diagnóstico comunitario.
          </p>
        </div>

        <button
          className="formulario-comunidad__cerrar"
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar formulario de comunidad"
        >
          ×
        </button>
      </div>

      <section className="formulario-comunidad__seccion" aria-labelledby="seccion-informacion-general">
        <div className="formulario-comunidad__seccion-encabezado">
          <span className="formulario-comunidad__numero">01</span>
          <div>
            <h3 id="seccion-informacion-general">Información general</h3>
            <p>Identificación y ubicación básica de la comunidad.</p>
          </div>
        </div>

        <div className="formulario-comunidad__campos formulario-comunidad__campos--dos">
          <div className="pagina-comunidades__campo">
            <label htmlFor="nombre-comunidad">Nombre de la comunidad</label>
            <input id="nombre-comunidad" type="text" placeholder="Ej. Agua Azul Rancho" />
          </div>

          <div className="pagina-comunidades__campo">
            <label htmlFor="zona-comunidad">Zona</label>
            <select id="zona-comunidad" defaultValue="">
              <option value="" disabled>Seleccionar zona</option>
              <option value="zona-1">Zona 1</option>
              <option value="zona-2">Zona 2</option>
            </select>
          </div>
        </div>
      </section>

      <section className="formulario-comunidad__seccion" aria-labelledby="seccion-poblacion-vivienda">
        <div className="formulario-comunidad__seccion-encabezado">
          <span className="formulario-comunidad__numero">02</span>
          <div>
            <h3 id="seccion-poblacion-vivienda">Población y vivienda</h3>
            <p>Datos aproximados para comprender la dimensión y las necesidades habitacionales.</p>
          </div>
        </div>

        <div className="formulario-comunidad__campos formulario-comunidad__campos--tres">
          <div className="pagina-comunidades__campo">
            <label htmlFor="poblacion-aproximada">Población aproximada</label>
            <input id="poblacion-aproximada" type="number" min="0" placeholder="Ej. 850" />
          </div>

          <div className="pagina-comunidades__campo">
            <label htmlFor="viviendas-aproximadas">Viviendas aproximadas</label>
            <input id="viviendas-aproximadas" type="number" min="0" placeholder="Ej. 180" />
          </div>

          <div className="pagina-comunidades__campo">
            <label htmlFor="viviendas-intervencion">Viviendas que necesitan intervención</label>
            <input id="viviendas-intervencion" type="number" min="0" placeholder="Ej. 35" />
          </div>
        </div>

        <div className="pagina-comunidades__campo">
          <label htmlFor="tipos-vivienda">Tipos de vivienda predominantes</label>
          <textarea
            id="tipos-vivienda"
            rows={3}
            placeholder="Ej. bloque, adobe, madera, bahareque, techo de zinc..."
          />
        </div>
      </section>

      <p className="formulario-comunidad__aviso">
        Este formulario todavía es visual. Los datos se conectarán a la organización activa cuando trabajemos el backend multi-organización.
      </p>
    </form>
  );
}

export default FormularioComunidad;
