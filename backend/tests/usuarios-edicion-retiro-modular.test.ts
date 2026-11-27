import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { actualizarNombreCuenta, actualizarEmailCuenta } from '../src/modules/usuarios/edicion-cuentas.repository.js';
import { retirarCuentaOrganizacion } from '../src/modules/usuarios/retiro-cuentas.repository.js';

const org = '0b2a2b82-0b99-44e8-809f-0a43707b0439';
const admin = '36fa5a1c-b125-4b6e-8b95-f41bc27873f5';
const user = '81475a0d-9f0a-4fd1-8775-a6a3bb034455';
type Consulta = { sql: string; valores?: unknown[] };

function fakeDb(options: { nombre?: string; email?: string; roles?: string[]; adminActivo?: boolean;
  protegido?: boolean; retirado?: boolean; otrosAdmins?: number; existe?: boolean; falla?: string } = {}) {
  const consultas: Consulta[] = [];
  let liberaciones = 0;
  const query = async (sql: string, valores?: unknown[]) => {
    consultas.push({ sql, valores });
    if (options.falla && sql.includes(options.falla)) throw new Error('fallo');
    if (sql.includes('FROM organizaciones WHERE')) return { rows: [{id:org}], rowCount:1 };
    if (sql.includes("r.nombre='ADMINISTRADOR' AND r.activo") && sql.includes('LIMIT 1')) {
      const rows=options.adminActivo===false?[]:[{id:admin}];return { rows, rowCount:rows.length };
    }
    if (sql.includes('FROM usuarios u') && sql.includes('FOR UPDATE OF u')) {
      const rows=options.existe===false?[]:[{id:user,nombreVisible:options.nombre??'Anterior'}];
      return {rows,rowCount:rows.length};
    }
    if (sql.includes('SELECT id,email FROM usuarios')) {
      const rows=options.existe===false?[]:[{id:user,email:options.email??'anterior@ejemplo.org'}];
      return {rows,rowCount:rows.length};
    }
    if (sql.includes('SELECT id,activo FROM usuarios')) {
      const rows=options.existe===false?[]:[{id:user,activo:true}];return {rows,rowCount:rows.length};
    }
    if (sql.includes("r.nombre='SUPERADMINISTRADOR'")) {
      const rows=options.protegido?[{id:user}]:[];return {rows,rowCount:rows.length};
    }
    if (sql.includes('SELECT r.nombre FROM usuarios_roles')) {
      const rows=(options.roles??['CAMPO']).map(nombre=>({nombre}));return {rows,rowCount:rows.length};
    }
    if (sql.includes("accion='RETIRAR_USUARIO_ORGANIZACION'")) {
      const rows=options.retirado?[{id:user}]:[];return {rows,rowCount:rows.length};
    }
    if (sql.includes('COUNT(DISTINCT u.id)')) return {rows:[{total:options.otrosAdmins??1}],rowCount:1};
    return {rows:[],rowCount:1};
  };
  const client = {query,release:()=>{liberaciones++;}};
  return { pool:{connect:async()=>client,query} as unknown as Pool, consultas, liberaciones:()=>liberaciones };
}

test('ADR-006 Edición: nombre conserva auditoría y transacción', async () => {
  const d=fakeDb();
  assert.deepEqual(await actualizarNombreCuenta(d.pool,user,'Nuevo Nombre',admin,org),{estado:'ACTUALIZADO'});
  assert.equal(d.consultas[0].sql,'BEGIN');
  assert.ok(d.consultas.some(c=>c.sql.includes('CAMBIAR_NOMBRE_USUARIO')));
  assert.equal(d.consultas.at(-1)?.sql,'COMMIT');
  assert.equal(d.liberaciones(),1);
});

test('ADR-006 Edición: nombre sin cambios evita escrituras', async () => {
  const d=fakeDb({nombre:'Sin Cambios'});
  await actualizarNombreCuenta(d.pool,user,'Sin Cambios',admin,org);
  assert.equal(d.consultas.some(c=>c.sql.includes('INSERT INTO perfiles_usuarios')),false);
  assert.equal(d.consultas.at(-1)?.sql,'COMMIT');
});

test('ADR-006 Edición: correo modificado revoca tokens y audita', async () => {
  const d=fakeDb();
  assert.deepEqual(await actualizarEmailCuenta(d.pool,user,'nuevo@ejemplo.org',admin,org),{estado:'ACTUALIZADO'});
  assert.ok(d.consultas.some(c=>c.sql.includes('UPDATE tokens_refresco')));
  assert.ok(d.consultas.some(c=>c.sql.includes('CAMBIAR_EMAIL_USUARIO')));
  assert.equal(d.consultas.at(-1)?.sql,'COMMIT');
});

test('ADR-006 Edición: correo sin cambios no revoca sesiones', async () => {
  const d=fakeDb({email:'igual@ejemplo.org'});
  await actualizarEmailCuenta(d.pool,user,'igual@ejemplo.org',admin,org);
  assert.equal(d.consultas.some(c=>c.sql.includes('UPDATE tokens_refresco')),false);
});

test('ADR-006 Edición: cuenta global protegida provoca rollback', async () => {
  const d=fakeDb({protegido:true});
  assert.equal((await actualizarEmailCuenta(d.pool,user,'nuevo@ejemplo.org',admin,org)).estado,'CUENTA_PROTEGIDA');
  assert.equal(d.consultas.at(-1)?.sql,'ROLLBACK');
  assert.equal(d.liberaciones(),1);
});

test('ADR-006 Retiro: protege al último administrador de la organización', async () => {
  const d=fakeDb({roles:['ADMINISTRADOR'],otrosAdmins:0});
  const resultado=await retirarCuentaOrganizacion(d.pool,user,admin,org);
  assert.equal(resultado.estado,'ULTIMO_ADMINISTRADOR');
  assert.equal(d.consultas.at(-1)?.sql,'ROLLBACK');
  assert.equal(d.liberaciones(),1);
});

test('ADR-006 Retiro: impide retirar cuenta de plataforma o ya retirada', async () => {
  const protegida=fakeDb({roles:['SUPERADMINISTRADOR']});
  assert.equal((await retirarCuentaOrganizacion(protegida.pool,user,admin,org)).estado,'CUENTA_PROTEGIDA');
  assert.equal(protegida.consultas.at(-1)?.sql,'ROLLBACK');
  const retirada=fakeDb({retirado:true});
  assert.equal((await retirarCuentaOrganizacion(retirada.pool,user,admin,org)).estado,'YA_RETIRADA');
  assert.equal(retirada.consultas.at(-1)?.sql,'ROLLBACK');
});

test('ADR-006 Retiro: desactiva cuenta y sesiones con auditoría', async () => {
  const d=fakeDb();
  assert.deepEqual(await retirarCuentaOrganizacion(d.pool,user,admin,org),{estado:'RETIRADA',id:user});
  assert.ok(d.consultas.some(c=>c.sql.includes('UPDATE usuarios SET activo=FALSE')));
  assert.ok(d.consultas.some(c=>c.sql.includes('UPDATE tokens_refresco')));
  assert.ok(d.consultas.some(c=>c.sql.includes('RETIRAR_USUARIO_ORGANIZACION')));
  assert.equal(d.consultas.at(-1)?.sql,'COMMIT');
});

test('ADR-006 Retiro: error revierte y libera conexión', async () => {
  const d=fakeDb({falla:'UPDATE usuarios SET activo=FALSE'});
  await assert.rejects(retirarCuentaOrganizacion(d.pool,user,admin,org));
  assert.equal(d.consultas.at(-1)?.sql,'ROLLBACK');
  assert.equal(d.liberaciones(),1);
});

test('ADR-006 Usuarios: rutas sin SQL directo y permisos intactos', () => {
  const routes=readFileSync(new URL('../src/routes/usuarios.routes.ts',import.meta.url),'utf8');
  assert.equal(routes.includes('.query('),false);
  assert.match(routes,/requirePermission\('usuarios\.gestionar'\), retirarCuentaUsuario/);
  assert.match(routes,/requirePermission\('usuarios\.gestionar'\), editarNombreCuenta/);
  assert.match(routes,/requirePermission\('usuarios\.gestionar'\), editarEmailCuenta/);
  assert.match(routes,/requirePermission\('usuarios\.gestionar'\), reemitirCredencialCuenta/);
  const root=new URL('../src/modules/usuarios/',import.meta.url);
  for (const file of ['edicion-cuentas.controller.ts','edicion-cuentas.service.ts','retiro-cuentas.controller.ts','retiro-cuentas.service.ts','credenciales-cuentas.controller.ts','credenciales-cuentas.service.ts']) {
    const s=readFileSync(new URL(file,root),'utf8');
    assert.equal(s.includes('.query('),false,file);
  }
});
