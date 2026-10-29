import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const JWT_ISSUER = 'semilla-api';
const JWT_AUDIENCE = 'semilla-web';
const DEFAULT_ACCESS_MINUTES = 15;
const DEFAULT_REFRESH_DAYS = 30;

export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: string[];
  permisos: string[];
  debeCambiarContrasena: boolean;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
}

interface AccessTokenInput {
  usuarioId: string;
  email: string;
  roles: string[];
  permisos: string[];
  debeCambiarContrasena: boolean;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET debe estar configurado con al menos 32 caracteres.');
  }

  return secret;
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAccessTokenTtlSeconds(): number {
  const minutes = positiveNumber(process.env.JWT_EXPIRES_IN_MINUTES, DEFAULT_ACCESS_MINUTES);
  return Math.floor(minutes * 60);
}

export function getRefreshTokenTtlMs(): number {
  const days = positiveNumber(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS, DEFAULT_REFRESH_DAYS);
  return Math.floor(days * 24 * 60 * 60 * 1000);
}

export function getRefreshTokenExpiresAt(): Date {
  return new Date(Date.now() + getRefreshTokenTtlMs());
}

function encodeJson(value: object): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function sign(unsignedToken: string): string {
  return createHmac('sha256', getJwtSecret()).update(unsignedToken).digest('base64url');
}

export function createAccessToken(input: AccessTokenInput): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + getAccessTokenTtlSeconds();

  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson({
    sub: input.usuarioId,
    email: input.email,
    roles: input.roles,
    permisos: input.permisos,
    debeCambiarContrasena: input.debeCambiarContrasena,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: issuedAt,
    exp: expiresAt,
    jti: randomUUID(),
  });

  const unsignedToken = `${header}.${payload}`;
  return `${unsignedToken}.${sign(unsignedToken)}`;
}

function parseJsonPart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token inválido.');
  }

  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  const header = parseJsonPart(headerPart);

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Algoritmo de token no permitido.');
  }

  const unsignedToken = `${headerPart}.${payloadPart}`;
  const expectedSignature = Buffer.from(sign(unsignedToken), 'base64url');
  const receivedSignature = Buffer.from(signaturePart, 'base64url');

  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    throw new Error('Firma de token inválida.');
  }

  const payload = parseJsonPart(payloadPart);
  const now = Math.floor(Date.now() / 1000);

  if (
    payload.iss !== JWT_ISSUER ||
    payload.aud !== JWT_AUDIENCE ||
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string' ||
    !Array.isArray(payload.roles) ||
    !Array.isArray(payload.permisos) ||
    typeof payload.debeCambiarContrasena !== 'boolean' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    typeof payload.jti !== 'string' ||
    payload.exp <= now
  ) {
    throw new Error('Token expirado o inválido.');
  }

  return payload as unknown as AccessTokenClaims;
}

export function createRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
