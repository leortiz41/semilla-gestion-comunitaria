import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validarFichaDonante, listarAccesosDonantes, actualizarEstadoDonante } from '../src/modules/donantes/administracion-donantes.service.js';
import type { Pool } from 'pg';
import { donantesRouter as routerAnterior } from '../src/routes/donantes.routes.js';
import { donantesRouter as routerModular } from '../src/modules/donantes/donantes.routes.js';

test('Módulo Donantes: el adaptador mantiene la misma instancia del router', () => {
  assert.equal(routerAnterior, routerModular);
});

test('ADR-006: normalización y validación de una ficha de donante', () => {
  assert.deepEqual(validarFichaDonante({
    nombre: '  Iglesia Esperanza ', correo: '  EQUIPO@EJEMPLO.COM ', telefono: '',
  }), { nombre: 'Iglesia Esperanza', correo: 'equipo@ejemplo.com', telefono: null });
  assert.equal(validarFichaDonante({ nombre: '', correo: 'x@ejemplo.com' }), null);
  assert.equal(validarFichaDonante({ nombre: 'Donante', correo: 'correo-sin-arroba' }), null);
});

test('ADR-006: administración filtra ambas consultas por organización', async () => {
  const consultas: { sql: string; parametros: unknown[] }[] = [];
  const pool = { query: async (sql: string, parametros: unknown[]) => {
    consultas.push({ sql, parametros });
    return { rows: [] };
  } } as unknown as Pool;
  const organizacionId = '6c93b1dc-7232-4e3f-99cb-5b543ca8a30d';
  assert.deepEqual(await listarAccesosDonantes(pool, organizacionId), { donantes: [], proyectos: [] });
  assert.equal(consultas.length, 2);
  for (const consulta of consultas) {
    assert.deepEqual(consulta.parametros, [organizacionId]);
    assert.match(consulta.sql, /organizacion_id = \$1/);
  }
});

test('ADR-006: cambiar estado de brigada aplica tenant y propietario en SQL', async () => {
  const consultas: { sql: string; parametros: unknown[] }[] = [];
  const pool = { query: async (sql: string, parametros: unknown[]) => {
    consultas.push({ sql, parametros }); return { rowCount: 1 };
  } } as unknown as Pool;
  const ok = await actualizarEstadoDonante(pool, 'org-prueba', 'ficha-prueba', 'brigada-prueba', false);
  assert.equal(ok, true);
  assert.match(consultas[0].sql, /d\.organizacion_id = \$3/);
  assert.match(consultas[0].sql, /b\.donante_id = d\.id/);
  assert.deepEqual(consultas[0].parametros, [false, 'ficha-prueba', 'org-prueba', 'brigada-prueba']);
});

test('ADR-006: rutas administrativas delegan sin SQL en sus nuevos controladores', () => {
  const base = '../src/modules/donantes/';
  const rutas = readFileSync(new URL(base + 'donantes.routes.ts', import.meta.url), 'utf8');
  const controlador = readFileSync(new URL(base + 'administracion-donantes.controller.ts', import.meta.url), 'utf8');
  const servicio = readFileSync(new URL(base + 'administracion-donantes.service.ts', import.meta.url), 'utf8');
  assert.match(rutas, /administracionDonantes\.get\('\/', obtenerAdministracionDonantes\)/);
  assert.match(rutas, /administracionDonantes\.post\('\/fichas', guardarFichaDonante\)/);
  assert.match(rutas, /administracionDonantes\.put\('\/fichas\/:id\/estado', modificarEstadoDonante\)/);
  assert.equal(controlador.includes('.query('), false);
  assert.equal(controlador.includes('administracion-donantes.repository'), false);
  assert.equal(servicio.includes('express'), false);
  assert.equal(servicio.includes('.query('), false);
});
