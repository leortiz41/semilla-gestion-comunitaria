import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { perfilesFamiliaRouter as adaptador } from '../src/routes/perfiles-familia.routes.js';
import { perfilesFamiliaRouter as modular } from '../src/modules/familias/perfiles-familia.routes.js';
import { consultarProyectosDePerfilesEnRepositorio, consultarPerfilesFamiliaresEnRepositorio,
  persistirEvaluacionFamiliarEnRepositorio, persistirRevisionFamiliarEnRepositorio,
} from '../src/modules/familias/perfiles-familia.repository.js';
import { numero, texto, opcion } from '../src/modules/familias/perfiles-familia.domain.js';

test('ADR-006 Perfiles familiares: el adaptador conserva el router y los permisos internos', () => {
  assert.equal(adaptador, modular);
  const routes = readFileSync(new URL('../src/modules/familias/perfiles-familia.routes.ts', import.meta.url), 'utf8');
  assert.match(routes, /requireRole\('ADMINISTRADOR', 'COORDINADOR', 'CAMPO'\)/);
  assert.match(routes, /requireRole\('ADMINISTRADOR', 'COORDINADOR'\)/);
  assert.match(routes, /requirePermission\('comunidades\.ver'\)/);
  assert.match(routes, /requirePermission\('comunidades\.gestionar'\)/);
});

test('ADR-006 Perfiles familiares: preserva validaciones de entradas', () => {
  assert.equal(numero(3, 100, true), 3);
  assert.equal(numero(2.5, 100, true), null);
  assert.equal(texto('  Referencia  ', 150), 'Referencia');
  assert.equal(opcion('falso'), undefined);
  assert.equal(opcion(''), null);
});

test('ADR-006 Perfiles familiares: todas las consultas incluyen restricción por organización', async () => {
  const llamadas: { sql: string; params: unknown[] }[] = [];
  const pool = { query: async (sql: string, params: unknown[]) => {
    llamadas.push({ sql, params }); return { rows: [], rowCount: 0 };
  }} as unknown as Pool;
  const organizacionId = 'a6961f71-743f-4ea4-a998-39860161b4bc';
  const familiaId = '64ca5db2-22e0-43cf-a0cb-8241aa177c8c';
  const perfilId = 'ca158498-27e0-4ac7-9df7-28f7f400832a';
  await consultarProyectosDePerfilesEnRepositorio(pool, [organizacionId]);
  await consultarPerfilesFamiliaresEnRepositorio(pool, [familiaId, organizacionId]);
  await persistirEvaluacionFamiliarEnRepositorio(pool, [
    familiaId, perfilId, organizacionId, 4, 'MEDIO', 2, null, null, null, null,
    null, null, null, null, null, null, null, null, perfilId,
  ]);
  await persistirRevisionFamiliarEnRepositorio(pool, [perfilId, familiaId, 'EVALUADO', perfilId, '', organizacionId]);
  assert.equal(llamadas.length, 4);
  llamadas.forEach(c => {
    assert.ok(c.params.includes(organizacionId));
    assert.match(c.sql, /organizacion_id/);
  });
  assert.match(llamadas[2].sql, /perfiles_familia\.estado IN \('PENDIENTE','EVALUADO'\)/);
  assert.match(llamadas[3].sql, /pf\.estado='PENDIENTE'/);
});

test('ADR-006 Perfiles familiares: SQL aislado de rutas, controladores y servicios', () => {
  const leer = (file: string) => readFileSync(new URL('../src/modules/familias/' + file, import.meta.url), 'utf8');
  for (const file of ['perfiles-familia.routes.ts', 'perfiles-familia.controller.ts', 'perfiles-familia.service.ts']) {
    assert.equal(leer(file).includes('.query('), false, file);
  }
  assert.match(leer('perfiles-familia.controller.ts'), /La selección y entrega requieren validación documental/);
  assert.match(leer('perfiles-familia.repository.ts'), /ON CONFLICT \(familia_id,proyecto_id\)/);
});
