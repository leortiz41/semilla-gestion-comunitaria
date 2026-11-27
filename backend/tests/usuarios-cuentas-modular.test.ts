import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { validarRoles, normalizarNombre, validarEmail } from '../src/modules/usuarios/usuarios.domain.js';
import { insertarCuentaOrganizacion } from '../src/modules/usuarios/cuentas.repository.js';
import { actualizarRolesCuenta } from '../src/modules/usuarios/roles.repository.js';

const org = '38df6b1b-a29a-4f8e-a073-e65ef98e48bd';
const admin = 'a3b7d314-b69e-4907-967f-a78a18be9299';
const usuario = '9e4ded90-900c-4ed0-b5ae-1f08e84a37f3';
const rolId = 'c6b36890-2138-4b3f-a598-11f431b39ad0';
type Consulta = { sql: string; args?: unknown[] };
function simular(opciones: { plataforma?: boolean; ultimo?: boolean; existe?: boolean; falla?: string } = {}) {
  const consultas: Consulta[] = [];
  let liberaciones = 0;
  const query = async (sql: string, args?: unknown[]) => {
    consultas.push({sql, args});
    if (opciones.falla && sql.includes(opciones.falla)) throw Error('Fallo simulado');
    if (sql.includes('FROM organizaciones WHERE')) return { rows: opciones.existe === false ? [] : [{id:org}], rowCount: 1 };
    if (sql.includes('FROM usuarios WHERE') && sql.includes('FOR UPDATE')) return {rows:[{id:usuario}],rowCount:1};
    if (sql.includes("rpr.nombre='SUPERADMINISTRADOR'")) return {rows: opciones.plataforma ? [{id:usuario}] : []};
    if (sql.includes("r.nombre='ADMINISTRADOR' AND r.activo LIMIT 1")) return {rows:[{id:admin}]};
    if (sql.includes('SELECT r.nombre FROM usuarios_roles')) return {rows:[{nombre:'ADMINISTRADOR'}]};
    if (sql.includes('count(DISTINCT u.id)')) return {rows:[{total: opciones.ultimo ? 0 : 1}]};
    if (sql.includes('SELECT id,nombre FROM roles')) return {rows:[{id:rolId,nombre:'COORDINADOR'}]};
    if (sql.includes('RETURNING id,email,activo')) return {rows:[{id:usuario,email:'prueba@example.org',activo:true}]};
    return {rows:[],rowCount:1};
  };
  const client={query,release:()=>{liberaciones++;}};
  return {pool:{query,connect:async()=>client} as unknown as Pool,consultas,liberaciones:()=>liberaciones};
}
test('ADR-006 Usuarios: reglas de roles, emails y nombres preservadas', () => {
  assert.deepEqual(validarRoles(['ADMINISTRADOR','CAMPO']),['ADMINISTRADOR','CAMPO']);
  assert.equal(validarRoles(['SUPERADMINISTRADOR']),null);
  assert.equal(validarRoles(['DONANTE','CAMPO']),null);
  assert.equal(validarRoles(['CAMPO','CAMPO']),null);
  assert.equal(validarEmail('ejemplo@example.org'),true);
  assert.equal(normalizarNombre('  Ana   López '),'Ana López');
});
test('ADR-006 Usuarios: alta transaccional conserva tenant, auditoría y commit', async () => {
  const db=simular();
  const cuenta=await insertarCuentaOrganizacion(db.pool,{
    email:'prueba@example.org',roles:['COORDINADOR'],nombreVisible:'Usuario Prueba',
    hash:'hash-de-prueba',organizacionId:org,administradorId:admin,
  });
  assert.equal(cuenta.id,usuario);
  assert.equal(db.consultas[0].sql,'BEGIN');
  assert.ok(db.consultas.some(c=>c.sql.includes('CREAR_USUARIO')));
  assert.ok(db.consultas.some(c=>c.args?.includes(org)));
  assert.equal(db.consultas.at(-1)?.sql,'COMMIT');
  assert.equal(db.liberaciones(),1);
});
test('ADR-006 Usuarios: fallo en alta revierte', async () => {
  const db=simular({falla:'INSERT INTO perfiles_usuarios'});
  await assert.rejects(insertarCuentaOrganizacion(db.pool,{
    email:'prueba@example.org',roles:['COORDINADOR'],nombreVisible:'Usuario Prueba',
    hash:'hash-de-prueba',organizacionId:org,administradorId:admin,
  }));
  assert.equal(db.consultas.at(-1)?.sql,'ROLLBACK');
  assert.equal(db.liberaciones(),1);
});
test('ADR-006 Roles: nunca modifica cuenta de superadministración', async () => {
  const db=simular({plataforma:true});
  const r=await actualizarRolesCuenta(db.pool,usuario,['COORDINADOR'],admin,org);
  assert.equal(r.estado,'CUENTA_PROTEGIDA');
  assert.equal(db.consultas.at(-1)?.sql,'ROLLBACK');
  assert.equal(db.liberaciones(),1);
});
test('ADR-006 Roles: protege al último administrador', async () => {
  const db=simular({ultimo:true});
  const r=await actualizarRolesCuenta(db.pool,usuario,['COORDINADOR'],admin,org);
  assert.equal(r.estado,'ULTIMO_ADMINISTRADOR');
  assert.equal(db.consultas.at(-1)?.sql,'ROLLBACK');
  assert.equal(db.liberaciones(),1);
});
test('ADR-006 Roles: cambio válido conserva auditoría y bloqueo por organización', async () => {
  const db=simular();
  const r=await actualizarRolesCuenta(db.pool,usuario,['COORDINADOR'],admin,org);
  assert.equal(r.estado,'ACTUALIZADO');
  assert.deepEqual(db.consultas[1].args,[org]);
  assert.deepEqual(db.consultas[2].args,[usuario,org]);
  assert.ok(db.consultas.some(c=>c.sql.includes('CAMBIAR_ROLES_USUARIO')));
  assert.equal(db.consultas.at(-1)?.sql,'COMMIT');
  assert.equal(db.liberaciones(),1);
});
test('ADR-006 Usuarios: las rutas de escritura delegan a controladores sin SQL', () => {
  const route=readFileSync(new URL('../src/routes/usuarios.routes.ts',import.meta.url),'utf8');
  assert.match(route,/requirePermission\('usuarios\.gestionar'\), registrarCuentaOrganizacion/);
  assert.match(route,/requirePermission\('usuarios\.gestionar'\), actualizarRolesUsuario/);
  for(const p of ['cuentas.controller.ts','cuentas.service.ts','roles.controller.ts','roles.service.ts']){
    const source=readFileSync(new URL('../src/modules/usuarios/'+p,import.meta.url),'utf8');
    assert.equal(source.includes('.query('),false,p);
  }
});
