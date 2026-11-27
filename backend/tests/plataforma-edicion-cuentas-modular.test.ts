import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import {
  editarNombreDesdePlataforma, editarEmailDesdePlataforma, retirarCuentaDesdePlataforma,
} from '../src/modules/plataforma/edicion-cuentas.repository.js';

const organizacionId = '1fb7c07c-7e4f-4131-bc1a-58ea75f199f2';
const usuarioId = 'c4179c98-37cf-4185-8927-8fc01dd62f5d';
const operadorId = '9a0a5d38-876c-4a58-9374-ae056b6d14aa';
const contexto = { organizacionId, usuarioId, operadorId };
function fakeDB(op: {
  organizacion?: boolean; cuenta?: boolean; protegida?: boolean; retirada?: boolean;
  roles?: string[]; otrosAdministradores?: number; anterior?: string; falla?: string;
} = {}) {
  const llamadas: {sql:string;params?:unknown[]}[] = [];
  let liberaciones = 0;
  const query = async (sql:string, params?:unknown[]) => {
    llamadas.push({sql,params});
    if(op.falla && sql.includes(op.falla)) throw new Error('Fallo simulado');
    if(sql.includes('SELECT id FROM organizaciones')) {
      const rows = op.organizacion===false ? [] : [{id:organizacionId}];
      return {rows,rowCount:rows.length};
    }
    if(sql.includes('SELECT u.id,pf.nombre_visible')) {
      const rows = op.cuenta===false ? [] : [{id:usuarioId,nombreVisible:op.anterior??'Anterior'}];
      return {rows,rowCount:rows.length};
    }
    if(sql.includes('SELECT id,email FROM usuarios')) {
      const rows = op.cuenta===false ? [] : [{id:usuarioId,email:op.anterior??'anterior@example.org'}];
      return {rows,rowCount:rows.length};
    }
    if(sql.includes('SELECT id,activo FROM usuarios')) {
      const rows = op.cuenta===false ? [] : [{id:usuarioId,activo:true}];
      return {rows,rowCount:rows.length};
    }
    if(sql.includes("r.nombre='SUPERADMINISTRADOR'")) {
      const rows = op.protegida ? [{id:usuarioId}] : [];
      return {rows,rowCount:rows.length};
    }
    if(sql.includes("accion='RETIRAR_USUARIO_ORGANIZACION'")) {
      const rows = op.retirada ? [{id:usuarioId}] : [];
      return {rows,rowCount:rows.length};
    }
    if(sql.includes('SELECT r.nombre FROM usuarios_roles')) {
      const rows = (op.roles??['CAMPO']).map(nombre=>({nombre}));
      return {rows,rowCount:rows.length};
    }
    if(sql.includes('count(DISTINCT u.id)')) return {rows:[{total:op.otrosAdministradores??1}],rowCount:1};
    return {rows:[],rowCount:1};
  };
  const client={query,release:()=>{liberaciones++;}};
  return {pool:{connect:async()=>client,query} as unknown as Pool,llamadas,liberaciones:()=>liberaciones};
}

test('ADR-006 Plataforma: nombre actualiza perfil y auditoría atómicamente',async()=>{
  const d=fakeDB();
  assert.equal(await editarNombreDesdePlataforma(d.pool,{...contexto,nombreVisible:'Nombre Nuevo'}),'OK');
  assert.ok(d.llamadas.some(c=>c.sql.includes('INSERT INTO perfiles_usuarios')));
  assert.ok(d.llamadas.some(c=>c.sql.includes('PLATAFORMA_CAMBIAR_NOMBRE')));
  assert.equal(d.llamadas.at(-1)?.sql,'COMMIT');
  assert.equal(d.liberaciones(),1);
});

test('ADR-006 Plataforma: nombre sin cambio evita escrituras',async()=>{
  const d=fakeDB({anterior:'Sin Cambios'});
  assert.equal(await editarNombreDesdePlataforma(d.pool,{...contexto,nombreVisible:'Sin Cambios'}),'OK');
  assert.equal(d.llamadas.some(c=>c.sql.includes('INSERT INTO perfiles_usuarios')),false);
});

test('ADR-006 Plataforma: nombre bloquea cuenta protegida y retirada',async()=>{
  const p=fakeDB({protegida:true});
  assert.equal(await editarNombreDesdePlataforma(p.pool,{...contexto,nombreVisible:'Otro'}),'PROTEGIDA');
  assert.equal(p.llamadas.at(-1)?.sql,'ROLLBACK');
  const r=fakeDB({retirada:true});
  assert.equal(await editarNombreDesdePlataforma(r.pool,{...contexto,nombreVisible:'Otro'}),'RETIRADA');
  assert.equal(r.llamadas.at(-1)?.sql,'ROLLBACK');
});

test('ADR-006 Plataforma: correo revoca sesiones y audita',async()=>{
  const d=fakeDB();
  assert.equal(await editarEmailDesdePlataforma(d.pool,{...contexto,email:'nuevo@example.org'}),'OK');
  assert.ok(d.llamadas.some(c=>c.sql.includes('UPDATE tokens_refresco')));
  assert.ok(d.llamadas.some(c=>c.sql.includes('PLATAFORMA_CAMBIAR_EMAIL')));
  assert.equal(d.llamadas.at(-1)?.sql,'COMMIT');
});

test('ADR-006 Plataforma: correo igual evita revocación y auditoría',async()=>{
  const d=fakeDB({anterior:'igual@example.org'});
  assert.equal(await editarEmailDesdePlataforma(d.pool,{...contexto,email:'igual@example.org'}),'OK');
  assert.equal(d.llamadas.some(c=>c.sql.includes('UPDATE tokens_refresco')),false);
});

test('ADR-006 Plataforma: retiro mantiene al último administrador',async()=>{
  const d=fakeDB({roles:['ADMINISTRADOR'],otrosAdministradores:0});
  assert.equal(await retirarCuentaDesdePlataforma(d.pool,contexto),'ULTIMO_ADMINISTRADOR');
  assert.equal(d.llamadas.at(-1)?.sql,'ROLLBACK');
});

test('ADR-006 Plataforma: retiro lógico revoca sesiones y preserva relaciones',async()=>{
  const d=fakeDB();
  assert.equal(await retirarCuentaDesdePlataforma(d.pool,contexto),'OK');
  assert.ok(d.llamadas.some(c=>c.sql.includes('UPDATE usuarios SET activo=FALSE')));
  assert.ok(d.llamadas.some(c=>c.sql.includes('UPDATE tokens_refresco')));
  assert.ok(d.llamadas.some(c=>c.sql.includes('RETIRAR_USUARIO_ORGANIZACION')&&c.sql.includes('INSERT INTO bitacora')));
  assert.equal(d.llamadas.at(-1)?.sql,'COMMIT');
});

test('ADR-006 Plataforma: SQL fallido revierte y libera conexión',async()=>{
  const d=fakeDB({falla:'UPDATE tokens_refresco'});
  await assert.rejects(editarEmailDesdePlataforma(d.pool,{...contexto,email:'nuevo@example.org'}));
  assert.equal(d.llamadas.at(-1)?.sql,'ROLLBACK');
  assert.equal(d.liberaciones(),1);
});

test('ADR-006 Plataforma: rutas protegidas con controladores sin SQL directo',()=>{
  const rutas=readFileSync(new URL('../src/routes/plataforma.routes.ts',import.meta.url),'utf8');
  assert.match(rutas,/plataformaRouter\.use\(authenticateAccessToken, superadminActual\)/);
  for(const action of ['editarNombreCuentaPlataforma','editarEmailCuentaPlataforma','retirarCuentaPlataformaController'])
    assert.ok(rutas.includes(action));
  const root=new URL('../src/modules/plataforma/',import.meta.url);
  for(const f of ['edicion-cuentas.controller.ts','edicion-cuentas.service.ts'])
    assert.equal(readFileSync(new URL(f,root),'utf8').includes('.query('),false);
});
