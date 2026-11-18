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
      // Cloudflare R2: usar /bucket/clave sobre el dominio de cuenta.
      // Evita el host bucket.account.r2.cloudflarestorage.com que puede fallar TLS.
      forcePathStyle: true,
      // Evitar CRC32 de carga vacía al firmar PUT sin disponer aún del archivo.
      // El checksum opcional generado por defecto provoca 403 en R2 con URLs prefirmadas.
      requestChecksumCalculation: 'WHEN_REQUIRED',
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


// Transferencia privada desde el backend: evita conexiones directas navegador → R2.
export async function cargarObjetoR2(clave: string, mime: string, datos: Buffer) {
  validarClave(clave);
  if (!['image/jpeg','image/png','image/webp'].includes(mime) ||
      !datos.length || datos.length > 10 * 1024 * 1024) {
    throw new Error('Archivo de evidencia inválido.');
  }
  const {cliente,bucket}=clienteR2();
  try {
    await cliente.send(new PutObjectCommand({
      Bucket:bucket,Key:clave,Body:datos,ContentType:mime,
    }));
  } finally {cliente.destroy();}
}

export async function leerObjetoR2(clave: string): Promise<{datos:Uint8Array;mime:string}> {
  validarClave(clave);
  const {cliente,bucket}=clienteR2();
  try {
    const salida=await cliente.send(new GetObjectCommand({Bucket:bucket,Key:clave}));
    if (!salida.Body || !['image/jpeg','image/png','image/webp'].includes(
      salida.ContentType?.split(';')[0]?.trim().toLowerCase() || ''
    ) || (salida.ContentLength??0)>10*1024*1024) {
      throw new Error('Objeto de imagen no válido.');
    }
    const datos=await salida.Body.transformToByteArray();
    if (!datos.length || datos.length>10*1024*1024)throw new Error('Imagen demasiado grande.');
    return {datos,mime:salida.ContentType!.split(';')[0].trim().toLowerCase()};
  } finally {cliente.destroy();}
}


// Diagnóstico sin secretos: examina causas anidadas de los errores del SDK S3.
export function diagnosticarErrorR2(error: unknown): {categoria:string;codigo:string;estado:number|null} {
  const visitar=(valor:unknown,nivel:number):{codigos:string[];estado:number|null}=>{
    if(!valor||typeof valor!=='object'||nivel>5)return {codigos:[],estado:null};
    const e=valor as {
      name?:unknown;code?:unknown;cause?:unknown;errors?:unknown;
      $metadata?:{httpStatusCode?:number};
    };
    const propios=[e.code,e.name].filter((v):v is string=>typeof v==='string');
    const anidados=[e.cause,...(Array.isArray(e.errors)?e.errors.slice(0,5):[])]
      .map(x=>visitar(x,nivel+1));
    return {
      codigos:[...anidados.flatMap(x=>x.codigos),...propios],
      estado:typeof e.$metadata?.httpStatusCode==='number'?e.$metadata.httpStatusCode
        :anidados.find(x=>x.estado!==null)?.estado??null,
    };
  };
  const inspeccion=visitar(error,0);
  const patrones={
    TLS_CERTIFICADO:/ERR_SSL|CERT_|TLS|SSL|EPROTO|UNABLE_TO_VERIFY|SELF_SIGNED|WRONG_VERSION|HANDSHAKE/i,
    DNS:/ENOTFOUND|EAI_AGAIN|ENODATA|DNS/i,
    RED:/ECONN|ETIMEDOUT|EHOSTUNREACH|UND_ERR|TimeoutError|AbortError/i,
    CREDENCIALES_O_PERMISOS:/AccessDenied|InvalidAccessKey|SignatureDoesNotMatch|InvalidToken|Forbidden/i,
    BUCKET:/NoSuchBucket|NotFound/i,
  };
  const pista=inspeccion.codigos.find(c=>Object.values(patrones).some(p=>p.test(c)))
    ||inspeccion.codigos.find(c=>c!=='Error')||'DESCONOCIDO';
  let categoria='ALMACENAMIENTO';
  for(const [grupo,patron] of Object.entries(patrones)){
    if(inspeccion.codigos.some(c=>patron.test(c))){categoria=grupo;break;}
  }
  if(categoria==='ALMACENAMIENTO'){
    if([401,403].includes(inspeccion.estado??0))categoria='CREDENCIALES_O_PERMISOS';
    if(inspeccion.estado===404)categoria='BUCKET';
  }
  // Whitelist: no publicar mensajes, hosts, rutas, objetos, firmas o secretos.
  const seguro=/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(pista)?pista:'DESCONOCIDO';
  return {categoria,codigo:seguro,estado:inspeccion.estado};
}
