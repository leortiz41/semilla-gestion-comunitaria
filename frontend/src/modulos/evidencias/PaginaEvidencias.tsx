import { useEffect, useRef, useState } from 'react';
import {
  obtenerActividadesProyecto, obtenerIndiceFotografias, obtenerProyectosAdministrativos,
  type ActividadProyecto, type AvanceConFotografias, type ProyectoAdministrativo,
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
  const [indice, setIndice] = useState<AvanceConFotografias[]>([]);
  const [errorIndice, setErrorIndice] = useState('');
  const [cargandoIndice, setCargandoIndice] = useState(false);
  const [recargaIndice, setRecargaIndice] = useState(0);
  const pendienteSeleccion = useRef<AvanceConFotografias | null>(null);
  const [soloConFotografias, setSoloConFotografias] = useState(false);

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
      (datos) => {
        if (!activo) return;
        setActividades(datos.actividades);
        const pendiente = pendienteSeleccion.current;
        if (pendiente && pendiente.proyectoId === proyectoId) {
          const encontrada = datos.actividades.find((a) => a.id === pendiente.actividadId);
          if (encontrada?.avances.some((av) => av.id === pendiente.avanceId)) {
            setActividadId(pendiente.actividadId);
            setAvanceId(pendiente.avanceId);
          }
          pendienteSeleccion.current = null;
        }
      },
      (fallo: Error) => { if (activo) setError(fallo.message); },
    ).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [token, proyectoId]);

  useEffect(() => {
    let activo = true;
    setCargandoIndice(true);
    obtenerIndiceFotografias(token).then(
      (datos) => { if (activo) { setIndice(datos.avances); setErrorIndice(''); } },
      (fallo: Error) => { if (activo) setErrorIndice(fallo.message); },
    ).finally(() => { if (activo) setCargandoIndice(false); });
    return () => { activo = false; };
  }, [token, recargaIndice]);

  function abrirEvidencia(item: AvanceConFotografias) {
    setError('');
    if (item.proyectoId === proyectoId) {
      setActividadId(item.actividadId);
      setAvanceId(item.avanceId);
    } else {
      pendienteSeleccion.current = item;
      setProyectoId(item.proyectoId);
    }
  }

  const actividad = actividades.find((item) => item.id === actividadId);
  const actividadesVisibles = soloConFotografias
    ? actividades.filter((item) => item.avances.some((av) => av.cantidadEvidencias > 0))
    : actividades;
  const avancesVisibles = soloConFotografias
    ? (actividad?.avances ?? []).filter((av) => av.cantidadEvidencias > 0)
    : (actividad?.avances ?? []);
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
        <section className="evidencias-indice" aria-label="Avances con fotografías guardadas">
          <div className="evidencias-indice__cabecera">
            <div>
              <h3>Encontrar fotografías guardadas</h3>
              <p>Seleccioná un avance para abrir directamente sus imágenes, sin buscar en cada proyecto.</p>
            </div>
            <button type="button" onClick={() => setRecargaIndice((n) => n + 1)}
              disabled={cargandoIndice}>Actualizar</button>
          </div>
          {errorIndice && <p role="alert" className="evidencias-explorador__error">{errorIndice}</p>}
          {cargandoIndice && <p role="status">Buscando avances con fotografías…</p>}
          {!cargandoIndice && indice.length === 0 && !errorIndice &&
            <p className="evidencias-explorador__ayuda">Todavía no hay fotografías registradas en los proyectos a los que tenés acceso.</p>}
          {indice.length > 0 && (
            <div className="evidencias-indice__lista">
              {indice.map((item) => (
                <button key={item.avanceId} type="button" onClick={() => abrirEvidencia(item)}
                  aria-pressed={avanceId === item.avanceId && proyectoId === item.proyectoId}>
                  <strong>{item.proyecto}</strong>
                  <span>{item.actividad} · {item.comunidad}</span>
                  <small>{item.fecha} · {item.estadoRevision === 'BORRADOR' ? 'Borrador' :
                    item.estadoRevision === 'ENVIADO' ? 'En revisión' :
                    item.estadoRevision === 'VALIDADO' ? 'Validado' : 'Devuelto'}</small>
                  <span className="evidencias-indice__cantidad">{item.cantidadEvidencias} {item.cantidadEvidencias === 1 ? 'fotografía' : 'fotografías'}</span>
                </button>
              ))}
            </div>
          )}
        </section>
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
              {actividadesVisibles.map((a) => <option key={a.id} value={a.id}>
                {a.nombre} · {a.avances.reduce((total, av) => total + (av.cantidadEvidencias ?? 0), 0)} fotos
              </option>)}
            </select>
          </label>
          <label>3. Avance
            <select value={avanceId} disabled={!actividadId}
              onChange={(e) => setAvanceId(e.target.value)}>
              <option value="">Seleccionar avance</option>
              {avancesVisibles.map((av) => (
                <option key={av.id} value={av.id}>
                  {av.fecha} · {av.estadoRevision === 'BORRADOR' ? 'Borrador' :
                    av.estadoRevision === 'DEVUELTO' ? 'Devuelto' :
                    av.estadoRevision === 'ENVIADO' ? 'En revisión' : 'Validado'}
                  {av.responsable ? ' · ' + av.responsable : ''}
                  {' · ' + (av.cantidadEvidencias ?? 0) + ' fotos'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="evidencias-explorador__check">
          <input type="checkbox" checked={soloConFotografias}
            onChange={(e) => {
              setSoloConFotografias(e.target.checked);
              setActividadId('');
              setAvanceId('');
            }} />
          Mostrar solo actividades y avances que tienen fotografías
        </label>
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
              actividadId={actividadId} avanceId={avance.id} permitirCarga={permitirCarga}
              onCambio={(cantidad) => {
                setActividades((actual) => actual.map((item) => item.id !== actividadId ? item : {
                  ...item,
                  avances: item.avances.map((registro) => registro.id === avance.id
                    ? { ...registro, cantidadEvidencias: cantidad } : registro),
                }));
                setRecargaIndice((actual) => actual + 1);
              }} />
          </div>
        )}
        {!proyectoId && <p className="evidencias-explorador__ayuda">
          Para empezar una prueba, seleccioná un proyecto que tenga una actividad y un avance guardado como borrador.
        </p>}
      </div>
    </section>
  );
}
