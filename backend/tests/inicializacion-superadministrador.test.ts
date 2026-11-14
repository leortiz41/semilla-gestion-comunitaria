import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import {
  ErrorInicializacion,
  crearSuperadministradorInicial,
  CORREO_SUPERADMINISTRADOR_INICIAL,
  estadoInicializacionSuperadministrador,
  secretoDeInstalacionValido,
  type ConjuntoConexionesInicializacion,
} from '../src/services/inicializacion-superadministrador.service.js';

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
    '025_inicializacion_superadministrador_unico',
  ]) {
    await db.exec(await leerMigracion(migracion));
  }

  const consultar = async <Fila extends object = Record<string, unknown>>(sql: string, valores?: unknown[]) => {
    const resultado = await db.query(sql, valores as never[] | undefined);
    return { rows: resultado.rows as Fila[] };
  };
  const conexiones: ConjuntoConexionesInicializacion = {
    query: consultar,
    connect: async () => ({ query: consultar, release() {} }),
  };

  return { db, conexiones };
}

function entrada(secretoInstalacion = secreto) {
  return {
    secretoInstalacion,
    contrasena: 'SemillaInicial123',
    direccionIp: '127.0.0.1',
    agenteUsuario: 'test',
  };
}

test('inicialización gráfica crea solo leortiz41@gmail.com y se consume en la misma transacción', async () => {
  const { db, conexiones } = await crearBasePrueba();
  try {
    const dependencias = { conexiones, secretoInstalacion: secreto, identificadorOrganizacion: 'ministerio-sal-y-luz' };
    assert.deepEqual(await estadoInicializacionSuperadministrador(dependencias), { disponible: true });

    const resultado = await crearSuperadministradorInicial(entrada(), dependencias);
    assert.equal(resultado.email, CORREO_SUPERADMINISTRADOR_INICIAL);
    assert.equal(
      (await db.query<{ total: number }>(
        `SELECT count(*)::int AS total
           FROM usuarios u
           JOIN usuarios_roles ur ON ur.usuario_id = u.id
           JOIN roles r ON r.id = ur.rol_id
          WHERE u.email = $1 AND r.nombre = 'SUPERADMINISTRADOR'`,
        [CORREO_SUPERADMINISTRADOR_INICIAL],
      )).rows[0].total,
      1,
    );
    assert.equal(
      (await db.query<{ total: number }>('SELECT count(*)::int AS total FROM inicializacion_superadministrador WHERE consumido_en IS NOT NULL'))
        .rows[0].total,
      1,
    );
    assert.deepEqual(await estadoInicializacionSuperadministrador(dependencias), { disponible: false });

    await assert.rejects(
      crearSuperadministradorInicial(entrada(), dependencias),
      (error: unknown) => error instanceof ErrorInicializacion && error.codigoEstado === 410,
    );
  } finally {
    await db.close();
  }
});

test('inicialización gráfica limita intentos fallidos y compara secretos sin exponerlos', async () => {
  const { db, conexiones } = await crearBasePrueba();
  try {
    const dependencias = { conexiones, secretoInstalacion: secreto, identificadorOrganizacion: 'ministerio-sal-y-luz' };
    assert.equal(secretoDeInstalacionValido(secreto, secreto), true);
    assert.equal(secretoDeInstalacionValido('otro-secreto-con-32-caracteres-----', secreto), false);

    for (let intento = 1; intento < 5; intento += 1) {
      await assert.rejects(
        crearSuperadministradorInicial(entrada('otro-secreto-con-32-caracteres-----'), dependencias),
        (error: unknown) => error instanceof ErrorInicializacion && error.codigoEstado === 401,
      );
    }
    await assert.rejects(
      crearSuperadministradorInicial(entrada('otro-secreto-con-32-caracteres-----'), dependencias),
      (error: unknown) => error instanceof ErrorInicializacion && error.codigoEstado === 429 && Boolean(error.segundosReintento),
    );
    assert.equal(
      (await db.query<{ intentos_fallidos: number }>('SELECT intentos_fallidos FROM inicializacion_superadministrador'))
        .rows[0].intentos_fallidos,
      5,
    );
    assert.equal((await db.query('SELECT id FROM usuarios')).rows.length, 0);
  } finally {
    await db.close();
  }
});
