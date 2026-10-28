import { Pool } from 'pg';

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
