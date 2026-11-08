import { useEffect, useState } from 'react';
import {
  actualizarAccesoDonante,
  actualizarEvidenciaDonante,
  obtenerAdministracionDonantes,
  type AdministracionDonantes,
} from '../../lib/api';

export default function PanelAccesoDonantes({ token }: { token: string }) {
  const [datos, setDatos] = useState<AdministracionDonantes | null>(null);
  const [proyectoId, setProyectoId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    let vigente = true;
    obtenerAdministracionDonantes(token).then(
      (resultado) => { if (vigente) setDatos(resultado); },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    );
    return () => { vigente = false; };
  }, [token]);

  const proyecto = datos?.proyectos.find((item) => item.id === proyectoId);

  async function guardar(operacion: () => Promise<void>, actualizar: (actual: AdministracionDonantes) => AdministracionDonantes) {
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await operacion();
      setDatos((actual) => actual ? actualizar(actual) : actual);
      setMensaje('Cambio guardado.');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible guardar el cambio.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="roles-panel__tarjeta" aria-labelledby="titulo-acceso-donantes">
      <h2 id="titulo-acceso-donantes">Acceso de donantes</h2>
      <p>Elegí un proyecto para gestionar sus donantes. Las evidencias compartidas se muestran a todos los donantes asignados a ese proyecto.</p>
      {error && <p role="alert">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      {!datos && !error && <p role="status">Cargando proyectos y donantes…</p>}
      {datos?.proyectos.length === 0 && <p>Todavía no hay proyectos registrados en tu organización.</p>}
      {datos && datos.proyectos.length > 0 && (
        <fieldset disabled={guardando}>
          <legend>Configuración por proyecto</legend>
          <label>
            Proyecto{' '}
            <select value={proyectoId} onChange={(event) => {
              setProyectoId(event.target.value);
              setError('');
              setMensaje('');
            }}>
              <option value="">Seleccioná un proyecto</option>
              {datos.proyectos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          {proyecto && (
            <>
              <h3>Donantes</h3>
              {!datos.donantes.length && <p>Todavía no hay cuentas con el rol Donante.</p>}
              <ul>
                {datos.donantes.map((donante) => {
                  const asignado = proyecto.donanteIds.includes(donante.id);
                  return (
                    <li key={donante.id}>
                      <label>
                        <input type="checkbox" checked={asignado} disabled={!donante.activo && !asignado}
                          onChange={(event) => {
                            const nuevo = event.target.checked;
                            void guardar(
                              () => actualizarAccesoDonante(token, proyecto.id, donante.id, nuevo),
                              (actual) => ({
                                ...actual,
                                proyectos: actual.proyectos.map((item) => item.id === proyecto.id ? {
                                  ...item,
                                  donanteIds: nuevo
                                    ? [...new Set([...item.donanteIds, donante.id])]
                                    : item.donanteIds.filter((id) => id !== donante.id),
                                } : item),
                              }),
                            );
                          }} />
                        {' '}{donante.email}{donante.activo ? '' : ' (cuenta inactiva)'}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <h3>Evidencias compartidas</h3>
              {!proyecto.evidencias.length && <p>Este proyecto todavía no tiene evidencias disponibles para compartir.</p>}
              <ul>
                {proyecto.evidencias.map((evidencia) => (
                  <li key={evidencia.id}>
                    <label>
                      <input type="checkbox" checked={evidencia.compartida} onChange={(event) => {
                        const compartida = event.target.checked;
                        void guardar(
                          () => actualizarEvidenciaDonante(token, proyecto.id, evidencia.id, compartida),
                          (actual) => ({
                            ...actual,
                            proyectos: actual.proyectos.map((item) => item.id === proyecto.id ? {
                              ...item,
                              evidencias: item.evidencias.map((registro) => registro.id === evidencia.id
                                ? { ...registro, compartida } : registro),
                            } : item),
                          }),
                        );
                      }} />
                      {' '}{evidencia.titulo}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </fieldset>
      )}
    </section>
  );
}
