import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { validarBrigada } from '../src/modules/donantes/brigadas.domain.js';
import { guardarBrigadaEnRepositorio } from '../src/modules/donantes/brigadas.repository.js';

const fichaId = '7c32a895-b9d2-4f48-8951-69c4b27c0e5f';
const brigadaId = 'c86cc41e-a4c0-4fb1-bfeb-6e3a2198a15d';
const organizacionId = 'a3582b4f-62e5-458b-b748-1a9b97ae5ee1';
const comunidadId = 'c8aa9de4-664c-4434-8c15-16d60581f313';
const proyectoId = '9bba9d04-d607-4af0-9f8b-94bf674177cf';
const zonaId = '2c366ecd-d3cc-4e9e-b6ab-f75ca48494ca';

const entrada = {
  lider: 'Coordinadora de grupo', miembros: 18,
  llegada: '2026-12-04', salida: '2026-12-09',
  zonaId, comunidadIds: [comunidadId], proyectoIds: [proyectoId],
  actividades: ['Educación'], contrataciones: ['Transporte'],
  observaciones: '',
};

test('ADR-006 brigadas: dominio valida relaciones, cantidades, fechas y duplicados', () => {
  assert.equal(validarBrigada(entrada)?.miembros, 18);
  for (const cambios of [
    { miembros: 0 }, { llegada: '2026-13-04' },
    { salida: '2026-11-30' }, { comunidadIds: [comunidadId, comunidadId] },
    { proyectoIds: [proyectoId, proyectoId] }, { zonaId: 'otra-zona' },
  ]) {
    assert.equal(validarBrigada({ ...entrada, ...cambios }), null, JSON.stringify(cambios));
  }
});

function baseSimulada(fallarEn?: string, bloqueoAusente = false) {
  const llamadas: Array<{ sql: string; parametros?: unknown[] }> = [];
  let releases = 0;
  const cliente = {
    query: async (sql: string, parametros?: unknown[]) => {
      llamadas.push({ sql, parametros });
      if (fallarEn && sql.includes(fallarEn)) throw Error('Fallo simulado');
      if (sql.includes('FOR UPDATE OF b')) return { rowCount: bloqueoAusente ? 0 : 1, rows: [{ id: brigadaId }] };
      if (sql.includes('WITH comunidades_validas')) return { rowCount: 1, rows: [{ id: brigadaId }] };
      return { rowCount: 1, rows: [] };
    },
    release: () => { releases += 1; },
  };
  return {
    pool: { connect: async () => cliente } as unknown as Pool,
    llamadas, obtenerLiberaciones: () => releases,
  };
}

test('ADR-006 brigadas: creación conserva tenant, relaciones y COMMIT', async () => {
  const db = baseSimulada();
  const datos = validarBrigada(entrada);
  assert.ok(datos);
  assert.equal(await guardarBrigadaEnRepositorio(db.pool, fichaId, null, organizacionId, datos), 'OK');
  assert.equal(db.llamadas[0].sql, 'BEGIN');
  const escritura = db.llamadas.find(c => c.sql.includes('WITH comunidades_validas'));
  assert.ok(escritura);
  assert.match(escritura.sql, /organizacion_id = \$2/);
  assert.deepEqual(escritura.parametros?.slice(0, 3), [fichaId, organizacionId, [proyectoId]]);
  assert.ok(db.llamadas.some(c => c.sql.includes('INSERT INTO brigadas_donantes_comunidades')));
  assert.ok(db.llamadas.some(c => c.sql.includes('INSERT INTO brigadas_donantes_proyectos')));
  assert.equal(db.llamadas.at(-1)?.sql, 'COMMIT');
  assert.equal(db.obtenerLiberaciones(), 1);
});

test('ADR-006 brigadas: edición bloquea y actualiza relaciones dentro de la transacción', async () => {
  const db = baseSimulada();
  const datos = validarBrigada(entrada);
  assert.ok(datos);
  assert.equal(await guardarBrigadaEnRepositorio(db.pool, fichaId, brigadaId, organizacionId, datos), 'OK');
  assert.match(db.llamadas[1].sql, /FOR UPDATE OF b/);
  assert.deepEqual(db.llamadas[1].parametros, [brigadaId, fichaId, organizacionId]);
  assert.equal(db.llamadas.filter(c => c.sql.startsWith('DELETE FROM brigadas_donantes_')).length, 2);
  assert.equal(db.llamadas.at(-1)?.sql, 'COMMIT');
});

test('ADR-006 brigadas: fallo de persistencia revierte cambios y libera conexión', async () => {
  const db = baseSimulada('INSERT INTO brigadas_donantes_proyectos');
  const datos = validarBrigada(entrada);
  assert.ok(datos);
  await assert.rejects(guardarBrigadaEnRepositorio(db.pool, fichaId, null, organizacionId, datos));
  assert.equal(db.llamadas.at(-1)?.sql, 'ROLLBACK');
  assert.equal(db.llamadas.some(c => c.sql === 'COMMIT'), false);
  assert.equal(db.obtenerLiberaciones(), 1);
});

test('ADR-006 brigadas: actualización no localizada hace rollback', async () => {
  const db = baseSimulada(undefined, true);
  const datos = validarBrigada(entrada);
  assert.ok(datos);
  assert.equal(await guardarBrigadaEnRepositorio(db.pool, fichaId, brigadaId, organizacionId, datos), 'BRIGADA_NO_ENCONTRADA');
  assert.equal(db.llamadas.at(-1)?.sql, 'ROLLBACK');
  assert.equal(db.obtenerLiberaciones(), 1);
});

test('ADR-006 brigadas: rutas no contienen transacciones de brigadas', () => {
  const raiz = '../src/modules/donantes/';
  const rutas = readFileSync(new URL(raiz + 'donantes.routes.ts', import.meta.url), 'utf8');
  const controlador = readFileSync(new URL(raiz + 'brigadas.controller.ts', import.meta.url), 'utf8');
  const servicio = readFileSync(new URL(raiz + 'brigadas.service.ts', import.meta.url), 'utf8');
  assert.match(rutas, /post\('\/fichas\/:id\/brigadas', guardarBrigadaDonante\)/);
  assert.match(rutas, /put\('\/fichas\/:id\/brigadas\/:brigadaId', guardarBrigadaDonante\)/);
  assert.equal(rutas.includes('const guardarBrigada: RequestHandler'), false);
  assert.equal(controlador.includes('.query('), false);
  assert.equal(servicio.includes('express'), false);
  assert.equal(servicio.includes('.query('), false);
});
