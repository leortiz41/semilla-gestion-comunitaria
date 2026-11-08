import { useState } from 'react';

export interface ComunidadBrigada {
  id: string;
  nombre: string;
  municipio: string;
}

export interface ProyectoBrigada {
  id: string;
  nombre: string;
  comunidadId: string;
}

function ListaPlan({ nombre, titulo, singular }: {
  nombre: string;
  titulo: string;
  singular: string;
}) {
  const [filas, setFilas] = useState<string[]>([]);

  return (
    <fieldset>
      <legend>{titulo}</legend>
      {filas.map((id, indice) => (
        <div key={id} className="donantes-fila">
          <label>
            {singular} {indice + 1}
            <textarea name={nombre} required maxLength={3000} />
          </label>
          <button type="button" onClick={() => setFilas((actual) => actual.filter((fila) => fila !== id))}>
            Quitar {singular.toLowerCase()} {indice + 1}
          </button>
        </div>
      ))}
      <button type="button" disabled={filas.length >= 50}
        onClick={() => setFilas((actual) => [...actual, crypto.randomUUID()])}>
        Agregar {singular.toLowerCase()}
      </button>
    </fieldset>
  );
}

export default function PlanBrigada({ comunidades, proyectos }: {
  comunidades: ComunidadBrigada[];
  proyectos: ProyectoBrigada[];
}) {
  const [comunidadId, setComunidadId] = useState('');

  return (
    <>
      <div className="donantes-campos">
        <label>Comunidad de trabajo
          <select name="comunidadId" required value={comunidadId} onChange={(evento) => setComunidadId(evento.target.value)}>
            <option value="">Seleccioná una comunidad</option>
            {comunidades.map((comunidad) => (
              <option key={comunidad.id} value={comunidad.id}>{comunidad.nombre} · {comunidad.municipio}</option>
            ))}
          </select>
        </label>
        <label>Proyecto relacionado
          <select key={comunidadId} name="proyectoId" disabled={!comunidadId}>
            <option value="">Por asignar</option>
            {proyectos.filter((proyecto) => proyecto.comunidadId === comunidadId).map((proyecto) => (
              <option key={proyecto.id} value={proyecto.id}>{proyecto.nombre}</option>
            ))}
          </select>
        </label>
      </div>
      <ListaPlan nombre="actividades" titulo="Actividades" singular="Actividad" />
      <ListaPlan nombre="contrataciones" titulo="Contrataciones previstas" singular="Contratación" />
    </>
  );
}
