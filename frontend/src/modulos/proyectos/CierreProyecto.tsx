import { useEffect, useState } from 'react';
import {
  obtenerVerificacionCierre, finalizarProyectoAdministrativo,
  reabrirProyectoAdministrativo, type VerificacionCierreProyecto,
} from '../../lib/api';
import '../../estilos/modulos/proyectos/cierre-proyecto.css';

export default function CierreProyecto({
  token, proyectoId, estado, puedeGestionar, onCambio,
}: {
  token: string; proyectoId: string; estado: string;
  puedeGestionar: boolean; onCambio: (accion: 'finalizado' | 'reabierto') => void;
}) {
  const [verificacion, setVerificacion] = useState<VerificacionCierreProyecto | null>(null);
  const [evidenciasRevisadas, setEvidenciasRevisadas] = useState(false);
  const [recursosRevisados, setRecursosRevisados] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  useEffect(() => {
    let vigente = true;
    obtenerVerificacionCierre(token, proyectoId).then(
      (datos) => { if (vigente) { setVerificacion(datos); setError(''); } },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    );
    return () => { vigente = false; };
  }, [token, proyectoId, recarga]);

  async function finalizar() {
    if (!verificacion?.listo || !evidenciasRevisadas || !recursosRevisados || procesando) return;
    setProcesando(true);
    setError('');
    try {
      await finalizarProyectoAdministrativo(token, proyectoId);
      onCambio('finalizado');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible finalizar el proyecto.');
      setRecarga((n) => n + 1);
    } finally {
      setProcesando(false);
    }
  }

  async function reabrir() {
    if (motivo.trim().length < 10 || procesando) return;
    setProcesando(true);
    setError('');
    try {
      await reabrirProyectoAdministrativo(token, proyectoId, motivo.trim());
      onCambio('reabierto');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible reabrir el proyecto.');
      setRecarga((n) => n + 1);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <section className="cierre-proyecto" aria-label="Cierre administrativo del proyecto">
      <h3>{estado === 'FINALIZADO' ? 'Proyecto finalizado' : 'Cierre administrativo'}</h3>
      <p>El 100 % de ejecución no cierra automáticamente el proyecto. Coordinación verifica las metas,
        las evidencias y los compromisos antes de finalizarlo.</p>
      {error && <p role="alert">{error}</p>}
      {!verificacion ? <p role="status">Consultando requisitos de cierre…</p> : (
        <>
          <ul className="cierre-proyecto__lista">
            <li>Metas cumplidas: <strong>{verificacion.metasCumplidas} de {verificacion.actividades}</strong></li>
            <li>Avances pendientes de revisión o corrección: <strong>{verificacion.pendientes}</strong></li>
            <li>Actividades sin evidencias fotográficas validadas: <strong>{verificacion.sinEvidencia}</strong></li>
          </ul>
          {estado === 'FINALIZADO' ? (
            <p role="status">Este proyecto está cerrado y disponible para consulta e informes.</p>
          ) : (
            <>
              <label className="cierre-proyecto__opcion">
                <input type="checkbox" checked={evidenciasRevisadas}
                  onChange={(evento) => setEvidenciasRevisadas(evento.target.checked)} />
                Verifiqué las evidencias finales y su correspondencia con el trabajo realizado.
              </label>
              <label className="cierre-proyecto__opcion">
                <input type="checkbox" checked={recursosRevisados}
                  onChange={(evento) => setRecursosRevisados(evento.target.checked)} />
                Revisé los recursos y compromisos pendientes de las brigadas.
              </label>
              {!verificacion.listo && (
                <p role="status">El cierre estará disponible cuando todas las metas estén validadas, no
                  existan reportes pendientes y cada actividad tenga evidencias confirmadas.</p>
              )}
              {puedeGestionar && (
                <button type="button" disabled={procesando || !verificacion.listo ||
                  !evidenciasRevisadas || !recursosRevisados} onClick={() => void finalizar()}>
                  {procesando ? 'Finalizando…' : 'Finalizar proyecto'}
                </button>
              )}
            </>
          )}
        </>
      )}
      {estado === 'FINALIZADO' && puedeGestionar && (
        <details className="cierre-proyecto__reapertura">
          <summary>Reapertura excepcional (solo administración)</summary>
          <p>Explicá qué debe corregirse. El motivo y la persona responsable quedarán en Auditoría.</p>
          <label>Motivo de reapertura
            <textarea value={motivo} minLength={10} maxLength={3000}
              onChange={(evento) => setMotivo(evento.target.value)} />
          </label>
          <button type="button" disabled={motivo.trim().length < 10 || procesando}
            onClick={() => void reabrir()}>
            {procesando ? 'Procesando…' : 'Solicitar reapertura'}
          </button>
        </details>
      )}
    </section>
  );
}
