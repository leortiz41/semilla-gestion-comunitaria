import 'dotenv/config';
import { databasePool } from '../config/database.js';
import { hashPassword } from '../security/password.js';

async function main(): Promise<void> {
  const email = process.env.SEMILLA_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEMILLA_ADMIN_PASSWORD;
  const organizacionSlug = process.env.SEMILLA_ADMIN_ORGANIZACION_SLUG?.trim().toLowerCase();

  if (!email || !password || !organizacionSlug) {
    throw new Error('Configure SEMILLA_ADMIN_EMAIL, SEMILLA_ADMIN_PASSWORD y SEMILLA_ADMIN_ORGANIZACION_SLUG antes de ejecutar este script.');
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
    const organizacionResult = await client.query(
      'SELECT id FROM organizaciones WHERE slug = $1 AND activo = TRUE FOR UPDATE',
      [organizacionSlug],
    );
    const organizacionId = (organizacionResult.rows[0] as { id: string } | undefined)?.id;
    if (!organizacionId) throw new Error('No existe una organización activa con el slug indicado.');

    const administradores = await client.query(
      `SELECT 1 FROM usuarios u JOIN usuarios_roles ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
       WHERE u.organizacion_id = $1 AND r.nombre = 'ADMINISTRADOR' LIMIT 1`,
      [organizacionId],
    );
    if (administradores.rowCount) throw new Error('La organización ya tiene un administrador; use la gestión normal de usuarios.');

    const userResult = await client.query(
      `INSERT INTO usuarios (email, hash_contrasena, organizacion_id, debe_cambiar_contrasena)
       VALUES ($1, $2, $3, TRUE) RETURNING id`,
      [email, passwordHash, organizacionId],
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
