import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { ErrorExpediente } from '../src/domain/expediente.js';
import { persistirVisionDesarrollo, consultarVisionesDesarrollo } from '../src/modules/comunidades/vision-desarrollo.repository.js';
import type { VisionDesarrolloComunitaria } from '../src/modules/comunidades/comunidades.service.js';

const organizacionId = '6ae56e4e-65d2-4bb8-876b-5288170e5939';
const comunidadId = '2d97c459-4a46-46fa-8b93-ac38071a911a';
const usuarioId = 'e933c510-a6b9-4279-b175-a7ec9dc463ce';
const visionId = '90c5121d-215d-4926-8ec6-a167f919d5b9';
const metas = [{ id: 'ccbaa0d3-74a2-4887-a1b4-2dd8b68a625c', descripcion: 'Capacitación comunitaria' }];
const vision: VisionDesarrolloComunitaria = {
  area: 'EDUCACION_COMUNITARIA', situacionActual: 'Por fortalecer',
  prioridad: 'ALTA', metaDesarrollo: 'Fortalecer aprendizaje', revision: 0, metas,
};
type Consulta = { sql: string; parametros?: unknown[] };
function simularPool(revisionExistente = 0, fallo?: string) {
  const consultas: Consulta[] = [];
  let liberaciones = 0;
  const cliente = {
    query: async (sql: string, parametros?: unknown[]) => {
      consultas.push({ sql, parametros });
      if (fallo && sql.includes(fallo)) throw Error('Fallo simulado');
      if (sql.startsWith('SELECT id FROM comunidades')) return { rowCount: 1, rows: [{ id: comunidadId }] };
      if (sql.startsWith('SELECT id FROM usuarios')) return { rowCount: 1, rows: [{ id: usuarioId }] };
      if (sql.startsWith('SELECT id,revision FROM visiones')) return { rowCount: 1, rows: [{ id: visionId, revision: revisionExistente }] };
      if (sql.startsWith('INSERT INTO visiones_desarrollo_comunitarias')) return { rowCount: 1, rows: [{ id: visionId }] };
      if (sql.startsWith('INSERT INTO metas_vision_desarrollo')) return { rowCount: 1, rows: [{ id: metas[0].id }] };
      if (sql.startsWith('SELECT v.area')) return { rowCount: 1, rows: [{
        area: vision.area, situacion_actual: vision.situacionActual, prioridad: vision.prioridad,
        meta_desarrollo: vision.metaDesarrollo, revision: 1, metas,
      }] };
      return { rowCount: 1, rows: [] };
    },
    release: () => { liberaciones++; },
  };
  return { pool: { connect: async () => cliente, query: cliente.query } as unknown as Pool,
    consultas, liberaciones: () => liberaciones };
}

test('ADR-006 visión: escritura exitosa bloquea tenant, audita y confirma transacción', async () => {
  const db = simularPool();
  const resultado = await persistirVisionDesarrollo(db.pool, organizacionId, comunidadId, vision, usuarioId, metas, 0);
  assert.equal(resultado?.revision, 1);
  assert.equal(db.consultas[0].sql, 'BEGIN');
  assert.match(db.consultas[1].sql, /FOR UPDATE/);
  assert.deepEqual(db.consultas[1].parametros, [comunidadId, organizacionId]);
  assert.match(db.consultas[2].sql, /FOR SHARE/);
  assert.deepEqual(db.consultas[2].parametros, [usuarioId, organizacionId]);
  assert.ok(db.consultas.some(c => c.sql.includes('GUARDAR_METAS_VISION')));
  assert.equal(db.consultas.at(-1)?.sql, 'COMMIT');
  assert.equal(db.liberaciones(), 1);
});

test('ADR-006 visión: una revisión obsoleta revierte la transacción', async () => {
  const db = simularPool(2);
  await assert.rejects(
    persistirVisionDesarrollo(db.pool, organizacionId, comunidadId, vision, usuarioId, metas, 0),
    (error: unknown) => error instanceof ErrorExpediente && error.status === 409,
  );
  assert.equal(db.consultas.at(-1)?.sql, 'ROLLBACK');
  assert.equal(db.consultas.some(c => c.sql === 'COMMIT'), false);
  assert.equal(db.liberaciones(), 1);
});

test('ADR-006 visión: un fallo al guardar metas ejecuta rollback', async () => {
  const db = simularPool(0, 'INSERT INTO metas_vision_desarrollo');
  await assert.rejects(persistirVisionDesarrollo(db.pool, organizacionId, comunidadId, vision, usuarioId, metas, 0));
  assert.equal(db.consultas.at(-1)?.sql, 'ROLLBACK');
  assert.equal(db.liberaciones(), 1);
});

test('ADR-006 visión: consulta de visiones exige filtro por organización', async () => {
  const db = simularPool();
  await consultarVisionesDesarrollo(db.pool, organizacionId, comunidadId);
  assert.deepEqual(db.consultas[0].parametros, [comunidadId, organizacionId]);
  assert.match(db.consultas[0].sql, /organizacion_id=\$2/);
});

test('ADR-006 visión: rutas y servicios delegan, sin SQL directo', () => {
  const raiz = '../src/modules/comunidades/';
  const routes = readFileSync(new URL(raiz + 'comunidades.routes.ts', import.meta.url), 'utf8');
  const controller = readFileSync(new URL(raiz + 'comunidades.controller.ts', import.meta.url), 'utf8');
  const service = readFileSync(new URL(raiz + 'comunidades.service.ts', import.meta.url), 'utf8');
  assert.match(routes, /obtenerVisionDesarrolloComunidad\)/);
  assert.match(routes, /guardarVisionDesarrolloComunidad\)/);
  assert.equal(controller.includes('.query('), false);
  assert.equal(service.includes('.query('), false);
  assert.equal(service.includes('BEGIN'), false);
  assert.equal(service.includes('bitacora_auditoria'), false);
});
