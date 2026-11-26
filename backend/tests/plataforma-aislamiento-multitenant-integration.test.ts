import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import type { Pool } from 'pg';
import { crearAutenticacion, requireRole, requirePermission } from '../src/middleware/auth.middleware.js';
import { superadminActual } from '../src/modules/plataforma/plataforma.middleware.js';
import { createAccessToken } from '../src/security/token.js';
import {
  actualizarRestriccionesUsuario,
  actualizarRestriccionesRol,
  consultarMatrizAccesos,
} from '../src/modules/plataforma/permisos-tenant.repository.js';

/** Integración real sin servicios externos: PGlite ejecuta DDL y SQL del repositorio. */
test('H-03: permisos multitenant reales A/B, auditoría, rechazo y acceso HTTP', async () => {
  const anterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'h03-permisos-aislamiento-semilla-pruebas-2026';
  const db = new PGlite();
  const servidor = createServer();
  try {
    for (const nombre of [
      '001_esquema_inicial',
      '002_configurar_roles_permisos',
      '003_multi_organizacion_base',
      '004_aislamiento_territorial',
      '034_restricciones_permisos_usuarios_tenant',
      '035_permisos_roles_tenant',
    ]) {
      const sql = (await readFile(
        new URL(`../../database/sql/${nombre}.sql`, import.meta.url), 'utf8',
      )).replaceAll('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '');
      await db.exec(sql);
    }

    const orgA = (await db.query<{id:string}>(
      "SELECT id FROM organizaciones WHERE slug='ministerio-sal-y-luz'",
    )).rows[0].id;
    const orgB = (await db.query<{id:string}>(
      "INSERT INTO organizaciones(nombre,slug) VALUES('Tenant B H03','tenant-b-h03') RETURNING id",
    )).rows[0].id;
    const crearUsuario = async (email:string, organizacionId:string) => (
      await db.query<{id:string}>(
        'INSERT INTO usuarios(email,hash_contrasena,organizacion_id) VALUES($1,$2,$3) RETURNING id',
        [email,'hash-de-prueba',organizacionId],
      )
    ).rows[0].id;
    const usuarioA = await crearUsuario('campo-a@semilla.test',orgA);
    const usuarioB = await crearUsuario('campo-b@semilla.test',orgB);
    const operador = await crearUsuario('super-a@semilla.test',orgA);
    for (const [uid,nombre] of [[usuarioA,'CAMPO'],[usuarioB,'CAMPO'],[operador,'SUPERADMINISTRADOR']]) {
      await db.query(
        'INSERT INTO usuarios_roles(usuario_id,rol_id) SELECT $1,id FROM roles WHERE nombre=$2',
        [uid,nombre],
      );
    }

    const permiso = (await db.query<{id:string}>(
      "SELECT p.id FROM permisos p JOIN roles_permisos rp ON rp.permiso_id=p.id JOIN roles r ON r.id=rp.rol_id WHERE r.nombre='CAMPO' AND p.codigo='comunidades.ver'",
    )).rows[0];
    assert.ok(permiso,'El rol CAMPO debe incluir comunidades.ver en el catálogo');
    const permisosBase = (await db.query<{codigo:string}>(
      "SELECT p.codigo FROM roles_permisos rp JOIN roles r ON r.id=rp.rol_id JOIN permisos p ON p.id=rp.permiso_id WHERE r.nombre='CAMPO'",
    )).rows.map(x=>x.codigo);
    assert.ok(permisosBase.includes('comunidades.ver'));

    // PGlite mantiene transacciones reales en una única conexión embebida.
    const query = async (sql:string, args?:unknown[]) => {
      const result = await db.query(sql,args);
      return {...result,rowCount:result.rows.length || result.affectedRows || 0};
    };
    const pool = {query,connect:async()=>({query,release:()=>undefined})} as unknown as Pool;
    const app = express();
    app.use(crearAutenticacion(pool));
    app.get('/consulta',requireRole('CAMPO'),requirePermission('comunidades.ver'),
      (_req,res)=>res.json({ok:true}));
    app.get('/plataforma/protegida',superadminActual,(_req,res)=>res.json({ok:true}));
    servidor.on('request',app);
    await new Promise<void>((resolve,reject)=>{
      servidor.once('error',reject);servidor.listen(0,resolve);
    });
    const base=`http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
    const token = (id:string,org:string,email:string) => createAccessToken({
      usuarioId:id,email,organizacionId:org,roles:['SUPERADMINISTRADOR'],
      permisos:['comunidades.ver','usuarios.gestionar'],debeCambiarContrasena:false,
    });
    const tokenA=token(usuarioA,orgA,'campo-a@semilla.test');
    const tokenB=token(usuarioB,orgB,'campo-b@semilla.test');
    const pedir=(path:string,credencial:string)=>fetch(base+path,{headers:{Authorization:`Bearer ${credencial}`}});

    assert.equal((await pedir('/consulta',tokenA)).status,200);
    assert.equal((await pedir('/consulta',tokenB)).status,200);
    // La supuesta función de plataforma en el JWT se rechaza al recomputarse el rol en DB.
    assert.equal((await pedir('/plataforma/protegida',tokenA)).status,403);
    assert.equal((await pedir('/plataforma/protegida',tokenB)).status,403);
    // El ID de otra organización no concede acceso con el mismo usuario.
    assert.equal((await pedir('/consulta',token(usuarioA,orgB,'campo-a@semilla.test'))).status,403);

    const matrizA=await consultarMatrizAccesos(pool,orgA);
    const matrizB=await consultarMatrizAccesos(pool,orgB);
    assert.ok(matrizA?.cuentas.some(c=>c.id===usuarioA));
    assert.ok(!matrizA?.cuentas.some(c=>c.id===usuarioB));
    assert.ok(matrizB?.cuentas.some(c=>c.id===usuarioB));
    assert.ok(!matrizB?.cuentas.some(c=>c.id===usuarioA));

    const permisosSinVer=permisosBase.filter(p=>p!=='comunidades.ver');
    assert.equal(await actualizarRestriccionesUsuario(pool,{
      organizacionId:orgA,usuarioId:usuarioA,permisos:permisosSinVer,operadorId:operador,
    }),'OK');
    assert.equal((await pedir('/consulta',tokenA)).status,403);
    assert.equal((await pedir('/consulta',tokenB)).status,200);
    const bloqueadosA=await db.query<{organizacion_id:string;usuario_id:string}>(
      'SELECT organizacion_id,usuario_id FROM usuarios_permisos_restringidos WHERE permiso_id=$1',[permiso.id],
    );
    assert.deepEqual(bloqueadosA.rows,[{organizacion_id:orgA,usuario_id:usuarioA}]);

    assert.equal(await actualizarRestriccionesUsuario(pool,{
      organizacionId:orgA,usuarioId:usuarioA,permisos:permisosBase,operadorId:operador,
    }),'OK');
    assert.equal((await pedir('/consulta',tokenA)).status,200);

    assert.equal(await actualizarRestriccionesRol(pool,{
      organizacionId:orgA,nombre:'CAMPO',permisos:permisosSinVer,operadorId:operador,
    }),'OK');
    assert.equal((await pedir('/consulta',tokenA)).status,403);
    assert.equal((await pedir('/consulta',tokenB)).status,200);
    assert.equal(await actualizarRestriccionesRol(pool,{
      organizacionId:orgA,nombre:'CAMPO',permisos:permisosBase,operadorId:operador,
    }),'OK');
    assert.equal((await pedir('/consulta',tokenA)).status,200);

    assert.equal(await actualizarRestriccionesRol(pool,{
      organizacionId:orgA,nombre:'CAMPO',permisos:[...permisosBase,'plataforma.administrar'],
      operadorId:operador,
    }),'PERMISOS_INVALIDOS');

    const auditoria=await db.query<{accion:string}>(
      "SELECT accion FROM bitacora_auditoria WHERE usuario_id=$1 AND accion IN ('PLATAFORMA_RESTRINGIR_PERMISOS','PLATAFORMA_PERMISOS_ROL_TENANT')",
      [operador],
    );
    assert.equal(auditoria.rows.filter(r=>r.accion==='PLATAFORMA_RESTRINGIR_PERMISOS').length,2);
    assert.equal(auditoria.rows.filter(r=>r.accion==='PLATAFORMA_PERMISOS_ROL_TENANT').length,2);
    assert.equal((await db.query(
      'SELECT id FROM organizaciones_roles_permisos_restringidos WHERE organizacion_id=$1',
      [orgB],
    )).rows.length,0);
    assert.equal((await pedir('/consulta',tokenB)).status,200);
  } finally {
    await new Promise<void>(resolve=>servidor.close(()=>resolve()));
    await db.close();
    if(anterior===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=anterior;
  }
});
