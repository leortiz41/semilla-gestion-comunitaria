import { useEffect, useState } from 'react';
import PaginaMapaDonante from '../mapa-impacto/PaginaMapaDonante';
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
  tokenAcceso, vista, usuarioId,
}: { tokenAcceso: string; vista: 'proyectos' | 'evidencias'; usuarioId?: string }) {
  const [proyectos, setProyectos] = useState<ProyectoDonante[] | null>(null);
  const [error, setError] = useState('');
  const [seccionEvidencias, setSeccionEvidencias] = useState<'fotografias' | 'mapa'>('fotografias');

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
      {vista === 'evidencias' && (
        <div role="group" aria-label="Vistas de evidencias" className="mapa-impacto__herramientas">
          <button type="button" aria-pressed={seccionEvidencias === 'fotografias'}
            onClick={() => setSeccionEvidencias('fotografias')}>Fotografías</button>
          <button type="button" aria-pressed={seccionEvidencias === 'mapa'}
            onClick={() => setSeccionEvidencias('mapa')}>Mapa de Impacto</button>
        </div>
      )}
      {vista === 'evidencias' && seccionEvidencias === 'mapa' && usuarioId ? (
        <PaginaMapaDonante token={tokenAcceso} usuarioId={usuarioId} />
      ) : (
        <>
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
                {proyecto.porcentajeAvance === null ? <p>Avance global pendiente de ponderación de actividades.</p> : (
                  <>
                    <label>
                      Avance global validado · {proyecto.porcentajeAvance} %
                      <br />
                      <progress value={proyecto.porcentajeAvance} max={100} />
                    </label>
                    {proyecto.fechaAvance && (
                      <p>Última ejecución validada: <time dateTime={proyecto.fechaAvance}>{proyecto.fechaAvance}</time></p>
                    )}
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
        </>
      )}
    </section>
  );
}
