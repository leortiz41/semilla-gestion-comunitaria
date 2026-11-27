import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validarProteccionCuenta,
  requiereValidarUltimoAdministrador,
  esUltimoAdministradorActivo,
  requiereActualizarEstado,
} from '../src/modules/plataforma/estado-cuentas.domain.js';

test('ADR-006 H-02: una cuenta retirada nunca puede reactivarse', () => {
  assert.equal(validarProteccionCuenta({
    retirada:true,esCuentaGlobal:false,esCuentaOperador:false,
  }), 'RETIRADA');
  // La condición retirada prevalece sobre cualquier protección posterior.
  assert.equal(validarProteccionCuenta({
    retirada:true,esCuentaGlobal:true,esCuentaOperador:true,
  }), 'RETIRADA');
});

test('ADR-006 H-02: cuenta global o cuenta del operador permanecen protegidas', () => {
  assert.equal(validarProteccionCuenta({
    retirada:false,esCuentaGlobal:true,esCuentaOperador:false,
  }), 'PROTEGIDA');
  assert.equal(validarProteccionCuenta({
    retirada:false,esCuentaGlobal:false,esCuentaOperador:true,
  }), 'PROTEGIDA');
  assert.equal(validarProteccionCuenta({
    retirada:false,esCuentaGlobal:false,esCuentaOperador:false,
  }), null);
});

test('ADR-006 H-02: último administrador solo se verifica al suspender una cuenta activa', () => {
  assert.equal(requiereValidarUltimoAdministrador(true,false),true);
  assert.equal(requiereValidarUltimoAdministrador(false,true),false);
  assert.equal(requiereValidarUltimoAdministrador(true,true),false);
  assert.equal(requiereValidarUltimoAdministrador(false,false),false);
  assert.equal(esUltimoAdministradorActivo(true,0),true);
  assert.equal(esUltimoAdministradorActivo(true,1),false);
  assert.equal(esUltimoAdministradorActivo(false,0),false);
});

test('ADR-006 H-02: operación idempotente no genera escrituras', () => {
  assert.equal(requiereActualizarEstado(true,true),false);
  assert.equal(requiereActualizarEstado(false,false),false);
  assert.equal(requiereActualizarEstado(true,false),true);
  assert.equal(requiereActualizarEstado(false,true),true);
});

test('ADR-006 H-02: servicio contiene la política; repo conserva SQL y atomicidad', () => {
  const root=new URL('../src/modules/plataforma/',import.meta.url);
  const domain=readFileSync(new URL('estado-cuentas.domain.ts',root),'utf8');
  const service=readFileSync(new URL('cuentas-plataforma.service.ts',root),'utf8');
  const repository=readFileSync(new URL('cuentas-plataforma.repository.ts',root),'utf8');
  assert.equal(domain.includes('.query('),false);
  assert.equal(domain.includes('express'),false);
  assert.equal(service.includes('.query('),false);
  assert.equal(service.includes('express'),false);
  assert.ok(service.includes('validarProteccionCuenta'));
  assert.ok(service.includes('esUltimoAdministradorActivo'));
  assert.ok(repository.includes('FOR UPDATE'));
  assert.ok(repository.includes('ejecutarCambioEstadoCuentaTransaccional'));
  assert.equal(repository.includes('validarProteccionCuenta'),false);
});
