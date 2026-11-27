import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { asignacionesFamiliasRouter as rutaAnterior } from '../src/routes/asignaciones-familias.routes.js';
import { asignacionesFamiliasRouter as rutaModular } from '../src/modules/familias/asignaciones-familias.routes.js';
import {
  consultarBrigadasFamilia, persistirAsignacionBrigada,
} from '../src/modules/familias/asignaciones-familias.repository.js';

const familiaId = '574f1212-5d2e-4cd9-ac9d-4e1c2554e1e6';
const perfilId = 'cc51dadb-0a99-4721-9b57-49e82141c879';
const brigadaId = 'aa765bd2-cff9-4fc5-8837-a84e55cdd133';
const usuarioId = '7bb3df0b-ea7a-4e12-8125-b4de2a05845b';
const organizacionId = '04fc8df6-14b8-450f-9ff3-bb0e31356867';
type Llamada = { sql: string; params?: unknown[] };

function crearPool(opciones: { perfilExiste?: boolean; brigadaElegible?: boolean; fallaEn?: string } = {}) {
  const llamadas: Llamada[] = [];
  let liberaciones = 0;
  const query = async (sql: string, params?: unknown[]) => {
    llamadas.push({ sql, params });
    if (opciones.fallaEn && sql.includes(opciones.fallaEn)) throw new Error('Fallo simulado');
    if (sql.includes('SELECT pf.id FROM perfiles_familia')) {
      return { rows: opciones.perfilExiste === false ? [] : [{ id: perfilId }] };
    }
    if (sql.includes('SELECT b.id FROM brigadas_donantes')) {
      return { rows: opciones.brigadaElegible === false ? [] : [{ id: brigadaId }] };
    }
    return { rows: [], rowCount: 1 };
  };
  const client = { query, release: () => { liberaciones++; } };
  const pool = { query, connect: async () => client } as unknown as Pool;
  return { pool, llamadas, liberaciones: () => liberaciones };
}

test('ADR-006 Asignaciones: router histórico es el mismo y mantiene roles', () => {
  assert.equal(rutaAnterior, rutaModular);
  const rutas = readFileSync(new URL('../src/modules/familias/asignaciones-familias.routes.ts', import.meta.url), 'utf8');
  assert.match(rutas, /requireRole\('ADMINISTRADOR', 'COORDINADOR', 'CAMPO'\)/);
  assert.match(rutas, /requireRole\('ADMINISTRADOR', 'COORDINADOR'\)/);
  assert.match(rutas, /requirePermission\('comunidades\.ver'\)/);
  assert.match(rutas, /requirePermission\('comunidades\.gestionar'\)/);
});

test('ADR-006 Asignaciones: listado usa alcance multitenant', async () => {
  const db = crearPool();
  await consultarBrigadasFamilia(db.pool, familiaId, perfilId, organizacionId);
  assert.deepEqual(db.llamadas[0].params, [familiaId, perfilId, organizacionId]);
  assert.match(db.llamadas[0].sql, /c\.organizacion_id = \$3/);
  assert.match(db.llamadas[0].sql, /d\.organizacion_id = c\.organizacion_id/);
});

test('ADR-006 Asignaciones: asignación válida confirma y audita dentro de transacción', async () => {
  const db = crearPool();
  const resultado = await persistirAsignacionBrigada(
    db.pool, familiaId, perfilId, brigadaId, usuarioId, organizacionId,
  );
  assert.deepEqual(resultado, { estado: 'ASIGNADO', perfilId, brigadaId });
  assert.equal(db.llamadas[0].sql, 'BEGIN');
  assert.match(db.llamadas[1].sql, /FOR UPDATE OF pf/);
  assert.deepEqual(db.llamadas[1].params, [familiaId, perfilId, organizacionId]);
  assert.deepEqual(db.llamadas[2].params, [brigadaId, perfilId, organizacionId]);
  assert.ok(db.llamadas.some(c => c.sql.includes('INSERT INTO asignaciones_familias_brigadas')));
  assert.ok(db.llamadas.some(c => c.sql.includes('ASIGNAR_BRIGADA_FAMILIAR')));
  assert.equal(db.llamadas.at(-1)?.sql, 'COMMIT');
  assert.equal(db.liberaciones(), 1);
});

test('ADR-006 Asignaciones: desasignación también audita y confirma', async () => {
  const db = crearPool();
  const resultado = await persistirAsignacionBrigada(
    db.pool, familiaId, perfilId, null, usuarioId, organizacionId,
  );
  assert.deepEqual(resultado, { estado: 'ASIGNADO', perfilId, brigadaId: null });
  assert.ok(db.llamadas.some(c => c.sql.startsWith('DELETE FROM asignaciones_familias_brigadas')));
  assert.equal(db.llamadas.at(-1)?.sql, 'COMMIT');
  assert.equal(db.liberaciones(), 1);
});

test('ADR-006 Asignaciones: perfil inexistente revierte y devuelve estado equivalente a 404', async () => {
  const db = crearPool({ perfilExiste: false });
  const resultado = await persistirAsignacionBrigada(db.pool, familiaId, perfilId, brigadaId, usuarioId, organizacionId);
  assert.equal(resultado.estado, 'PERFIL_NO_DISPONIBLE');
  assert.equal(db.llamadas.at(-1)?.sql, 'ROLLBACK');
  assert.equal(db.liberaciones(), 1);
});

test('ADR-006 Asignaciones: brigada no elegible revierte y devuelve estado equivalente a 409', async () => {
  const db = crearPool({ brigadaElegible: false });
  const resultado = await persistirAsignacionBrigada(db.pool, familiaId, perfilId, brigadaId, usuarioId, organizacionId);
  assert.equal(resultado.estado, 'BRIGADA_NO_ELEGIBLE');
  assert.equal(db.llamadas.at(-1)?.sql, 'ROLLBACK');
  assert.equal(db.liberaciones(), 1);
});

test('ADR-006 Asignaciones: fallo de escritura revierte y libera conexión', async () => {
  const db = crearPool({ fallaEn: 'INSERT INTO asignaciones_familias_brigadas' });
  await assert.rejects(persistirAsignacionBrigada(db.pool, familiaId, perfilId, brigadaId, usuarioId, organizacionId));
  assert.equal(db.llamadas.at(-1)?.sql, 'ROLLBACK');
  assert.equal(db.liberaciones(), 1);
});

test('ADR-006 Asignaciones: SQL reside únicamente en el repositorio', () => {
  const leer = (nombre: string) =>
    readFileSync(new URL('../src/modules/familias/asignaciones-familias.' + nombre + '.ts', import.meta.url), 'utf8');
  for (const archivo of ['routes', 'controller', 'service']) {
    assert.equal(leer(archivo).includes('.query('), false, archivo);
  }
  assert.match(leer('repository'), /bitacora_auditoria/);
});
