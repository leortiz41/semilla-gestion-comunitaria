import type { PoolClient } from 'pg';
import { databasePool } from '../config/database.js';
import { hashPassword, validateNewPassword, verifyPassword } from '../security/password.js';
import {
  createAccessToken,
  createRefreshToken,
  getAccessTokenTtlSeconds,
  getRefreshTokenExpiresAt,
  hashRefreshToken,
} from '../security/token.js';

interface QueryRunner {
  query: (...args: any[]) => Promise<any>;
}

interface UsuarioRow {
  id: string;
  email: string;
  hash_contrasena: string;
  activo: boolean;
  debe_cambiar_contrasena: boolean;
  nombre: string | null;
}

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nombre: string | null;
  roles: string[];
  permisos: string[];
  debeCambiarContrasena: boolean;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  usuario: UsuarioAutenticado;
}

export class AuthError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function getPool() {
  if (!databasePool) {
    throw new AuthError(503, 'La base de datos no está configurada.');
  }

  return databasePool;
}

async function loadAuthorization(usuarioId: string, runner: QueryRunner): Promise<{
  roles: string[];
  permisos: string[];
}> {
  const rolesResult = await runner.query(
    `SELECT DISTINCT r.nombre
       FROM usuarios_roles ur
       JOIN roles r ON r.id = ur.rol_id
      WHERE ur.usuario_id = $1
        AND r.activo = TRUE
      ORDER BY r.nombre`,
    [usuarioId],
  );

  const permissionsResult = await runner.query(
    `SELECT DISTINCT p.codigo
       FROM usuarios_roles ur
       JOIN roles r ON r.id = ur.rol_id AND r.activo = TRUE
       JOIN roles_permisos rp ON rp.rol_id = r.id
       JOIN permisos p ON p.id = rp.permiso_id
      WHERE ur.usuario_id = $1
      ORDER BY p.codigo`,
    [usuarioId],
  );

  return {
    roles: rolesResult.rows.map((row: { nombre: string }) => row.nombre),
    permisos: permissionsResult.rows.map((row: { codigo: string }) => row.codigo),
  };
}

async function insertRefreshToken(
  runner: QueryRunner,
  usuarioId: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<string> {
  const refreshToken = createRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);

  await runner.query(
    `INSERT INTO tokens_refresco
      (usuario_id, hash_token, expira_en, direccion_ip, agente_usuario)
     VALUES ($1, $2, $3, $4, $5)`,
    [usuarioId, tokenHash, getRefreshTokenExpiresAt(), ipAddress, userAgent],
  );

  return refreshToken;
}

function toAuthenticatedUser(
  usuario: Pick<UsuarioRow, 'id' | 'email' | 'nombre' | 'debe_cambiar_contrasena'>,
  roles: string[],
  permisos: string[],
): UsuarioAutenticado {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    roles,
    permisos,
    debeCambiarContrasena: usuario.debe_cambiar_contrasena,
  };
}

function buildAccessToken(usuario: UsuarioAutenticado): string {
  return createAccessToken({
    usuarioId: usuario.id,
    email: usuario.email,
    roles: usuario.roles,
    permisos: usuario.permisos,
    debeCambiarContrasena: usuario.debeCambiarContrasena,
  });
}

export async function login(
  email: string,
  password: string,
  metadata: { ipAddress: string | null; userAgent: string | null },
): Promise<LoginResult> {
  if (!email.trim() || !password) {
    throw new AuthError(400, 'Correo y contraseña son obligatorios.');
  }

  const pool = getPool();
  const result = await pool.query(
    `SELECT u.id,
            u.email,
            u.hash_contrasena,
            u.activo,
            u.debe_cambiar_contrasena,
            NULLIF(CONCAT_WS(' ', p.primer_nombre, p.primer_apellido), '') AS nombre
       FROM usuarios u
       LEFT JOIN empleados e ON e.id = u.empleado_id
       LEFT JOIN personas p ON p.id = e.persona_id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1`,
    [email.trim()],
  );

  const usuario = result.rows[0] as UsuarioRow | undefined;

  if (!usuario || !usuario.activo || !(await verifyPassword(password, usuario.hash_contrasena))) {
    throw new AuthError(401, 'Credenciales inválidas.');
  }

  const { roles, permisos } = await loadAuthorization(usuario.id, pool);
  const authenticatedUser = toAuthenticatedUser(usuario, roles, permisos);
  const refreshToken = await insertRefreshToken(
    pool,
    usuario.id,
    metadata.ipAddress,
    metadata.userAgent,
  );

  await pool.query('UPDATE usuarios SET ultimo_acceso_en = NOW() WHERE id = $1', [usuario.id]);
  await pool.query(
    `INSERT INTO bitacora_auditoria (usuario_id, accion, nombre_entidad, entidad_id, direccion_ip, agente_usuario)
     VALUES ($1, 'INICIO_SESION', 'usuarios', $1, $2, $3)`,
    [usuario.id, metadata.ipAddress, metadata.userAgent],
  );

  return {
    accessToken: buildAccessToken(authenticatedUser),
    refreshToken,
    expiresIn: getAccessTokenTtlSeconds(),
    usuario: authenticatedUser,
  };
}

export async function refreshSession(
  refreshToken: string,
  metadata: { ipAddress: string | null; userAgent: string | null },
): Promise<LoginResult> {
  if (!refreshToken) {
    throw new AuthError(401, 'No existe una sesión para renovar.');
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT t.id,
              u.id AS usuario_id,
              u.email,
              u.activo,
              u.debe_cambiar_contrasena,
              NULLIF(CONCAT_WS(' ', p.primer_nombre, p.primer_apellido), '') AS nombre
         FROM tokens_refresco t
         JOIN usuarios u ON u.id = t.usuario_id
         LEFT JOIN empleados e ON e.id = u.empleado_id
         LEFT JOIN personas p ON p.id = e.persona_id
        WHERE t.hash_token = $1
          AND t.revocado_en IS NULL
          AND t.expira_en > NOW()
          AND u.activo = TRUE
        FOR UPDATE OF t, u`,
      [hashRefreshToken(refreshToken)],
    );

    const row = result.rows[0] as
      | {
          id: string;
          usuario_id: string;
          email: string;
          debe_cambiar_contrasena: boolean;
          nombre: string | null;
        }
      | undefined;

    if (!row) {
      throw new AuthError(401, 'La sesión ya no es válida.');
    }

    await client.query('UPDATE tokens_refresco SET revocado_en = NOW() WHERE id = $1', [row.id]);

    const { roles, permisos } = await loadAuthorization(row.usuario_id, client);
    const usuario = toAuthenticatedUser(
      {
        id: row.usuario_id,
        email: row.email,
        nombre: row.nombre,
        debe_cambiar_contrasena: row.debe_cambiar_contrasena,
      },
      roles,
      permisos,
    );

    const nextRefreshToken = await insertRefreshToken(
      client,
      row.usuario_id,
      metadata.ipAddress,
      metadata.userAgent,
    );

    await client.query('COMMIT');

    return {
      accessToken: buildAccessToken(usuario),
      refreshToken: nextRefreshToken,
      expiresIn: getAccessTokenTtlSeconds(),
      usuario,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function logout(refreshToken: string | undefined, usuarioId?: string): Promise<void> {
  if (!refreshToken) {
    return;
  }

  const pool = getPool();
  const result = await pool.query(
    `UPDATE tokens_refresco
        SET revocado_en = COALESCE(revocado_en, NOW())
      WHERE hash_token = $1
      RETURNING usuario_id`,
    [hashRefreshToken(refreshToken)],
  );

  const auditedUserId = usuarioId ?? (result.rows[0] as { usuario_id?: string } | undefined)?.usuario_id;

  if (auditedUserId) {
    await pool.query(
      `INSERT INTO bitacora_auditoria (usuario_id, accion, nombre_entidad, entidad_id)
       VALUES ($1, 'CIERRE_SESION', 'usuarios', $1)`,
      [auditedUserId],
    );
  }
}

export async function getCurrentUser(usuarioId: string): Promise<UsuarioAutenticado> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT u.id,
            u.email,
            u.debe_cambiar_contrasena,
            NULLIF(CONCAT_WS(' ', p.primer_nombre, p.primer_apellido), '') AS nombre
       FROM usuarios u
       LEFT JOIN empleados e ON e.id = u.empleado_id
       LEFT JOIN personas p ON p.id = e.persona_id
      WHERE u.id = $1
        AND u.activo = TRUE
      LIMIT 1`,
    [usuarioId],
  );

  const row = result.rows[0] as
    | { id: string; email: string; debe_cambiar_contrasena: boolean; nombre: string | null }
    | undefined;

  if (!row) {
    throw new AuthError(404, 'Usuario no encontrado.');
  }

  const { roles, permisos } = await loadAuthorization(usuarioId, pool);
  return toAuthenticatedUser(row, roles, permisos);
}

export async function changePassword(
  usuarioId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  validateNewPassword(newPassword);

  const pool = getPool();
  const result = await pool.query(
    'SELECT hash_contrasena FROM usuarios WHERE id = $1 AND activo = TRUE LIMIT 1',
    [usuarioId],
  );

  const row = result.rows[0] as { hash_contrasena: string } | undefined;
  if (!row || !(await verifyPassword(currentPassword, row.hash_contrasena))) {
    throw new AuthError(401, 'La contraseña actual no es correcta.');
  }

  const nextHash = await hashPassword(newPassword);
  const client: PoolClient = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE usuarios
          SET hash_contrasena = $1,
              debe_cambiar_contrasena = FALSE,
              actualizado_en = NOW()
        WHERE id = $2`,
      [nextHash, usuarioId],
    );
    await client.query(
      `UPDATE tokens_refresco
          SET revocado_en = COALESCE(revocado_en, NOW())
        WHERE usuario_id = $1`,
      [usuarioId],
    );
    await client.query(
      `INSERT INTO bitacora_auditoria (usuario_id, accion, nombre_entidad, entidad_id)
       VALUES ($1, 'CAMBIO_CONTRASENA', 'usuarios', $1)`,
      [usuarioId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
