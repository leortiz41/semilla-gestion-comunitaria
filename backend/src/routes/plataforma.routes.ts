import { randomBytes } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { databasePool } from '../config/database.js';
import { hashPassword } from '../security/password.js';
import { authenticateAccessToken } from '../middleware/auth.middleware.js';

export const plataformaRouter = Router();
const rolesPermitidos = ['ADMINISTRADOR', 'COORDINADOR', 'FINANZAS', 'CAMPO', 'DONANTE'];
const esUuid = (valor: unknown): valor is string => typeof valor === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
const rolesValidos = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 &&
  v.length <= rolesPermitidos.length && v.every((r) => typeof r === 'string' && rolesPermitidos.includes(r)) &&
  new Set(v).size === v.length && (!v.includes('DONANTE') || v.length === 1);
const esCorreo = (v: unknown): v is string => typeof v === 'string' && v.length <= 150 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const nombreError = (error: unknown) => (error as { code?: string }).code === '23505';
const errorHttp = (error: unknown) => error instanceof Error ? error.message : 'ErrorDesconocido';

// No confiar únicamente en el JWT: los privilegios globales se confirman
// contra la base de datos, por cada petición y sobre una cuenta activa.
const superadminActual: RequestHandler = async (req, res, next) => {
  if (!databasePool || !req.auth) {
    res.status(503).json({ message: 'Gestión de plataforma no disponible.' }); return;
  }
  if (req.auth.debeCambiarContrasena) {
    res.status(403).json({ message: 'Cambiá tu contraseña antes de administrar la plataforma.' }); return;
  }
  if (!req.auth.roles.includes('SUPERADMINISTRADOR')) {
    res.status(403).json({ message: 'Acceso reservado al superadministrador.' }); return;
  }
  try {
    const { rows } = await databasePool.query(
      `SELECT 1 FROM usuarios u
       JOIN organizaciones o ON o.id=u.organizacion_id AND o.activo
       JOIN usuarios_roles ur ON ur.usuario_id=u.id
       JOIN roles r ON r.id=ur.rol_id AND r.nombre='SUPERADMINISTRADOR' AND r.activo
       WHERE u.id=$1 AND u.activo LIMIT 1`,
      [req.auth.sub],
    );
    if (!rows.length) { res.status(403).json({ message: 'Privilegios de plataforma revocados.' }); return; }
    next();
  } catch (error) {
    console.error('Error verificando permisos de plataforma:', errorHttp(error));
    res.status(503).json({ message: 'No fue posible verificar acceso de plataforma.' });
  }
};

plataformaRouter.use(authenticateAccessToken, superadminActual);

plataformaRouter.get('/organizaciones', async (_req, res) => {
  try {
    const { rows } = await databasePool!.query(
      `SELECT o.id,o.nombre,o.slug,o.activo,o.email_contacto AS "emailContacto",
          (SELECT count(*)::int FROM usuarios u WHERE u.organizacion_id=o.id) AS "cantidadUsuarios",
          (SELECT count(DISTINCT u.id)::int FROM usuarios u
           JOIN usuarios_roles ur ON ur.usuario_id=u.id
           JOIN roles r ON r.id=ur.rol_id AND r.nombre='ADMINISTRADOR'
           WHERE u.organizacion_id=o.id AND u.activo) AS "cantidadAdministradores"
       FROM organizaciones o ORDER BY o.nombre,o.id LIMIT 500`,
    );
    res.set('Cache-Control','no-store');
    res.json({ organizaciones: rows });
  } catch (error) {
    console.error('Error consultando organizaciones:', errorHttp(error));
    res.status(500).json({ message: 'No se pudieron consultar las organizaciones.' });
  }
});

plataformaRouter.post('/organizaciones', async (req, res) => {
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim().toLowerCase() : '';
  const emailContacto = typeof req.body?.emailContacto === 'string' ? req.body.emailContacto.trim().toLowerCase() : null;
  if (!nombre || nombre.length > 150 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      slug.length > 80 || (emailContacto && !esCorreo(emailContacto))) {
    res.status(400).json({ message: 'Nombre, slug o correo de contacto inválidos.' }); return;
  }
  const client = await databasePool!.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO organizaciones(nombre,slug,email_contacto)
       VALUES($1,$2,$3) RETURNING id,nombre,slug,activo,email_contacto AS "emailContacto"`,
      [nombre,slug,emailContacto],
    );
    await client.query(
      `INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
       VALUES($1,'PLATAFORMA_CREAR_ORGANIZACION','organizaciones',$2,$3::jsonb)`,
      [req.auth!.sub,rows[0].id,JSON.stringify({ nombre, slug })],
    );
    await client.query('COMMIT');
    res.status(201).json({ organizacion: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    if (nombreError(error)) { res.status(409).json({ message: 'Ya existe una organización con ese slug.' }); return; }
    console.error('Error creando organización:', errorHttp(error));
    res.status(500).json({ message: 'No fue posible crear la organización.' });
  } finally { client.release(); }
});

plataformaRouter.get('/organizaciones/:organizacionId/cuentas', async (req,res) => {
  if (!esUuid(req.params.organizacionId)) { res.status(400).json({message:'Organización inválida.'});return; }
  try {
    const org=await databasePool!.query('SELECT id FROM organizaciones WHERE id=$1', [req.params.organizacionId]);
    if (!org.rows.length) { res.status(404).json({message:'Organización no encontrada.'});return; }
    const {rows}=await databasePool!.query(
      `SELECT u.id,u.email,u.activo,u.debe_cambiar_contrasena AS "debeCambiarContrasena",
         COALESCE(array_agg(r.nombre ORDER BY r.nombre) FILTER(WHERE r.id IS NOT NULL),'{}'::text[]) AS roles
       FROM usuarios u LEFT JOIN usuarios_roles ur ON ur.usuario_id=u.id
       LEFT JOIN roles r ON r.id=ur.rol_id
       WHERE u.organizacion_id=$1 GROUP BY u.id ORDER BY u.email LIMIT 500`, [req.params.organizacionId],
    );
    res.set('Cache-Control','no-store'); res.json({cuentas:rows});
  } catch(error) {
    console.error('Error consultando cuentas de plataforma:',errorHttp(error));
    res.status(500).json({message:'No se pudieron consultar las cuentas.'});
  }
});

plataformaRouter.post('/organizaciones/:organizacionId/cuentas',async (req,res) => {
  const organizacionId=req.params.organizacionId;
  const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
  const roles=req.body?.roles;
  if (!esUuid(organizacionId) || !esCorreo(email) || !rolesValidos(roles)) {
    res.status(400).json({message:'Organización, correo o roles inválidos.'});return;
  }
  const temporal='Aa1-'+randomBytes(18).toString('base64url');
  const hash=await hashPassword(temporal);
  const client=await databasePool!.connect();
  try {
    await client.query('BEGIN');
    const org=await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[organizacionId]);
    if (!org.rows.length) {await client.query('ROLLBACK');res.status(404).json({message:'Organización no encontrada o inactiva.'});return;}
    const rs=await client.query('SELECT id,nombre FROM roles WHERE nombre=ANY($1::text[]) AND activo',[roles]);
    if (rs.rows.length!==roles.length) {await client.query('ROLLBACK');res.status(400).json({message:'Hay roles no disponibles.'});return;}
    const {rows}=await client.query(
      `INSERT INTO usuarios(email,hash_contrasena,organizacion_id,debe_cambiar_contrasena)
       VALUES($1,$2,$3,TRUE) RETURNING id,email,activo`,[email,hash,organizacionId]);
    for(const rol of rs.rows) await client.query(
      'INSERT INTO usuarios_roles(usuario_id,rol_id) VALUES($1,$2)',[rows[0].id,rol.id]);
    await client.query(
      `INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
       VALUES($1,'PLATAFORMA_CREAR_CUENTA','usuarios',$2,$3::jsonb)`,
      [req.auth!.sub,rows[0].id,JSON.stringify({ organizacionId,email,roles })]);
    await client.query('COMMIT');
    res.set('Cache-Control','no-store');
    res.status(201).json({cuenta:{...rows[0],roles},contrasenaTemporal:temporal});
  } catch(error) {
    await client.query('ROLLBACK');
    if(nombreError(error)){res.status(409).json({message:'El correo ya está registrado.'});return;}
    console.error('Error creando cuenta desde plataforma:',errorHttp(error));
    res.status(500).json({message:'No fue posible crear la cuenta.'});
  } finally {client.release();}
});

plataformaRouter.put('/organizaciones/:organizacionId/cuentas/:usuarioId/roles', async (req,res) => {
  const { organizacionId, usuarioId } = req.params;
  const roles = req.body?.roles;
  if (!esUuid(organizacionId) || !esUuid(usuarioId) || !rolesValidos(roles)) {
    res.status(400).json({message:'Organización, usuario o roles inválidos.'}); return;
  }
  const client=await databasePool!.connect();
  try {
    await client.query('BEGIN');
    const org=await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[organizacionId]);
    const usuario=await client.query('SELECT id,activo FROM usuarios WHERE id=$1 AND organizacion_id=$2 FOR UPDATE',
      [usuarioId,organizacionId]);
    if(!org.rows.length || !usuario.rows.length || !usuario.rows[0].activo) {
      await client.query('ROLLBACK');res.status(404).json({message:'La cuenta o su organización no están activas.'});return;
    }
    const actuales=await client.query(
      `SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
       WHERE ur.usuario_id=$1`,[usuarioId]);
    if(actuales.rows.some((r:{nombre:string})=>r.nombre==='SUPERADMINISTRADOR')) {
      await client.query('ROLLBACK');res.status(403).json({message:'La cuenta de plataforma no admite edición desde este módulo.'});return;
    }
    if(actuales.rows.some((r:{nombre:string})=>r.nombre==='ADMINISTRADOR') && !roles.includes('ADMINISTRADOR')) {
      const otros=await client.query(
        `SELECT count(DISTINCT u.id)::int AS total FROM usuarios u
         JOIN usuarios_roles ur ON ur.usuario_id=u.id
         JOIN roles r ON r.id=ur.rol_id
         WHERE u.organizacion_id=$1 AND u.activo AND r.nombre='ADMINISTRADOR' AND u.id<>$2`,
        [organizacionId,usuarioId],
      );
      if(otros.rows[0].total===0) {
        await client.query('ROLLBACK');
        res.status(409).json({message:'No se puede quitar el último administrador de una organización.'});return;
      }
    }
    const rs=await client.query('SELECT id,nombre FROM roles WHERE nombre=ANY($1::text[]) AND activo',[roles]);
    if(rs.rows.length!==roles.length){
      await client.query('ROLLBACK');res.status(400).json({message:'Hay roles no disponibles.'});return;
    }
    await client.query('DELETE FROM usuarios_roles WHERE usuario_id=$1',[usuarioId]);
    for(const rol of rs.rows) await client.query('INSERT INTO usuarios_roles(usuario_id,rol_id) VALUES($1,$2)',
      [usuarioId,rol.id]);
    // Revocar refresh tokens: la sesión anterior no debe conservar permisos ampliados.
    await client.query('UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW()) WHERE usuario_id=$1',[usuarioId]);
    await client.query(`INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
      VALUES($1,'PLATAFORMA_CAMBIAR_ROLES','usuarios',$2,$3::jsonb)`,
      [req.auth!.sub,usuarioId,JSON.stringify({organizacionId,roles})]);
    await client.query('COMMIT');
    res.json({roles});
  }catch(error){
    await client.query('ROLLBACK');
    console.error('Error cambiando roles desde plataforma:',errorHttp(error));
    res.status(500).json({message:'No fue posible cambiar los perfiles de la cuenta.'});
  }finally{client.release();}
});
