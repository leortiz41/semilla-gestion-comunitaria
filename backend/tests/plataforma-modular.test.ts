import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { consultarSuperadministradorVigente, consultarDashboardPlataforma,
  consultarOrganizacionesPlataforma } from '../src/modules/plataforma/plataforma.repository.js';
import { superadministradorVigente, obtenerResumenPlataforma,
  listarOrganizacionesPlataforma } from '../src/modules/plataforma/plataforma.service.js';

const usuarioId = '0be79f99-5b88-4c8c-a85a-2ad5f47563ed';

test('ADR-006 Plataforma: privilegios SUPERADMINISTRADOR vigentes en base de datos', async () => {
  const llamadas: {sql:string; args?:unknown[]}[]=[];
  const pool={ query:async(sql:string,args?:unknown[])=>{
    llamadas.push({sql,args});return {rows:[{id:1}]};
  }} as unknown as Pool;
  assert.equal(await superadministradorVigente(usuarioId,pool),true);
  assert.deepEqual(llamadas[0].args,[usuarioId]);
  assert.match(llamadas[0].sql,/r.nombre='SUPERADMINISTRADOR' AND r.activo/);
  assert.match(llamadas[0].sql,/o.activo/);
  assert.match(llamadas[0].sql,/u.id=\$1 AND u.activo/);
  const revocado={query:async()=>({rows:[]})} as unknown as Pool;
  assert.equal(await superadministradorVigente(usuarioId,revocado),false);
});

test('ADR-006 Plataforma: métricas y organizaciones conservan SQL, exclusiones y límite', async () => {
  const llamadas:string[]=[];
  const pool={query:async(sql:string)=>{llamadas.push(sql);return {rows:[]};}} as unknown as Pool;
  await consultarSuperadministradorVigente(pool,usuarioId);
  await consultarDashboardPlataforma(pool);
  await consultarOrganizacionesPlataforma(pool);
  assert.equal(llamadas.length,3);
  assert.match(llamadas[1],/RETIRAR_USUARIO_ORGANIZACION/);
  assert.match(llamadas[1],/FROM evidencias e/);
  assert.match(llamadas[1],/LIMIT 500/);
  assert.match(llamadas[2],/cantidadAdministradores/);
  assert.match(llamadas[2],/o.id AND u.activo/);
  assert.match(llamadas[2],/LIMIT 500/);
});

test('ADR-006 Plataforma: agregados respetan números y cuentas suspendidas', async () => {
  const organizaciones=[
    {id:'a',activo:true,usuariosVigentes:3,usuariosActivos:2,usuariosRetirados:1,
      comunidades:4,proyectos:5,evidencias:6},
    {id:'b',activo:false,usuariosVigentes:2,usuariosActivos:0,usuariosRetirados:2,
      comunidades:0,proyectos:1,evidencias:0},
  ];
  const pool={query:async()=>({rows:organizaciones})} as unknown as Pool;
  const resumen=await obtenerResumenPlataforma(pool);
  assert.deepEqual(resumen.totales,{
    organizaciones:2,activas:1,suspendidas:1,usuariosVigentes:5,
    usuariosActivos:2,usuariosRetirados:3,comunidades:4,proyectos:6,evidencias:6,
  });
  assert.equal(resumen.organizaciones,organizaciones);
});

test('ADR-006 Plataforma: listado preserva la respuesta de organizaciones', async () => {
  const rows=[{id:'a',nombre:'Comunidad A'}];
  const pool={query:async()=>({rows})} as unknown as Pool;
  assert.equal(await listarOrganizacionesPlataforma(pool),rows);
});

test('ADR-006 Plataforma: rutas protegidas y SQL solo en repositorios nuevos', () => {
  const r=readFileSync(new URL('../src/routes/plataforma.routes.ts',import.meta.url),'utf8');
  const leer=(file:string)=>readFileSync(new URL('../src/modules/plataforma/'+file,import.meta.url),'utf8');
  assert.match(r,/plataformaRouter\.use\(authenticateAccessToken, superadminActual\)/);
  assert.match(r,/plataformaRouter\.get\('\/dashboard', obtenerDashboardPlataforma\)/);
  assert.match(r,/plataformaRouter\.get\('\/organizaciones', obtenerOrganizacionesPlataforma\)/);
  for(const f of ['plataforma.middleware.ts','plataforma.controller.ts','plataforma.service.ts']){
    assert.equal(leer(f).includes('.query('),false,f);
  }
  assert.match(leer('plataforma.middleware.ts'),/debeCambiarContrasena/);
  assert.match(leer('plataforma.middleware.ts'),/SUPERADMINISTRADOR/);
});
