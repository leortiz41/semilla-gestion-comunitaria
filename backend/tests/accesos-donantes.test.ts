import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import {
  validarCorreoCuentaDonante, guardarAsignacionProyecto,
  publicarEvidenciaDonante, listarFichasDonantes,
} from '../src/modules/donantes/accesos-donantes.service.js';

const organizacionId = '2baa12c1-0e27-4c6d-aacc-bf9f1ec0d66b';
const proyectoId = '283ae2e2-53ad-47a1-b3cb-10b779d84638';
const donanteId = '27d382d5-43f1-4998-a89e-24be0045eb8b';
const evidenciaId = 'fb4f719b-bbc2-4a31-aa15-f5a51a66b8e1';

test('ADR-006 Donantes: correo de cuenta con validación y normalización', () => {
  assert.equal(validarCorreoCuentaDonante(' USUARIO@EJEMPLO.COM '), 'usuario@ejemplo.com');
  assert.equal(validarCorreoCuentaDonante('correo-invalido'), null);
  assert.equal(validarCorreoCuentaDonante('x'.repeat(151) + '@ejemplo.com'), null);
});

test('ADR-006 Donantes: asignación y revocación usan la organización explícita', async () => {
  const consultas: Array<{ sql: string; parametros: unknown[] }> = [];
  const pool = { query: async (sql: string, parametros: unknown[]) => {
    consultas.push({ sql, parametros });
    return { rows: [{ permitido: true }] };
  } } as unknown as Pool;
  assert.equal(await guardarAsignacionProyecto(pool, proyectoId, donanteId, organizacionId, true), true);
  assert.deepEqual(consultas[0].parametros, [donanteId, proyectoId, organizacionId, true]);
  assert.match(consultas[0].sql, /u\.organizacion_id = \$3/);
  assert.match(consultas[0].sql, /c\.organizacion_id = \$3/);
  assert.match(consultas[0].sql, /ON CONFLICT DO NOTHING/);
  assert.match(consultas[0].sql, /DELETE FROM proyectos_donantes/);
  assert.equal(await guardarAsignacionProyecto(pool, proyectoId, donanteId, organizacionId, false), true);
  assert.deepEqual(consultas[1].parametros, [donanteId, proyectoId, organizacionId, false]);
});

test('ADR-006 Donantes: publicación y revocación de evidencias exigen tenant', async () => {
  const consultas: Array<{ sql: string; parametros: unknown[] }> = [];
  const pool = { query: async (sql: string, parametros: unknown[]) => {
    consultas.push({ sql, parametros });
    return { rowCount: 1 };
  } } as unknown as Pool;
  assert.equal(await publicarEvidenciaDonante(pool, proyectoId, evidenciaId, organizacionId, true), true);
  assert.deepEqual(consultas[0].parametros, [true, evidenciaId, proyectoId, organizacionId]);
  assert.match(consultas[0].sql, /c\.organizacion_id = \$4/);
  assert.match(consultas[0].sql, /e\.solicitud_pago_id IS NULL/);
});

test('ADR-006 Donantes: fichas y catálogos filtrados por organización', async () => {
  const consultas: Array<{ sql: string; parametros: unknown[] }> = [];
  const pool = { query: async (sql: string, parametros: unknown[]) => {
    consultas.push({ sql, parametros });
    return { rows: [] };
  } } as unknown as Pool;
  assert.deepEqual(await listarFichasDonantes(pool, organizacionId), {
    fichas: [], comunidades: [], zonas: [],
  });
  assert.equal(consultas.length, 3);
  for (const consulta of consultas) {
    assert.deepEqual(consulta.parametros, [organizacionId]);
    assert.match(consulta.sql, /organizacion_id = \$1/);
  }
});

test('ADR-006 Donantes: router solo define endpoints y middleware', () => {
  const raiz = '../src/modules/donantes/';
  const rutas = readFileSync(new URL(raiz + 'donantes.routes.ts', import.meta.url), 'utf8');
  const controlador = readFileSync(new URL(raiz + 'accesos-donantes.controller.ts', import.meta.url), 'utf8');
  const servicio = readFileSync(new URL(raiz + 'accesos-donantes.service.ts', import.meta.url), 'utf8');
  assert.equal(rutas.includes('.query('), false);
  assert.equal(rutas.includes('databasePool'), false);
  assert.equal(rutas.includes('hashPassword'), false);
  assert.equal(controlador.includes('.query('), false);
  assert.equal(controlador.includes('accesos-donantes.repository'), false);
  assert.equal(servicio.includes('express'), false);
  assert.equal(servicio.includes('.query('), false);
  for (const nombre of [
    'crearCuentaAccesoDonante', 'actualizarAsignacionProyectoDonante',
    'actualizarVisibilidadEvidenciaDonante', 'obtenerFichasDonantes',
  ]) assert.ok(rutas.includes(nombre), nombre);
});
