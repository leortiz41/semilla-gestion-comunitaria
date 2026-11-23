import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { validarPlanificacionActividad } from '../src/modules/proyectos/planificacion-actividad.domain.js';
import { guardarPlanificacionActividad } from '../src/modules/proyectos/planificacion-actividad.service.js';

const proyectoId = 'eaf2c17a-2865-4163-a3b2-9510b239f156';
const organizacionId = '5b9fd3dc-7914-4561-b306-ae1b6fae9678';
const usuarioId = '730bddf2-ed6a-429d-b079-429d043d43f3';
const entrada = {
  nombre: 'Instalar sistema de agua',
  descripcion: 'Trabajo comunitario',
  estado: 'PLANIFICADA',
  fechaInicio: '2026-11-24',
  fechaFin: '2026-12-14',
  responsableAsignadoId: usuarioId,
  metaCantidad: 20,
  unidadMedida: 'Metros lineales',
  presupuestoEstimado: 4000,
  pesoResultado: 50,
};

test('planificación: normaliza datos válidos sin depender de Express', () => {
  const datos = validarPlanificacionActividad({ ...entrada, nombre: '  Instalar sistema de agua  ' });
  assert.equal(datos?.nombre, entrada.nombre);
  assert.equal(datos?.metaCantidad, 20);
  assert.equal(datos?.responsableAsignadoId, usuarioId);
});

test('planificación: rechaza metas, presupuesto, pesos y fechas inválidos', () => {
  for (const modificacion of [
    { metaCantidad: -1 },
    { metaCantidad: 0 },
    { metaCantidad: 20, unidadMedida: '' },
    { metaCantidad: null, unidadMedida: 'Viviendas' },
    { presupuestoEstimado: -1 },
    { pesoResultado: 101 },
    { fechaInicio: '2026-12-15', fechaFin: '2026-12-14' },
    { responsableAsignadoId: 'otra-organizacion-no-es-uuid' },
  ]) {
    assert.equal(validarPlanificacionActividad({ ...entrada, ...modificacion }), null,
      JSON.stringify(modificacion));
  }
});

test('planificación: se respeta la organización en el repositorio al crear una actividad', async () => {
  const consultas: Array<{ sql: string; parametros: unknown[] }> = [];
  const pool = {
    query: async (sql: string, parametros: unknown[]) => {
      consultas.push({ sql, parametros });
      return { rows: [{ id: 'actividad-creada' }] };
    },
  } as unknown as Pool;
  const datos = validarPlanificacionActividad(entrada);
  assert.ok(datos);
  const resultado = await guardarPlanificacionActividad(pool, proyectoId, null, organizacionId, datos);
  assert.equal(resultado.tipo, 'OK');
  assert.equal(consultas.length, 1);
  assert.match(consultas[0].sql, /c\.organizacion_id = \$2/);
  assert.match(consultas[0].sql, /presupuesto_asignado/);
  assert.match(consultas[0].sql, /u\.organizacion_id = p\.organizacion_id/);
  assert.equal(consultas[0].parametros[1], organizacionId);
});

test('planificación: informa saldo insuficiente sin ocultarlo como fallo de responsable', async () => {
  const pool = {
    query: async (sql: string) => {
      if (sql.includes('INSERT INTO actividades_programadas')) return { rows: [] };
      if (sql.includes('SELECT 1 FROM proyectos')) return { rows: [{ '?column?': 1 }] };
      if (sql.includes('AS asignado')) return { rows: [{ presupuesto: 3000, asignado: 1000 }] };
      throw Error('Consulta inesperada: ' + sql);
    },
  } as unknown as Pool;
  const datos = validarPlanificacionActividad(entrada);
  assert.ok(datos);
  const resultado = await guardarPlanificacionActividad(pool, proyectoId, null, organizacionId, datos);
  assert.equal(resultado.tipo, 'PRESUPUESTO_INSUFICIENTE');
});
