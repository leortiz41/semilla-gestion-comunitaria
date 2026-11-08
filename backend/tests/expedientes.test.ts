import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Pool } from 'pg';
import { validarExpediente } from '../src/domain/expediente.js';
import {
  guardarExpediente,
  obtenerExpediente,
} from '../src/services/expedientes.service.js';

const base = {
  nombre: 'Comunidad de prueba',
  zonaId: '00000000-0000-0000-0000-000000000001',
  municipio: 'Municipio de prueba',
  departamento: 'Cortés',
  latitud: 14.87,
  longitud: -87.98,
  poblacion: 850,
  viviendas: 180,
  viviendasIntervencion: 35,
  tiposVivienda: ['Bloque', 'Madera'],
  organizaciones: ['Patronato', 'Junta de agua'],
  actividadesProductivas: ['Agricultura'],
  productosServicios: ['Café'],
  visiones: [
    {
      categoria: 'Educación formal',
      situacion: 'Faltan materiales',
      meta: 'Dotar de materiales',
      prioridad: 'alta',
    },
  ],
  observacionesOrganizaciones: 'Reunión mensual',
  potencialProductivo: 'Huertos comunitarios',
};

test('validación rechaza coordenadas incompletas, conteos inválidos y listas duplicadas', () => {
  assert.deepEqual(validarExpediente(base), base);
  for (const cambios of [
    { latitud: 91 },
    { longitud: null },
    { poblacion: -1 },
    { viviendas: 2 },
    { viviendasIntervencion: 1.5 },
    { organizaciones: ['Patronato', 'patronato'] },
    { zonaId: 'incorrecto' },
    { visiones: [{ ...base.visiones[0], meta: '' }] },
    { poblacion: '850' },
    { tiposVivienda: [''] },
    { nombre: '' },
  ])
    assert.throws(() => validarExpediente({ ...base, ...cambios }));
  assert.equal(validarExpediente({ ...base, poblacion: null }).poblacion, null);
});

test('migraciones y servicio: persistencia, aislamiento, duplicados y rollback', async () => {
  const db = new PGlite();
  try {
    for (const archivo of [
      '001_esquema_inicial.sql',
      '002_configurar_roles_permisos.sql',
      '003_multi_organizacion_base.sql',
      '004_aislamiento_territorial.sql',
    ]) {
      let sql = await readFile(
        new URL('../../database/sql/' + archivo, import.meta.url),
        'utf8',
      );
      // PGlite incorpora gen_random_uuid(); no distribuye la extensión pgcrypto.
      sql = sql.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '');
      await db.exec(sql);
    }
    const org = (
      await db.query<{ id: string }>(
        "SELECT id FROM organizaciones WHERE slug='ministerio-sal-y-luz'",
      )
    ).rows[0].id;
    const otra = (
      await db.query<{ id: string }>(
        "INSERT INTO organizaciones(nombre,slug) VALUES ('ONG ficticia','ong-prueba') RETURNING id",
      )
    ).rows[0].id;
    const user = (
      await db.query<{ id: string }>(
        "INSERT INTO usuarios(email,hash_contrasena,organizacion_id) VALUES ('prueba@example.test','hash-no-utilizable',$1) RETURNING id",
        [org],
      )
    ).rows[0].id;
    const zona = (
      await db.query<{ id: string }>(
        "INSERT INTO zonas(nombre,organizacion_id) VALUES ('Zona prueba',$1) RETURNING id",
        [org],
      )
    ).rows[0].id;
    const zonaOtra = (
      await db.query<{ id: string }>(
        "INSERT INTO zonas(nombre,organizacion_id) VALUES ('Zona otra',$1) RETURNING id",
        [otra],
      )
    ).rows[0].id;
    const basica = (
      await db.query<{ id: string }>(
        "INSERT INTO comunidades(nombre,municipio,departamento,organizacion_id,zona_id) VALUES ('Anterior','Municipio','Cortés',$1,$2) RETURNING id",
        [org, zona],
      )
    ).rows[0].id;
    await db.exec(
      await readFile(
        new URL(
          '../../database/sql/005_expediente_comunitario.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const query = async (sql: string, params?: unknown[]) => {
      const r = await db.query(sql, params);
      return { ...r, rowCount: r.rows.length || r.affectedRows || 0 };
    };
    const pool = {
      query,
      connect: async () => ({ query, release() {} }),
    } as unknown as Pool;
    const datos = validarExpediente({ ...base, zonaId: zona });
    const { id } = await guardarExpediente(org, user, datos, pool);
    const leido = await obtenerExpediente(org, id, pool);
    assert.equal(leido?.nombre, datos.nombre);
    assert.equal(leido?.poblacion, 850);
    assert.equal(leido?.latitud, 14.87);
    assert.deepEqual(leido?.organizaciones, ['Junta de agua', 'Patronato']);
    assert.deepEqual(leido?.visiones, datos.visiones);
    assert.equal(await obtenerExpediente(otra, id, pool), null);
    assert.equal(
      (await obtenerExpediente(org, basica, pool))?.fechaDiagnostico,
      null,
    );
    await assert.rejects(
      guardarExpediente(org, user, { ...datos, zonaId: zonaOtra }, pool),
    );
    await assert.rejects(guardarExpediente(org, user, datos, pool));
    await assert.rejects(
      guardarExpediente(
        org,
        user,
        {
          ...datos,
          nombre: 'No debe quedar',
          visiones: [{ ...datos.visiones[0], prioridad: 'invalida' }],
        },
        pool,
      ),
    );
    assert.equal(
      (
        await db.query(
          "SELECT id FROM comunidades WHERE nombre='No debe quedar'",
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query('SELECT id FROM diagnosticos_comunidad')).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query(
          "SELECT id FROM bitacora_auditoria WHERE accion='CREAR_EXPEDIENTE'",
        )
      ).rows.length,
      1,
    );
    await assert.rejects(
      db.query('UPDATE comunidades SET latitud=100 WHERE id=$1', [id]),
    );
    await assert.rejects(
      db.query(
        'INSERT INTO diagnosticos_comunidad(organizacion_id,comunidad_id,creado_por_id) VALUES ($1,$2,$3)',
        [otra, id, user],
      ),
    );
    const anterior = leido!.diagnosticoId;
    const editado = {
      ...datos,
      nombre: 'No cambiar el nombre',
      organizaciones: ['Cooperativa'],
      actividadesProductivas: ['Pesca'],
      productosServicios: ['Tilapia'],
      observacionesOrganizaciones: 'Comité activo',
      potencialProductivo: 'Mejorar comercialización',
    };
    await guardarExpediente(org, user, editado, pool, {
      comunidadId: id,
      diagnosticoAnteriorId: anterior,
    });
    const actual = await obtenerExpediente(org, id, pool);
    assert.equal(actual?.nombre, datos.nombre);
    assert.deepEqual(actual?.organizaciones, ['Cooperativa']);
    assert.deepEqual(actual?.actividadesProductivas, ['Pesca']);
    assert.deepEqual(actual?.productosServicios, ['Tilapia']);
    assert.equal(actual?.observacionesOrganizaciones, 'Comité activo');
    assert.equal(actual?.potencialProductivo, 'Mejorar comercialización');
    assert.notEqual(actual?.diagnosticoId, anterior);
    assert.equal(
      (
        await db.query(
          'SELECT id FROM diagnosticos_comunidad WHERE comunidad_id=$1',
          [id],
        )
      ).rows.length,
      2,
    );
    await assert.rejects(
      guardarExpediente(org, user, datos, pool, {
        comunidadId: id,
        diagnosticoAnteriorId: anterior,
      }),
      /cambió/,
    );
    await assert.rejects(
      guardarExpediente(org, user, datos, pool, {
        comunidadId: zonaOtra,
        diagnosticoAnteriorId: null,
      }),
      /no encontrada/,
    );
    await guardarExpediente(org, user, datos, pool, {
      comunidadId: basica,
      diagnosticoAnteriorId: null,
    });
    assert.ok((await obtenerExpediente(org, basica, pool))?.diagnosticoId);
    await assert.rejects(
      guardarExpediente(
        org,
        user,
        {
          ...datos,
          visiones: [{ ...datos.visiones[0], prioridad: 'invalida' }],
        },
        pool,
        { comunidadId: id, diagnosticoAnteriorId: actual!.diagnosticoId },
      ),
    );
    assert.equal(
      (await obtenerExpediente(org, id, pool))?.diagnosticoId,
      actual!.diagnosticoId,
    );
    await db.query('UPDATE zonas SET activo=FALSE WHERE id=$1', [zona]);
    await assert.rejects(
      guardarExpediente(org, user, { ...datos, nombre: 'Zona inactiva' }, pool),
    );
  } finally {
    await db.close();
  }
});
