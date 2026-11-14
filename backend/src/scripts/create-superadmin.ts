import 'dotenv/config';
import { databasePool } from '../config/database.js';
import { hashPassword } from '../security/password.js';

// Bootstrap de una única cuenta privilegiada; nunca expuesto por HTTP.
// Su organización de identidad NO le concede permisos tenant.
async function main() {
  const email = process.env.SEMILLA_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEMILLA_SUPERADMIN_PASSWORD;
  const slug = process.env.SEMILLA_SUPERADMIN_ORGANIZACION_SLUG?.trim().toLowerCase();
  if (!email || !password || !slug || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Configure SEMILLA_SUPERADMIN_EMAIL, SEMILLA_SUPERADMIN_PASSWORD y SEMILLA_SUPERADMIN_ORGANIZACION_SLUG.');
  }
  if (!databasePool) throw new Error('DATABASE_URL no configurada.');
  const hash = await hashPassword(password);
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    // Evitar carreras de bootstrap concurrente usando advisory lock a nivel transacción.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('semilla:bootstrap-superadmin'))");
    const existe = await client.query(
      `SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
       WHERE r.nombre='SUPERADMINISTRADOR' LIMIT 1`,
    );
    if (existe.rows.length) throw new Error('Ya existe un superadministrador. Bootstrap bloqueado.');
    const org = await client.query(
      'SELECT id FROM organizaciones WHERE slug=$1 AND activo FOR UPDATE', [slug],
    );
    if (!org.rows.length) throw new Error('La organización de identidad no existe o está inactiva.');
    const rol = await client.query(
      "SELECT id FROM roles WHERE nombre='SUPERADMINISTRADOR' AND activo LIMIT 1",
    );
    if (!rol.rows.length) throw new Error('Falta aplicar migración 024.');
    const registrado = await client.query('SELECT 1 FROM usuarios WHERE LOWER(email)=LOWER($1)', [email]);
    if (registrado.rows.length) throw new Error('El correo ya tiene una cuenta. Use otro correo para bootstrap.');
    const usuario = await client.query(
      `INSERT INTO usuarios (email,hash_contrasena,organizacion_id,debe_cambiar_contrasena)
       VALUES($1,$2,$3,TRUE) RETURNING id`, [email, hash, org.rows[0].id],
    );
    await client.query('INSERT INTO usuarios_roles(usuario_id,rol_id) VALUES($1,$2)',
      [usuario.rows[0].id, rol.rows[0].id]);
    await client.query(`INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
      VALUES ($1,'BOOTSTRAP_SUPERADMIN','usuarios',$1,$2::jsonb)`,
      [usuario.rows[0].id, JSON.stringify({ rol: 'SUPERADMINISTRADOR', organizacionIdentidad: slug })]);
    await client.query('COMMIT');
    console.log('Superadministrador inicial creado. Es obligatorio cambiar la contraseña al iniciar sesión.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

main().catch((error) => { console.error('Bootstrap de plataforma no completado:', error); process.exitCode=1; })
  .finally(async () => databasePool?.end());
