import { FormEvent, useEffect, useState } from 'react';
import {
  crearComunidad,
  editarComunidad,
  listarZonas,
  type ComunidadResumen,
  type ZonaResumen,
} from '../../../lib/api';

interface PropiedadesFormularioRegistroBasicoComunidad {
  tokenAcceso: string;
  alCerrar: () => void;
  alGuardar: () => void;
  comunidad?: ComunidadResumen;
}

function FormularioRegistroBasicoComunidad({
  tokenAcceso,
  alCerrar,
  alGuardar,
  comunidad,
}: PropiedadesFormularioRegistroBasicoComunidad) {
  const [zonas, setZonas] = useState<ZonaResumen[]>([]);
  const [nombre, setNombre] = useState(comunidad?.nombre ?? '');
  const [zonaId, setZonaId] = useState(
    comunidad?.zonaActiva ? comunidad.zonaId ?? '' : '',
  );
  const [municipio, setMunicipio] = useState(comunidad?.municipio ?? '');
  const [departamento, setDepartamento] = useState(comunidad?.departamento ?? '');
  const [cargandoZonas, setCargandoZonas] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    listarZonas(tokenAcceso)
      .then(({ zonas: zonasRegistradas }) => {
        if (!activo) return;
        setZonas(zonasRegistradas.filter((zona) => zona.activo));
      })
      .catch((err) => {
        if (!activo) return;
        setError(err instanceof Error ? err.message : 'No fue posible cargar las zonas.');
      })
      .finally(() => {
        if (activo) setCargandoZonas(false);
      });

    return () => {
      activo = false;
    };
  }, [tokenAcceso]);

  async function handleGuardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!nombre.trim() || !zonaId || !municipio.trim() || !departamento.trim()) {
      setError('Nombre, zona, municipio y departamento son obligatorios.');
      return;
    }

    setGuardando(true);

    try {
      const datos = {
        nombre: nombre.trim(),
        zonaId,
        municipio: municipio.trim(),
        departamento: departamento.trim(),
      };

      if (comunidad) {
        await editarComunidad(tokenAcceso, comunidad.id, datos);
      } else {
        await crearComunidad(tokenAcceso, datos);
      }

      alGuardar();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : comunidad
            ? 'No fue posible actualizar la comunidad.'
            : 'No fue posible registrar la comunidad.',
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="formulario-comunidad" onSubmit={handleGuardar}>
      <div className="formulario-comunidad__encabezado">
        <div>
          <p className="formulario-comunidad__etiqueta">Registro comunitario</p>
          <h2>{comunidad ? 'Editar comunidad' : 'Información general'}</h2>
          <p>
            {comunidad
              ? 'Actualiza la identificación territorial y asigna la comunidad a una zona activa de la organización.'
              : 'Registra primero la identificación territorial de la comunidad. El expediente completo se llenará progresivamente después del alta inicial.'}
          </p>
        </div>

        <button
          className="formulario-comunidad__cerrar"
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar formulario de comunidad"
        >
          ×
        </button>
      </div>

      {error && <div className="pagina-zonas__aviso pagina-zonas__aviso--error">{error}</div>}

      {comunidad?.zonaActiva === false && (
        <div className="pagina-zonas__aviso pagina-zonas__aviso--error">
          La comunidad pertenece a una zona inactiva. Selecciona una zona activa para actualizarla.
        </div>
      )}

      <details className="formulario-comunidad__acordeon" open>
        <summary className="formulario-comunidad__acordeon-resumen">
          <div className="formulario-comunidad__seccion-encabezado">
            <span className="formulario-comunidad__numero">01</span>
            <div>
              <h3>Información general</h3>
              <p>
                {comunidad
                  ? 'Identificación y ubicación que puedes corregir sin perder el registro existente.'
                  : 'Identificación y ubicación obligatoria para crear la comunidad.'}
              </p>
            </div>
          </div>
          <span className="formulario-comunidad__acordeon-indicador" aria-hidden="true">⌄</span>
        </summary>

        <div className="formulario-comunidad__acordeon-contenido">
          <div className="formulario-comunidad__campos formulario-comunidad__campos--dos">
            <div className="pagina-comunidades__campo">
              <label htmlFor="nombre-comunidad">Nombre de la comunidad</label>
              <input
                id="nombre-comunidad"
                type="text"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Ej. Agua Azul Rancho"
                maxLength={150}
                required
              />
            </div>

            <div className="pagina-comunidades__campo">
              <label htmlFor="zona-comunidad">Zona</label>
              <select
                id="zona-comunidad"
                value={zonaId}
                onChange={(event) => setZonaId(event.target.value)}
                disabled={cargandoZonas || zonas.length === 0}
                required
              >
                <option value="" disabled>
                  {cargandoZonas
                    ? 'Cargando zonas...'
                    : zonas.length === 0
                      ? 'No hay zonas activas registradas'
                      : 'Seleccionar zona'}
                </option>
                {zonas.map((zona) => (
                  <option value={zona.id} key={zona.id}>
                    {zona.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="pagina-comunidades__campo">
              <label htmlFor="municipio-comunidad">Municipio</label>
              <input
                id="municipio-comunidad"
                type="text"
                value={municipio}
                onChange={(event) => setMunicipio(event.target.value)}
                placeholder="Ej. Santa Cruz de Yojoa"
                maxLength={120}
                required
              />
            </div>

            <div className="pagina-comunidades__campo">
              <label htmlFor="departamento-comunidad">Departamento</label>
              <input
                id="departamento-comunidad"
                type="text"
                value={departamento}
                onChange={(event) => setDepartamento(event.target.value)}
                placeholder="Ej. Cortés"
                maxLength={120}
                required
              />
            </div>
          </div>

          <div className="pagina-comunidades__acciones">
            <button
              className="pagina-comunidades__boton-nuevo"
              type="submit"
              disabled={guardando || cargandoZonas || zonas.length === 0}
            >
              {guardando
                ? 'Guardando…'
                : comunidad
                  ? 'Guardar cambios'
                  : 'Guardar comunidad'}
            </button>
          </div>
        </div>
      </details>

      <p className="formulario-comunidad__aviso">
        En este paso solo se guarda la información general. Población, visión de desarrollo, organizaciones comunitarias y productividad se incorporarán después al expediente individual.
      </p>
    </form>
  );
}

export default FormularioRegistroBasicoComunidad;
