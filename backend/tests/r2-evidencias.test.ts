import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firmarObjetoR2, r2Disponible } from '../src/services/r2-evidencias.service.js';

// Credenciales ficticias: no acceden a Cloudflare ni leen secretos de producción.
const variables = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const;
function conVariablesDePrueba(ejecutar: () => void) {
  const anteriores = Object.fromEntries(variables.map((nombre) => [nombre, process.env[nombre]]));
  try {
    process.env.R2_ACCOUNT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    process.env.R2_ACCESS_KEY_ID = 'TESTACCESS';
    process.env.R2_SECRET_ACCESS_KEY = 'TESTSECRET';
    process.env.R2_BUCKET = 'semilla-evidencias-production';
    ejecutar();
  } finally {
    for (const nombre of variables) {
      const anterior = anteriores[nombre];
      if (anterior === undefined) delete process.env[nombre];
      else process.env[nombre] = anterior;
    }
  }
}

test('R2: URLs SigV4 PUT, GET y HEAD usan bucket virtual y firma estable', () => {
  conVariablesDePrueba(() => {
    assert.equal(r2Disponible(), true);
    const clave = 'organizaciones/123/proyectos/456/avances/789/evidencia 1.png';
    const ahora = new Date('2026-11-13T12:00:00Z');
    const put = new URL(firmarObjetoR2(clave, 'PUT', 'image/png', 300, ahora));
    assert.equal(put.hostname, 'semilla-evidencias-production.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com');
    assert.equal(put.pathname, '/organizaciones/123/proyectos/456/avances/789/evidencia%201.png');
    assert.equal(put.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
    assert.equal(put.searchParams.get('X-Amz-Content-Sha256'), 'UNSIGNED-PAYLOAD');
    assert.equal(put.searchParams.get('X-Amz-Credential'), 'TESTACCESS/20261113/auto/s3/aws4_request');
    assert.equal(put.searchParams.get('X-Amz-Date'), '20261113T120000Z');
    assert.equal(put.searchParams.get('X-Amz-Expires'), '300');
    assert.equal(put.searchParams.get('X-Amz-SignedHeaders'), 'content-type;host');
    const firma = put.searchParams.get('X-Amz-Signature');
    assert.match(firma ?? '', /^[0-9a-f]{64}$/);
    assert.equal(firmarObjetoR2(clave, 'PUT', 'image/png', 300, ahora), put.toString());
    assert.notEqual(new URL(firmarObjetoR2(clave, 'PUT', 'image/jpeg', 300, ahora))
      .searchParams.get('X-Amz-Signature'), firma);

    for (const metodo of ['GET', 'HEAD'] as const) {
      const enlace = new URL(firmarObjetoR2(clave, metodo, undefined, 3600, ahora));
      assert.equal(enlace.searchParams.get('X-Amz-SignedHeaders'), 'host');
      assert.equal(enlace.searchParams.get('X-Amz-Expires'), '3600');
      assert.equal(enlace.searchParams.get('X-Amz-Content-Sha256'), 'UNSIGNED-PAYLOAD');
      assert.notEqual(enlace.searchParams.get('X-Amz-Signature'), firma);
    }
    assert.notEqual(
      new URL(firmarObjetoR2(clave, 'GET', undefined, 3600, ahora)).searchParams.get('X-Amz-Signature'),
      new URL(firmarObjetoR2(clave, 'HEAD', undefined, 3600, ahora)).searchParams.get('X-Amz-Signature'),
    );
  });
});

test('R2: parámetros inválidos se rechazan y no se emite URL', () => {
  conVariablesDePrueba(() => {
    for (const clave of ['', '/carpeta/archivo']) {
      assert.throws(() => firmarObjetoR2(clave, 'GET'));
    }
    assert.throws(() => firmarObjetoR2('foto', 'PUT', 'image/png', 0));
    assert.throws(() => firmarObjetoR2('foto', 'GET', undefined, 604801));
  });
});

test('R2: no se generan firmas si faltan credenciales', () => {
  conVariablesDePrueba(() => {
    delete process.env.R2_SECRET_ACCESS_KEY;
    assert.equal(r2Disponible(), false);
    assert.throws(() => firmarObjetoR2('foto', 'GET'), /no configurado/);
  });
});
