import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
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

const migracionesPrevias = [
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
];

async function aplicarMigracion(db: PGlite, nombre: string) {
  const sql = (await readFile(
    new URL(`../../database/sql/${nombre}.sql`, import.meta.url),
    'utf8',
  )).replaceAll('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '');
  await db.exec(sql);
}

test('validarAvanceActividad valida avances cuantitativos y estimaciones justificadas', () => {
  const estimacion = {
    porcentajeAvance: 37.5,
    cantidadReportada: null,
    fecha: '2026-11-08',
    descripcion: 'Se completó la primera etapa.',
    observaciones: 'Se midió el avance con base en los hitos terminados.',
    claveIdempotencia: '819db581-22d5-4e1b-9eb3-080257694c56',
  };
  assert.deepEqual(validarAvanceActividad(estimacion), estimacion);
  assert.deepEqual(validarAvanceActividad({
    ...estimacion,
    porcentajeAvance: null,
    cantidadReportada: 4.25,
    observaciones: null,
  }), {
    ...estimacion,
    porcentajeAvance: null,
    cantidadReportada: 4.25,
    observaciones: null,
  });
  assert.equal(validarAvanceActividad({ ...estimacion, porcentajeAvance: 0 })?.porcentajeAvance, 0);
  assert.equal(validarAvanceActividad({ ...estimacion, porcentajeAvance: 100 })?.porcentajeAvance, 100);

  for (const cambios of [
    { porcentajeAvance: -0.01 },
    { porcentajeAvance: 100.01 },
    { porcentajeAvance: 12.345 },
    { porcentajeAvance: '50' },
    { cantidadReportada: -1 },
    { cantidadReportada: 1.2345, porcentajeAvance: null },
    { fecha: '2026-02-30' },
    { descripcion: '   ' },
    { observaciones: '   ' },
    { claveIdempotencia: 'no-es-un-uuid' },
  ]) {
    assert.equal(validarAvanceActividad({ ...estimacion, ...cambios }), null);
  }
  assert.equal(validarAvanceActividad(null), null);
});

test('HU-12: conserva avances legados y audita estados, permisos, resultados e aislamiento', async () => {
  const jwtSecretAnterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'pruebas-de-integracion-semilla-seguras-2026';
  const db = new PGlite();
  const server = createServer();

  try {
    for (const migracion of migracionesPrevias) await aplicarMigracion(db, migracion);

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
    const revisor = (await db.query<{ id: string }>(
      "INSERT INTO usuarios (email, hash_contrasena, organizacion_id) VALUES ('coordina@semilla.test', 'hash', $1) RETURNING id",
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

    await aplicarMigracion(db, '019_avances_por_actividad');
    const avanceLegado = (await db.query<{ id: string }>(
      `INSERT INTO avances_proyecto (
         proyecto_id, actividad_id, responsable_usuario_id, porcentaje_avance, fecha_avance, comentarios
       ) VALUES ($1, $2, $3, 15, '2026-11-07', 'Avance registrado con HU-12 original.')
       RETURNING id`,
      [proyecto, actividad, usuario],
    )).rows[0].id;
    await aplicarMigracion(db, '020_planificacion_ejecucion_resultados');
    await aplicarMigracion(db, '021_autorrevision_avances');

    const legadoMigrado = (await db.query<{ estado_revision: string }>(
      'SELECT estado_revision FROM avances_proyecto WHERE id = $1',
      [avanceLegado],
    )).rows[0];
    assert.equal(legadoMigrado.estado_revision, 'ENVIADO');
    const actividadCuantificable = (await db.query<{ id: string }>(
      `INSERT INTO actividades_programadas (proyecto_id, nombre, meta_cantidad, unidad_medida)
       VALUES ($1, 'Hogares atendidos', 10, 'hogares') RETURNING id`,
      [proyecto],
    )).rows[0].id;
    await db.query(
      'UPDATE actividades_programadas SET peso_resultado = 50 WHERE proyecto_id = $1',
      [proyecto],
    );

    const rolesConPermiso = (await db.query<{ nombre: string }>(
      `SELECT r.nombre FROM roles r
       JOIN roles_permisos rp ON rp.rol_id = r.id
       JOIN permisos p ON p.id = rp.permiso_id
       WHERE p.codigo = 'actividades.avance.gestionar'
       ORDER BY r.nombre`,
    )).rows.map((fila) => fila.nombre);
    assert.deepEqual(rolesConPermiso, ['ADMINISTRADOR', 'CAMPO', 'COORDINADOR']);
    const rolesRevisores = (await db.query<{ nombre: string }>(
      `SELECT r.nombre FROM roles r
       JOIN roles_permisos rp ON rp.rol_id = r.id
       JOIN permisos p ON p.id = rp.permiso_id
       WHERE p.codigo = 'actividades.avance.revisar'
       ORDER BY r.nombre`,
    )).rows.map((fila) => fila.nombre);
    assert.deepEqual(rolesRevisores, ['ADMINISTRADOR', 'COORDINADOR']);

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
    const correos = new Map([
      [usuario, 'campo@semilla.test'],
      [revisor, 'coordina@semilla.test'],
      [usuarioOtraOrg, 'otra@semilla.test'],
    ]);
    const crearToken = (usuarioId: string, organizacionId: string, permisos: string[], roles: string[] = []) =>
      createAccessToken({
        usuarioId,
        email: correos.get(usuarioId) ?? 'otro@semilla.test',
        organizacionId,
        roles,
        permisos,
        debeCambiarContrasena: false,
      });
    const permisosCampo = ['proyectos.ver', 'actividades.avance.gestionar'];
    const tokenCampo = crearToken(usuario, org, permisosCampo);
    const tokenCampoRevisor = crearToken(usuario, org, [...permisosCampo, 'actividades.avance.revisar']);
    const tokenSoloConsulta = crearToken(usuario, org, ['proyectos.ver']);
    const tokenRevisor = crearToken(revisor, org, ['proyectos.ver', 'actividades.avance.revisar']);
    const tokenCorrector = crearToken(usuario, org, ['proyectos.ver', 'actividades.avance.corregir']);
    const tokenCoordinador = crearToken(revisor, org, ['proyectos.ver', 'actividades.avance.gestionar', 'actividades.avance.revisar'], ['COORDINADOR']);
    const tokenAdministrador = crearToken(revisor, org, ['proyectos.ver', 'actividades.avance.gestionar', 'actividades.avance.revisar'], ['ADMINISTRADOR']);
    const headers = (token: string, conJson = false) => ({
      Authorization: `Bearer ${token}`,
      ...(conJson ? { 'Content-Type': 'application/json' } : {}),
    });
    const rutaActividad = (actividadId: string) => `${baseUrl}/${proyecto}/actividades/${actividadId}`;
    const consultar = (token = tokenCampo) => fetch(`${baseUrl}/${proyecto}/actividades`, {
      headers: headers(token),
    });
    const datosEstimacion = (porcentajeAvance: number, claveIdempotencia = randomUUID()) => ({
      porcentajeAvance,
      cantidadReportada: null,
      fecha: '2026-11-08',
      descripcion: `Trabajo de campo: ${porcentajeAvance}%.`,
      observaciones: 'Estimación acumulada conforme a los hitos observados.',
      claveIdempotencia,
    });
    const crearAvance = async (actividadId: string, token: string, datos: object) =>
      fetch(`${rutaActividad(actividadId)}/avances`, {
        method: 'POST',
        headers: headers(token, true),
        body: JSON.stringify(datos),
      });
    const enviar = (actividadId: string, avanceId: string, token = tokenCampo) =>
      fetch(`${rutaActividad(actividadId)}/avances/${avanceId}/enviar`, {
        method: 'POST',
        headers: headers(token),
      });
    const revisar = (actividadId: string, avanceId: string, accion: 'validar' | 'devolver',
      token: string, motivo?: string) =>
      fetch(`${rutaActividad(actividadId)}/avances/${avanceId}/${accion}`, {
        method: 'POST',
        headers: headers(token, accion === 'devolver'),
        ...(accion === 'devolver' ? { body: JSON.stringify({ motivo }) } : {}),
      });

    const sinPermiso = await crearAvance(actividad, tokenSoloConsulta, datosEstimacion(5));
    assert.equal(sinPermiso.status, 403);

    const consultaInicial = await consultar();
    assert.equal(consultaInicial.status, 200);
    const inicial = await consultaInicial.json() as {
      actividades: { id: string; porcentajeResultado: number; avances: { id: string; estadoRevision: string }[] }[];
      porcentajeProyecto: number | null;
      pesoConfigurado: number;
    };
    const actividadInicial = inicial.actividades.find((item) => item.id === actividad);
    assert.ok(actividadInicial);
    assert.deepEqual(actividadInicial.avances.map((avance) => ({
      id: avance.id,
      estadoRevision: avance.estadoRevision,
    })), [{ id: avanceLegado, estadoRevision: 'ENVIADO' }]);
    assert.equal(actividadInicial.porcentajeResultado, 0);
    assert.equal(inicial.porcentajeProyecto, 0);
    assert.equal(inicial.pesoConfigurado, 100);

    const consultaOtraOrg = await fetch(`${baseUrl}/${proyectoOtraOrg}/actividades`, {
      headers: headers(tokenCampo),
    });
    assert.equal(consultaOtraOrg.status, 404);
    const invalidos = await Promise.all([
      crearAvance(actividad, tokenCampo, datosEstimacion(101)),
      crearAvance(actividadCuantificable, tokenCampo, datosEstimacion(10)),
    ]);
    assert.deepEqual(invalidos.map((respuesta) => respuesta.status), [400, 400]);

    const clavePrimerAvance = randomUUID();
    const registrado = await crearAvance(actividad, tokenCampo, {
      ...datosEstimacion(40, clavePrimerAvance),
      responsableUsuarioId: usuarioOtraOrg,
    });
    assert.equal(registrado.status, 201);
    const primerAvance = await registrado.json() as {
      id: string; porcentajeAvance: number; estadoRevision: string; responsable: string;
    };
    assert.equal(primerAvance.porcentajeAvance, 40);
    assert.equal(primerAvance.estadoRevision, 'BORRADOR');
    assert.equal(primerAvance.responsable, 'campo@semilla.test');

    const duplicado = await crearAvance(actividad, tokenCampo, {
      ...datosEstimacion(40, clavePrimerAvance),
    });
    assert.equal(duplicado.status, 409);

    assert.equal((await enviar(actividad, primerAvance.id)).status, 204);
    assert.equal((await revisar(actividad, primerAvance.id, 'validar', tokenCampoRevisor)).status, 409);
    assert.equal((await revisar(actividad, primerAvance.id, 'devolver', tokenRevisor, 'Aclarar los hitos logrados.')).status, 204);

    const devuelto = await consultar();
    const datosDevuelto = await devuelto.json() as {
      actividades: { id: string; avances: { id: string; estadoRevision: string; motivoDevolucion: string | null }[] }[];
    };
    const avanceDevuelto = datosDevuelto.actividades.find((item) => item.id === actividad)
      ?.avances.find((avance) => avance.id === primerAvance.id);
    assert.equal(avanceDevuelto?.estadoRevision, 'DEVUELTO');
    assert.equal(avanceDevuelto?.motivoDevolucion, 'Aclarar los hitos logrados.');

    const editado = await fetch(`${rutaActividad(actividad)}/avances/${primerAvance.id}`, {
      method: 'PUT',
      headers: headers(tokenCampo, true),
      body: JSON.stringify(datosEstimacion(60)),
    });
    assert.equal(editado.status, 204);
    assert.equal((await enviar(actividad, primerAvance.id)).status, 204);
    assert.equal((await revisar(actividad, primerAvance.id, 'validar', tokenRevisor)).status, 204);

    const segundoAvanceResponse = await crearAvance(actividad, tokenCampo, datosEstimacion(80));
    assert.equal(segundoAvanceResponse.status, 201);
    const segundoAvance = await segundoAvanceResponse.json() as { id: string };
    assert.equal((await enviar(actividad, segundoAvance.id)).status, 204);
    assert.equal((await revisar(actividad, segundoAvance.id, 'validar', tokenRevisor)).status, 204);

    const crearCantidad = async (cantidadReportada: number) => {
      const respuesta = await crearAvance(actividadCuantificable, tokenCampo, {
        porcentajeAvance: null,
        cantidadReportada,
        fecha: '2026-11-08',
        descripcion: `Se atendieron ${cantidadReportada} hogares.`,
        observaciones: null,
        claveIdempotencia: randomUUID(),
      });
      assert.equal(respuesta.status, 201);
      const avance = await respuesta.json() as { id: string };
      assert.equal((await enviar(actividadCuantificable, avance.id)).status, 204);
      assert.equal((await revisar(actividadCuantificable, avance.id, 'validar', tokenRevisor)).status, 204);
    };
    await crearCantidad(4);
    await crearCantidad(3);

    const consultaPersistida = await consultar();
    const persistida = await consultaPersistida.json() as {
      actividades: {
        id: string;
        porcentajeResultado: number;
        cantidadValidada: number;
        avances: { id: string; estadoRevision: string; historial: { accion: string }[] }[];
      }[];
      porcentajeProyecto: number;
    };
    const resultadoManual = persistida.actividades.find((item) => item.id === actividad);
    const resultadoCuantificable = persistida.actividades.find((item) => item.id === actividadCuantificable);
    assert.equal(resultadoManual?.porcentajeResultado, 80);
    assert.equal(resultadoCuantificable?.cantidadValidada, 7);
    assert.equal(resultadoCuantificable?.porcentajeResultado, 70);
    assert.equal(persistida.porcentajeProyecto, 75);
    assert.ok((resultadoManual?.avances.find((avance) => avance.id === segundoAvance.id)?.historial.length ?? 0) >= 2);

    const correccion = await fetch(`${rutaActividad(actividad)}/avances/${segundoAvance.id}/corregir`, {
      method: 'POST',
      headers: headers(tokenCorrector, true),
      body: JSON.stringify({ ...datosEstimacion(90), motivoCorreccion: 'Se corrigió la estimación según nueva medición.' }),
    });
    assert.equal(correccion.status, 204);
    assert.equal((await revisar(actividad, segundoAvance.id, 'validar', tokenRevisor)).status, 204);
    const consultaCorregida = await consultar();
    const corregida = await consultaCorregida.json() as {
      actividades: { id: string; porcentajeResultado: number; avances: { id: string; historial: { accion: string }[] }[] }[];
      porcentajeProyecto: number;
    };
    const resultadoCorregido = corregida.actividades.find((item) => item.id === actividad);
    assert.equal(resultadoCorregido?.porcentajeResultado, 90);
    assert.equal(corregida.porcentajeProyecto, 80);
    assert.ok(resultadoCorregido?.avances.find((avance) => avance.id === segundoAvance.id)
      ?.historial.some((evento) => evento.accion === 'CORREGIR_AVANCE_VALIDADO'));

    // Los permisos aislados no habilitan la revisión propia sin rol autorizado.
    for (const [rol, token] of [['COORDINADOR', tokenCoordinador], ['ADMINISTRADOR', tokenAdministrador]] as const) {
      const respuesta = await crearAvance(actividad, token, datosEstimacion(33));
      assert.equal(respuesta.status, 201);
      const propio = await respuesta.json() as { id: string };
      assert.equal((await enviar(actividad, propio.id, token)).status, 204);
      if (rol === 'COORDINADOR') {
        assert.equal((await revisar(actividad, propio.id, 'validar', tokenRevisor)).status, 204);
      } else {
        assert.equal((await revisar(actividad, propio.id, 'devolver', token, 'Corregir visita.')).status, 204);
        assert.equal((await enviar(actividad, propio.id, token)).status, 204);
        assert.equal((await revisar(actividad, propio.id, 'validar', token)).status, 204);
      }
      const auditoria = await db.query<{ accion: string; usuario_id: string; autorrevision: boolean }>(
        `SELECT accion, usuario_id, (valores_nuevos->>'autorrevision')::boolean AS autorrevision
         FROM bitacora_auditoria WHERE entidad_id = $1 AND accion = 'AUTOVALIDAR_AVANCE'`,
        [propio.id],
      );
      if (rol === 'ADMINISTRADOR') {
        assert.equal(auditoria.rows.length, 1);
        assert.equal(auditoria.rows[0].usuario_id, revisor);
        assert.equal(auditoria.rows[0].autorrevision, true);
      }
    }

    const countLegacy = await db.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM bitacora_auditoria
       WHERE nombre_entidad = 'avances_proyecto' AND entidad_id = $1`,
      [avanceLegado],
    );
    assert.equal(countLegacy.rows[0].total, '1');
    for (const [proyectoSolicitado, actividadSolicitada, token, estadosEsperados] of [
      [proyecto, actividadOtroProyecto, tokenCampo, [404]],
      [proyectoOtraOrg, actividadOtraOrg, tokenCampo, [404]],
      [proyecto, actividad, crearToken(usuarioOtraOrg, org, permisosCampo), [409, 404]],
    ] as const) {
      const noAutorizado = await crearAvance(
        actividadSolicitada,
        token,
        datosEstimacion(50),
      );
      assert.ok(estadosEsperados.includes(noAutorizado.status), `estado inesperado para ${proyectoSolicitado}: ${noAutorizado.status}`);
    }
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await db.close();
    if (jwtSecretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = jwtSecretAnterior;
  }
});
