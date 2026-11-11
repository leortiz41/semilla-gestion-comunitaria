import { createHmac, createHash } from 'node:crypto';

// Firma AWS Signature V4 para la API S3 compatible de Cloudflare R2.
// Las credenciales nunca salen del backend; el navegador recibe URLs de corta duración.
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest();
const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (c) =>
  '%' + c.charCodeAt(0).toString(16).toUpperCase());

export function r2Disponible() {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

export function firmarObjetoR2(
  clave: string,
  metodo: 'PUT' | 'GET' | 'HEAD',
  mime?: string,
  segundos = 300,
): string {
  if (!r2Disponible()) throw new Error('Almacenamiento R2 no configurado.');
  const account = process.env.R2_ACCOUNT_ID!;
  const bucket = process.env.R2_BUCKET!;
  const endpoint = new URL('https://' + account + '.r2.cloudflarestorage.com');
  const fecha = new Date();
  const amzDate = fecha.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const region = 'auto';
  const scope = date + '/' + region + '/s3/aws4_request';
  const host = endpoint.host;
  const path = '/' + encode(bucket) + '/' + clave.split('/').map(encode).join('/');
  const signedHeaders = mime ? 'content-type;host' : 'host';
  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': process.env.R2_ACCESS_KEY_ID! + '/' + scope,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(segundos),
    'X-Amz-SignedHeaders': signedHeaders,
  });
  const canonicalQuery = [...query.entries()]
    .map(([k, v]) => encode(k) + '=' + encode(v)).sort().join('&');
  const canonicalHeaders = (mime ? 'content-type:' + mime + '\n' : '') + 'host:' + host + '\n';
  const canonicalRequest = [metodo, path, canonicalQuery, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const dateKey = hmac('AWS4' + process.env.R2_SECRET_ACCESS_KEY!, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 's3');
  const signature = createHmac('sha256', hmac(serviceKey, 'aws4_request')).update(toSign).digest('hex');
  return endpoint.origin + path + '?' + canonicalQuery + '&X-Amz-Signature=' + signature;
}

export async function verificarObjetoR2(clave: string, mime: string, maxBytes = 10 * 1024 * 1024) {
  const url = firmarObjetoR2(clave, 'HEAD', undefined, 60);
  const respuesta = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
  if (!respuesta.ok) return false;
  const tamano = Number(respuesta.headers.get('content-length'));
  const tipo = respuesta.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  return Number.isFinite(tamano) && tamano > 0 && tamano <= maxBytes && tipo === mime;
}
