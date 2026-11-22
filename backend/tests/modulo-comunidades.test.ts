import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { comunidadesRouter as routerAnterior } from '../src/routes/comunidades.routes.js';
import { comunidadesRouter as routerModular } from '../src/modules/comunidades/comunidades.routes.js';
import { capacidadesRouter as capacidadesAnterior } from '../src/routes/capacidades.routes.js';
import { capacidadesRouter as capacidadesModular } from '../src/modules/comunidades/capacidades.routes.js';
import { necesidadesRouter as necesidadesAnterior } from '../src/routes/necesidades.routes.js';
import { necesidadesRouter as necesidadesModular } from '../src/modules/comunidades/necesidades.routes.js';
import { listarComunidadesPorOrganizacion as listarAnterior } from '../src/services/comunidades.service.js';
import { listarComunidadesPorOrganizacion as listarModular } from '../src/modules/comunidades/comunidades.service.js';
import { consultarComunidadesPorOrganizacion } from '../src/modules/comunidades/comunidades.repository.js';
import { validarMetasVision as validarMetasAnterior } from '../src/domain/metas-vision.js';
import { validarMetasVision as validarMetasModular } from '../src/modules/comunidades/metas-vision.domain.js';
import { validarNecesidad as validarNecesidadAnterior } from '../src/domain/necesidades.js';
import { validarNecesidad as validarNecesidadModular } from '../src/modules/comunidades/necesidades.domain.js';
import { validarCapacidades as validarCapacidadesAnterior, guardarCapacidades as guardarCapacidadesAnterior } from '../src/services/capacidades.service.js';
import { validarCapacidades as validarCapacidadesModular, guardarCapacidades as guardarCapacidadesModular } from '../src/modules/comunidades/capacidades.service.js';
import { registrarNecesidad as registrarNecesidadAnterior, listarNecesidades as listarNecesidadesAnterior } from '../src/services/necesidades.service.js';
import { registrarNecesidad as registrarNecesidadModular, listarNecesidades as listarNecesidadesModular } from '../src/modules/comunidades/necesidades.service.js';

test('Módulo comunidades: los adaptadores conservan las mismas rutas y servicios', () => {
  assert.equal(routerAnterior, routerModular);
  assert.equal(capacidadesAnterior, capacidadesModular);
  assert.equal(necesidadesAnterior, necesidadesModular);
  assert.equal(listarAnterior, listarModular);
  assert.equal(validarMetasAnterior, validarMetasModular);
  assert.equal(validarNecesidadAnterior, validarNecesidadModular);
  assert.equal(validarCapacidadesAnterior, validarCapacidadesModular);
  assert.equal(guardarCapacidadesAnterior, guardarCapacidadesModular);
  assert.equal(registrarNecesidadAnterior, registrarNecesidadModular);
  assert.equal(listarNecesidadesAnterior, listarNecesidadesModular);
});

test('Módulo comunidades: el repositorio limita la consulta a la organización recibida', async () => {
  const organizacionId = 'a63f86ca-318e-492b-8bc6-d5e2700062ba';
  const fila = {
    id: 'f9e9eb43-5e5f-437f-a7d8-bc7dc288644b',
    zona_id: null,
    nombre: 'Agua Azul Rancho',
    barrio_colonia: null,
    localidad: null,
    municipio: 'Santa Cruz de Yojoa',
    departamento: 'Cortés',
    activo: true,
    nombre_zona: null,
    zona_activa: null,
  };
  let llamadas = 0;
  const pool = {
    query: async (consulta: string, parametros: unknown[]) => {
      llamadas++;
      assert.match(consulta, /WHERE c\.organizacion_id = \$1/);
      assert.deepEqual(parametros, [organizacionId]);
      return { rows: [fila] };
    },
  } as unknown as Pool;
  const registros = await consultarComunidadesPorOrganizacion(pool, organizacionId);
  assert.deepEqual(registros, [fila]);
  assert.equal(llamadas, 1);
});
