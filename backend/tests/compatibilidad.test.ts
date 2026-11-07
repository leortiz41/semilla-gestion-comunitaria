import { validarNecesidad } from '../src/domain/necesidades.js';
import {
  listarNecesidades,
  registrarNecesidad,
} from '../src/services/necesidades.service.js';
import { randomUUID } from 'node:crypto';
import { validarMetasVision } from '../src/domain/metas-vision.js';
import {
  obtenerVisionesDesarrolloComunitaria,
  guardarVisionDesarrolloComunitaria,
} from '../src/services/comunidades.service.js';
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

      await db.query(
        "INSERT INTO visiones_desarrollo_comunitarias(comunidad_id,organizacion_id,area) VALUES($1,$2,'EVANGELISMO') ON CONFLICT(comunidad_id,area) DO NOTHING",
        [comunidad, org],
      );
      await db.query(
        "UPDATE visiones_desarrollo_comunitarias SET meta_desarrollo='Construir un aula y equiparla' WHERE comunidad_id=$1",
        [comunidad],
      );
      await db.exec(await leer('database/sql/009_metas_vision_desarrollo.sql'));
      const visiones = await obtenerVisionesDesarrolloComunitaria(
        org,
        comunidad,
        pool,
      );
      assert.ok(visiones?.length);
      const vision = visiones![0];
      assert.equal(
        vision.metas[0].descripcion,
        'Construir un aula y equiparla',
      );
      const datosVision = {
        ...vision,
        metas: [
          { ...vision.metas[0], descripcion: 'Construir un aula' },
          { id: randomUUID(), descripcion: 'Equipar el aula' },
        ],
      };
      assert.throws(() =>
        validarMetasVision([{ id: randomUUID(), descripcion: ' ' }], 1),
      );
      assert.throws(() =>
        validarMetasVision(
          [
            { id: randomUUID(), descripcion: 'A' },
            { id: randomUUID(), descripcion: 'a' },
          ],
          1,
        ),
      );
      assert.throws(() => validarMetasVision([], undefined));
      const nueva = await guardarVisionDesarrolloComunitaria(
        org,
        comunidad,
        datosVision,
        usuario,
        pool,
      );
      assert.equal(nueva?.metas.length, 2);
      assert.equal(nueva?.metas[0].id, vision.metas[0].id);
      assert.equal(nueva?.metaDesarrollo, 'Construir un aula y equiparla'); // legado intacto
      assert.deepEqual(
        (
          await obtenerVisionesDesarrolloComunitaria(org, comunidad, pool)
        )?.find((v) => v.area === vision.area),
        nueva,
      );
      await assert.rejects(
        guardarVisionDesarrolloComunitaria(
          org,
          comunidad,
          datosVision,
          usuario,
          pool,
        ),
        /actualizó/,
      );
      assert.equal(
        await obtenerVisionesDesarrolloComunitaria(otra, comunidad, pool),
        undefined,
      );
      assert.equal(
        await guardarVisionDesarrolloComunitaria(
          otra,
          comunidad,
          datosVision,
          usuario,
          pool,
        ),
        null,
      );
      const areaDestino = visiones!.find((v) => v.area === 'INFRAESTRUCTURA');
      const nuevaArea = {
        ...nueva!,
        area: 'INFRAESTRUCTURA' as const,
        revision: areaDestino?.revision ?? 0,
      };
      // La misma meta no puede moverse a otra área por manipulación del ID; se revierte todo.
      if (vision.area !== 'INFRAESTRUCTURA') {
        await assert.rejects(
          guardarVisionDesarrolloComunitaria(
            org,
            comunidad,
            nuevaArea,
            usuario,
            pool,
          ),
          /no pertenece/,
        );
        assert.deepEqual(
          (
            await obtenerVisionesDesarrolloComunitaria(org, comunidad, pool)
          )?.find((v) => v.area === 'INFRAESTRUCTURA'),
          areaDestino,
        );
      }
      const recortada = await guardarVisionDesarrolloComunitaria(
        org,
        comunidad,
        { ...nueva!, metas: [nueva!.metas[1]] },
        usuario,
        pool,
      );
      assert.equal(recortada?.metas.length, 1);
      assert.equal(
        (
          await db.query<{ activa: boolean }>(
            'SELECT activa FROM metas_vision_desarrollo WHERE id=$1',
            [vision.metas[0].id],
          )
        ).rows[0].activa,
        false,
      );
      assert.equal(
        (
          await db.query(
            "SELECT id FROM bitacora_auditoria WHERE accion='GUARDAR_METAS_VISION'",
          )
        ).rows.length,
        2,
      );

      await db.exec(
        await leer('database/sql/010_necesidades_comunitarias.sql'),
      );
      assert.deepEqual(await listarNecesidades(org, comunidad, pool), []);
      const necesidad = validarNecesidad({
        id: randomUUID(),
        area: recortada!.area,
        metaId: recortada!.metas[0].id,
        titulo: 'Espacio escolar insuficiente',
        descripcion: 'Falta espacio para recibir estudiantes.',
        situacionInicial: 'Visita comunitaria documenta un solo salón.',
        poblacionAfectada: 'Estudiantes de primaria',
        cantidadAfectada: null,
        resultadoEsperado: 'Disponer de espacio suficiente.',
        unidadMedida: 'aulas',
        cantidadObjetivo: 1,
        prioridad: 'ALTA',
        motivoPrioridad: 'Hay estudiantes sin espacio.',
      });
      assert.throws(() =>
        validarNecesidad({ ...necesidad, motivoPrioridad: '' }),
      );
      assert.throws(() =>
        validarNecesidad({ ...necesidad, cantidadAfectada: -1 }),
      );
      assert.throws(() =>
        validarNecesidad({ ...necesidad, unidadMedida: null }),
      );
      assert.throws(() =>
        validarNecesidad({ ...necesidad, estado: 'RESUELTA' }),
      );
      assert.throws(() =>
        validarNecesidad({ ...necesidad, cantidadObjetivo: 1.234 }),
      );
      const registrada = await registrarNecesidad(
        org,
        comunidad,
        usuario,
        necesidad,
        pool,
      );
      assert.equal(registrada.estado, 'IDENTIFICADA');
      assert.equal(registrada.cantidadAfectada, null);
      assert.equal(registrada.metaId, recortada!.metas[0].id);
      assert.equal((await listarNecesidades(org, comunidad, pool))?.length, 1);
      await assert.rejects(
        registrarNecesidad(org, comunidad, usuario, necesidad, pool),
        /ya existe/,
      );
      assert.equal(await listarNecesidades(otra, comunidad, pool), null);
      await assert.rejects(
        registrarNecesidad(
          otra,
          comunidad,
          usuario,
          { ...necesidad, id: randomUUID() },
          pool,
        ),
        /no encontrada/,
      );
      await assert.rejects(
        registrarNecesidad(
          org,
          comunidad,
          usuario,
          { ...necesidad, id: randomUUID(), metaId: vision.metas[0].id },
          pool,
        ),
        /activa/,
      );
      await assert.rejects(
        registrarNecesidad(
          org,
          comunidad,
          usuario,
          { ...necesidad, id: randomUUID(), area: 'EDUCACION_COMUNITARIA' },
          pool,
        ),
        /pertenecer/,
      );
      const comunidadAjena = (
        await db.query<{ id: string }>(
          "INSERT INTO comunidades(nombre,municipio,departamento,organizacion_id) VALUES('Otra','Otro','Otro',$1) RETURNING id",
          [org],
        )
      ).rows[0].id;
      await assert.rejects(
        registrarNecesidad(
          org,
          comunidadAjena,
          usuario,
          { ...necesidad, id: randomUUID() },
          pool,
        ),
        /pertenecer/,
      );
      const libre = await registrarNecesidad(
        org,
        comunidad,
        usuario,
        {
          ...necesidad,
          id: randomUUID(),
          metaId: null,
          prioridad: 'POR_EVALUAR',
          motivoPrioridad: 'Falta evaluación',
          cantidadObjetivo: null,
          unidadMedida: null,
          cantidadAfectada: 0,
        },
        pool,
      );
      assert.equal(libre.cantidadAfectada, 0);
      assert.equal(libre.metaId, null);
      assert.equal(libre.prioridad, 'POR_EVALUAR');
      assert.equal(
        (
          await db.query(
            "SELECT id FROM bitacora_auditoria WHERE accion='REGISTRAR_NECESIDAD'",
          )
        ).rows.length,
        2,
      );
      assert.equal((await listarNecesidades(org, comunidad, pool))?.length, 2);
      await guardarVisionDesarrolloComunitaria(
        org,
        comunidad,
        { ...recortada!, metas: [] },
        usuario,
        pool,
      );
      const conservada = (await listarNecesidades(org, comunidad, pool))?.find(
        (n) => n.id === necesidad.id,
      );
      assert.equal(conservada?.metaActiva, false);
      assert.equal(conservada?.metaDescripcion, 'Equipar el aula');
      // La restricción compuesta también protege escrituras SQL que omiten el servicio.
      await assert.rejects(
        db.query(
          'UPDATE necesidades_comunitarias SET comunidad_id=$1 WHERE id=$2',
          [comunidadAjena, necesidad.id],
        ),
      );
    } finally {
      await db.close();
    }
  });
