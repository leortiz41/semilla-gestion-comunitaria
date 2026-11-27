import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { consultarAccesoEvidenciaAvance, consultarIndiceEvidencias, consultarCatalogoProyectos, consultarResponsablesProyecto, consultarAvancesPendientes, consultarMetaActividad, consultarEvidenciasAvance, consultarClaveEvidencia, guardarActividadEnRepositorio, existeProyectoEnOrganizacion, consultarSaldoActividad, guardarProyectoEnRepositorio, registrarEvidenciaEnRepositorio } from '../src/modules/proyectos/proyectos.repository.js';

const organizacionId = 'a63f86ca-318e-492b-8bc6-d5e2700062ba';
const proyectoId = 'f0cc242b-b341-46a9-98af-4e6d224f218e';
const actividadId = '16d3acec-c071-4cdd-99da-cd94096bcc56';
const avanceId = '6c4afcad-3d12-468b-90d6-f40d46d24ce9';

test('Proyectos: consulta de acceso a evidencia exige UUID y limita por organización', async () => {
  const fila = { id: avanceId, estado: 'VALIDADO', responsable: null };
  let llamadas = 0;
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      llamadas++;
      assert.match(consulta, /c\.organizacion_id = \$4/);
      assert.deepEqual(parametros, [proyectoId, actividadId, avanceId, organizacionId]);
      return { rows: [fila] };
    },
  } as unknown as Pool;
  assert.deepEqual(
    await consultarAccesoEvidenciaAvance(pool, proyectoId, actividadId, avanceId, organizacionId),
    fila,
  );
  assert.equal(llamadas, 1);
  assert.equal(
    await consultarAccesoEvidenciaAvance(pool, proyectoId, actividadId, 'no-es-uuid', organizacionId),
    null,
  );
  assert.equal(await consultarAccesoEvidenciaAvance(null, proyectoId, actividadId, avanceId, organizacionId), null);
  assert.equal(llamadas, 1);
});

test('Proyectos: índice documental pasa el tenant a las dos consultas', async () => {
  const consultas: string[] = [];
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      consultas.push(consulta);
      assert.match(consulta, /c\.organizacion_id\s*=\s*\$1/);
      assert.deepEqual(parametros, [organizacionId]);
      return { rows: consultas.length === 1 ? [{ avanceId }] : [{ id: proyectoId }] };
    },
  } as unknown as Pool;
  const resultado = await consultarIndiceEvidencias(pool, organizacionId);
  assert.deepEqual(resultado.avances, [{ avanceId }]);
  assert.deepEqual(resultado.proyectosFinalizados, [{ id: proyectoId }]);
  assert.equal(consultas.length, 2);
});

test('Proyectos: el catálogo usa la organización en sus cuatro consultas', async () => {
  let indice = 0;
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      assert.deepEqual(parametros, [organizacionId]);
      assert.match(consulta, /organizacion_id\s*=\s*\$1|WHERE id = \$1/);
      indice++;
      return { rows: indice === 4 ? [{ moneda: 'HNL' }] : [] };
    },
  } as unknown as Pool;
  const catalogo = await consultarCatalogoProyectos(pool, organizacionId);
  assert.equal(indice, 4);
  assert.deepEqual(catalogo.proyectos, []);
  assert.deepEqual(catalogo.comunidades, []);
  assert.deepEqual(catalogo.donantes, []);
  assert.equal(catalogo.moneda, 'HNL');
});

test('Proyectos: responsables se limitan al proyecto y organización y excluyen DONANTE', async () => {
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      assert.match(consulta, /c\.organizacion_id\s*=\s*\$2/);
      assert.match(consulta, /r.nombre = 'DONANTE'/);
      assert.deepEqual(parametros, [proyectoId, organizacionId]);
      return { rows: [{ id: actividadId, nombre: 'coordinador@ejemplo.test' }] };
    },
  } as unknown as Pool;
  const responsables = await consultarResponsablesProyecto(pool, proyectoId, organizacionId);
  assert.equal(responsables.length, 1);
});

test('Proyectos: bandeja de revisión filtra organización, estado ENVIADO y autor', async () => {
  const usuarioId = 'f84bc9ac-eb2e-4749-af68-2d7d7fbc5fc7';
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      assert.match(consulta, /c\.organizacion_id\s*=\s*\$1/);
      assert.match(consulta, /av.estado_revision = 'ENVIADO'/);
      assert.deepEqual(parametros, [organizacionId, usuarioId]);
      return { rows: [{ id: avanceId }] };
    },
  } as unknown as Pool;
  assert.deepEqual(await consultarAvancesPendientes(pool, organizacionId, usuarioId), [{ id: avanceId }]);
});

test('Proyectos: la meta de actividad pertenece al proyecto y tenant solicitados', async () => {
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      assert.match(consulta, /c\.organizacion_id\s*=\s*\$3/);
      assert.deepEqual(parametros, [proyectoId, actividadId, organizacionId]);
      return { rows: [{ meta_cantidad: 30 }] };
    },
  } as unknown as Pool;
  assert.deepEqual(await consultarMetaActividad(pool, proyectoId, actividadId, organizacionId), [{ meta_cantidad: 30 }]);
});

test('Proyectos: las consultas de evidencia conservan los filtros por proyecto y avance', async () => {
  const evidenciaId = 'bd6cdb66-a498-4f5d-9ef8-bd10e1ea45bc';
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      if (parametros.length === 2) {
        assert.match(consulta, /proyecto_id=\$1 AND avance_proyecto_id=\$2/);
        assert.deepEqual(parametros, [proyectoId, avanceId]);
        return { rows: [{ id: evidenciaId, archivoUrl: 'r2:clave' }] };
      }
      assert.match(consulta, /e.id=\$1 AND e.proyecto_id=\$2 AND e.avance_proyecto_id=\$3/);
      assert.deepEqual(parametros, [evidenciaId, proyectoId, avanceId]);
      return { rows: [{ clave: 'r2:clave' }] };
    },
  } as unknown as Pool;
  const evidencias = await consultarEvidenciasAvance(pool, proyectoId, avanceId);
  assert.equal(evidencias.length, 1);
  assert.equal(await consultarClaveEvidencia(pool, evidenciaId, proyectoId, avanceId), 'r2:clave');
});

test('Proyectos: guardar actividad conserva organización y validación de presupuesto en SQL', async () => {
  const parametros = [proyectoId, organizacionId, 'Actividad', null, 'PLANIFICADA', null, null, actividadId, 100, null, 20, 'unidades', 25];
  const consultas: string[] = [];
  const pool = {
    query: async (consulta: string, args: unknown[]) => {
      consultas.push(consulta);
      assert.match(consulta, /c\.organizacion_id = \$2/);
      assert.match(consulta, /presupuesto_asignado/);
      assert.equal(args[0], proyectoId);
      assert.equal(args[1], organizacionId);
      if (consulta.includes('UPDATE actividades_programadas')) {
        assert.equal(args[7], actividadId);
        return { rows: [{ id: actividadId }] };
      }
      assert.equal(args.length, 12);
      assert.equal(args[7], 100);
      return { rows: [{ id: actividadId }] };
    },
  } as unknown as Pool;
  assert.deepEqual(await guardarActividadEnRepositorio(pool, actividadId, parametros), [{ id: actividadId }]);
  assert.deepEqual(await guardarActividadEnRepositorio(pool, null, parametros), [{ id: actividadId }]);
  assert.equal(consultas.length, 2);
});

test('Proyectos: verificación y saldo de actividad usan el mismo tenant', async () => {
  const pool = {
    query: async (consulta: string, args: unknown[]) => {
      assert.equal(args[0], proyectoId);
      assert.equal(args[1], organizacionId);
      assert.match(consulta, /c\.organizacion_id\s*=\s*\$2/);
      return args.length === 2 ? { rows: [{ existe: 1 }] } : { rows: [{ presupuesto: '500', asignado: '200' }] };
    },
  } as unknown as Pool;
  assert.equal(await existeProyectoEnOrganizacion(pool, proyectoId, organizacionId), true);
  assert.deepEqual(await consultarSaldoActividad(pool, proyectoId, organizacionId, actividadId), [{ presupuesto: '500', asignado: '200' }]);
});

test('Proyectos: crear proyecto conserva transacción y parámetros del tenant', async () => {
  const comandos: string[] = [];
  let liberado = false;
  const cliente = {
    query: async (sql: string, params?: unknown[]) => {
      comandos.push(sql);
      if (sql.includes('INSERT INTO proyectos (')) {
        assert.equal(params?.[1], organizacionId);
        return { rowCount: 1, rows: [{ id: proyectoId }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release: () => { liberado = true; },
  };
  const pool = { connect: async () => cliente } as unknown as Pool;
  const resultado = await guardarProyectoEnRepositorio(pool, {
    organizacionId, tipoDeDiagnostico: true,
    parametros: [actividadId, organizacionId, 'Educación', 'EDUCACION_FORMAL',
      'PLANIFICADO', '2026-11-22', null, null, '100'],
  });
  assert.deepEqual(resultado, { tipo: 'OK', id: proyectoId });
  assert.equal(comandos[0], 'BEGIN');
  assert.equal(comandos.at(-1), 'COMMIT');
  assert.equal(comandos.includes('ROLLBACK'), false);
  assert.equal(liberado, true);
});

test('Proyectos: presupuesto menor a las actividades revierte la transacción', async () => {
  const comandos: string[] = [];
  let liberado = false;
  const cliente = {
    query: async (sql: string, params?: unknown[]) => {
      comandos.push(sql);
      if (sql.includes('presupuesto_actividades')) {
        assert.deepEqual(params, [proyectoId, organizacionId]);
        return { rows: [{ presupuesto_actividades: '250' }] };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => { liberado = true; },
  };
  const pool = { connect: async () => cliente } as unknown as Pool;
  const resultado = await guardarProyectoEnRepositorio(pool, {
    id: proyectoId, organizacionId, presupuesto: '100', tipoDeDiagnostico: true,
    parametros: [actividadId, organizacionId, 'Educación', 'EDUCACION_FORMAL',
      'PLANIFICADO', '2026-11-22', null, null, '100'],
  });
  assert.deepEqual(resultado, { tipo: 'PRESUPUESTO_INSUFICIENTE' });
  assert.equal(comandos[0], 'BEGIN');
  assert.equal(comandos.at(-1), 'ROLLBACK');
  assert.equal(liberado, true);
});

test('Proyectos: registra fotografía proxy con tenant y auditoría dentro de transacción', async () => {
  const comandos: string[] = [];
  let liberado = false;
  const evidenciaId = 'a7ecbfde-6dbd-4a95-9d94-20131fb3f6dd';
  const cliente = {
    query: async (sql: string, args?: unknown[]) => {
      comandos.push(sql);
      if (sql.includes('FOR UPDATE OF av')) {
        assert.deepEqual(args, [avanceId, actividadId, proyectoId, organizacionId, actividadId]);
        return { rows: [{ id: avanceId }] };
      }
      if (sql.includes('INSERT INTO evidencias')) return { rows: [{ id: evidenciaId }] };
      if (sql.includes('INSERT INTO bitacora_auditoria')) {
        assert.equal(args?.[0], actividadId);
        assert.equal(args?.[1], evidenciaId);
      }
      return { rows: [] };
    },
    release: () => { liberado = true; },
  };
  const pool = { connect: async () => cliente } as unknown as Pool;
  const resultado = await registrarEvidenciaEnRepositorio(pool, {
    proyectoId, actividadId, avanceId, organizacionId, usuarioId: actividadId,
    clave: 'ruta/imagen', mime: 'image/png', titulo: 'Evidencia', modo: 'proxy',
  });
  assert.deepEqual(resultado, { tipo: 'CREADA', id: evidenciaId });
  assert.equal(comandos[0], 'BEGIN');
  assert.equal(comandos.at(-1), 'COMMIT');
  assert.equal(liberado, true);
});

test('Proyectos: confirma evidencia existente sin duplicar la inserción', async () => {
  const comandos: string[] = [];
  const evidenciaId = 'a7ecbfde-6dbd-4a95-9d94-20131fb3f6dd';
  const cliente = {
    query: async (sql: string, args?: unknown[]) => {
      comandos.push(sql);
      if (sql.includes('FOR UPDATE OF av')) {
        assert.equal(args?.[3], organizacionId);
        return { rows: [{ id: avanceId }] };
      }
      if (sql.startsWith('SELECT id FROM evidencias')) return { rows: [{ id: evidenciaId }] };
      return { rows: [] };
    },
    release: () => {},
  };
  const pool = { connect: async () => cliente } as unknown as Pool;
  const resultado = await registrarEvidenciaEnRepositorio(pool, {
    proyectoId, actividadId, avanceId, organizacionId, usuarioId: actividadId,
    clave: 'ruta/imagen', mime: 'image/png', titulo: 'Evidencia', modo: 'confirmar',
  });
  assert.deepEqual(resultado, { tipo: 'EXISTENTE', id: evidenciaId });
  assert.equal(comandos.at(-1), 'COMMIT');
  assert.equal(comandos.some(x => x.includes('INSERT INTO evidencias')), false);
});

test('Proyectos: rechaza cambio de estado y revierte antes de guardar evidencia', async () => {
  const comandos: string[] = [];
  const cliente = {
    query: async (sql: string) => {
      comandos.push(sql);
      return { rows: [] };
    },
    release: () => {},
  };
  const pool = { connect: async () => cliente } as unknown as Pool;
  const resultado = await registrarEvidenciaEnRepositorio(pool, {
    proyectoId, actividadId, avanceId, organizacionId, usuarioId: actividadId,
    clave: 'ruta/imagen', mime: 'image/png', titulo: 'Evidencia', modo: 'confirmar',
  });
  assert.deepEqual(resultado, { tipo: 'CAMBIO_ESTADO' });
  assert.equal(comandos.at(-1), 'ROLLBACK');
  assert.equal(comandos.some(x => x.includes('INSERT INTO evidencias')), false);
});
