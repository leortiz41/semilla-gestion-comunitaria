import { useEffect, useState, type FormEvent } from 'react';
import {
  guardarFichaDonante, obtenerAdministracionDonantes, obtenerFichasDonantes, type FichaDonante,
} from '../../lib/api';
import PanelAccesoDonantes from '../usuarios/PanelAccesoDonantes';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/roles.css';
import './donantes.css';

export default function PaginaDonantes({ token }: { token: string }) {
  const [fichas, setFichas] = useState<FichaDonante[]>([]);
  const [proyectos, setProyectos] = useState<{ id: string; nombre: string }[]>([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    Promise.all([obtenerFichasDonantes(token), obtenerAdministracionDonantes(token)])
      .then(([registro, catalogo]) => {
        if (!vigente) return;
        setFichas(registro.fichas);
        setProyectos(catalogo.proyectos);
      })
      .catch((fallo: Error) => { if (vigente) setError(fallo.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [token]);

  async function guardar(evento: FormEvent<HTMLFormElement>, fichaId?: string) {
    evento.preventDefault();
    if (ocupado) return;
    const formulario = evento.currentTarget;
    const datos: Record<string, string | number> = {};
    for (const [clave, valor] of new FormData(formulario)) {
      datos[clave] = clave === 'miembros' ? Number(valor) : String(valor);
    }
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await guardarFichaDonante(token, datos, fichaId);
      formulario.reset();
      setMensaje(fichaId ? 'Brigada registrada.' : 'Donante registrado.');
      setFichas((await obtenerFichasDonantes(token)).fichas);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible completar la operación.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="pagina-modulo donantes-modulo">
      <header className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Coordinación comunitaria</p>
        <h1 className="pagina-modulo__titulo">Donantes y brigadas</h1>
        <p className="pagina-modulo__descripcion">Registrá organizaciones e iglesias y planificá sus viajes.</p>
      </header>
      {error && <p role="alert">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      {cargando && <p role="status">Cargando donantes…</p>}
      <form className="roles-panel__tarjeta" onSubmit={guardar}>
        <fieldset disabled={ocupado || cargando}>
          <legend>Nueva ficha de donante</legend>
          <div className="donantes-campos">
            <label>Organización o iglesia<input name="nombre" required maxLength={180} /></label>
            <label>Correo de contacto<input name="correo" type="email" required maxLength={150} /></label>
            <label>Teléfono opcional<input name="telefono" type="tel" maxLength={50} /></label>
          </div>
          <button type="submit">Registrar donante</button>
        </fieldset>
      </form>
      {fichas.map((ficha) => (
        <article className="roles-panel__tarjeta" key={ficha.id}>
          <h2>{ficha.nombre}</h2>
          <p>{ficha.correo}{ficha.telefono && ` · ${ficha.telefono}`}</p>
          <h3>Brigadas registradas</h3>
          {!ficha.brigadas.length && <p>Todavía no hay brigadas registradas.</p>}
          {ficha.brigadas.map((brigada) => (
            <details key={brigada.id}>
              <summary>{brigada.lider} · {brigada.miembros} integrantes · {brigada.llegada ?? 'Fecha por definir'}</summary>
              <p>Salida: {brigada.salida ?? 'Por definir'} · Proyecto: {brigada.proyecto ?? 'Por asignar'}</p>
              {brigada.actividades && <p>Actividades: {brigada.actividades}</p>}
              {brigada.contrataciones && <p>Contrataciones: {brigada.contrataciones}</p>}
              {brigada.observaciones && <p>Observaciones: {brigada.observaciones}</p>}
            </details>
          ))}
          <details>
            <summary>Registrar brigada</summary>
            <form onSubmit={(evento) => void guardar(evento, ficha.id)}>
              <fieldset disabled={ocupado}>
                <legend>Plan del viaje</legend>
                <div className="donantes-campos">
                  <label>Líder del grupo<input name="lider" required maxLength={180} /></label>
                  <label>Cantidad de integrantes<input name="miembros" type="number" required min={1} max={100000} /></label>
                  <label>Llegada tentativa<input name="llegada" type="date" /></label>
                  <label>Salida tentativa<input name="salida" type="date" /></label>
                  <label>Proyecto relacionado
                    <select name="proyectoId">
                      <option value="">Por asignar</option>
                      {proyectos.map((proyecto) => <option key={proyecto.id} value={proyecto.id}>{proyecto.nombre}</option>)}
                    </select>
                  </label>
                  <label>Actividades<textarea name="actividades" maxLength={3000} /></label>
                  <label>Contrataciones previstas<textarea name="contrataciones" maxLength={3000} placeholder="Transporte, alojamiento, alimentación u otros servicios" /></label>
                  <label>Observaciones<textarea name="observaciones" maxLength={3000} /></label>
                </div>
                <button type="submit">Guardar brigada</button>
              </fieldset>
            </form>
          </details>
        </article>
      ))}
      <PanelAccesoDonantes token={token} />
    </section>
  );
}
