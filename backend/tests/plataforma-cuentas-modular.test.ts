import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { consultarCuentasPlataforma, insertarCuentaPlataforma } from '../src/modules/plataforma/cuentas-plataforma.repository.js';
import { actualizarEstadoCuentaPlataforma } from '../src/modules/plataforma/cuentas-plataforma.service.js';
import type { ResultadoEstadoCuenta } from '../src/modules/plataforma/cuentas-plataforma.repository.js';

const cambiarEstadoCuentaPlataforma = (
  pool: Pool,
  datos: {organizacionId:string;usuarioId:string;activo:boolean;operadorId:string},
): Promise<ResultadoEstadoCuenta> => actualizarEstadoCuentaPlataforma(datos,pool);

const org='1f260c3c-7155-4aa1-a6b7-e3c6cc9e2b4b';
const usuario='8e0b8753-897b-458b-b59f-603b1b5b79c6';
const admin='3aed9dbd-10e5-4f24-b1ce-4d9568cbd82f';
function crearMock(op: {organizacion?: boolean; retirada?: boolean; global?: boolean;
  usuario?:boolean; roles?: boolean; cambia?: boolean; fallo?: string;
  administradorCuenta?:boolean; otrosAdministradores?:number}={}) {
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
    if(sql.includes("r.nombre='ADMINISTRADOR'") && sql.includes('FROM usuarios_roles ur'))
      return {rows:op.administradorCuenta?[{id:usuario}]:[]};
    if(sql.includes('COUNT(DISTINCT u.id)::int AS total'))
      return {rows:[{total:op.otrosAdministradores??1}]};
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
test('ADR-006 H-01: prohíbe suspender al último administrador activo',async()=>{
  const db=crearMock({administradorCuenta:true,otrosAdministradores:0});
  const resultado=await cambiarEstadoCuentaPlataforma(db.pool,{
    organizacionId:org,usuarioId:usuario,activo:false,operadorId:admin,
  });
  assert.equal(resultado.estado,'ULTIMO_ADMINISTRADOR');
  assert.equal(db.llamadas[0].sql,'BEGIN');
  assert.ok(db.llamadas.some(x=>x.sql.includes('FROM organizaciones WHERE id=$1 FOR UPDATE')&&x.params?.[0]===org));
  assert.ok(db.llamadas.some(x=>x.sql.includes('COUNT(DISTINCT u.id)::int AS total')&&
    x.params?.[0]===org&&x.params?.[1]===usuario));
  assert.equal(db.llamadas.at(-1)?.sql,'ROLLBACK');
  assert.equal(db.llamadas.some(x=>x.sql.includes('UPDATE usuarios SET activo=')),false);
  assert.equal(db.llamadas.some(x=>x.sql.includes('UPDATE tokens_refresco')),false);
  assert.equal(db.llamadas.some(x=>x.sql.includes('PLATAFORMA_CAMBIAR_ESTADO_CUENTA')),false);
  assert.equal(db.liberado(),1);
});

test('ADR-006 H-01: otro administrador activo permite desactivación',async()=>{
  const db=crearMock({administradorCuenta:true,otrosAdministradores:1});
  const resultado=await cambiarEstadoCuentaPlataforma(db.pool,{
    organizacionId:org,usuarioId:usuario,activo:false,operadorId:admin,
  });
  assert.equal(resultado.estado,'ACTUALIZADA');
  assert.ok(db.llamadas.some(x=>x.sql.includes('UPDATE usuarios SET activo=')));
  assert.ok(db.llamadas.some(x=>x.sql.includes('UPDATE tokens_refresco')));
  assert.equal(db.llamadas.at(-1)?.sql,'COMMIT');
});

test('ADR-006 H-01: desactivar CAMPO no depende de tener otro administrador',async()=>{
  const db=crearMock({administradorCuenta:false,otrosAdministradores:0});
  const resultado=await cambiarEstadoCuentaPlataforma(db.pool,{
    organizacionId:org,usuarioId:usuario,activo:false,operadorId:admin,
  });
  assert.equal(resultado.estado,'ACTUALIZADA');
  assert.equal(db.llamadas.some(x=>x.sql.includes('COUNT(DISTINCT u.id)::int AS total')),false);
  assert.equal(db.llamadas.at(-1)?.sql,'COMMIT');
});

test('ADR-006 H-01: reactivación de cuenta suspendida no exige otros administradores',async()=>{
  const db=crearMock({administradorCuenta:true,otrosAdministradores:0,cambia:false});
  const resultado=await cambiarEstadoCuentaPlataforma(db.pool,{
    organizacionId:org,usuarioId:usuario,activo:true,operadorId:admin,
  });
  assert.equal(resultado.estado,'ACTUALIZADA');
  assert.equal(db.llamadas.some(x=>x.sql.includes('COUNT(DISTINCT u.id)::int AS total')),false);
  assert.equal(db.llamadas.at(-1)?.sql,'COMMIT');
});

test('ADR-006 H-01: fallo durante verificación revierte transacción y libera conexión',async()=>{
  const db=crearMock({administradorCuenta:true,fallo:'COUNT(DISTINCT u.id)::int AS total'});
  await assert.rejects(cambiarEstadoCuentaPlataforma(db.pool,{
    organizacionId:org,usuarioId:usuario,activo:false,operadorId:admin,
  }));
  assert.equal(db.llamadas.at(-1)?.sql,'ROLLBACK');
  assert.equal(db.liberado(),1);
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
