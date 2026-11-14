import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import {
  BootstrapError,
  crearSuperadminInicial,
  EMAIL_SUPERADMIN_INICIAL,
  estadoBootstrapSuperadmin,
  secretDeInstalacionValido,
  type BootstrapPool,
} from '../src/services/bootstrap-superadmin.service.js';

const secreto = 'secreto-de-instalacion-de-prueba-con-32-caracteres';

async function crearBasePrueba() {
  const db = new PGlite();
  const leerMigracion = async (nombre: string) => (
    await readFile(new URL(`../../database/sql/${nombre}.sql`, import.meta.url), 'utf8')
  ).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '');

  for (const migracion of [
    '001_esquema_inicial',
    '002_configurar_roles_permisos',
    '003_multi_organizacion_base',
    '024_superadministracion_plataforma',
    '025_bootstrap_superadministrador_unico',
  ]) {
    await db.exec(await leerMigracion(migracion));
  }

  const query = async <Row extends object = Record<string, unknown>>(sql: string, values?: unknown[]) => {
    const result = await db.query(sql, values as never[] | undefined);
    return { rows: result.rows as Row[] };
  };
  const pool: BootstrapPool = {
    query,
    connect: async () => ({ query, release() {} }),
  };

  return { db, pool };
}

function entrada(secretoInstalacion = secreto) {
  return {
    secretoInstalacion,
    contrasena: 'SemillaInicial123',
    direccionIp: '127.0.0.1',
    agenteUsuario: 'test',
  };
}

test('bootstrap gráfico crea solo leortiz41@gmail.com y se consume en la misma transacción', async () => {
  const { db, pool } = await crearBasePrueba();
  try {
    const dependencies = { pool, installationSecret: secreto, organizationSlug: 'ministerio-sal-y-luz' };
    assert.deepEqual(await estadoBootstrapSuperadmin(dependencies), { disponible: true });

    const resultado = await crearSuperadminInicial(entrada(), dependencies);
    assert.equal(resultado.email, EMAIL_SUPERADMIN_INICIAL);
    assert.equal(
      (await db.query<{ total: number }>(
        `SELECT count(*)::int AS total
           FROM usuarios u
           JOIN usuarios_roles ur ON ur.usuario_id = u.id
           JOIN roles r ON r.id = ur.rol_id
          WHERE u.email = $1 AND r.nombre = 'SUPERADMINISTRADOR'`,
        [EMAIL_SUPERADMIN_INICIAL],
      )).rows[0].total,
      1,
    );
    assert.equal(
      (await db.query<{ total: number }>('SELECT count(*)::int AS total FROM bootstrap_superadministrador WHERE consumido_en IS NOT NULL'))
        .rows[0].total,
      1,
    );
    assert.deepEqual(await estadoBootstrapSuperadmin(dependencies), { disponible: false });

    await assert.rejects(
      crearSuperadminInicial(entrada(), dependencies),
      (error: unknown) => error instanceof BootstrapError && error.statusCode === 410,
    );
  } finally {
    await db.close();
  }
});

test('bootstrap gráfico limita intentos fallidos y compara secretos sin exponerlos', async () => {
  const { db, pool } = await crearBasePrueba();
  try {
    const dependencies = { pool, installationSecret: secreto, organizationSlug: 'ministerio-sal-y-luz' };
    assert.equal(secretDeInstalacionValido(secreto, secreto), true);
    assert.equal(secretDeInstalacionValido('otro-secreto-con-32-caracteres-----', secreto), false);

    for (let intento = 1; intento < 5; intento += 1) {
      await assert.rejects(
        crearSuperadminInicial(entrada('otro-secreto-con-32-caracteres-----'), dependencies),
        (error: unknown) => error instanceof BootstrapError && error.statusCode === 401,
      );
    }
    await assert.rejects(
      crearSuperadminInicial(entrada('otro-secreto-con-32-caracteres-----'), dependencies),
      (error: unknown) => error instanceof BootstrapError && error.statusCode === 429 && Boolean(error.retryAfterSeconds),
    );
    assert.equal(
      (await db.query<{ intentos_fallidos: number }>('SELECT intentos_fallidos FROM bootstrap_superadministrador'))
        .rows[0].intentos_fallidos,
      5,
    );
    assert.equal((await db.query('SELECT id FROM usuarios')).rows.length, 0);
  } finally {
    await db.close();
  }
});
