import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { consultarCuentasPlataforma, insertarCuentaPlataforma,
  cambiarEstadoCuentaPlataforma } from '../src/modules/plataforma/cuentas-plataforma.repository.js';

const org='1f260c3c-7155-4aa1-a6b7-e3c6cc9e2b4b';
const usuario='8e0b8753-897b-458b-b59f-603b1b5b79c6';
const admin='3aed9dbd-10e5-4f24-b1ce-4d9568cbd82f';
function crearMock(op: {organizacion?: boolean; retirada?: boolean; global?: boolean;
  usuario?:boolean; roles?: boolean; cambia?: boolean; fallo?: string}={}) {
  const llamadas:{sql:string;params?:unknown[]}[]=[];let liberado=0;
  const query=async(sql:string,params?:unknown[])=>{
    llamadas.push({sql,params});
    if(op.fallo&&sql.includes(op.fallo))throw Error('error simulado');
    if(sql.includes('SELECT id FROM organizaciones WHERE id=$1 AND activo'))
      return {rows:op.organizacion===false?[]:[{id:org}],rowCount:op.organizacion===false?0:1};
    if(sql.includes('SELECT id FROM organizaciones WHERE id=$1'))
      return {rows:op.organizacion===false?[]:[{id:org}],rowCount:op.organizacion===false?0:1};
    if(sql.includes('SELECT id,activo FROM organizaciones'))
      return {rows:op.organizacion===false?[]:[{id:org,activo:true}]};
    if(sql.includes('SELECT id,activo FROM usuarios'))
      return {rows:op.usuario===false?[]:[{id:usuario,activo:op.cambia===false?false:true}]};
    if(sql.includes('RETIRAR_USUARIO_ORGANIZACION')&&sql.includes('SELECT 1 FROM bitacora'))
      return {rows:op.retirada?[{id:usuario}]:[],rowCount:op.retirada?1:0};
    if(sql.includes("r.nombre='SUPERADMINISTRADOR'"))
      return {rows:op.global?[{id:usuario}]:[]};
    if(sql.includes('SELECT id,nombre FROM roles'))
      return {rows:op.roles===false?[]:[{id:'rol1',nombre:'ADMINISTRADOR'}]};
    if(sql.includes('INSERT INTO usuarios(email'))
      return {rows:[{id:usuario,email:'nuevo@example.org',activo:true}]};
    return {rows:[]};
  };
  const client={query,release:()=>{liberado++}};
  return {pool:{query,connect:async()=>client} as unknown as Pool,llamadas,liberado:()=>liberado};
}
const datos={organizacionId:org,email:'nuevo@example.org',nombreVisible:'Usuario Nuevo',roles:['ADMINISTRADOR'],hash:'dummy',operadorId:admin};
test('ADR-006 Plataforma cuentas: listado filtrado por tenant',async()=>{
  const db=crearMock();await consultarCuentasPlataforma(db.pool,org);
  assert.ok(db.llamadas.some(x=>x.sql.includes('WHERE u.organizacion_id=$1')&&x.params?.[0]===org));
  assert.ok(db.llamadas.some(x=>x.sql.includes('RETIRAR_USUARIO_ORGANIZACION')));
});
test('ADR-006 Plataforma cuentas: alta completa con auditoría y commit',async()=>{
  const db=crearMock();const r=await insertarCuentaPlataforma(db.pool,datos);
  assert.equal(r.estado,'CREADA');assert.equal(db.llamadas[0].sql,'BEGIN');
  assert.ok(db.llamadas.some(x=>x.sql.includes('PLATAFORMA_CREAR_CUENTA')));
  assert.ok(db.llamadas.some(x=>x.sql.includes('INSERT INTO perfiles_usuarios')));
  assert.equal(db.llamadas.at(-1)?.sql,'COMMIT');assert.equal(db.liberado(),1);
});
test('ADR-006 Plataforma cuentas: roles ausentes causan rollback',async()=>{
  const db=crearMock({roles:false});const r=await insertarCuentaPlataforma(db.pool,datos);
  assert.equal(r.estado,'ROLES_NO_DISPONIBLES');
  assert.equal(db.llamadas.at(-1)?.sql,'ROLLBACK');assert.equal(db.liberado(),1);
});
test('ADR-006 Plataforma cuentas: falla al crear auditar revierte',async()=>{
  const db=crearMock({fallo:'PLATAFORMA_CREAR_CUENTA'});
  await assert.rejects(insertarCuentaPlataforma(db.pool,datos));
  assert.equal(db.llamadas.at(-1)?.sql,'ROLLBACK');assert.equal(db.liberado(),1);
});
test('ADR-006 Plataforma cuentas: retirada nunca se reactiva',async()=>{
  const db=crearMock({retirada:true});
  const r=await cambiarEstadoCuentaPlataforma(db.pool,{organizacionId:org,usuarioId:usuario,activo:true,operadorId:admin});
  assert.equal(r.estado,'RETIRADA');assert.equal(db.llamadas.at(-1)?.sql,'ROLLBACK');
});
test('ADR-006 Plataforma cuentas: protege superadministrador y cuenta propia',async()=>{
  const db=crearMock({global:true});
  const r=await cambiarEstadoCuentaPlataforma(db.pool,{organizacionId:org,usuarioId:usuario,activo:false,operadorId:admin});
  assert.equal(r.estado,'PROTEGIDA');
  const propia=crearMock();
  const r2=await cambiarEstadoCuentaPlataforma(propia.pool,{organizacionId:org,usuarioId:admin,activo:false,operadorId:admin});
  assert.equal(r2.estado,'PROTEGIDA');
});
test('ADR-006 Plataforma cuentas: suspensión revoca refresh tokens y audita',async()=>{
  const db=crearMock();
  const r=await cambiarEstadoCuentaPlataforma(db.pool,{organizacionId:org,usuarioId:usuario,activo:false,operadorId:admin});
  assert.equal(r.estado,'ACTUALIZADA');
  assert.ok(db.llamadas.some(x=>x.sql.includes('UPDATE tokens_refresco')));
  assert.ok(db.llamadas.some(x=>x.sql.includes('PLATAFORMA_CAMBIAR_ESTADO_CUENTA')));
  assert.equal(db.llamadas.at(-1)?.sql,'COMMIT');
});
test('ADR-006 Plataforma cuentas: rutas y autorización global conservadas',()=>{
  const rutas=readFileSync(new URL('../src/routes/plataforma.routes.ts',import.meta.url),'utf8');
  assert.match(rutas,/plataformaRouter\.use\(authenticateAccessToken, superadminActual\)/);
  for(const k of ['obtenerCuentasPlataforma','registrarCuentaPlataforma','modificarEstadoCuentaPlataforma'])
    assert.ok(rutas.includes(k));
  const base=new URL('../src/modules/plataforma/',import.meta.url);
  for(const file of ['cuentas-plataforma.controller.ts','cuentas-plataforma.service.ts'])
    assert.equal(readFileSync(new URL(file,base),'utf8').includes('.query('),false);
});
