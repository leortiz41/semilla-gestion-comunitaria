import { FormEvent, useEffect, useState } from 'react';
import {
  guardarDiagnosticoPoblacionVivienda,
  obtenerDiagnosticoPoblacionVivienda,
  type DiagnosticoPoblacionVivienda,
} from '../../../lib/api';

interface PropiedadesSeccionPoblacionVivienda {
  comunidadId: string;
  tokenAcceso: string;
}

function valorTexto(valor: number | null) {
  return valor === null ? 'Sin registrar' : new Intl.NumberFormat('es-HN').format(valor);
}

function SeccionPoblacionVivienda({ comunidadId, tokenAcceso }: PropiedadesSeccionPoblacionVivienda) {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoPoblacionVivienda | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [poblacionAproximada, setPoblacionAproximada] = useState('');
  const [viviendasAproximadas, setViviendasAproximadas] = useState('');
  const [viviendasIntervencion, setViviendasIntervencion] = useState('');
  const [tiposVivienda, setTiposVivienda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  function cargarFormulario(datos: DiagnosticoPoblacionVivienda | null) {
    setPoblacionAproximada(datos?.poblacionAproximada?.toString() ?? '');
    setViviendasAproximadas(datos?.viviendasAproximadas?.toString() ?? '');
    setViviendasIntervencion(datos?.viviendasIntervencion?.toString() ?? '');
    setTiposVivienda(datos?.tiposVivienda ?? '');
  }

  useEffect(() => {
    let activo = true;

    obtenerDiagnosticoPoblacionVivienda(tokenAcceso, comunidadId)
      .then(({ diagnostico: diagnosticoRegistrado }) => {
        if (!activo) return;
        setDiagnostico(diagnosticoRegistrado);
        cargarFormulario(diagnosticoRegistrado);
      })
      .catch((err) => {
        if (!activo) return;
        setError(err instanceof Error ? err.message : 'No fue posible cargar esta sección.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [comunidadId, tokenAcceso]);

  function convertirCantidad(valor: string): number | null {
    if (!valor.trim()) return null;
    const cantidad = Number(valor);
    return Number.isInteger(cantidad) && cantidad >= 0 ? cantidad : Number.NaN;
  }

  function iniciarEdicion() {
    setError(null);
    setMensaje(null);
    cargarFormulario(diagnostico);
    setEditando(true);
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const datos: DiagnosticoPoblacionVivienda = {
      poblacionAproximada: convertirCantidad(poblacionAproximada),
      viviendasAproximadas: convertirCantidad(viviendasAproximadas),
      viviendasIntervencion: convertirCantidad(viviendasIntervencion),
      tiposVivienda: tiposVivienda.trim() || null,
    };

    if (
      Number.isNaN(datos.poblacionAproximada) ||
      Number.isNaN(datos.viviendasAproximadas) ||
      Number.isNaN(datos.viviendasIntervencion)
    ) {
      setError('Las cantidades deben ser números enteros iguales o mayores a cero.');
      return;
    }

    setError(null);
    setMensaje(null);
    setGuardando(true);

    try {
      const respuesta = await guardarDiagnosticoPoblacionVivienda(tokenAcceso, comunidadId, datos);
      setDiagnostico(respuesta.diagnostico);
      setEditando(false);
      setMensaje('Diagnóstico de población y vivienda guardado correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar esta sección.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <article className="expediente-comunidad__seccion">
      <div>
        <p className="expediente-comunidad__etiqueta">02 · Diagnóstico</p>
        <h2>Población y vivienda</h2>
        <p>Registra datos aproximados para conocer la dimensión y las necesidades habitacionales.</p>
      </div>

      {cargando ? (
        <span className="expediente-comunidad__estado-seccion">Cargando…</span>
      ) : editando ? (
        <form className="expediente-comunidad__formulario" onSubmit={guardar}>
          {error && <div className="pagina-zonas__aviso pagina-zonas__aviso--error">{error}</div>}
          <div className="expediente-comunidad__campos-numericos">
            <label>
              Población aproximada
              <input type="number" min="0" step="1" value={poblacionAproximada} onChange={(event) => setPoblacionAproximada(event.target.value)} />
            </label>
            <label>
              Viviendas aproximadas
              <input type="number" min="0" step="1" value={viviendasAproximadas} onChange={(event) => setViviendasAproximadas(event.target.value)} />
            </label>
            <label>
              Viviendas con intervención
              <input type="number" min="0" step="1" value={viviendasIntervencion} onChange={(event) => setViviendasIntervencion(event.target.value)} />
            </label>
          </div>
          <label className="expediente-comunidad__campo-texto">
            Tipos de vivienda predominantes
            <textarea rows={3} value={tiposVivienda} onChange={(event) => setTiposVivienda(event.target.value)} placeholder="Ej. bloque, adobe, madera, bahareque, techo de zinc…" maxLength={2000} />
          </label>
          <div className="expediente-comunidad__acciones-formulario">
            <button className="pagina-comunidades__boton-nuevo" type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar sección'}
            </button>
            <button className="pagina-comunidades__boton-secundario" type="button" disabled={guardando} onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="expediente-comunidad__contenido-seccion">
          {mensaje && <div className="pagina-zonas__aviso pagina-zonas__aviso--exito">{mensaje}</div>}
          {error && <div className="pagina-zonas__aviso pagina-zonas__aviso--error">{error}</div>}
          {diagnostico ? (
            <>
              <div className="expediente-comunidad__metricas">
                <span><strong>{valorTexto(diagnostico.poblacionAproximada)}</strong>Población</span>
                <span><strong>{valorTexto(diagnostico.viviendasAproximadas)}</strong>Viviendas</span>
                <span><strong>{valorTexto(diagnostico.viviendasIntervencion)}</strong>Intervención</span>
              </div>
              {diagnostico.tiposVivienda && <p className="expediente-comunidad__detalle">{diagnostico.tiposVivienda}</p>}
            </>
          ) : (
            <span className="expediente-comunidad__estado-seccion">Sin datos registrados</span>
          )}
          <button className="listado-comunidades__boton-editar" type="button" onClick={iniciarEdicion}>
            {diagnostico ? 'Editar sección' : 'Completar sección'}
          </button>
        </div>
      )}
    </article>
  );
}

export default SeccionPoblacionVivienda;
