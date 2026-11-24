import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import {
  listarProyectosPortal, obtenerMapaPortal, obtenerImpactoFamiliarPortal,
} from '../src/modules/donantes/portal-donantes.service.js';

const contexto = {
  usuarioId: '37c70dfe-6fd3-4f43-b30d-b2cfb2ae4557',
  organizacionId: '98dfe784-7b35-4bb5-932c-2a905073d403',
  puedeVerEvidencias: false,
};
const proyectoId = '72cf486f-c4bb-4054-8819-a16aacc45965';

test('ADR-006 portal: listado de proyectos limita usuario, organización y evidencias', async () => {
  const consultas: { sql: string; parametros: unknown[] }[] = [];
  const pool = { query: async (sql: string, parametros: unknown[]) => {
    consultas.push({ sql, parametros });
    return { rows: [] };
  } } as unknown as Pool;
  assert.deepEqual(await listarProyectosPortal(pool, contexto), []);
  assert.equal(consultas.length, 1);
  assert.deepEqual(consultas[0].parametros, [contexto.usuarioId, contexto.organizacionId, false]);
  assert.match(consultas[0].sql, /pd\.usuario_id = \$1/);
  assert.match(consultas[0].sql, /c\.organizacion_id = \$2/);
  assert.match(consultas[0].sql, /e\.visible_para_donantes/);
});

test('ADR-006 portal: mapa sin proyecto autorizado no consulta actividades ni evidencias', async () => {
  const consultas: { sql: string; parametros: unknown[] }[] = [];
  const pool = { query: async (sql: string, parametros: unknown[]) => {
    consultas.push({ sql, parametros });
    return { rows: [] };
  } } as unknown as Pool;
  assert.equal(await obtenerMapaPortal(pool, proyectoId, contexto), null);
  assert.equal(consultas.length, 1);
  assert.deepEqual(consultas[0].parametros, [contexto.usuarioId, proyectoId, contexto.organizacionId]);
  assert.match(consultas[0].sql, /pd\.proyecto_id = \$2/);
  assert.match(consultas[0].sql, /c\.organizacion_id = \$3/);
});

test('ADR-006 portal: mapa autorizado solo incluye avances validados y evidencias visibles', async () => {
  const consultas: { sql: string; parametros: unknown[] }[] = [];
  const pool = { query: async (sql: string, parametros: unknown[]) => {
    consultas.push({ sql, parametros });
    if (sql.includes('FROM proyectos_donantes pd')) return { rows: [{ id: proyectoId }] };
    if (sql.includes('FROM actividades_programadas')) return { rows: [{ id: 'actividad' }] };
    if (sql.includes('FROM avances_proyecto av')) return { rows: [{ id: 'avance' }] };
    if (sql.includes('FROM evidencias e')) return { rows: [] };
    throw Error('Consulta inesperada');
  } } as unknown as Pool;
  const mapa = await obtenerMapaPortal(pool, proyectoId, contexto);
  assert.equal(mapa?.proyecto.id, proyectoId);
  assert.equal(mapa?.actividades.length, 1);
  assert.equal(mapa?.avances.length, 1);
  assert.equal(mapa?.evidencias.length, 0);
  assert.equal(consultas.length, 4);
  const avances = consultas.find(c => c.sql.includes('FROM avances_proyecto av'));
  const evidencias = consultas.find(c => c.sql.includes('FROM evidencias e'));
  assert.match(avances!.sql, /estado_revision = 'VALIDADO'/);
  assert.match(evidencias!.sql, /e\.visible_para_donantes = TRUE/);
  assert.deepEqual(evidencias?.parametros, [proyectoId, false]);
});

test('ADR-006 portal: resumen familiar restringido por donante y organización sin datos personales', async () => {
  const consultas: { sql: string; parametros: unknown[] }[] = [];
  const pool = { query: async (sql: string, parametros: unknown[]) => {
    consultas.push({ sql, parametros }); return { rows: [] };
  } } as unknown as Pool;
  assert.deepEqual(await obtenerImpactoFamiliarPortal(pool, proyectoId, contexto), []);
  assert.equal(consultas.length, 1);
  assert.deepEqual(consultas[0].parametros, [contexto.usuarioId, proyectoId, contexto.organizacionId]);
  assert.match(consultas[0].sql, /u\.organizacion_id=\$3/);
  assert.match(consultas[0].sql, /proyectos_donantes pd/);
  assert.doesNotMatch(consultas[0].sql, /pf\.identidad|pf\.direccion|pf\.documento/);
});

test('ADR-006 portal: routes/controller/service no incluyen SQL ni accesos directos indebidos', () => {
  const raiz = '../src/modules/donantes/';
  const rutas = readFileSync(new URL(raiz + 'donantes.routes.ts', import.meta.url), 'utf8');
  const controller = readFileSync(new URL(raiz + 'portal-donantes.controller.ts', import.meta.url), 'utf8');
  const service = readFileSync(new URL(raiz + 'portal-donantes.service.ts', import.meta.url), 'utf8');
  for (const name of [
    'listarProyectosAutorizadosDonante', 'obtenerMapaAutorizadoDonante',
    'obtenerImpactoFamiliarAutorizado',
  ]) assert.ok(rutas.includes(name));
  assert.equal(controller.includes('.query('), false);
  assert.equal(controller.includes('portal-donantes.repository'), false);
  assert.equal(service.includes('.query('), false);
  assert.equal(service.includes('express'), false);
});
