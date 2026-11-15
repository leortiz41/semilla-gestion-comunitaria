import { useEffect, useState } from 'react';
import MapaReactFlow from './componentes/MapaReactFlow';
import { obtenerProyectosDonante, type ProyectoDonante } from '../../lib/api';
import type { DetalleImpacto } from '../../servicios/mapa-impacto/servicioMapaImpacto';
import '../../estilos/modulos/mapa-impacto/mapaImpacto.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function PaginaMapaDonante({ token, usuarioId }: { token: string; usuarioId: string }) {
  const [proyectos, setProyectos] = useState<ProyectoDonante[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [detalle, setDetalle] = useState<DetalleImpacto | null>(null);
  const [seleccion, setSeleccion] = useState<{ tipo: string; id: string } | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    obtenerProyectosDonante(token).then(({ proyectos: permitidos }) => {
      if (!activo) return;
      setProyectos(permitidos);
      setProyectoId((anterior) => permitidos.some((p) => p.id === anterior)
        ? anterior : (permitidos[0]?.id ?? ''));
      if (!permitidos.length) setCargando(false);
    }).catch((e: Error) => {
      if (activo) { setError(e.message); setCargando(false); }
    });
    return () => { activo = false; };
  }, [token]);

  useEffect(() => {
    if (!proyectoId) { setDetalle(null); return; }
    let activo = true;
    setCargando(true);
    setError('');
    setDetalle(null);
    setSeleccion(null);
    fetch(`${API}/donantes/mapa/proyectos/${encodeURIComponent(proyectoId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).then(async (respuesta) => {
      if (!respuesta.ok) throw new Error(
        (await respuesta.json().catch(() => ({})) as { message?: string }).message
          || 'No se pudo consultar el mapa de avances.'
      );
      return respuesta.json() as Promise<DetalleImpacto>;
    }).then((datos) => {
      if (!activo) return;
      if (datos.proyecto.id !== proyectoId) throw new Error('El proyecto no coincide con la selección.');
      setDetalle(datos);
      setSeleccion({ tipo: 'proyecto', id: datos.proyecto.id });
    }).catch((e: Error) => { if (activo) setError(e.message); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [token, proyectoId]);

  const seleccionado = seleccion?.tipo === 'actividad'
    ? detalle?.actividades.find((a) => a.id === seleccion.id)?.nombre
    : seleccion?.tipo === 'avance'
      ? detalle?.avances.find((a) => a.id === seleccion.id)?.descripcion
      : seleccion?.tipo === 'comunidad' ? detalle?.proyecto.comunidad
      : seleccion?.tipo === 'evidencias' ? 'Evidencias compartidas'
      : detalle?.proyecto.nombre;

  return (
    <section className="pagina-mapa-impacto" aria-labelledby="titulo-mapa-donante">
      <header className="mapa-impacto__encabezado">
        <div>
          <p className="mapa-impacto__etiqueta">Semilla · Portal del donante</p>
          <h1 id="titulo-mapa-donante">Mapa de Avances</h1>
          <p>Explorá únicamente los proyectos asignados a tu cuenta, sus avances validados y fotografías compartidas.</p>
        </div>
      </header>
      <div className="mapa-impacto__herramientas">
        <label>Proyecto patrocinado
          <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
            {!proyectos.length && <option value="">Sin proyectos asignados</option>}
            {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {cargando && <p role="status">Cargando mapa de avances…</p>}
      {!cargando && !error && !proyectos.length && <p>Tu cuenta todavía no tiene proyectos autorizados.</p>}
      {detalle && !cargando && (
        <>
          <div style={{ minHeight: 510 }}>
            <MapaReactFlow
              key={detalle.proyecto.id}
              datos={detalle}
              usuarioId={usuarioId}
              seleccion={seleccion}
              seleccionar={(tipo, id) => setSeleccion({ tipo, id })}
              soloLectura
            />
          </div>
          <div className="mapa-impacto__leyenda" aria-live="polite">
            <strong>Selección:</strong> {seleccionado || 'Proyecto'}.
            {' '}Avances validados: {detalle.avances.length}.
            {' '}Fotografías autorizadas: {detalle.evidencias.length}.
          </div>
          {seleccion?.tipo === 'evidencias' && (
            <div className="roles-panel">
              {detalle.evidencias.filter((f) => f.avanceId === seleccion.id).map((foto) => (
                <a key={foto.id} href={foto.url || undefined} target="_blank" rel="noopener noreferrer">
                  {foto.titulo || 'Fotografía del avance'}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
