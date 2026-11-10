import { useEffect, useState } from 'react';
import {
  obtenerActividadesProyecto, obtenerProyectosAdministrativos,
  type ActividadProyecto, type ProyectoAdministrativo,
} from '../../lib/api';
import FotografiasAvance from '../proyectos/FotografiasAvance';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/evidencias.css';

export default function PaginaEvidencias({
  token, usuarioEmail, puedeGestionar = false,
}: {
  token: string; usuarioEmail: string; puedeGestionar?: boolean;
}) {
  const [proyectos, setProyectos] = useState<ProyectoAdministrativo[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [actividades, setActividades] = useState<ActividadProyecto[]>([]);
  const [actividadId, setActividadId] = useState('');
  const [avanceId, setAvanceId] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    setCargando(true);
    obtenerProyectosAdministrativos(token).then(
      (datos) => { if (activo) setProyectos(datos.proyectos); },
      (fallo: Error) => { if (activo) setError(fallo.message); },
    ).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [token]);

  useEffect(() => {
    setActividades([]);
    setActividadId('');
    setAvanceId('');
    if (!proyectoId) return;
    let activo = true;
    setCargando(true);
    setError('');
    obtenerActividadesProyecto(token, proyectoId).then(
      (datos) => { if (activo) setActividades(datos.actividades); },
      (fallo: Error) => { if (activo) setError(fallo.message); },
    ).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [token, proyectoId]);

  const actividad = actividades.find((item) => item.id === actividadId);
  const avance = actividad?.avances.find((item) => item.id === avanceId);
  const permitirCarga = Boolean(puedeGestionar && avance &&
    avance.responsable?.toLowerCase() === usuarioEmail.toLowerCase() &&
    (avance.estadoRevision === 'BORRADOR' || avance.estadoRevision === 'DEVUELTO'));

  return (
    <section className="pagina-modulo" aria-labelledby="titulo-evidencias">
      <div className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">HU-15 · Seguimiento documental</p>
        <h1 id="titulo-evidencias" className="pagina-modulo__titulo">Evidencias fotográficas</h1>
        <p className="pagina-modulo__descripcion">
          Seleccioná un proyecto, una actividad y un avance para cargar fotografías de campo o consultar las existentes.
        </p>
      </div>
      <div className="evidencias-explorador">
        <div className="evidencias-explorador__titulo">
          <h2>Fotografías de avances</h2>
          <p>Las fotografías pertenecen a un avance registrado. Solo el responsable puede adjuntarlas
            mientras el avance esté en borrador o devuelto.</p>
        </div>
        {error && <p role="alert" className="evidencias-explorador__error">{error}</p>}
        <div className="evidencias-explorador__filtros">
          <label>1. Proyecto
            <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
              <option value="">Seleccionar proyecto</option>
              {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {p.comunidad}</option>)}
            </select>
          </label>
          <label>2. Actividad
            <select value={actividadId} disabled={!proyectoId || cargando}
              onChange={(e) => { setActividadId(e.target.value); setAvanceId(''); }}>
              <option value="">Seleccionar actividad</option>
              {actividades.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </label>
          <label>3. Avance
            <select value={avanceId} disabled={!actividadId}
              onChange={(e) => setAvanceId(e.target.value)}>
              <option value="">Seleccionar avance</option>
              {actividad?.avances.map((av) => (
                <option key={av.id} value={av.id}>
                  {av.fecha} · {av.estadoRevision === 'BORRADOR' ? 'Borrador' :
                    av.estadoRevision === 'DEVUELTO' ? 'Devuelto' :
                    av.estadoRevision === 'ENVIADO' ? 'En revisión' : 'Validado'}
                  {av.responsable ? ' · ' + av.responsable : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        {cargando && <p role="status">Cargando datos…</p>}
        {proyectoId && !cargando && actividades.length === 0 &&
          <p>Este proyecto todavía no tiene actividades. Primero registrá una en Proyectos → Planificación.</p>}
        {actividad && !actividad.avances.length &&
          <p>Esta actividad todavía no tiene avances. Registrá un avance en Proyectos → Ejecución y guardalo como borrador.</p>}
        {avance && (
          <div className="evidencias-explorador__resultado">
            <h3>{actividad?.nombre}</h3>
            <p>{avance.descripcion}</p>
            {!permitirCarga && <p className="evidencias-explorador__ayuda">
              {['BORRADOR', 'DEVUELTO'].includes(avance.estadoRevision)
                ? 'Para subir fotografías necesitás ser el responsable del avance y contar con el permiso de evidencias.'
                : 'Este avance ya fue enviado o validado. Podés consultar sus fotografías, pero no agregar nuevas.'}
            </p>}
            <FotografiasAvance key={avance.id} token={token} proyectoId={proyectoId}
              actividadId={actividadId} avanceId={avance.id} permitirCarga={permitirCarga} />
          </div>
        )}
        {!proyectoId && <p className="evidencias-explorador__ayuda">
          Para empezar una prueba, seleccioná un proyecto que tenga una actividad y un avance guardado como borrador.
        </p>}
      </div>
    </section>
  );
}
