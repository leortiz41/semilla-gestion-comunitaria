import {
  GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Integración S3 oficial de Cloudflare R2. Nunca enviar credenciales al navegador.
// Cada operación usa el bucket y token del entorno actual de Render o del backend local.
function configuracionR2() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('Almacenamiento R2 no configurado.');
  }
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/i.test(bucket)) {
    throw new Error('La configuración R2 del servidor no es válida.');
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function clienteR2() {
  const config = configuracionR2();
  return {
    bucket: config.bucket,
    cliente: new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: false,
      maxAttempts: 2,
    }),
  };
}

export function r2Disponible() {
  try { configuracionR2(); return true; }
  catch { return false; }
}

function validarClave(clave: string) {
  if (!clave || clave.startsWith('/') || clave.includes('..') || clave.includes('\\') ||
      clave.split('/').some((segmento) => !segmento)) {
    throw new Error('La clave del objeto R2 no es válida.');
  }
}

export async function firmarObjetoR2(
  clave: string,
  metodo: 'PUT' | 'GET' | 'HEAD',
  mime?: string,
  segundos = 300,
): Promise<string> {
  validarClave(clave);
  if (!Number.isInteger(segundos) || segundos < 1 || segundos > 604800) {
    throw new Error('La duración del enlace R2 no es válida.');
  }
  if (metodo === 'PUT' && !['image/jpeg', 'image/png', 'image/webp'].includes(mime ?? '')) {
    throw new Error('El tipo de fotografía no está permitido.');
  }

  const { cliente, bucket } = clienteR2();
  try {
    const entrada = { Bucket: bucket, Key: clave };
    const comando = metodo === 'PUT'
      ? new PutObjectCommand({ ...entrada, ContentType: mime })
      : metodo === 'GET'
        ? new GetObjectCommand(entrada)
        : new HeadObjectCommand(entrada);
    return await getSignedUrl(cliente, comando, { expiresIn: segundos });
  } finally {
    cliente.destroy();
  }
}

// La confirmación NO depende de un enlace HEAD firmado ni del CORS del navegador.
// El backend consulta directamente a R2 con las credenciales privadas.
export async function verificarObjetoR2(clave: string, mime: string, maxBytes = 10 * 1024 * 1024) {
  validarClave(clave);
  const { cliente, bucket } = clienteR2();
  try {
    const respuesta = await cliente.send(new HeadObjectCommand({ Bucket: bucket, Key: clave }));
    const tamano = respuesta.ContentLength;
    const tipo = respuesta.ContentType?.split(';')[0]?.trim().toLowerCase();
    return typeof tamano === 'number' && tamano > 0 && tamano <= maxBytes && tipo === mime;
  } catch (error) {
    // Solo datos diagnósticos no sensibles. Evitar imprimir urls prefirmadas o claves de API.
    const codigo = error instanceof Error ? error.name : 'ErrorDesconocido';
    console.warn('R2: verificación HEAD rechazada:', codigo);
    return false;
  } finally {
    cliente.destroy();
  }
}
