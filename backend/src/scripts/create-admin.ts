import 'dotenv/config';
import { databasePool } from '../config/database.js';
import { hashPassword } from '../security/password.js';

async function main(): Promise<void> {
  const email = process.env.SEMILLA_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEMILLA_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Configure SEMILLA_ADMIN_EMAIL y SEMILLA_ADMIN_PASSWORD antes de ejecutar este script.');
  }

  if (!databasePool) {
    throw new Error('DATABASE_URL no está configurada.');
  }

  const existing = await databasePool.query('SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)', [email]);
  if (existing.rowCount) {
    throw new Error(`Ya existe un usuario con el correo ${email}.`);
  }

  const roleResult = await databasePool.query(
    "SELECT id FROM roles WHERE nombre = 'ADMINISTRADOR' AND activo = TRUE LIMIT 1",
  );
  const role = roleResult.rows[0] as { id: string } | undefined;

  if (!role) {
    throw new Error('No existe el rol ADMINISTRADOR. Aplique primero los scripts SQL de Semilla.');
  }

  const passwordHash = await hashPassword(password);
  const client = await databasePool.connect();

  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      `INSERT INTO usuarios (email, hash_contrasena, debe_cambiar_contrasena)
       VALUES ($1, $2, TRUE)
       RETURNING id`,
      [email, passwordHash],
    );

    const userId = (userResult.rows[0] as { id: string }).id;
    await client.query(
      'INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, role.id],
    );
    await client.query('COMMIT');

    console.log(`Administrador inicial creado correctamente: ${email}`);
    console.log('El usuario deberá cambiar su contraseña después del primer inicio de sesión.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error('No fue posible crear el administrador inicial:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await databasePool?.end();
  });
