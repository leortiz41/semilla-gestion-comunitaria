import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import {
  consultarMatrizAccesos, actualizarRestriccionesUsuario, actualizarRestriccionesRol,
} from '../src/modules/plataforma/permisos-tenant.repository.js';

const org='43ae3238-cfa5-43e9-a418-a56414b4d76e', id='6879894f-d541-43ce-81b4-b24062fe7f6e';
const operador='1964e8fa-d914-489e-9956-a193a894774d';
function db(op:{sinOrg?:boolean;retirada?:boolean;admin?:boolean;rolInactivo?:boolean;permisosBase?:string[];falla?:string}={}) {
  const llamadas:{sql:string;params?:unknown[]}[]=[];let liberado=0;
  const query=async(sql:string,params?:unknown[])=>{
    llamadas.push({sql,params});
    if(op.falla&&sql.includes(op.falla))throw Error('Falla');
    if(sql.startsWith('SELECT id FROM organizaciones'))return {rows:op.sinOrg?[]:[{id:org}],rowCount:op.sinOrg?0:1};
    if(sql.startsWith('SELECT id FROM usuarios'))return {rows:[{id}],rowCount:1};
    if(sql.startsWith('SELECT 1 FROM bitacora'))return {rows:op.retirada?[{id}]:[],rowCount:op.retirada?1:0};
    if(sql.startsWith('SELECT r.nombre FROM usuarios_roles'))return {rows:[{nombre:op.admin?'ADMINISTRADOR':'CAMPO'}]};
    if(sql.startsWith('SELECT DISTINCT p.id,p.codigo')||sql.startsWith('SELECT p.id,p.codigo FROM roles_permisos'))
      return {rows:(op.permisosBase??['proyectos.ver','usuarios.ver']).map((codigo,i)=>({id:'p'+i,codigo}))};
    if(sql.startsWith('SELECT id FROM roles'))return {rows:op.rolInactivo?[]:[{id:'rol'}],rowCount:op.rolInactivo?0:1};
    return {rows:[],rowCount:1};
  };
  const client={query,release:()=>{liberado++}};
  return {pool:{connect:async()=>client,query} as unknown as Pool,llamadas,liberado:()=>liberado};
}
test('Matriz de tenant: lectura filtra superadmin y cuentas retiradas',async()=>{
  const d=db();
  const r=await consultarMatrizAccesos(d.pool,org);
  assert.ok(r);
  const cuenta=d.llamadas.find(x=>x.sql.includes('FROM usuarios u WHERE u.organizacion_id=$1'));
  assert.deepEqual(cuenta?.params,[org,'SUPERADMINISTRADOR','usuarios','RETIRAR_USUARIO_ORGANIZACION']);
  assert.ok(cuenta?.sql.includes('organizaciones_roles_permisos_restringidos'));
  assert.ok(cuenta?.sql.includes('usuarios_permisos_restringidos'));
});
test('Matriz de tenant: una organización desconocida no revela permisos',async()=>{
  const d=db({sinOrg:true});assert.equal(await consultarMatrizAccesos(d.pool,org),null);
  assert.equal(d.llamadas.length,1);
});
test('Permisos usuario: no se pueden ampliar fuera del rol',async()=>{
  const d=db();
  const estado=await actualizarRestriccionesUsuario(d.pool,{organizacionId:org,usuarioId:id,operadorId:operador,permisos:['admin.global']});
  assert.equal(estado,'PERMISOS_INVALIDOS');assert.equal(d.llamadas.at(-1)?.sql,'ROLLBACK');
  assert.ok(!d.llamadas.some(c=>c.sql.includes('INSERT INTO usuarios_permisos_restringidos')));
});
test('Permisos usuario: administrador y retirada protegidos',async()=>{
  const a=db({admin:true});
  assert.equal(await actualizarRestriccionesUsuario(a.pool,{organizacionId:org,usuarioId:id,operadorId:operador,permisos:[]}), 'PROTEGIDA');
  const r=db({retirada:true});
  assert.equal(await actualizarRestriccionesUsuario(r.pool,{organizacionId:org,usuarioId:id,operadorId:operador,permisos:[]}), 'RETIRADA');
});
test('Permisos usuario: solo restricción del tenant elegido y bitácora',async()=>{
  const d=db();
  assert.equal(await actualizarRestriccionesUsuario(d.pool,{organizacionId:org,usuarioId:id,operadorId:operador,permisos:['proyectos.ver']}),'OK');
  const insert=d.llamadas.find(c=>c.sql.startsWith('INSERT INTO usuarios_permisos_restringidos'));
  assert.deepEqual(insert?.params,[org,id,'p1',operador]);
  assert.ok(d.llamadas.some(c=>c.params?.includes('PLATAFORMA_RESTRINGIR_PERMISOS')));
  assert.equal(d.llamadas.at(-1)?.sql,'COMMIT');
  assert.equal(d.liberado(),1);
});
test('Permisos rol: nunca escribe los permisos base globales',async()=>{
  const d=db();
  assert.equal(await actualizarRestriccionesRol(d.pool,{organizacionId:org,nombre:'CAMPO',permisos:['proyectos.ver'],operadorId:operador}),'OK');
  assert.ok(d.llamadas.some(c=>c.sql.startsWith('INSERT INTO organizaciones_roles_permisos_restringidos')));
  assert.ok(!d.llamadas.some(c=>/^(UPDATE|INSERT INTO|DELETE FROM) roles_permisos/.test(c.sql)));
  assert.ok(d.llamadas.some(c=>c.params?.includes('PLATAFORMA_PERMISOS_ROL_TENANT')));
  assert.equal(d.llamadas.at(-1)?.sql,'COMMIT');
});
test('Permisos rol: rechaza concesiones fuera del rol',async()=>{
  const d=db();
  assert.equal(await actualizarRestriccionesRol(d.pool,{organizacionId:org,nombre:'CAMPO',permisos:['superadmin'],operadorId:operador}),'PERMISOS_INVALIDOS');
  assert.equal(d.llamadas.at(-1)?.sql,'ROLLBACK');
});
test('Permisos rol: fallo SQL revierte y libera conexión',async()=>{
  const d=db({falla:'INSERT INTO organizaciones_roles_permisos_restringidos'});
  await assert.rejects(actualizarRestriccionesRol(d.pool,{organizacionId:org,nombre:'CAMPO',permisos:[],operadorId:operador}));
  assert.equal(d.llamadas.at(-1)?.sql,'ROLLBACK');assert.equal(d.liberado(),1);
});
test('ADR-006 Plataforma: rutas limpias y guardia global conservada',()=>{
  const routes=readFileSync(new URL('../src/routes/plataforma.routes.ts',import.meta.url),'utf8');
  assert.match(routes,/plataformaRouter\.use\(authenticateAccessToken, superadminActual\)/);
  assert.equal(routes.includes('.query('),false);
  for(const name of ['consultarAccesosTenant','actualizarPermisosCuentaTenant','actualizarPermisosRolTenant'])
    assert.ok(routes.includes(name));
  for(const name of ['permisos-tenant.controller.ts','permisos-tenant.service.ts']){
    const src=readFileSync(new URL('../src/modules/plataforma/'+name,import.meta.url),'utf8');
    assert.equal(src.includes('.query('),false);
  }
});
