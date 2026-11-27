import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { proyectosRouter as routerAnterior, crearRouterActividades as crearRouterAnterior } from '../src/routes/proyectos.routes.js';
import { proyectosRouter as routerModular, crearRouterActividades as crearRouterModular } from '../src/modules/proyectos/proyectos.routes.js';
import { validarAvanceActividad as validarAnterior } from '../src/domain/avances-actividad.js';
import { validarAvanceActividad as validarModular } from '../src/modules/proyectos/avances-actividad.domain.js';
import {
  registrarAvanceActividad as registrarAnterior,
  listarActividadesProyecto as listarAnterior,
  transicionarAvanceActividad as transicionarAnterior,
  editarAvanceActividad as editarAnterior,
} from '../src/services/avances-actividad.service.js';
import {
  registrarAvanceActividad as registrarModular,
  listarActividadesProyecto as listarModular,
  transicionarAvanceActividad as transicionarModular,
  editarAvanceActividad as editarModular,
} from '../src/modules/proyectos/avances-actividad.service.js';

test('Módulo Proyectos: rutas, dominio y servicios mantienen la misma implementación', () => {
  assert.equal(routerAnterior, routerModular);
  assert.equal(crearRouterAnterior, crearRouterModular);
  assert.equal(validarAnterior, validarModular);
  assert.equal(registrarAnterior, registrarModular);
  assert.equal(listarAnterior, listarModular);
  assert.equal(transicionarAnterior, transicionarModular);
  assert.equal(editarAnterior, editarModular);
});


test('Módulo Proyectos: rutas y servicios de avances no contienen consultas SQL directas', () => {
  for (const nombre of ['proyectos.routes.ts', 'avances-actividad.service.ts']) {
    const contenido = readFileSync(new URL('../src/modules/proyectos/' + nombre, import.meta.url), 'utf8');
    assert.equal(contenido.includes('.query('), false, nombre);
  }
});

test('ADR-006: rutas de cierre delegan a controladores y servicio no depende de Express', () => {
  const directorio = '../src/modules/proyectos/';
  const rutas = readFileSync(new URL(directorio + 'proyectos.routes.ts', import.meta.url), 'utf8');
  const controlador = readFileSync(new URL(directorio + 'cierre-proyecto.controller.ts', import.meta.url), 'utf8');
  const servicio = readFileSync(new URL(directorio + 'cierre-proyecto.service.ts', import.meta.url), 'utf8');
  const repositorio = readFileSync(new URL(directorio + 'cierre-proyecto.repository.ts', import.meta.url), 'utf8');

  assert.match(rutas, /post\('\/:proyectoId\/finalizar',[\s\S]*?confirmarFinalizacionProyecto\)/);
  assert.match(rutas, /post\('\/:proyectoId\/reabrir',[\s\S]*?confirmarReaperturaProyecto\)/);
  assert.equal(rutas.includes('.query('), false);
  assert.equal(controlador.includes('.query('), false);
  assert.equal(controlador.includes('cierre-proyecto.repository'), false);
  assert.equal(servicio.includes('express'), false);
  assert.equal(servicio.includes('.query('), false);
  assert.match(repositorio, /FINALIZAR_PROYECTO/);
  assert.match(repositorio, /REABRIR_PROYECTO/);
});

test('ADR-006: catálogo y revisión solo delegan a controladores y servicios', () => {
  const raiz = '../src/modules/proyectos/';
  const rutas = readFileSync(new URL(raiz + 'proyectos.routes.ts', import.meta.url), 'utf8');
  const controlador = readFileSync(new URL(raiz + 'consultas-proyectos.controller.ts', import.meta.url), 'utf8');
  const servicio = readFileSync(new URL(raiz + 'consultas-proyectos.service.ts', import.meta.url), 'utf8');
  assert.match(rutas, /get\('\/revision\/pendientes',[\s\S]*?listarAvancesPendientesRevision\)/);
  assert.match(rutas, /get\('\/', listarCatalogoProyectos\)/);
  assert.equal(controlador.includes('.query('), false);
  assert.equal(controlador.includes('proyectos.repository'), false);
  assert.equal(servicio.includes('express'), false);
  assert.equal(servicio.includes('.query('), false);
});

test('ADR-006: planificación delega controlador, servicio y dominio sin SQL fuera del repositorio', () => {
  const directorio = '../src/modules/proyectos/';
  const rutas = readFileSync(new URL(directorio + 'proyectos.routes.ts', import.meta.url), 'utf8');
  const controlador = readFileSync(new URL(directorio + 'planificacion-actividad.controller.ts', import.meta.url), 'utf8');
  const servicio = readFileSync(new URL(directorio + 'planificacion-actividad.service.ts', import.meta.url), 'utf8');
  const dominio = readFileSync(new URL(directorio + 'planificacion-actividad.domain.ts', import.meta.url), 'utf8');
  assert.match(rutas, /post\('\/:proyectoId\/actividades',[\s\S]*?guardarActividadPlanificada\)/);
  assert.match(rutas, /put\('\/:proyectoId\/actividades\/:actividadId',[\s\S]*?guardarActividadPlanificada\)/);
  assert.equal(rutas.includes('const guardarActividad: RequestHandler'), false);
  assert.equal(controlador.includes('.query('), false);
  assert.equal(controlador.includes('proyectos.repository'), false);
  assert.equal(servicio.includes('express'), false);
  assert.equal(servicio.includes('.query('), false);
  assert.equal(dominio.includes('express'), false);
  assert.equal(dominio.includes('databasePool'), false);
});

test('ADR-006: registro, edición, envío, revisión y corrección delegados a controladores', () => {
  const directorio = '../src/modules/proyectos/';
  const rutas = readFileSync(new URL(directorio + 'proyectos.routes.ts', import.meta.url), 'utf8');
  const controlador = readFileSync(new URL(directorio + 'avances-actividad.controller.ts', import.meta.url), 'utf8');
  const servicio = readFileSync(new URL(directorio + 'avances-actividad.service.ts', import.meta.url), 'utf8');

  for (const operacion of ['registrar', 'editar', 'enviar', 'corregir', 'revisar']) {
    assert.match(rutas, new RegExp('controladores\\.' + operacion), operacion);
    assert.match(controlador, new RegExp('\\b' + operacion + '\\b'), operacion);
  }
  assert.equal(rutas.includes('const contexto = { rows: await consultarMetaActividad'), false);
  assert.equal(controlador.includes('.query('), false);
  assert.equal(controlador.includes('proyectos.repository'), false);
  assert.equal(servicio.includes('.query('), false);
  assert.equal(servicio.includes('express'), false);
  assert.match(servicio, /comprobarTipoDeMetaAvance/);
  assert.match(servicio, /consultarExcesoDeMeta/);
});
