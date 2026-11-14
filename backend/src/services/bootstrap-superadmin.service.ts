import { createHash, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
import { databasePool } from '../config/database.js';
import { hashPassword, validateNewPassword } from '../security/password.js';

export const EMAIL_SUPERADMIN_INICIAL = 'leortiz41@gmail.com';

const MAX_INTENTOS = 5;
const VENTANA_INTENTOS_MS = 15 * 60 * 1000;
const BLOQUEO_MS = 15 * 60 * 1000;

type QueryResult<Row extends object = Record<string, unknown>> = { rows: Row[] };

export interface BootstrapClient {
  query<Row extends object = Record<string, unknown>>(
    query: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
  release(): void;
}

export interface BootstrapPool {
  query<Row extends object = Record<string, unknown>>(
    query: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
  connect(): Promise<BootstrapClient>;
}

interface BootstrapState {
  consumido_en: Date | string | null;
  usuario_id: string | null;
  intentos_fallidos: number;
  ventana_intentos_inicia_en: Date | string | null;
  bloqueado_hasta: Date | string | null;
}

export class BootstrapError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export interface BootstrapDependencies {
  pool?: BootstrapPool;
  installationSecret?: string;
  organizationSlug?: string;
}

function configuredSecret(secret: string | undefined): string | null {
  return secret && secret.length >= 32 ? secret : null;
}

function resolveDependencies(dependencies: BootstrapDependencies) {
  const pool = dependencies.pool ?? (databasePool as Pool | null);
  const installationSecret = configuredSecret(
    dependencies.installationSecret ?? process.env.SEMILLA_BOOTSTRAP_SECRET,
  );
  const organizationSlug = (
    dependencies.organizationSlug ?? process.env.SEMILLA_BOOTSTRAP_ORGANIZACION_SLUG ?? 'ministerio-sal-y-luz'
  ).trim().toLowerCase();

  if (!pool || !installationSecret || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizationSlug)) {
    throw new BootstrapError(503, 'El asistente de configuración inicial no está disponible.');
  }

  return { pool: pool as BootstrapPool, installationSecret, organizationSlug };
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function secretDeInstalacionValido(provided: string, configured: string): boolean {
  const expected = digest(configured);
  const received = digest(provided);
  return timingSafeEqual(expected, received);
}

function asDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function secondsUntil(date: Date | string | null): number {
  const until = asDate(date)?.getTime() ?? Date.now();
  return Math.max(1, Math.ceil((until - Date.now()) / 1000));
}

async function lockedState(client: BootstrapClient): Promise<BootstrapState> {
  try {
    const result = await client.query<BootstrapState>(
      `SELECT consumido_en, usuario_id, intentos_fallidos, ventana_intentos_inicia_en, bloqueado_hasta
         FROM bootstrap_superadministrador
        WHERE id = 1
        FOR UPDATE`,
    );

    const state = result.rows[0];
    if (!state) {
      throw new BootstrapError(503, 'El asistente de configuración inicial no está disponible.');
    }

    return state;
  } catch (error) {
    if (error instanceof BootstrapError) throw error;
    throw new BootstrapError(503, 'El asistente de configuración inicial no está disponible.');
  }
}

async function consumeWhenExistingSuperadmin(client: BootstrapClient): Promise<boolean> {
  const existing = await client.query<{ id: string }>(
    `SELECT u.id
       FROM usuarios u
       JOIN usuarios_roles ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
      WHERE r.nombre = 'SUPERADMINISTRADOR'
      LIMIT 1`,
  );

  if (!existing.rows[0]) return false;

  await client.query(
    `UPDATE bootstrap_superadministrador
        SET consumido_en = COALESCE(consumido_en, NOW()),
            usuario_id = COALESCE(usuario_id, $1),
            actualizado_en = NOW()
      WHERE id = 1`,
    [existing.rows[0].id],
  );
  return true;
}

async function registerFailedAttempt(client: BootstrapClient, state: BootstrapState): Promise<number | undefined> {
  const now = new Date();
  const windowStart = asDate(state.ventana_intentos_inicia_en);
  const windowExpired = !windowStart || now.getTime() - windowStart.getTime() >= VENTANA_INTENTOS_MS;
  const attempts = (windowExpired ? 0 : state.intentos_fallidos) + 1;
  const blockedUntil = attempts >= MAX_INTENTOS ? new Date(now.getTime() + BLOQUEO_MS) : null;

  await client.query(
    `UPDATE bootstrap_superadministrador
        SET intentos_fallidos = $1,
            ventana_intentos_inicia_en = $2,
            bloqueado_hasta = $3,
            ultimo_intento_en = $4,
            actualizado_en = $4
      WHERE id = 1`,
    [attempts, windowExpired ? now : windowStart, blockedUntil, now],
  );

  return blockedUntil ? secondsUntil(blockedUntil) : undefined;
}

export async function estadoBootstrapSuperadmin(
  dependencies: BootstrapDependencies = {},
): Promise<{ disponible: boolean }> {
  let resolved: ReturnType<typeof resolveDependencies>;
  try {
    resolved = resolveDependencies(dependencies);
  } catch {
    return { disponible: false };
  }

  try {
    const [state, superadmin] = await Promise.all([
      resolved.pool.query<Pick<BootstrapState, 'consumido_en'>>(
        'SELECT consumido_en FROM bootstrap_superadministrador WHERE id = 1',
      ),
      resolved.pool.query(
        `SELECT 1
           FROM usuarios_roles ur
           JOIN roles r ON r.id = ur.rol_id
          WHERE r.nombre = 'SUPERADMINISTRADOR'
          LIMIT 1`,
      ),
    ]);
    return { disponible: Boolean(state.rows[0]) && !state.rows[0].consumido_en && !superadmin.rows.length };
  } catch {
    return { disponible: false };
  }
}

export async function crearSuperadminInicial(
  input: { secretoInstalacion: string; contrasena: string; direccionIp: string | null; agenteUsuario: string | null },
  dependencies: BootstrapDependencies = {},
): Promise<{ email: string }> {
  if (
    typeof input.secretoInstalacion !== 'string' ||
    typeof input.contrasena !== 'string' ||
    input.secretoInstalacion.length > 512 ||
    input.contrasena.length > 256
  ) {
    throw new BootstrapError(400, 'Datos de configuración inválidos.');
  }

  try {
    validateNewPassword(input.contrasena);
  } catch (error) {
    throw new BootstrapError(400, error instanceof Error ? error.message : 'La contraseña no es válida.');
  }

  const { pool, installationSecret, organizationSlug } = resolveDependencies(dependencies);
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const state = await lockedState(client);

    if (state.consumido_en || await consumeWhenExistingSuperadmin(client)) {
      await client.query('COMMIT');
      transactionOpen = false;
      throw new BootstrapError(410, 'La configuración inicial ya no está disponible.');
    }

    const blockedUntil = asDate(state.bloqueado_hasta);
    if (blockedUntil && blockedUntil.getTime() > Date.now()) {
      await client.query('COMMIT');
      transactionOpen = false;
      throw new BootstrapError(429, 'Demasiados intentos. Espera antes de volver a intentarlo.', secondsUntil(blockedUntil));
    }

    if (!secretDeInstalacionValido(input.secretoInstalacion, installationSecret)) {
      const retryAfterSeconds = await registerFailedAttempt(client, state);
      await client.query('COMMIT');
      transactionOpen = false;
      if (retryAfterSeconds) {
        throw new BootstrapError(429, 'Demasiados intentos. Espera antes de volver a intentarlo.', retryAfterSeconds);
      }
      throw new BootstrapError(401, 'No fue posible validar el secreto de instalación.');
    }

    const organization = await client.query<{ id: string }>(
      'SELECT id FROM organizaciones WHERE slug = $1 AND activo = TRUE FOR UPDATE',
      [organizationSlug],
    );
    const role = await client.query<{ id: string }>(
      "SELECT id FROM roles WHERE nombre = 'SUPERADMINISTRADOR' AND activo = TRUE LIMIT 1",
    );
    const existingEmail = await client.query(
      'SELECT 1 FROM usuarios WHERE LOWER(email) = $1 LIMIT 1',
      [EMAIL_SUPERADMIN_INICIAL],
    );

    if (!organization.rows[0] || !role.rows[0]) {
      throw new BootstrapError(503, 'La configuración inicial no está lista para crear la cuenta.');
    }
    if (existingEmail.rows.length) {
      throw new BootstrapError(409, 'No fue posible completar la configuración inicial.');
    }

    const passwordHash = await hashPassword(input.contrasena);
    const user = await client.query<{ id: string }>(
      `INSERT INTO usuarios (email, hash_contrasena, organizacion_id, debe_cambiar_contrasena)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id`,
      [EMAIL_SUPERADMIN_INICIAL, passwordHash, organization.rows[0].id],
    );
    await client.query(
      'INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, $2)',
      [user.rows[0].id, role.rows[0].id],
    );
    await client.query(
      `INSERT INTO bitacora_auditoria
        (usuario_id, accion, nombre_entidad, entidad_id, valores_nuevos, direccion_ip, agente_usuario)
       VALUES ($1, 'BOOTSTRAP_SUPERADMIN_GRAFICO', 'usuarios', $1, $2::jsonb, $3, $4)`,
      [
        user.rows[0].id,
        JSON.stringify({ rol: 'SUPERADMINISTRADOR', organizacionIdentidad: organizationSlug }),
        input.direccionIp,
        input.agenteUsuario,
      ],
    );
    await client.query(
      `UPDATE bootstrap_superadministrador
          SET consumido_en = NOW(),
              usuario_id = $1,
              intentos_fallidos = 0,
              bloqueado_hasta = NULL,
              ultimo_intento_en = NOW(),
              actualizado_en = NOW()
        WHERE id = 1`,
      [user.rows[0].id],
    );
    await client.query('COMMIT');
    transactionOpen = false;
    return { email: EMAIL_SUPERADMIN_INICIAL };
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
