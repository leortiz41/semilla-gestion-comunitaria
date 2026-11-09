import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import express from 'express';
import type { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarAvanceActividad } from '../src/domain/avances-actividad.js';
import { crearRouterActividades } from '../src/routes/proyectos.routes.js';
import { authenticateAccessToken, requirePermission } from '../src/middleware/auth.middleware.js';
import { createAccessToken } from '../src/security/token.js';

const migraciones = [
  '001_esquema_inicial',
  '002_configurar_roles_permisos',
  '003_multi_organizacion_base',
  '004_aislamiento_territorial',
  '005_expediente_comunitario',
  '006_vision_desarrollo_comunitaria',
  '007_compatibilidad_diagnostico_secciones',
  '008_organizacion_productividad',
  '009_metas_vision_desarrollo',
  '010_necesidades_comunitarias',
  '011_rol_donante',
  '012_seguimiento_donantes',
  '013_donantes_y_brigadas',
  '014_comunidad_y_plan_brigadas',
  '015_zonas_brigadas',
  '016_estado_donantes_y_brigadas',
  '017_proyectos_donantes_brigadas',
  '018_actividades_sin_equipo_misionero',
  '019_avances_por_actividad',
];

test('validarAvanceActividad acepta valores de 0 a 100 y rechaza datos inválidos', () => {
  const valido = {
    porcentajeAvance: 37.5,
    fecha: '2026-11-08',
    descripcion: 'Se completó la primera etapa.',
  };
  assert.deepEqual(validarAvanceActividad(valido), valido);
  assert.deepEqual(validarAvanceActividad({ ...valido, porcentajeAvance: 0 })?.porcentajeAvance, 0);
  assert.deepEqual(validarAvanceActividad({ ...valido, porcentajeAvance: 100 })?.porcentajeAvance, 100);

  for (const cambios of [
    { porcentajeAvance: -0.01 },
    { porcentajeAvance: 100.01 },
    { porcentajeAvance: 12.345 },
    { porcentajeAvance: '50' },
    { fecha: '2026-02-30' },
    { descripcion: '   ' },
    { descripcion: 'x'.repeat(3001) },
  ]) {
    assert.equal(validarAvanceActividad({ ...valido, ...cambios }), null);
  }
  assert.equal(validarAvanceActividad(null), null);
});

test('HU-12: registra y consulta avances con permiso y aislamiento de organización/proyecto', async () => {
  process.env.JWT_SECRET = 'pruebas-de-integracion-semilla-seguras-2026';
  const db = new PGlite();
  const server = createServer();

  try {
    for (const migracion of migraciones) {
      const sql = (await readFile(
        new URL(`../../database/sql/${migracion}.sql`, import.meta.url),
        'utf8',
      )).replaceAll('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '');
      await db.exec(sql);
    }

    const org = (await db.query<{ id: string }>(
      "SELECT id FROM organizaciones WHERE slug = 'ministerio-sal-y-luz'",
    )).rows[0].id;
    const otraOrg = (await db.query<{ id: string }>(
      "INSERT INTO organizaciones (nombre, slug) VALUES ('Otra organización', 'otra-organizacion') RETURNING id",
    )).rows[0].id;
    const usuario = (await db.query<{ id: string }>(
      "INSERT INTO usuarios (email, hash_contrasena, organizacion_id) VALUES ('campo@semilla.test', 'hash', $1) RETURNING id",
      [org],
    )).rows[0].id;
    const usuarioOtraOrg = (await db.query<{ id: string }>(
      "INSERT INTO usuarios (email, hash_contrasena, organizacion_id) VALUES ('otra@semilla.test', 'hash', $1) RETURNING id",
      [otraOrg],
    )).rows[0].id;
    const comunidad = (await db.query<{ id: string }>(
      "INSERT INTO comunidades (nombre, municipio, departamento, organizacion_id) VALUES ('Comunidad uno', 'Municipio', 'Cortés', $1) RETURNING id",
      [org],
    )).rows[0].id;
    const comunidadOtraOrg = (await db.query<{ id: string }>(
      "INSERT INTO comunidades (nombre, municipio, departamento, organizacion_id) VALUES ('Comunidad dos', 'Municipio', 'Cortés', $1) RETURNING id",
      [otraOrg],
    )).rows[0].id;

    const proyecto = (await db.query<{ id: string }>(
      "INSERT INTO proyectos (comunidad_id, nombre, tipo, fecha_inicio) VALUES ($1, 'Proyecto uno', 'EDUCACION_FORMAL', CURRENT_DATE) RETURNING id",
      [comunidad],
    )).rows[0].id;
    const otroProyecto = (await db.query<{ id: string }>(
      "INSERT INTO proyectos (comunidad_id, nombre, tipo, fecha_inicio) VALUES ($1, 'Proyecto dos', 'EDUCACION_FORMAL', CURRENT_DATE) RETURNING id",
      [comunidad],
    )).rows[0].id;
    const proyectoOtraOrg = (await db.query<{ id: string }>(
      "INSERT INTO proyectos (comunidad_id, nombre, tipo, fecha_inicio) VALUES ($1, 'Proyecto externo', 'EDUCACION_FORMAL', CURRENT_DATE) RETURNING id",
      [comunidadOtraOrg],
    )).rows[0].id;
    const actividad = (await db.query<{ id: string }>(
      "INSERT INTO actividades_programadas (proyecto_id, nombre) VALUES ($1, 'Taller comunitario') RETURNING id",
      [proyecto],
    )).rows[0].id;
    const actividadOtroProyecto = (await db.query<{ id: string }>(
      "INSERT INTO actividades_programadas (proyecto_id, nombre) VALUES ($1, 'Actividad ajena') RETURNING id",
      [otroProyecto],
    )).rows[0].id;
    const actividadOtraOrg = (await db.query<{ id: string }>(
      "INSERT INTO actividades_programadas (proyecto_id, nombre) VALUES ($1, 'Actividad externa') RETURNING id",
      [proyectoOtraOrg],
    )).rows[0].id;

    await assert.rejects(db.query(
      `INSERT INTO avances_proyecto (proyecto_id, actividad_id, responsable_usuario_id, porcentaje_avance, comentarios)
       VALUES ($1, $2, $3, 10, 'Debe respetar el proyecto de la actividad.')`,
      [proyecto, actividadOtroProyecto, usuario],
    ));
    await assert.rejects(db.query(
      `INSERT INTO avances_proyecto (proyecto_id, actividad_id, responsable_usuario_id, porcentaje_avance, comentarios)
       VALUES ($1, $2, $3, 10, '   ')`,
      [proyecto, actividad, usuario],
    ));
    await assert.rejects(db.query(
      `INSERT INTO avances_proyecto (proyecto_id, actividad_id, responsable_usuario_id, porcentaje_avance, comentarios)
       VALUES ($1, $2, $3, 101, 'Porcentaje fuera de rango.')`,
      [proyecto, actividad, usuario],
    ));

    const rolesConPermiso = (await db.query<{ nombre: string }>(
      `SELECT r.nombre FROM roles r
       JOIN roles_permisos rp ON rp.rol_id = r.id
       JOIN permisos p ON p.id = rp.permiso_id
       WHERE p.codigo = 'actividades.avance.gestionar'
       ORDER BY r.nombre`,
    )).rows.map((fila) => fila.nombre);
    assert.deepEqual(rolesConPermiso, ['ADMINISTRADOR', 'CAMPO', 'COORDINADOR']);

    const query = async (sql: string, parametros?: unknown[]) => {
      const resultado = await db.query(sql, parametros);
      return { ...resultado, rowCount: resultado.rows.length || resultado.affectedRows || 0 };
    };
    const pool = { query } as unknown as Pool;
    const app = express();
    app.use(express.json());
    app.use(
      '/proyectos',
      authenticateAccessToken,
      requirePermission('proyectos.ver'),
      crearRouterActividades(pool),
    );
    server.on('request', app);
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, resolve);
    });
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/proyectos`;
    const crearToken = (usuarioId: string, organizacionId: string, permisos: string[]) =>
      createAccessToken({
        usuarioId,
        email: usuarioId === usuario ? 'campo@semilla.test' : 'otra@semilla.test',
        organizacionId,
        roles: ['CAMPO'],
        permisos,
        debeCambiarContrasena: false,
      });
    const tokenCampo = crearToken(usuario, org, ['proyectos.ver', 'actividades.avance.gestionar']);
    const tokenSoloConsulta = crearToken(usuario, org, ['proyectos.ver']);

    const sinPermiso = await fetch(`${baseUrl}/${proyecto}/actividades/${actividad}/avances`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenSoloConsulta}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ porcentajeAvance: 50, fecha: '2026-11-08', descripcion: 'Trabajo ejecutado.' }),
    });
    assert.equal(sinPermiso.status, 403);

    const consultaInicial = await fetch(`${baseUrl}/${proyecto}/actividades`, {
      headers: { Authorization: `Bearer ${tokenSoloConsulta}` },
    });
    assert.equal(consultaInicial.status, 200);
    const inicial = await consultaInicial.json() as {
      actividades: { id: string; avances: unknown[] }[];
    };
    assert.deepEqual(inicial.actividades[0].avances, []);
    const consultaOtraOrg = await fetch(`${baseUrl}/${proyectoOtraOrg}/actividades`, {
      headers: { Authorization: `Bearer ${tokenSoloConsulta}` },
    });
    assert.equal(consultaOtraOrg.status, 404);

    const invalido = await fetch(`${baseUrl}/${proyecto}/actividades/${actividad}/avances`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCampo}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ porcentajeAvance: 101, fecha: '2026-11-08', descripcion: 'No válido.' }),
    });
    assert.equal(invalido.status, 400);

    const registrado = await fetch(`${baseUrl}/${proyecto}/actividades/${actividad}/avances`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCampo}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        porcentajeAvance: 37.5,
        fecha: '2026-11-08',
        descripcion: '  Se completó el taller inicial.  ',
        responsableUsuarioId: usuarioOtraOrg,
      }),
    });
    assert.equal(registrado.status, 201);
    const respuestaRegistrada = await registrado.json() as {
      id: string;
      porcentajeAvance: number;
      fecha: string;
      descripcion: string;
      responsable: string;
    };
    assert.ok(respuestaRegistrada.id);
    assert.deepEqual({ ...respuestaRegistrada, id: 'id' }, {
      id: 'id',
      porcentajeAvance: 37.5,
      fecha: '2026-11-08',
      descripcion: 'Se completó el taller inicial.',
      responsable: 'campo@semilla.test',
    });

    const consultaFinal = await fetch(`${baseUrl}/${proyecto}/actividades`, {
      headers: { Authorization: `Bearer ${tokenSoloConsulta}` },
    });
    const final = await consultaFinal.json() as {
      actividades: {
        id: string;
        avances: { porcentajeAvance: number; fecha: string; descripcion: string; responsable: string }[];
      }[];
    };
    assert.equal(final.actividades[0].avances.length, 1);
    assert.deepEqual(final.actividades[0].avances[0], {
      id: respuestaRegistrada.id,
      porcentajeAvance: 37.5,
      fecha: '2026-11-08',
      descripcion: 'Se completó el taller inicial.',
      responsable: 'campo@semilla.test',
    });

    for (const [proyectoSolicitado, actividadSolicitada, token] of [
      [proyecto, actividadOtroProyecto, tokenCampo],
      [proyectoOtraOrg, actividadOtraOrg, tokenCampo],
      [proyecto, actividad, crearToken(usuarioOtraOrg, org, ['proyectos.ver', 'actividades.avance.gestionar'])],
    ]) {
      const noAutorizado = await fetch(
        `${baseUrl}/${proyectoSolicitado}/actividades/${actividadSolicitada}/avances`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ porcentajeAvance: 50, fecha: '2026-11-08', descripcion: 'Debe rechazarse.' }),
        },
      );
      assert.equal(noAutorizado.status, 404);
    }
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await db.close();
  }
});
