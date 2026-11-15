import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { verifyPassword } from '../src/security/password.js';
import {
  ErrorCredencialTemporal,
  reemitirCredencialTemporalAdministrador,
  type ConjuntoConexionesCredencialesTemporales,
} from '../src/services/credenciales-temporales.service.js';

function conexionesDePrueba(db: PGlite): ConjuntoConexionesCredencialesTemporales {
  const query = async <Fila extends object = Record<string, unknown>>(consulta: string, valores?: unknown[]) => {
    const resultado = await db.query(consulta, valores);
    return { rows: resultado.rows as Fila[] };
  };
  return { connect: async () => ({ query, release() {} }) };
}

async function crearEscenario(rolesCuenta: string[]) {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE organizaciones (id uuid PRIMARY KEY, activo boolean NOT NULL DEFAULT TRUE);
    CREATE TABLE usuarios (
      id uuid PRIMARY KEY, email text NOT NULL, hash_contrasena text NOT NULL,
      organizacion_id uuid NOT NULL, activo boolean NOT NULL DEFAULT TRUE,
      debe_cambiar_contrasena boolean NOT NULL DEFAULT FALSE, actualizado_en timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE TABLE roles (id uuid PRIMARY KEY, nombre text NOT NULL, activo boolean NOT NULL DEFAULT TRUE);
    CREATE TABLE usuarios_roles (usuario_id uuid NOT NULL, rol_id uuid NOT NULL);
    CREATE TABLE tokens_refresco (id uuid PRIMARY KEY, usuario_id uuid NOT NULL, revocado_en timestamptz);
    CREATE TABLE bitacora_auditoria (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid, accion text NOT NULL, nombre_entidad text NOT NULL,
      entidad_id uuid NOT NULL, valores_nuevos jsonb
    );
  `);
  const organizacionId = randomUUID();
  const administradorId = randomUUID();
  const superadministradorId = randomUUID();
  await db.query('INSERT INTO organizaciones(id,activo) VALUES($1,TRUE)', [organizacionId]);
  await db.query(
    `INSERT INTO usuarios(id,email,hash_contrasena,organizacion_id,activo,debe_cambiar_contrasena)
     VALUES($1,$2,$3,$4,TRUE,FALSE)`,
    [administradorId, 'admin@tenant.test', 'hash-anterior', organizacionId],
  );
  await db.query(
    `INSERT INTO usuarios(id,email,hash_contrasena,organizacion_id,activo,debe_cambiar_contrasena)
     VALUES($1,$2,$3,$4,TRUE,FALSE)`,
    [superadministradorId, 'super@semilla.test', 'hash-super', organizacionId],
  );
  for (const nombre of new Set([...rolesCuenta, 'SUPERADMINISTRADOR'])) {
    await db.query('INSERT INTO roles(id,nombre,activo) VALUES($1,$2,TRUE)', [randomUUID(), nombre]);
  }
  const roles = await db.query<{ id: string; nombre: string }>('SELECT id,nombre FROM roles');
  for (const nombre of rolesCuenta) {
    const rol = roles.rows.find((fila) => fila.nombre === nombre)!;
    await db.query('INSERT INTO usuarios_roles(usuario_id,rol_id) VALUES($1,$2)', [administradorId, rol.id]);
  }
  const rolSuper = roles.rows.find((fila) => fila.nombre === 'SUPERADMINISTRADOR')!;
  await db.query('INSERT INTO usuarios_roles(usuario_id,rol_id) VALUES($1,$2)', [superadministradorId, rolSuper.id]);
  await db.query('INSERT INTO tokens_refresco(id,usuario_id) VALUES($1,$2)', [randomUUID(), administradorId]);

  return { db, organizacionId, administradorId, superadministradorId };
}

test('Reemitir la credencial de un administrador fuerza cambio, revoca sesiones y audita sin guardar la contraseña', async () => {
  const escenario = await crearEscenario(['ADMINISTRADOR', 'COORDINADOR']);
  try {
    const respuesta = await reemitirCredencialTemporalAdministrador(
      {
        organizacionId: escenario.organizacionId,
        usuarioId: escenario.administradorId,
        superadministradorId: escenario.superadministradorId,
      },
      conexionesDePrueba(escenario.db),
    );

    assert.equal(respuesta.cuenta.email, 'admin@tenant.test');
    assert.equal(respuesta.cuenta.debeCambiarContrasena, true);
    assert.ok(respuesta.cuenta.roles.includes('ADMINISTRADOR'));
    assert.match(respuesta.contrasenaTemporal, /^Aa1-/);
    const usuario = await escenario.db.query<{ hash_contrasena: string; debe_cambiar_contrasena: boolean }>(
      'SELECT hash_contrasena,debe_cambiar_contrasena FROM usuarios WHERE id=$1',
      [escenario.administradorId],
    );
    assert.equal(usuario.rows[0].debe_cambiar_contrasena, true);
    assert.equal(await verifyPassword(respuesta.contrasenaTemporal, usuario.rows[0].hash_contrasena), true);
    const token = await escenario.db.query<{ revocado_en: string | null }>(
      'SELECT revocado_en FROM tokens_refresco WHERE usuario_id=$1',
      [escenario.administradorId],
    );
    assert.notEqual(token.rows[0].revocado_en, null);
    const auditoria = await escenario.db.query<{ accion: string; valores_nuevos: unknown }>(
      'SELECT accion,valores_nuevos FROM bitacora_auditoria WHERE entidad_id=$1',
      [escenario.administradorId],
    );
    assert.equal(auditoria.rows[0].accion, 'PLATAFORMA_REEMITIR_CREDENCIAL_TEMPORAL');
    assert.equal(JSON.stringify(auditoria.rows[0].valores_nuevos).includes(respuesta.contrasenaTemporal), false);
  } finally {
    await escenario.db.close();
  }
});

test('No permite reemitir credenciales de cuentas que no son administradoras', async () => {
  const escenario = await crearEscenario(['COORDINADOR']);
  try {
    await assert.rejects(
      reemitirCredencialTemporalAdministrador(
        {
          organizacionId: escenario.organizacionId,
          usuarioId: escenario.administradorId,
          superadministradorId: escenario.superadministradorId,
        },
        conexionesDePrueba(escenario.db),
      ),
      (error: unknown) => error instanceof ErrorCredencialTemporal && error.codigoEstado === 409,
    );
    const usuario = await escenario.db.query<{ hash_contrasena: string; debe_cambiar_contrasena: boolean }>(
      'SELECT hash_contrasena,debe_cambiar_contrasena FROM usuarios WHERE id=$1',
      [escenario.administradorId],
    );
    assert.equal(usuario.rows[0].hash_contrasena, 'hash-anterior');
    assert.equal(usuario.rows[0].debe_cambiar_contrasena, false);
    const token = await escenario.db.query<{ revocado_en: string | null }>(
      'SELECT revocado_en FROM tokens_refresco WHERE usuario_id=$1',
      [escenario.administradorId],
    );
    assert.equal(token.rows[0].revocado_en, null);
  } finally {
    await escenario.db.close();
  }
});
