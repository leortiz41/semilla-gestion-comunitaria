import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import type { Pool } from 'pg';
import { crearAutenticacion, requirePermission, requireRole } from '../src/middleware/auth.middleware.js';
import { createAccessToken } from '../src/security/token.js';

test('HTTP: permisos vigentes, separación de organizaciones y revocación inmediata', async () => {
  const claveAnterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'semilla-test-regresion-permisos-clave-segura-2026';
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
        new URL(`../../database/sql/${nombre}.sql`, import.meta.url),
        'utf8',
      )).replaceAll('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '');
      await db.exec(sql);
    }

    const organizacionId = (await db.query<{ id: string }>(
      "SELECT id FROM organizaciones WHERE slug='ministerio-sal-y-luz'",
    )).rows[0].id;
    const otraOrganizacionId = (await db.query<{ id: string }>(
      "INSERT INTO organizaciones(nombre,slug) VALUES('Organización de prueba','organizacion-regresion') RETURNING id",
    )).rows[0].id;

    const crearUsuario = async (correo: string, org: string) => (
      await db.query<{ id: string }>(
        'INSERT INTO usuarios(email,hash_contrasena,organizacion_id) VALUES($1,$2,$3) RETURNING id',
        [correo, 'hash-no-real', org],
      )
    ).rows[0].id;

    const usuarioId = await crearUsuario('coordinacion@semilla.test', organizacionId);
    const usuarioAjenoId = await crearUsuario('ajeno@semilla.test', otraOrganizacionId);

    const asignarRol = (usuario: string, nombreRol: string) =>
      db.query(
        'INSERT INTO usuarios_roles(usuario_id,rol_id) SELECT $1,id FROM roles WHERE nombre=$2',
        [usuario, nombreRol],
      );
    await asignarRol(usuarioId, 'COORDINADOR');
    await asignarRol(usuarioAjenoId, 'COORDINADOR');

    const obtenerIds = async (codigo: string) => (
      await db.query<{ id: string }>('SELECT id FROM permisos WHERE codigo=$1', [codigo])
    ).rows[0]?.id;
    const permisoId = await obtenerIds('comunidades.ver');
    assert.ok(permisoId, 'El catálogo debe contener comunidades.ver');
    const rolId = (await db.query<{ id: string }>(
      "SELECT id FROM roles WHERE nombre='COORDINADOR'",
    )).rows[0].id;

    const pool = {
      query: async (sql: string, parametros?: unknown[]) => {
        const resultado = await db.query(sql, parametros);
        return { ...resultado, rowCount: resultado.rows.length || resultado.affectedRows || 0 };
      },
    } as unknown as Pool;

    const aplicacion = express();
    aplicacion.use(crearAutenticacion(pool));
    aplicacion.get('/consulta', requireRole('COORDINADOR'), requirePermission('comunidades.ver'), (req, res) => {
      res.json({ organizacionId: req.auth!.organizacionId, usuarioId: req.auth!.sub });
    });
    aplicacion.get('/administracion', requireRole('ADMINISTRADOR'), (req, res) => {
      res.json({ usuarioId: req.auth!.sub });
    });
    servidor.on('request', aplicacion);
    await new Promise<void>((resolve, reject) => {
      servidor.once('error', reject);
      servidor.listen(0, resolve);
    });

    const baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
    const token = (usuario: string, organizacion: string, roles = ['ADMINISTRADOR']) =>
      createAccessToken({
        usuarioId: usuario,
        email: usuario === usuarioId ? 'coordinacion@semilla.test' : 'ajeno@semilla.test',
        organizacionId: organizacion,
        roles,
        permisos: ['comunidades.ver', 'usuarios.gestionar'],
        debeCambiarContrasena: false,
      });
    const consultar = async (ruta: string, credencial?: string) => fetch(baseUrl + ruta, {
      headers: credencial ? { Authorization: 'Bearer ' + credencial } : {},
    });

    assert.equal((await consultar('/consulta')).status, 401);
    assert.equal((await consultar('/consulta', 'no-es-jwt')).status, 401);

    const credencialPrincipal = token(usuarioId, organizacionId);
    assert.equal((await consultar('/consulta', credencialPrincipal)).status, 200);
    // El rol falso del JWT no concede administración: manda el rol vigente en PostgreSQL.
    assert.equal((await consultar('/administracion', credencialPrincipal)).status, 403);

    // Tampoco se permite utilizar una cuenta de un tenant con el ID de otro tenant.
    assert.equal((await consultar('/consulta', token(usuarioId, otraOrganizacionId))).status, 403);
    assert.equal((await consultar('/consulta', token(usuarioAjenoId, otraOrganizacionId))).status, 200);

    await db.query(
      'INSERT INTO usuarios_permisos_restringidos(organizacion_id,usuario_id,permiso_id,actualizado_por_usuario_id) VALUES($1,$2,$3,$4)',
      [organizacionId, usuarioId, permisoId, usuarioId],
    );
    assert.equal((await consultar('/consulta', credencialPrincipal)).status, 403);
    await db.query(
      'DELETE FROM usuarios_permisos_restringidos WHERE usuario_id=$1 AND permiso_id=$2',
      [usuarioId, permisoId],
    );
    assert.equal((await consultar('/consulta', credencialPrincipal)).status, 200);

    await db.query(
      'INSERT INTO organizaciones_roles_permisos_restringidos(organizacion_id,rol_id,permiso_id,actualizado_por_usuario_id) VALUES($1,$2,$3,$4)',
      [organizacionId, rolId, permisoId, usuarioId],
    );
    assert.equal((await consultar('/consulta', credencialPrincipal)).status, 403);
    assert.equal((await consultar('/consulta', token(usuarioAjenoId, otraOrganizacionId))).status, 200);
    await db.query(
      'DELETE FROM organizaciones_roles_permisos_restringidos WHERE organizacion_id=$1 AND rol_id=$2 AND permiso_id=$3',
      [organizacionId, rolId, permisoId],
    );

    await db.query('UPDATE usuarios SET activo=FALSE WHERE id=$1', [usuarioId]);
    assert.equal((await consultar('/consulta', credencialPrincipal)).status, 403);
    await db.query('UPDATE usuarios SET activo=TRUE WHERE id=$1', [usuarioId]);

    await db.query('UPDATE organizaciones SET activo=FALSE WHERE id=$1', [organizacionId]);
    assert.equal((await consultar('/consulta', credencialPrincipal)).status, 403);
    assert.equal((await consultar('/consulta', token(usuarioAjenoId, otraOrganizacionId))).status, 200);

  } finally {
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    await db.close();
    if (claveAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = claveAnterior;
  }
});
