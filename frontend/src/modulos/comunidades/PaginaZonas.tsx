import { FormEvent, useEffect, useState } from 'react';
import {
  cambiarEstadoZona,
  crearZona,
  editarZona,
  listarZonas,
  type ZonaResumen,
} from '../../lib/api';
import '../../estilos/modulos/comunidades/zonas.css';

interface PropiedadesPaginaZonas {
  tokenAcceso: string;
}

function ordenarZonas(zonas: ZonaResumen[]) {
  return [...zonas].sort((a, b) => {
    if (a.activo !== b.activo) return a.activo ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

function PaginaZonas({ tokenAcceso }: PropiedadesPaginaZonas) {
  const [zonas, setZonas] = useState<ZonaResumen[]>([]);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [zonaProcesandoId, setZonaProcesandoId] = useState<string | null>(null);
  const [zonaEditandoId, setZonaEditandoId] = useState<string | null>(null);
  const [nombreEdicion, setNombreEdicion] = useState('');
  const [descripcionEdicion, setDescripcionEdicion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    setCargando(true);
    setError(null);

    listarZonas(tokenAcceso)
      .then((respuesta) => {
        if (!activo) return;
        setZonas(respuesta.zonas);
      })
      .catch((err) => {
        if (!activo) return;
        setError(err instanceof Error ? err.message : 'No fue posible cargar las zonas.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [tokenAcceso]);

  async function handleCrearZona(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMensaje(null);

    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      setError('El nombre de la zona es obligatorio.');
      return;
    }

    setGuardando(true);

    try {
      const respuesta = await crearZona(tokenAcceso, {
        nombre: nombreLimpio,
        descripcion: descripcion.trim() || null,
      });

      setZonas((actuales) => ordenarZonas([...actuales, respuesta.zona]));
      setNombre('');
      setDescripcion('');
      setMensaje('Zona registrada correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar la zona.');
    } finally {
      setGuardando(false);
    }
  }

  function iniciarEdicion(zona: ZonaResumen) {
    setError(null);
    setMensaje(null);
    setZonaEditandoId(zona.id);
    setNombreEdicion(zona.nombre);
    setDescripcionEdicion(zona.descripcion || '');
  }

  function cancelarEdicion() {
    setZonaEditandoId(null);
    setNombreEdicion('');
    setDescripcionEdicion('');
  }

  async function handleGuardarEdicion(zona: ZonaResumen) {
    const nombreLimpio = nombreEdicion.trim();
    if (!nombreLimpio) {
      setError('El nombre de la zona es obligatorio.');
      return;
    }

    setError(null);
    setMensaje(null);
    setZonaProcesandoId(zona.id);

    try {
      const respuesta = await editarZona(tokenAcceso, zona.id, {
        nombre: nombreLimpio,
        descripcion: descripcionEdicion.trim() || null,
      });

      setZonas((actuales) =>
        ordenarZonas(
          actuales.map((actual) => (actual.id === respuesta.zona.id ? respuesta.zona : actual)),
        ),
      );
      cancelarEdicion();
      setMensaje('Zona actualizada correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible actualizar la zona.');
    } finally {
      setZonaProcesandoId(null);
    }
  }

  async function handleCambiarEstado(zona: ZonaResumen) {
    setError(null);
    setMensaje(null);
    setZonaProcesandoId(zona.id);

    try {
      const respuesta = await cambiarEstadoZona(tokenAcceso, zona.id, !zona.activo);
      setZonas((actuales) =>
        ordenarZonas(
          actuales.map((actual) => (actual.id === respuesta.zona.id ? respuesta.zona : actual)),
        ),
      );
      setMensaje(
        respuesta.zona.activo
          ? 'Zona reactivada correctamente.'
          : 'Zona desactivada correctamente.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cambiar el estado de la zona.');
    } finally {
      setZonaProcesandoId(null);
    }
  }

  return (
    <section className="pagina-zonas" aria-labelledby="titulo-zonas">
      <div className="pagina-comunidades__superior">
        <div className="pagina-modulo__encabezado">
          <p className="pagina-modulo__etiqueta">Comunidades / Configuración territorial</p>
          <h1 id="titulo-zonas" className="pagina-modulo__titulo">Zonas</h1>
          <p className="pagina-modulo__descripcion">
            Administra las agrupaciones territoriales que se utilizarán para organizar las comunidades de la organización activa.
          </p>
        </div>
      </div>

      <form className="pagina-zonas__formulario" onSubmit={handleCrearZona}>
        <div className="pagina-zonas__formulario-encabezado">
          <div>
            <p className="formulario-comunidad__etiqueta">Nueva zona</p>
            <h2>Registrar zona territorial</h2>
            <p>El nombre será visible posteriormente al registrar y filtrar comunidades.</p>
          </div>
        </div>

        {mensaje && <div className="pagina-zonas__aviso pagina-zonas__aviso--exito">{mensaje}</div>}
        {error && <div className="pagina-zonas__aviso pagina-zonas__aviso--error">{error}</div>}

        <div className="pagina-zonas__campos">
          <div className="pagina-comunidades__campo">
            <label htmlFor="nombre-zona">Nombre de la zona</label>
            <input
              id="nombre-zona"
              type="text"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ej. Zona Norte"
              maxLength={100}
              required
            />
          </div>

          <div className="pagina-comunidades__campo">
            <label htmlFor="descripcion-zona">Descripción</label>
            <input
              id="descripcion-zona"
              type="text"
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
              placeholder="Descripción opcional de la cobertura territorial"
            />
          </div>

          <button className="pagina-comunidades__boton-nuevo" type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : '+ Crear zona'}
          </button>
        </div>
      </form>

      <section className="pagina-zonas__listado" aria-labelledby="titulo-zonas-registradas">
        <div className="pagina-zonas__listado-encabezado">
          <div>
            <p className="listado-comunidades__etiqueta">Organización territorial</p>
            <h2 id="titulo-zonas-registradas">Zonas registradas</h2>
          </div>
          <span>{zonas.length} {zonas.length === 1 ? 'zona' : 'zonas'}</span>
        </div>

        {cargando ? (
          <div className="pagina-zonas__vacio">Cargando zonas…</div>
        ) : zonas.length === 0 ? (
          <div className="pagina-zonas__vacio">
            <strong>Aún no hay zonas registradas.</strong>
            <span>Crea la primera zona para comenzar a organizar las comunidades.</span>
          </div>
        ) : (
          <div className="pagina-zonas__tabla" role="table" aria-label="Listado de zonas">
            <div className="pagina-zonas__fila pagina-zonas__fila--encabezado" role="row">
              <span role="columnheader">Zona</span>
              <span role="columnheader">Descripción</span>
              <span role="columnheader">Estado</span>
              <span role="columnheader">Acciones</span>
            </div>

            {zonas.map((zona) => {
              const editando = zonaEditandoId === zona.id;
              const procesando = zonaProcesandoId === zona.id;

              return (
                <div className="pagina-zonas__fila" role="row" key={zona.id}>
                  <div role="cell">
                    {editando ? (
                      <input
                        className="pagina-zonas__input-edicion"
                        type="text"
                        value={nombreEdicion}
                        onChange={(event) => setNombreEdicion(event.target.value)}
                        maxLength={100}
                      />
                    ) : (
                      <strong>{zona.nombre}</strong>
                    )}
                  </div>

                  <div role="cell">
                    {editando ? (
                      <input
                        className="pagina-zonas__input-edicion"
                        type="text"
                        value={descripcionEdicion}
                        onChange={(event) => setDescripcionEdicion(event.target.value)}
                        placeholder="Sin descripción"
                      />
                    ) : (
                      <span>{zona.descripcion || 'Sin descripción'}</span>
                    )}
                  </div>

                  <span
                    role="cell"
                    className={
                      zona.activo
                        ? 'pagina-zonas__estado pagina-zonas__estado--activo'
                        : 'pagina-zonas__estado pagina-zonas__estado--inactivo'
                    }
                  >
                    {zona.activo ? 'Activa' : 'Inactiva'}
                  </span>

                  <div role="cell" className="pagina-zonas__acciones-fila">
                    {editando ? (
                      <>
                        <button
                          className="pagina-zonas__boton-editar pagina-zonas__boton-editar--guardar"
                          type="button"
                          disabled={procesando}
                          onClick={() => void handleGuardarEdicion(zona)}
                        >
                          {procesando ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button
                          className="pagina-zonas__boton-editar"
                          type="button"
                          disabled={procesando}
                          onClick={cancelarEdicion}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="pagina-zonas__boton-editar"
                          type="button"
                          disabled={procesando || zonaEditandoId !== null}
                          onClick={() => iniciarEdicion(zona)}
                        >
                          Editar
                        </button>
                        <button
                          className={
                            zona.activo
                              ? 'pagina-zonas__boton-estado pagina-zonas__boton-estado--desactivar'
                              : 'pagina-zonas__boton-estado pagina-zonas__boton-estado--reactivar'
                          }
                          type="button"
                          disabled={procesando || zonaEditandoId !== null}
                          onClick={() => void handleCambiarEstado(zona)}
                        >
                          {procesando
                            ? 'Procesando…'
                            : zona.activo
                              ? 'Desactivar'
                              : 'Reactivar'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

export default PaginaZonas;
