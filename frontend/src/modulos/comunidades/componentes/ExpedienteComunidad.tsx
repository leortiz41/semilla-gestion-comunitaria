import type { ComunidadResumen } from '../../../lib/api';
import SeccionPoblacionVivienda from './SeccionPoblacionVivienda';
import SeccionVisionDesarrollo from './SeccionVisionDesarrollo';

interface PropiedadesExpedienteComunidad {
  comunidad: ComunidadResumen;
  tokenAcceso: string;
  alVolver: () => void;
  alEditarInformacionGeneral: () => void;
}

function obtenerEstado(comunidad: ComunidadResumen) {
  if (!comunidad.activo) return 'Inactiva';
  if (comunidad.zonaActiva === false) return 'Zona inactiva';
  return 'Activa';
}

function ExpedienteComunidad({
  comunidad,
  tokenAcceso,
  alVolver,
  alEditarInformacionGeneral,
}: PropiedadesExpedienteComunidad) {
  return (
    <section className="pagina-modulo pagina-comunidades" aria-labelledby="titulo-expediente-comunidad">
      <div className="pagina-comunidades__vista-superior">
        <div>
          <p className="pagina-modulo__etiqueta">Comunidades / Expediente</p>
          <h1 id="titulo-expediente-comunidad" className="pagina-modulo__titulo">
            {comunidad.nombre}
          </h1>
          <p className="pagina-modulo__descripcion">
            Consulta y completa el diagnóstico territorial y de desarrollo de esta comunidad por secciones.
          </p>
        </div>

        <button className="pagina-comunidades__boton-secundario" type="button" onClick={alVolver}>
          ← Volver al listado
        </button>
      </div>

      <section className="expediente-comunidad__resumen" aria-label="Resumen del expediente comunitario">
        <div>
          <span>Zona</span>
          <strong>{comunidad.nombreZona || 'Sin zona asignada'}</strong>
        </div>
        <div>
          <span>Municipio</span>
          <strong>{comunidad.municipio}</strong>
        </div>
        <div>
          <span>Departamento</span>
          <strong>{comunidad.departamento}</strong>
        </div>
        <div>
          <span>Estado</span>
          <strong>{obtenerEstado(comunidad)}</strong>
        </div>
      </section>

      <div className="expediente-comunidad__secciones">
        <article className="expediente-comunidad__seccion">
          <div>
            <p className="expediente-comunidad__etiqueta">01 · Identificación territorial</p>
            <h2>Información general</h2>
            <p>Nombre, zona, municipio y departamento de la comunidad.</p>
          </div>
          <button
            className="listado-comunidades__boton-editar"
            type="button"
            onClick={alEditarInformacionGeneral}
          >
            Editar información
          </button>
        </article>

        <SeccionPoblacionVivienda comunidadId={comunidad.id} tokenAcceso={tokenAcceso} />

        <SeccionVisionDesarrollo comunidadId={comunidad.id} tokenAcceso={tokenAcceso} />

        <article className="expediente-comunidad__seccion expediente-comunidad__seccion--pendiente">
          <div>
            <p className="expediente-comunidad__etiqueta">04 · Capacidades locales</p>
            <h2>Organización y productividad</h2>
            <p>Organizaciones comunitarias, actividades económicas y oportunidades de desarrollo.</p>
          </div>
          <span>Próxima sección</span>
        </article>
      </div>
    </section>
  );
}

export default ExpedienteComunidad;
