import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticarErrorR2, firmarObjetoR2, r2Disponible } from '../src/services/r2-evidencias.service.js';

const keys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const;

// Solo credenciales ficticias: no se envían solicitudes a una cuenta real.
async function conConfig(accion: () => Promise<void>) {
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    process.env.R2_ACCOUNT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    process.env.R2_ACCESS_KEY_ID = 'FAKEKEY123';
    process.env.R2_SECRET_ACCESS_KEY = 'ficticia-solo-para-pruebas';
    process.env.R2_BUCKET = 'semilla-evidencias-production';
    await accion();
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test('SDK R2: firma PUT con bucket, clave, tipo, región y expiración', async () => {
  await conConfig(async () => {
    assert.equal(r2Disponible(), true);
    const clave = 'organizaciones/demo/proyectos/123/avances/456/imagen 1.png';
    const enlace = new URL(await firmarObjetoR2(clave, 'PUT', 'image/png', 300));
    assert.equal(enlace.protocol, 'https:');
    // El cliente R2 usa forcePathStyle: el bucket va en la ruta, no en el host.
    assert.equal(enlace.hostname,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com');
    assert.equal(decodeURIComponent(enlace.pathname), '/semilla-evidencias-production/' + clave);
    assert.equal(enlace.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
    assert.match(enlace.searchParams.get('X-Amz-Credential') ?? '',
      /^FAKEKEY123\/\d{8}\/auto\/s3\/aws4_request$/);
    assert.equal(enlace.searchParams.get('X-Amz-Expires'), '300');
    assert.match(enlace.searchParams.get('X-Amz-Signature') ?? '', /^[a-f\d]{64}$/);
    assert.equal(enlace.searchParams.get('X-Amz-Content-Sha256'), 'UNSIGNED-PAYLOAD');
    assert.ok(enlace.searchParams.get('X-Amz-SignedHeaders')?.includes('host'));
  });
});

test('SDK R2: firmas GET y HEAD se diferencian y mantienen acceso privado', async () => {
  await conConfig(async () => {
    const clave = 'organizaciones/demo/avances/test/foto.webp';
    const get = new URL(await firmarObjetoR2(clave, 'GET', undefined, 3600));
    const head = new URL(await firmarObjetoR2(clave, 'HEAD', undefined, 60));
    assert.equal(get.searchParams.get('X-Amz-Expires'), '3600');
    assert.equal(head.searchParams.get('X-Amz-Expires'), '60');
    assert.notEqual(get.searchParams.get('X-Amz-Signature'), head.searchParams.get('X-Amz-Signature'));
    assert.ok(get.searchParams.has('X-Amz-Credential'));
    assert.ok(head.searchParams.has('X-Amz-Credential'));
  });
});

test('SDK R2: rechaza claves peligrosas, MIME no permitido y TTL inválido', async () => {
  await conConfig(async () => {
    for (const clave of ['', '/absoluta', 'carpeta/../archivo', 'carpeta//archivo']) {
      await assert.rejects(firmarObjetoR2(clave, 'GET'));
    }
    await assert.rejects(firmarObjetoR2('archivo', 'PUT', 'application/pdf'));
    await assert.rejects(firmarObjetoR2('archivo', 'GET', undefined, 0));
    await assert.rejects(firmarObjetoR2('archivo', 'GET', undefined, 604801));
    delete process.env.R2_SECRET_ACCESS_KEY;
    assert.equal(r2Disponible(), false);
    await assert.rejects(firmarObjetoR2('archivo', 'GET'), /no configurado/);
  });
});

test('Diagnóstico R2: clasifica errores anidados por categoría sin publicar mensajes privados', () => {
  const errorTls = {
    name: 'Error',
    cause: {
      name: 'EPROTO',
      message: 'dato privado no debe ser expuesto',
      $metadata: { httpStatusCode: 503 },
    },
  };
  assert.deepEqual(diagnosticarErrorR2(errorTls), {
    categoria: 'TLS_CERTIFICADO', codigo: 'EPROTO', estado: 503,
  });

  const errorPermiso = {
    name: 'Error',
    errors: [{ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } }],
  };
  assert.deepEqual(diagnosticarErrorR2(errorPermiso), {
    categoria: 'CREDENCIALES_O_PERMISOS', codigo: 'AccessDenied', estado: 403,
  });

  const errorSinCodigo = { name: 'Error', $metadata: { httpStatusCode: 404 } };
  assert.deepEqual(diagnosticarErrorR2(errorSinCodigo), {
    categoria: 'BUCKET', codigo: 'DESCONOCIDO', estado: 404,
  });

  const errorConSecreto = {
    name: 'Error',
    code: 'ClavePrivada?token=NO_PUBLICAR',
    message: 'https://example.test/objeto?firma=secreta',
  };
  const diagnostico = diagnosticarErrorR2(errorConSecreto);
  assert.equal(diagnostico.codigo, 'DESCONOCIDO');
  assert.equal(diagnostico.categoria, 'ALMACENAMIENTO');
  assert.ok(!JSON.stringify(diagnostico).includes('NO_PUBLICAR'));
  assert.ok(!JSON.stringify(diagnostico).includes('secreta'));
});

test('Diagnóstico R2: tolera valores inesperados y limita la inspección anidada', () => {
  assert.deepEqual(diagnosticarErrorR2(null), {
    categoria: 'ALMACENAMIENTO', codigo: 'DESCONOCIDO', estado: null,
  });
  let causa: unknown = { name: 'ENOTFOUND' };
  for (let profundidad = 0; profundidad < 9; profundidad++) {
    causa = { name: 'Error', cause: causa };
  }
  const resultado = diagnosticarErrorR2(causa);
  assert.equal(resultado.categoria, 'ALMACENAMIENTO');
  assert.equal(resultado.estado, null);
});
