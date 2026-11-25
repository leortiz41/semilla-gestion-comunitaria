import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { cambiarRolesDesdePlataforma } from '../src/modules/plataforma/roles-cuentas.repository.js';
import { rolesValidosPlataforma } from '../src/modules/plataforma/roles-cuentas.controller.js';

const organizacionId='1681a342-eb36-461d-ab43-994ff9a578d5';
const usuarioId='8e35473f-6d31-413c-bbed-7da85ab6447b';
const operadorId='80f056f0-9c6a-4e4f-b9e0-0b47925c715c';

function fakeDB(op: {org?:boolean; activo?:boolean; global?:boolean; ultimo?:boolean;
  actual?:string[]; roles?:boolean; fallar?:string}={}) {
  const llamadas:{sql:string;params?:unknown[]}[]=[];
  let liberaciones=0;
  const query=async(sql:string,params?:unknown[])=>{
    llamadas.push({sql,params});
    if(op.fallar&&sql.includes(op.fallar))throw Error('Fallo simulado');
    if(sql.includes('FROM organizaciones WHERE'))return {rows:op.org===false?[]:[{id:organizacionId}]};
    if(sql.includes('SELECT id,activo FROM usuarios'))return {rows:[{id:usuarioId,activo:op.activo!==false}]};
    if(sql.includes('SELECT r.nombre FROM usuarios_roles'))return {
      rows:op.global?[{nombre:'SUPERADMINISTRADOR'}]:(op.actual??['ADMINISTRADOR']).map(nombre=>({nombre})),
    };
    if(sql.includes('count(DISTINCT u.id)'))return {rows:[{total:op.ultimo?0:1}]};
    if(sql.includes('SELECT id,nombre FROM roles'))return {rows:op.roles===false?[]:[{id:'rol-id',nombre:'COORDINADOR'}]};
    return {rows:[],rowCount:1};
  };
  const client={query,release:()=>{liberaciones++}};
  return {pool:{query,connect:async()=>client} as unknown as Pool,llamadas,liberaciones:()=>liberaciones};
}
const datos={organizacionId,usuarioId,roles:['COORDINADOR'],operadorId};

test('ADR-006 Plataforma roles: prohíbe roles globales o DONANTE combinado',()=>{
  assert.equal(rolesValidosPlataforma(['SUPERADMINISTRADOR']),false);
  assert.equal(rolesValidosPlataforma(['DONANTE','CAMPO']),false);
  assert.equal(rolesValidosPlataforma(['CAMPO','CAMPO']),false);
  assert.equal(rolesValidosPlataforma(['COORDINADOR']),true);
});

test('ADR-006 Plataforma roles: no modifica cuenta global',async()=>{
  const d=fakeDB({global:true});
  assert.equal((await cambiarRolesDesdePlataforma(d.pool,datos)).estado,'CUENTA_PROTEGIDA');
  assert.equal(d.llamadas.at(-1)?.sql,'ROLLBACK');assert.equal(d.liberaciones(),1);
});

test('ADR-006 Plataforma roles: conserva último administrador',async()=>{
  const d=fakeDB({ultimo:true});
  assert.equal((await cambiarRolesDesdePlataforma(d.pool,datos)).estado,'ULTIMO_ADMINISTRADOR');
  assert.equal(d.llamadas.at(-1)?.sql,'ROLLBACK');assert.equal(d.liberaciones(),1);
});

test('ADR-006 Plataforma roles: bloquea tenant y usuario en transacción',async()=>{
  const d=fakeDB();
  assert.equal((await cambiarRolesDesdePlataforma(d.pool,datos)).estado,'ACTUALIZADO');
  assert.equal(d.llamadas[0].sql,'BEGIN');
  assert.deepEqual(d.llamadas[1].params,[organizacionId]);
  assert.deepEqual(d.llamadas[2].params,[usuarioId,organizacionId]);
  assert.ok(d.llamadas.some(x=>x.sql.includes('UPDATE tokens_refresco')));
  assert.ok(d.llamadas.some(x=>x.sql.includes('PLATAFORMA_CAMBIAR_ROLES')));
  assert.equal(d.llamadas.at(-1)?.sql,'COMMIT');assert.equal(d.liberaciones(),1);
});

test('ADR-006 Plataforma roles: invalidación atómica tras error',async()=>{
  const d=fakeDB({fallar:'UPDATE tokens_refresco'});
  await assert.rejects(cambiarRolesDesdePlataforma(d.pool,datos));
  assert.equal(d.llamadas.at(-1)?.sql,'ROLLBACK');assert.equal(d.liberaciones(),1);
});

test('ADR-006 Plataforma roles: sin organización activa no escribe',async()=>{
  const d=fakeDB({org:false});
  assert.equal((await cambiarRolesDesdePlataforma(d.pool,datos)).estado,'CUENTA_INACTIVA');
  assert.equal(d.llamadas.at(-1)?.sql,'ROLLBACK');
});

test('ADR-006 Plataforma roles y credenciales: rutas conservan middleware global',()=>{
  const root=new URL('../src/modules/plataforma/',import.meta.url);
  const routes=readFileSync(new URL('../src/routes/plataforma.routes.ts',import.meta.url),'utf8');
  assert.match(routes,/plataformaRouter\.use\(authenticateAccessToken, superadminActual\)/);
  assert.match(routes,/plataformaRouter\.put\('\/organizaciones\/:organizacionId\/cuentas\/:usuarioId\/roles',\s*modificarRolesCuentaPlataforma\)/);
  assert.match(routes,/plataformaRouter\.post\('\/organizaciones\/:organizacionId\/cuentas\/:usuarioId\/credencial-temporal',\s*reemitirCredencialCuentaPlataforma\)/);
  for(const file of ['roles-cuentas.service.ts','roles-cuentas.controller.ts',
    'credenciales-cuentas.service.ts','credenciales-cuentas.controller.ts']) {
    assert.equal(readFileSync(new URL(file,root),'utf8').includes('.query('),false,file);
  }
  const credenciales=readFileSync(new URL('credenciales-cuentas.service.ts',root),'utf8');
  assert.match(credenciales,/reemitirCredencialTemporalAdministrador/);
  assert.match(credenciales,/permitirOtrosRoles: true/);
});
