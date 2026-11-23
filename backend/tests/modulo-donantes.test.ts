import { test } from 'node:test';
import assert from 'node:assert/strict';
import { donantesRouter as routerAnterior } from '../src/routes/donantes.routes.js';
import { donantesRouter as routerModular } from '../src/modules/donantes/donantes.routes.js';

test('Módulo Donantes: el adaptador mantiene la misma instancia del router', () => {
  assert.equal(routerAnterior, routerModular);
});
