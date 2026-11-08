import { useState } from 'react';

export interface ComunidadBrigada {
  id: string;
  nombre: string;
  municipio: string;
  zonaId: string | null;
}

export interface ProyectoBrigada {
  id: string;
  nombre: string;
  comunidadId: string;
}

function ListaPlan({ nombre, titulo, singular, inicial = [] }: {
  nombre: string;
  titulo: string;
  singular: string;
  inicial?: string[];
}) {
  const [filas, setFilas] = useState(() => inicial.map((texto) => ({ id: crypto.randomUUID(), texto })));

  return (
    <fieldset>
      <legend>{titulo}</legend>
      {filas.map(({ id, texto }, indice) => (
        <div key={id} className="donantes-fila">
          <label>
            {singular} {indice + 1}
            <textarea name={nombre} defaultValue={texto} required maxLength={3000} />
          </label>
          <button type="button" onClick={() => setFilas((actual) => actual.filter((fila) => fila.id !== id))}>
            Quitar {singular.toLowerCase()} {indice + 1}
          </button>
        </div>
      ))}
      <button type="button" disabled={filas.length >= 50}
        onClick={() => setFilas((actual) => [...actual, { id: crypto.randomUUID(), texto: '' }])}>
        Agregar {singular.toLowerCase()}
      </button>
    </fieldset>
  );
}

export default function PlanBrigada({ zonas, comunidades, proyectos, inicial }: {
  zonas: { id: string; nombre: string }[];
  comunidades: ComunidadBrigada[];
  proyectos: ProyectoBrigada[];
  inicial?: {
    zonaId: string | null;
    comunidadIds: string[];
    proyectoId: string | null;
    actividades: string[];
    contrataciones: string[];
  };
}) {
  const [zonaId, setZonaId] = useState(inicial?.zonaId ?? '');
  const [comunidadIds, setComunidadIds] = useState(inicial?.comunidadIds ?? []);
  const [proyectoId, setProyectoId] = useState(inicial?.proyectoId ?? '');
  const comunidadesZona = comunidades.filter((comunidad) => comunidad.zonaId === zonaId);

  return (
    <>
      <div className="donantes-campos">
        <label>Zona de trabajo
          <select name="zonaId" required value={zonaId} onChange={(evento) => {
            setZonaId(evento.target.value);
            setComunidadIds([]);
            setProyectoId('');
          }}>
            <option value="">Seleccioná una zona</option>
            {zonas.map((zona) => <option key={zona.id} value={zona.id}>{zona.nombre}</option>)}
          </select>
        </label>
        <label>Proyecto relacionado
          <select name="proyectoId" value={proyectoId} onChange={(evento) => setProyectoId(evento.target.value)} disabled={!comunidadIds.length}>
            <option value="">Por asignar</option>
            {proyectos.filter((proyecto) => comunidadIds.includes(proyecto.comunidadId)).map((proyecto) => (
              <option key={proyecto.id} value={proyecto.id}>{proyecto.nombre}</option>
            ))}
          </select>
        </label>
      </div>
      {zonaId && (
        <fieldset>
          <legend>Comunidades de trabajo</legend>
          <p>Marcá las comunidades previstas o dejalas por definir.</p>
          {comunidadesZona.map((comunidad) => (
            <div key={comunidad.id}>
              <label>
                <input type="checkbox" name="comunidadIds" value={comunidad.id}
                  checked={comunidadIds.includes(comunidad.id)}
                  onChange={(evento) => {
                    const marcada = evento.target.checked;
                    if (!marcada && proyectos.some((p) => p.id === proyectoId && p.comunidadId === comunidad.id)) {
                      setProyectoId('');
                    }
                    setComunidadIds((actual) => marcada
                      ? [...actual, comunidad.id]
                      : actual.filter((id) => id !== comunidad.id));
                  }} />
                {' '}{comunidad.nombre} · {comunidad.municipio}
              </label>
            </div>
          ))}
        </fieldset>
      )}
      <ListaPlan nombre="actividades" titulo="Actividades" singular="Actividad" inicial={inicial?.actividades} />
      <ListaPlan nombre="contrataciones" titulo="Contrataciones previstas" singular="Contratación" inicial={inicial?.contrataciones} />
    </>
  );
}
