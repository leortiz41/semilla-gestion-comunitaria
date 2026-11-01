const categoriasVisionDesarrollo = [
  'Evangelismo',
  'Educación formal',
  'Educación comunitaria',
  'Infraestructura',
];

const tiposOrganizacionComunitaria = [
  'Patronato',
  'Junta de agua',
  'Iglesias',
  'Comité de pescadores',
  'Comité de mujeres',
  'Comité de jóvenes',
  'Cooperativa',
  'Asociación de productores',
  'Caja rural',
];

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

      <details className="formulario-comunidad__acordeon" open>
        <summary className="formulario-comunidad__acordeon-resumen">
          <div className="formulario-comunidad__seccion-encabezado">
            <span className="formulario-comunidad__numero">01</span>
            <div>
              <h3>Información general</h3>
              <p>Identificación y ubicación básica de la comunidad.</p>
            </div>
          </div>
          <span className="formulario-comunidad__acordeon-indicador" aria-hidden="true">⌄</span>
        </summary>

        <div className="formulario-comunidad__acordeon-contenido">
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
        </div>
      </details>

      <details className="formulario-comunidad__acordeon">
        <summary className="formulario-comunidad__acordeon-resumen">
          <div className="formulario-comunidad__seccion-encabezado">
            <span className="formulario-comunidad__numero">02</span>
            <div>
              <h3>Población y vivienda</h3>
              <p>Datos aproximados para comprender la dimensión y las necesidades habitacionales.</p>
            </div>
          </div>
          <span className="formulario-comunidad__acordeon-indicador" aria-hidden="true">⌄</span>
        </summary>

        <div className="formulario-comunidad__acordeon-contenido">
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
        </div>
      </details>

      <details className="formulario-comunidad__acordeon">
        <summary className="formulario-comunidad__acordeon-resumen">
          <div className="formulario-comunidad__seccion-encabezado">
            <span className="formulario-comunidad__numero">03</span>
            <div>
              <h3>Visión de desarrollo</h3>
              <p>Define la situación actual, la prioridad y la visión futura de cada área de desarrollo.</p>
            </div>
          </div>
          <span className="formulario-comunidad__acordeon-indicador" aria-hidden="true">⌄</span>
        </summary>

        <div className="formulario-comunidad__acordeon-contenido">
          <div className="formulario-comunidad__vision">
            {categoriasVisionDesarrollo.map((categoria, indice) => {
              const identificador = `vision-${indice}`;

              return (
                <article className="formulario-comunidad__vision-item" key={categoria}>
                  <div className="formulario-comunidad__vision-titulo">
                    <span>{String(indice + 1).padStart(2, '0')}</span>
                    <h4>{categoria}</h4>
                  </div>

                  <div className="formulario-comunidad__campos formulario-comunidad__campos--dos">
                    <div className="pagina-comunidades__campo">
                      <label htmlFor={`${identificador}-situacion`}>Situación actual</label>
                      <textarea
                        id={`${identificador}-situacion`}
                        rows={3}
                        placeholder="Describe brevemente la situación actual de esta área."
                      />
                    </div>

                    <div className="pagina-comunidades__campo">
                      <label htmlFor={`${identificador}-vision`}>Visión o meta de desarrollo</label>
                      <textarea
                        id={`${identificador}-vision`}
                        rows={3}
                        placeholder="¿Cómo espera la comunidad avanzar en esta área?"
                      />
                    </div>
                  </div>

                  <div className="pagina-comunidades__campo formulario-comunidad__prioridad">
                    <label htmlFor={`${identificador}-prioridad`}>Prioridad</label>
                    <select id={`${identificador}-prioridad`} defaultValue="">
                      <option value="" disabled>Seleccionar prioridad</option>
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </details>

      <details className="formulario-comunidad__acordeon">
        <summary className="formulario-comunidad__acordeon-resumen">
          <div className="formulario-comunidad__seccion-encabezado">
            <span className="formulario-comunidad__numero">04</span>
            <div>
              <h3>Organizaciones comunitarias activas</h3>
              <p>Identifica las estructuras locales que participan en la organización y representación comunitaria.</p>
            </div>
          </div>
          <span className="formulario-comunidad__acordeon-indicador" aria-hidden="true">⌄</span>
        </summary>

        <div className="formulario-comunidad__acordeon-contenido">
          <fieldset className="formulario-comunidad__selecciones">
            <legend>Tipos de organización presentes</legend>
            <div className="formulario-comunidad__selecciones-grid">
              {tiposOrganizacionComunitaria.map((tipo) => (
                <label className="formulario-comunidad__seleccion" key={tipo}>
                  <input type="checkbox" name="organizaciones-comunitarias" value={tipo} />
                  <span>{tipo}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="formulario-comunidad__campos formulario-comunidad__campos--dos">
            <div className="pagina-comunidades__campo">
              <label htmlFor="otras-organizaciones">Otras organizaciones</label>
              <input
                id="otras-organizaciones"
                type="text"
                placeholder="Ej. comité ambiental, grupo deportivo..."
              />
            </div>

            <div className="pagina-comunidades__campo">
              <label htmlFor="detalle-organizaciones">Observaciones</label>
              <textarea
                id="detalle-organizaciones"
                rows={3}
                placeholder="Nombres, alcance, nivel de actividad u otra información relevante."
              />
            </div>
          </div>
        </div>
      </details>

      <p className="formulario-comunidad__aviso">
        Este formulario todavía es visual. Los datos se conectarán a la organización activa cuando trabajemos el backend multi-organización.
      </p>
    </form>
  );
}

export default FormularioComunidad;
