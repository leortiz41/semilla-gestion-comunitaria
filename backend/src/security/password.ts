import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const VERSION = 'v1';
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

export function validateNewPassword(password: string): void {
  if (password.length < 12) {
    throw new Error('La contraseña debe contener al menos 12 caracteres.');
  }

  if (!/[A-ZÁÉÍÓÚÑ]/u.test(password) || !/[a-záéíóúñ]/u.test(password) || !/\d/u.test(password)) {
    throw new Error('La contraseña debe incluir mayúsculas, minúsculas y números.');
  }
}

export async function hashPassword(password: string): Promise<string> {
  validateNewPassword(password);

  const salt = randomBytes(16);
  const hash = await deriveKey(password, salt);

  return `scrypt$${VERSION}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, version, saltEncoded, hashEncoded] = encodedHash.split('$');

  if (algorithm !== 'scrypt' || version !== VERSION || !saltEncoded || !hashEncoded) {
    return false;
  }

  try {
    const salt = Buffer.from(saltEncoded, 'base64url');
    const expectedHash = Buffer.from(hashEncoded, 'base64url');
    const actualHash = await deriveKey(password, salt);

    return expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash);
  } catch {
    return false;
  }
}
