import { config as cargarEntorno } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

// La ruta se calcula desde este archivo para que `npm run dev` funcione igual
// tanto desde la carpeta backend como desde la raíz del proyecto.
const directorioConfiguracion = dirname(fileURLToPath(import.meta.url));
cargarEntorno({ path: resolve(directorioConfiguracion, '../../.env') });

const connectionString = process.env.DATABASE_URL;

export const databasePool = connectionString
  ? new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

export type DatabaseHealthStatus = 'connected' | 'not_configured' | 'error';

export async function checkDatabaseConnection(): Promise<{
  status: DatabaseHealthStatus;
  latencyMs?: number;
}> {
  if (!databasePool) {
    return { status: 'not_configured' };
  }

  const startedAt = Date.now();

  try {
    await databasePool.query('SELECT 1');

    return {
      status: 'connected',
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    console.error('Error verificando la conexión con PostgreSQL:', error);
    return {
      status: 'error',
      latencyMs: Date.now() - startedAt,
    };
  }
}
