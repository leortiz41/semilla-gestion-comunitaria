import assert from 'node:assert/strict';
import { test } from 'node:test';
import { datosIntegrante, validarIntegrante } from '../src/routes/integrantes-familia.routes.js';

const gradoId = 'e13121ec-129d-4f3d-b369-c8f745b35ca1';

function integrante(fechaNacimiento: string | null, asisteEscuela: boolean | null, gradoEstudioId: string | null) {
  return datosIntegrante({
    primerNombre: 'Carlos',
    segundoNombre: 'Eduardo',
    primerApellido: 'Pérez',
    segundoApellido: 'Gómez',
    fechaNacimiento,
    ocupacion: 'Estudiante',
    parentescoId: null,
    esJefeHogar: false,
    asisteEscuela,
    gradoEstudioId,
  });
}

test('Familias: permite fecha de nacimiento real y escolaridad con grado seleccionado', () => {
  assert.equal(validarIntegrante(integrante('2010-02-01', true, gradoId)), true);
  assert.equal(validarIntegrante(integrante('2000-12-31', false, null)), true);
  assert.equal(validarIntegrante(integrante(null, null, null)), true);
});

test('Familias: mantiene restricciones para fecha inválida y grado incompatible', () => {
  assert.equal(validarIntegrante(integrante('01/02/2010', true, gradoId)), false);
  assert.equal(validarIntegrante(integrante('2010/02/01', true, gradoId)), false);
  assert.equal(validarIntegrante(integrante('2010-02-01', false, gradoId)), false);
  assert.equal(validarIntegrante(integrante('2010-02-01', true, 'id-no-valido')), false);
});
