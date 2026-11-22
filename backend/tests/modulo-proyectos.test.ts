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
    assert.doesNotMatch(contenido, /\\.query\\s*\\(/, nombre);
  }
});
