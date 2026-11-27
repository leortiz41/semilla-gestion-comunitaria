import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { familiasRouter as rutaAnterior } from '../src/routes/familias.routes.js';
import { familiasRouter as rutaModular } from '../src/modules/familias/familias.routes.js';
import { camposFamilia } from '../src/modules/familias/familias.domain.js';
import {
  consultarComunidadesParaFamilias, consultarFamiliasPorOrganizacion,
  consultarFamiliaPorId, insertarFamilia, editarFamilia,
} from '../src/modules/familias/familias.repository.js';

const organizacionId = '25c2ee23-638e-43db-b65e-b74c6aa7fcc0';
const comunidadId = '958e59b6-2ba8-4555-9320-d6b7830e616a';
const familiaId = '9d8963a0-5e59-4d63-a7f0-bc836d9c3f22';

test('ADR-006 Familias: el adaptador conserva el mismo router', () => {
  assert.equal(rutaAnterior, rutaModular);
});

test('ADR-006 Familias: normalización original de campos', () => {
  assert.deepEqual(camposFamilia({
    comunidadId, nombreReferencia: '  Hogar ejemplo ',
    numeroCasa: '', direccionReferencia: ' Dirección ',
  }), { comunidadId, nombreReferencia: 'Hogar ejemplo', numeroCasa: '', direccionReferencia: 'Dirección' });
  assert.equal(camposFamilia({ comunidadId, nombreReferencia: 'x'.repeat(181) }).nombreReferencia, null);
});

test('ADR-006 Familias: todas las consultas restringen la organización', async () => {
  const llamadas: { sql: string; parametros: unknown[] }[] = [];
  const pool = { query: async (sql: string, parametros: unknown[]) => {
    llamadas.push({ sql, parametros }); return { rows: [], rowCount: 0 };
  } } as unknown as Pool;
  const datos = camposFamilia({ comunidadId, nombreReferencia: 'Hogar prueba',
    numeroCasa: '', direccionReferencia: '' });
  await consultarComunidadesParaFamilias(pool, organizacionId);
  await consultarFamiliasPorOrganizacion(pool, organizacionId);
  await consultarFamiliaPorId(pool, familiaId, organizacionId);
  await insertarFamilia(pool, datos, organizacionId);
  await editarFamilia(pool, familiaId, datos, false, organizacionId);
  assert.equal(llamadas.length, 5);
  for (const consulta of llamadas) {
    assert.ok(consulta.parametros.includes(organizacionId));
    assert.match(consulta.sql, /organizacion_id/);
  }
  assert.match(llamadas[3].sql, /c\.activo/);
  assert.match(llamadas[4].sql, /origen\.organizacion_id=\$7/);
  assert.match(llamadas[4].sql, /destino\.organizacion_id=\$7/);
});

test('ADR-006 Familias: rutas seguras, servicios y controladores sin SQL', () => {
  const leer = (nombre: string) =>
    readFileSync(new URL('../src/modules/familias/' + nombre, import.meta.url), 'utf8');
  const rutas = leer('familias.routes.ts');
  assert.match(rutas, /requireRole\('ADMINISTRADOR', 'COORDINADOR', 'CAMPO'\)/);
  assert.match(rutas, /requireRole\('ADMINISTRADOR', 'COORDINADOR'\)/);
  assert.match(rutas, /requirePermission\('comunidades\.ver'\)/);
  assert.match(rutas, /requirePermission\('comunidades\.gestionar'\)/);
  assert.equal(rutas.includes('.query('), false);
  assert.equal(leer('familias.controller.ts').includes('.query('), false);
  assert.equal(leer('familias.service.ts').includes('.query('), false);
  assert.match(leer('familias.repository.ts'), /SELECT.*familias/s);
});
