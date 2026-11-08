import { useEffect, useState } from 'react';
import { obtenerProyectosDonante, type ProyectoDonante } from '../../lib/api';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/roles.css';

const estados: Record<string, string> = {
  PLANIFICADO: 'Planificado',
  EN_EJECUCION: 'En ejecución',
  PAUSADO: 'Pausado',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

export default function SeguimientoDonante({
  tokenAcceso, vista,
}: { tokenAcceso: string; vista: 'proyectos' | 'evidencias' }) {
  const [proyectos, setProyectos] = useState<ProyectoDonante[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setProyectos(null);
    setError('');
    obtenerProyectosDonante(tokenAcceso).then(
      (respuesta) => { if (vigente) setProyectos(respuesta.proyectos); },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    );
    return () => { vigente = false; };
  }, [tokenAcceso]);

  return (
    <section className="pagina-modulo" aria-labelledby="titulo-seguimiento">
      <div className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Portal de donantes</p>
        <h1 id="titulo-seguimiento" className="pagina-modulo__titulo">
          {vista === 'proyectos' ? 'Proyectos' : 'Evidencias'}
        </h1>
      </div>
      {error && <p role="alert">{error}</p>}
      {!error && proyectos === null && <p role="status">Cargando proyectos…</p>}
      {proyectos?.length === 0 && <p>Todavía no hay proyectos autorizados para tu cuenta.</p>}
      <div className="roles-panel">
        {proyectos?.map((proyecto) => (
          <article key={proyecto.id} className="roles-panel__tarjeta">
            <h2>{proyecto.nombre}</h2>
            {vista === 'proyectos' ? (
              <>
                <p>{estados[proyecto.estado] ?? proyecto.estado}</p>
                {proyecto.porcentajeAvance === null ? <p>Avance pendiente de registrar.</p> : (
                  <>
                    <label>
                      Avance registrado · {proyecto.porcentajeAvance} %
                      <br />
                      <progress value={proyecto.porcentajeAvance} max={100} />
                    </label>
                    <p>Último avance: <time dateTime={proyecto.fechaAvance ?? undefined}>{proyecto.fechaAvance}</time></p>
                  </>
                )}
              </>
            ) : proyecto.evidencias.length ? (
              <ul>
                {proyecto.evidencias.map((evidencia) => (
                  <li key={evidencia.id}>
                    <a href={evidencia.url} target="_blank" rel="noopener noreferrer">
                      {evidencia.titulo || evidencia.tipo}
                    </a>
                  </li>
                ))}
              </ul>
            ) : <p>Todavía no hay evidencias compartidas para este proyecto.</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
