import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { consultarSesionAutorizada } from '../src/modules/usuarios/autorizacion.repository.js';
import { consultarCatalogoRoles, consultarCuentasOrganizacion } from '../src/modules/usuarios/usuarios.repository.js';

const organizacionId = '4b2951f7-611d-4d99-b1d5-6b29764cffaa';
const usuarioId = '4390f662-e06f-4ac2-9676-2d45d6cf52cf';

test('ADR-006 Autorización: permisos efectivos consultados en el tenant actual', async () => {
  const llamadas: { sql: string; parametros: unknown[] | undefined }[] = [];
  const pool = {
    query: async (sql: string, parametros?: unknown[]) => {
      llamadas.push({ sql, parametros }); return { rows: [{ roles: [], permisos: [] }] };
    },
  } as unknown as Pool;
  await consultarSesionAutorizada(pool, usuarioId, organizacionId);
  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0].parametros, [usuarioId, organizacionId]);
  assert.match(llamadas[0].sql, /u\.organizacion_id=\$2/);
  assert.match(llamadas[0].sql, /u\.activo AND o\.activo/);
  assert.match(llamadas[0].sql, /organizaciones_roles_permisos_restringidos/);
  assert.match(llamadas[0].sql, /usuarios_permisos_restringidos/);
});

test('ADR-006 Usuarios: listado limitado al tenant y sin superadministradores', async () => {
  const consultas: { sql: string; params?: unknown[] }[] = [];
  const pool = { query: async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params }); return { rows: [] };
  }} as unknown as Pool;
  await consultarCatalogoRoles(pool);
  await consultarCuentasOrganizacion(pool, organizacionId);
  assert.equal(consultas.length, 2);
  assert.match(consultas[0].sql, /roles_permisos/);
  assert.match(consultas[0].sql, /DONANTE/);
  assert.deepEqual(consultas[1].params, [organizacionId]);
  assert.match(consultas[1].sql, /u\.organizacion_id=\$1/);
  assert.match(consultas[1].sql, /SUPERADMINISTRADOR/);
  assert.match(consultas[1].sql, /LIMIT 500/);
});

test('ADR-006 Usuarios: endpoints de lectura y middleware sin SQL directo', () => {
  const mod = (nombre: string) =>
    readFileSync(new URL('../src/modules/usuarios/' + nombre, import.meta.url), 'utf8');
  const rutas = readFileSync(new URL('../src/routes/usuarios.routes.ts', import.meta.url), 'utf8');
  const middleware = readFileSync(new URL('../src/middleware/auth.middleware.ts', import.meta.url), 'utf8');
  assert.match(rutas, /requirePermission\('usuarios\.ver'\), obtenerRolesUsuarios/);
  assert.match(rutas, /requirePermission\('usuarios\.gestionar'\), obtenerCuentasUsuarios/);
  assert.match(rutas, /requireRole\('ADMINISTRADOR'\)/);
  assert.equal(middleware.includes('.query('), false);
  assert.match(middleware, /consultarSesionAutorizada/);
  assert.equal(mod('usuarios.controller.ts').includes('.query('), false);
  assert.equal(mod('usuarios.service.ts').includes('.query('), false);
});
