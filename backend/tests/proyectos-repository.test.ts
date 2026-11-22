import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { consultarAccesoEvidenciaAvance, consultarIndiceEvidencias } from '../src/modules/proyectos/proyectos.repository.js';

const organizacionId = 'a63f86ca-318e-492b-8bc6-d5e2700062ba';
const proyectoId = 'f0cc242b-b341-46a9-98af-4e6d224f218e';
const actividadId = '16d3acec-c071-4cdd-99da-cd94096bcc56';
const avanceId = '6c4afcad-3d12-468b-90d6-f40d46d24ce9';

test('Proyectos: consulta de acceso a evidencia exige UUID y limita por organización', async () => {
  const fila = { id: avanceId, estado: 'VALIDADO', responsable: null };
  let llamadas = 0;
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      llamadas++;
      assert.match(consulta, /c\.organizacion_id = \$4/);
      assert.deepEqual(parametros, [proyectoId, actividadId, avanceId, organizacionId]);
      return { rows: [fila] };
    },
  } as unknown as Pool;
  assert.deepEqual(
    await consultarAccesoEvidenciaAvance(pool, proyectoId, actividadId, avanceId, organizacionId),
    fila,
  );
  assert.equal(llamadas, 1);
  assert.equal(
    await consultarAccesoEvidenciaAvance(pool, proyectoId, actividadId, 'no-es-uuid', organizacionId),
    null,
  );
  assert.equal(await consultarAccesoEvidenciaAvance(null, proyectoId, actividadId, avanceId, organizacionId), null);
  assert.equal(llamadas, 1);
});

test('Proyectos: índice documental pasa el tenant a las dos consultas', async () => {
  const consultas: string[] = [];
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      consultas.push(consulta);
      assert.match(consulta, /c\.organizacion_id\s*=\s*\$1/);
      assert.deepEqual(parametros, [organizacionId]);
      return { rows: consultas.length === 1 ? [{ avanceId }] : [{ id: proyectoId }] };
    },
  } as unknown as Pool;
  const resultado = await consultarIndiceEvidencias(pool, organizacionId);
  assert.deepEqual(resultado.avances, [{ avanceId }]);
  assert.deepEqual(resultado.proyectosFinalizados, [{ id: proyectoId }]);
  assert.equal(consultas.length, 2);
});
