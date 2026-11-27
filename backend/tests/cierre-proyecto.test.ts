import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import {
  consultarCierreProyecto, finalizarProyecto, reabrirProyecto,
} from '../src/modules/proyectos/cierre-proyecto.repository.js';

const proyectoId = 'c9089356-bfb1-4746-bd93-952c4d9d53be';
const organizacionId = '04aa6639-5422-43fc-ac60-b9d047a0a9cc';
const usuarioId = '1ea1d18f-153c-46ea-8d5d-ec0e64e7c3b0';

test('cierre: meta validada y evidencias habilitan requisitos automáticos', async () => {
  const consultas: string[] = [];
  const pool = {
    query: async (sql: string, params: unknown[]) => {
      consultas.push(sql);
      assert.deepEqual(params, [proyectoId, organizacionId]);
      if (sql.includes('SELECT p.estado')) return { rows: [{ estado: 'EN_EJECUCION' }] };
      return { rows: [{
        id: 'actividad', estado: 'EN_PROCESO', meta_cantidad: '10',
        validado: '10', estimacion: '0', pendientes: 0, fotos: 2,
      }] };
    },
  } as unknown as Pool;
  const estado = await consultarCierreProyecto(pool, proyectoId, organizacionId);
  assert.equal(estado?.listo, true);
  assert.equal(estado?.metasCumplidas, 1);
  assert.equal(consultas.length, 2);
});

test('cierre: un avance sin revisión o sin fotografía impide finalizar', async () => {
  const pool = {
    query: async (sql: string) => sql.includes('SELECT p.estado')
      ? { rows: [{ estado: 'EN_EJECUCION' }] }
      : { rows: [{
        id: 'actividad', estado: 'EN_PROCESO', meta_cantidad: '10',
        validado: '10', estimacion: '0', pendientes: 1, fotos: 0,
      }] },
  } as unknown as Pool;
  const estado = await consultarCierreProyecto(pool, proyectoId, organizacionId);
  assert.equal(estado?.listo, false);
  assert.equal(estado?.pendientes, 1);
  assert.equal(estado?.sinEvidencia, 1);
});

test('cierre: finalizar es transaccional y audita la decisión', async () => {
  const sentencias: string[] = [];
  let released = false;
  const client = {
    query: async (sql: string) => {
      sentencias.push(sql);
      if (sql.includes('SELECT p.estado FROM proyectos p')) return { rows: [{ estado: 'EN_EJECUCION' }] };
      if (sql.includes('SELECT a.id, a.estado')) return { rows: [{
        id: 'actividad', estado: 'EN_PROCESO', meta_cantidad: '10',
        validado: '10', estimacion: '0', pendientes: 0, fotos: 1,
      }] };
      return { rows: [], rowCount: 1 };
    },
    release: () => { released = true; },
  };
  const pool = { connect: async () => client } as unknown as Pool;
  const resultado = await finalizarProyecto(pool, proyectoId, organizacionId, usuarioId, true, true);
  assert.equal(resultado.tipo, 'OK');
  assert.equal(sentencias.some((sql) => sql.includes('FINALIZAR_PROYECTO')), true);
  assert.equal(sentencias.at(-1), 'COMMIT');
  assert.equal(released, true);
});

test('reapertura: requiere estado FINALIZADO y registra auditoría', async () => {
  const sentencias: string[] = [];
  const client = {
    query: async (sql: string) => {
      sentencias.push(sql);
      return sql.includes('SELECT p.estado')
        ? { rows: [{ estado: 'FINALIZADO' }] }
        : { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  };
  const pool = { connect: async () => client } as unknown as Pool;
  assert.equal(await reabrirProyecto(pool, proyectoId, organizacionId, usuarioId,
    'Se detectó una corrección documental necesaria.'), 'OK');
  assert.equal(sentencias.some((sql) => sql.includes('REABRIR_PROYECTO')), true);
  assert.equal(sentencias.at(-1), 'COMMIT');
});
