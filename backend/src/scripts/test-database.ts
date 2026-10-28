import 'dotenv/config';
import { databasePool } from '../config/database.js';

async function main() {
  if (!databasePool) {
    throw new Error('DATABASE_URL no está configurada.');
  }

  const result = await databasePool.query<{
    database_name: string;
    current_time: Date;
  }>('SELECT current_database() AS database_name, NOW() AS current_time');

  console.log('Conexión PostgreSQL verificada correctamente.');
  console.log(`Base de datos: ${result.rows[0]?.database_name}`);
  console.log(`Hora del servidor: ${result.rows[0]?.current_time.toISOString()}`);

  await databasePool.end();
}

main().catch(async (error) => {
  console.error('Falló la verificación de PostgreSQL:', error);
  await databasePool?.end();
  process.exit(1);
});
