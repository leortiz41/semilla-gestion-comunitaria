import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { prepararNuevaOrganizacion, esUuidOrganizacion } from '../src/modules/plataforma/organizaciones.domain.js';
import { insertarOrganizacion, actualizarEstadoOrganizacion } from '../src/modules/plataforma/organizaciones.repository.js';

const org = 'af58f1ba-6650-46e8-967d-c472399ba523';
const admin = '3a0f6369-a3a3-4f5b-b42c-0467e4fc59e9';
type Llamada = { sql: string; params?: unknown[] };

function simular(op: { existe?: boolean; actual?: boolean; propia?: boolean; falla?: string } = {}) {
  const llamadas: Llamada[] = [];
  let liberaciones = 0;
  const query = async (sql: string, params?: unknown[]) => {
    llamadas.push({sql,params});
    if (op.falla && sql.includes(op.falla)) throw Error('Error simulado');
    if (sql.includes('INSERT INTO organizaciones(')) {
      return { rows: [{ id:org,nombre:'Organización Prueba',slug:'organizacion-prueba',activo:true,emailContacto:null }] };
    }
    if (sql.includes('SELECT id,activo FROM organizaciones')) {
      return { rows: op.existe === false ? [] : [{id:org,activo:op.actual ?? true}] };
    }
    if (sql.includes('SELECT 1 FROM usuarios WHERE id=$1')) {
      return { rows:op.propia ? [{id:admin}]:[] };
    }
    return { rows:[],rowCount:1 };
  };
  const client = {query,release:()=>{liberaciones++;}};
  return {pool:{connect:async()=>client,query} as unknown as Pool,llamadas,liberaciones:()=>liberaciones};
}

test('ADR-006 Organizaciones: normalización y validación original de datos', () => {
  assert.deepEqual(prepararNuevaOrganizacion({
    nombre:' Comunidad Prueba ',slug:' Comunidad-Prueba ',emailContacto:' PRUEBA@EXAMPLE.ORG ',
  }),{nombre:'Comunidad Prueba',slug:'comunidad-prueba',emailContacto:'prueba@example.org'});
  assert.equal(prepararNuevaOrganizacion({nombre:'Prueba',slug:'slug incorrecto'}),null);
  assert.equal(prepararNuevaOrganizacion({nombre:'Prueba',slug:'valido',emailContacto:'incorrecto'}),null);
  assert.equal(esUuidOrganizacion(org),true);
  assert.equal(esUuidOrganizacion('cualquier-id'),false);
});

test('ADR-006 Organizaciones: creación confirma usuario, tenant y bitácora atómicamente', async () => {
  const db=simular();
  const creado=await insertarOrganizacion(db.pool,{nombre:'Organización Prueba',slug:'organizacion-prueba',emailContacto:null},admin);
  assert.equal(creado.id,org);
  assert.equal(db.llamadas[0].sql,'BEGIN');
  assert.ok(db.llamadas.some(c=>c.sql.includes('PLATAFORMA_CREAR_ORGANIZACION')));
  assert.ok(db.llamadas.some(c=>c.params?.includes(admin)));
  assert.equal(db.llamadas.at(-1)?.sql,'COMMIT');
  assert.equal(db.liberaciones(),1);
});

test('ADR-006 Organizaciones: crear revierte transacción cuando falla auditoría', async () => {
  const db=simular({falla:'PLATAFORMA_CREAR_ORGANIZACION'});
  await assert.rejects(insertarOrganizacion(db.pool,{nombre:'Prueba',slug:'prueba',emailContacto:null},admin));
  assert.equal(db.llamadas.at(-1)?.sql,'ROLLBACK');
  assert.equal(db.liberaciones(),1);
});

test('ADR-006 Organizaciones: suspensión revoca sesiones y conserva datos', async () => {
  const db=simular();
  const resultado=await actualizarEstadoOrganizacion(db.pool,org,false,admin);
  assert.deepEqual(resultado,{estado:'ACTUALIZADA',id:org,activo:false});
  assert.deepEqual(db.llamadas[1].params,[org]);
  assert.ok(db.llamadas.some(c=>c.sql.includes('UPDATE organizaciones SET activo=$1')));
  assert.ok(db.llamadas.some(c=>c.sql.includes('UPDATE tokens_refresco')));
  assert.ok(db.llamadas.some(c=>c.sql.includes('PLATAFORMA_CAMBIAR_ESTADO_ORGANIZACION')));
  assert.equal(db.llamadas.at(-1)?.sql,'COMMIT');
  assert.equal(db.liberaciones(),1);
});

test('ADR-006 Organizaciones: no permite suspender organización de la cuenta global', async () => {
  const db=simular({propia:true});
  const r=await actualizarEstadoOrganizacion(db.pool,org,false,admin);
  assert.equal(r.estado,'ORGANIZACION_GLOBAL_PROTEGIDA');
  assert.equal(db.llamadas.at(-1)?.sql,'ROLLBACK');
  assert.equal(db.liberaciones(),1);
});

test('ADR-006 Organizaciones: tenant inexistente revierte transacción', async () => {
  const db=simular({existe:false});
  const r=await actualizarEstadoOrganizacion(db.pool,org,true,admin);
  assert.equal(r.estado,'NO_ENCONTRADA');
  assert.equal(db.llamadas.at(-1)?.sql,'ROLLBACK');
});

test('ADR-006 Organizaciones: estado idéntico no revoca sesiones ni escribe auditoría', async () => {
  const db=simular({actual:true});
  const r=await actualizarEstadoOrganizacion(db.pool,org,true,admin);
  assert.equal(r.estado,'ACTUALIZADA');
  assert.equal(db.llamadas.some(c=>c.sql.includes('UPDATE tokens_refresco')),false);
  assert.equal(db.llamadas.some(c=>c.sql.includes('PLATAFORMA_CAMBIAR_ESTADO_ORGANIZACION')),false);
  assert.equal(db.llamadas.at(-1)?.sql,'COMMIT');
});

test('ADR-006 Organizaciones: rollback por error de SQL en suspensión', async () => {
  const db=simular({falla:'UPDATE tokens_refresco'});
  await assert.rejects(actualizarEstadoOrganizacion(db.pool,org,false,admin));
  assert.equal(db.llamadas.at(-1)?.sql,'ROLLBACK');
  assert.equal(db.liberaciones(),1);
});

test('ADR-006 Organizaciones: rutas originales conservadas, SQL separado', () => {
  const rutas=readFileSync(new URL('../src/routes/plataforma.routes.ts',import.meta.url),'utf8');
  assert.match(rutas,/plataformaRouter\.post\('\/organizaciones', registrarOrganizacion\)/);
  assert.match(rutas,/plataformaRouter\.patch\('\/organizaciones\/:organizacionId\/estado', modificarEstadoOrganizacion\)/);
  assert.match(rutas,/plataformaRouter\.use\(authenticateAccessToken, superadminActual\)/);
  const base=new URL('../src/modules/plataforma/',import.meta.url);
  for (const f of ['organizaciones.domain.ts','organizaciones.controller.ts','organizaciones.service.ts']) {
    const texto=readFileSync(new URL(f,base),'utf8');
    assert.equal(texto.includes('.query('),false,f);
  }
});
