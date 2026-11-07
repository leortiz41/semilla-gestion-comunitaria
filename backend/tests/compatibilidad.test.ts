import type { Pool } from 'pg';
import {
  obtenerCapacidades,
  guardarCapacidades,
  validarCapacidades,
} from '../src/services/capacidades.service.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
for (const variante of ['local', 'publicada'])
  test(`Compatibilidad desde 005 ${variante} sin pérdida de datos`, async () => {
    const db = new PGlite();
    const leer = async (p: string) =>
      (await readFile(new URL('../../' + p, import.meta.url), 'utf8')).replace(
        'CREATE EXTENSION IF NOT EXISTS pgcrypto;',
        '',
      );
    try {
      for (const n of [
        '001_esquema_inicial',
        '002_configurar_roles_permisos',
        '003_multi_organizacion_base',
        '004_aislamiento_territorial',
      ])
        await db.exec(await leer('database/sql/' + n + '.sql'));
      await db.exec(
        await leer(
          variante === 'local'
            ? 'docs/migraciones-aplicadas/005_expediente_comunitario_local.sql'
            : 'database/sql/005_expediente_comunitario.sql',
        ),
      );
      const org = (
        await db.query<{ id: string }>('SELECT id FROM organizaciones LIMIT 1')
      ).rows[0].id;
      const comunidad = (
        await db.query<{ id: string }>(
          "INSERT INTO comunidades(nombre,municipio,departamento,organizacion_id) VALUES ('Prueba','Prueba','Prueba',$1) RETURNING id",
          [org],
        )
      ).rows[0].id;
      if (variante === 'local')
        await db.query(
          'INSERT INTO diagnosticos_comunitarios(comunidad_id,organizacion_id,poblacion_aproximada) VALUES ($1,$2,321)',
          [comunidad, org],
        );
      else {
        const user = (
          await db.query<{ id: string }>(
            "INSERT INTO usuarios(email,hash_contrasena,organizacion_id) VALUES ('test@example.test','no-login',$1) RETURNING id",
            [org],
          )
        ).rows[0].id;
        const diag = (
          await db.query<{ id: string }>(
            'INSERT INTO diagnosticos_comunidad(comunidad_id,organizacion_id,poblacion,creado_por_id) VALUES ($1,$2,321,$3) RETURNING id',
            [comunidad, org, user],
          )
        ).rows[0].id;
        await db.query(
          "INSERT INTO visiones_comunidad(diagnostico_id,organizacion_id,categoria,situacion,meta,prioridad) VALUES ($1,$2,'Infraestructura','Inicial','Mejora','alta')",
          [diag, org],
        );
        await db.query(
          "INSERT INTO elementos_diagnostico(diagnostico_id,organizacion_id,tipo,nombre) VALUES ($1,$2,'organizacion','Patronato original')",
          [diag, org],
        );
      }
      await db.exec(
        await leer('database/sql/006_vision_desarrollo_comunitaria.sql'),
      );
      const puente = await leer(
        'database/sql/007_compatibilidad_diagnostico_secciones.sql',
      );
      await db.exec(puente);
      assert.equal(
        (
          await db.query<{ poblacion_aproximada: number }>(
            'SELECT poblacion_aproximada FROM diagnosticos_comunitarios WHERE comunidad_id=$1',
            [comunidad],
          )
        ).rows[0].poblacion_aproximada,
        321,
      );
      await db.query(
        'UPDATE diagnosticos_comunitarios SET poblacion_aproximada=456 WHERE comunidad_id=$1',
        [comunidad],
      );
      await db.exec(puente);
      assert.equal(
        (
          await db.query<{ poblacion_aproximada: number }>(
            'SELECT poblacion_aproximada FROM diagnosticos_comunitarios WHERE comunidad_id=$1',
            [comunidad],
          )
        ).rows[0].poblacion_aproximada,
        456,
      );
      if (variante === 'publicada') {
        assert.equal(
          (await db.query('SELECT id FROM diagnosticos_comunidad')).rows.length,
          1,
        );
        assert.equal(
          (
            await db.query<{ prioridad: string }>(
              'SELECT prioridad FROM visiones_desarrollo_comunitarias',
            )
          ).rows[0].prioridad,
          'ALTA',
        );
      }

      await db.exec(
        await leer('database/sql/008_organizacion_productividad.sql'),
      );
      const query = async (sql: string, params?: unknown[]) => {
        const r = await db.query(sql, params);
        return { ...r, rowCount: r.rows.length || r.affectedRows || 0 };
      };
      const pool = {
        query,
        connect: async () => ({ query, release() {} }),
      } as unknown as Pool;
      const inicial = await obtenerCapacidades(org, comunidad, pool);
      assert.equal(inicial?.revision, variante === 'local' ? 0 : 1);
      assert.deepEqual(
        inicial?.organizaciones,
        variante === 'local' ? [] : ['Patronato original'],
      );
      const usuario = (
        await db.query<{ id: string }>(
          "INSERT INTO usuarios(email,hash_contrasena,organizacion_id) VALUES ('capacidades@example.test','no-login',$1) RETURNING id",
          [org],
        )
      ).rows[0].id;
      const otra = (
        await db.query<{ id: string }>(
          "INSERT INTO organizaciones(nombre,slug) VALUES ('Otra ONG','otra-ong') RETURNING id",
        )
      ).rows[0].id;
      const datos = validarCapacidades({
        revision: inicial!.revision,
        organizaciones: ['Junta de agua'],
        actividadesProductivas: ['Pesca'],
        productosServicios: ['Tilapia'],
        observacionesOrganizaciones: 'Reunión mensual',
        potencialProductivo: 'Mejorar distribución',
      });
      assert.throws(() =>
        validarCapacidades({ ...datos, organizaciones: ['Junta', 'junta'] }),
      );
      assert.throws(() =>
        validarCapacidades({ ...datos, productosServicios: [''] }),
      );
      assert.throws(() => validarCapacidades({ ...datos, revision: -1 }));
      const guardado = await guardarCapacidades(
        org,
        comunidad,
        usuario,
        datos,
        pool,
      );
      assert.deepEqual(
        await obtenerCapacidades(org, comunidad, pool),
        guardado,
      );
      assert.equal(await obtenerCapacidades(otra, comunidad, pool), null);
      await assert.rejects(
        guardarCapacidades(otra, comunidad, usuario, datos, pool),
      );
      await assert.rejects(
        guardarCapacidades(org, comunidad, usuario, datos, pool),
        /actualizó/,
      );
      await assert.rejects(
        guardarCapacidades(
          org,
          comunidad,
          usuario,
          { ...guardado, organizaciones: ['Doble', 'Doble'] },
          pool,
        ),
      );
      assert.deepEqual(
        await obtenerCapacidades(org, comunidad, pool),
        guardado,
      );
      const sinOrganizaciones = await guardarCapacidades(
        org,
        comunidad,
        usuario,
        { ...guardado, organizaciones: [] },
        pool,
      );
      assert.deepEqual(
        (await obtenerCapacidades(org, comunidad, pool))?.organizaciones,
        [],
      );
      assert.equal(
        (
          await db.query(
            'SELECT id FROM capacidades_comunitarias WHERE comunidad_id=$1',
            [comunidad],
          )
        ).rows.length,
        sinOrganizaciones.revision,
      );
      assert.equal(
        (
          await db.query(
            "SELECT id FROM bitacora_auditoria WHERE accion='GUARDAR_CAPACIDADES'",
          )
        ).rows.length,
        2,
      );
    } finally {
      await db.close();
    }
  });
