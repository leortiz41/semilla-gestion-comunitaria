import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { consultarAccesoEvidenciaAvance, consultarIndiceEvidencias, consultarCatalogoProyectos, consultarResponsablesProyecto, consultarAvancesPendientes, consultarMetaActividad } from '../src/modules/proyectos/proyectos.repository.js';

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

test('Proyectos: el catálogo usa la organización en sus cuatro consultas', async () => {
  let indice = 0;
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      assert.deepEqual(parametros, [organizacionId]);
      assert.match(consulta, /organizacion_id\s*=\s*\$1|WHERE id = \$1/);
      indice++;
      return { rows: indice === 4 ? [{ moneda: 'HNL' }] : [] };
    },
  } as unknown as Pool;
  const catalogo = await consultarCatalogoProyectos(pool, organizacionId);
  assert.equal(indice, 4);
  assert.deepEqual(catalogo.proyectos, []);
  assert.deepEqual(catalogo.comunidades, []);
  assert.deepEqual(catalogo.donantes, []);
  assert.equal(catalogo.moneda, 'HNL');
});

test('Proyectos: responsables se limitan al proyecto y organización y excluyen DONANTE', async () => {
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      assert.match(consulta, /c\.organizacion_id\s*=\s*\$2/);
      assert.match(consulta, /r.nombre = 'DONANTE'/);
      assert.deepEqual(parametros, [proyectoId, organizacionId]);
      return { rows: [{ id: actividadId, nombre: 'coordinador@ejemplo.test' }] };
    },
  } as unknown as Pool;
  const responsables = await consultarResponsablesProyecto(pool, proyectoId, organizacionId);
  assert.equal(responsables.length, 1);
});

test('Proyectos: bandeja de revisión filtra organización, estado ENVIADO y autor', async () => {
  const usuarioId = 'f84bc9ac-eb2e-4749-af68-2d7d7fbc5fc7';
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      assert.match(consulta, /c\.organizacion_id\s*=\s*\$1/);
      assert.match(consulta, /av.estado_revision = 'ENVIADO'/);
      assert.deepEqual(parametros, [organizacionId, usuarioId]);
      return { rows: [{ id: avanceId }] };
    },
  } as unknown as Pool;
  assert.deepEqual(await consultarAvancesPendientes(pool, organizacionId, usuarioId), [{ id: avanceId }]);
});

test('Proyectos: la meta de actividad pertenece al proyecto y tenant solicitados', async () => {
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      assert.match(consulta, /c\.organizacion_id\s*=\s*\$3/);
      assert.deepEqual(parametros, [proyectoId, actividadId, organizacionId]);
      return { rows: [{ meta_cantidad: 30 }] };
    },
  } as unknown as Pool;
  assert.deepEqual(await consultarMetaActividad(pool, proyectoId, actividadId, organizacionId), [{ meta_cantidad: 30 }]);
});
