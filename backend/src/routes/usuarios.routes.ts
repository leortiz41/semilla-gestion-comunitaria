import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../security/password.js';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { ErrorCredencialTemporal, reemitirCredencialTemporalAdministrador } from '../services/credenciales-temporales.service.js';

export const usuariosRouter = Router();

usuariosRouter.get('/roles', authenticateAccessToken, requirePermission('usuarios.ver'), async (_req, res) => {
  try {
    if (!databasePool) {
      res.status(503).json({ message: 'El catálogo de roles no está disponible.' });
      return;
    }

    const { rows } = await databasePool.query(`
      SELECT CASE WHEN r.nombre = 'CONSULTA' THEN 'DONANTE' ELSE r.nombre END AS nombre, r.activo,
        COALESCE(
          jsonb_agg(jsonb_build_object('codigo', p.codigo, 'descripcion', p.descripcion)
                    ORDER BY p.codigo) FILTER (WHERE p.id IS NOT NULL AND (
                      r.nombre NOT IN ('DONANTE', 'CONSULTA')
                      OR p.codigo IN ('proyectos.ver', 'evidencias.ver')
                    )),
          '[]'::jsonb
        ) AS permisos
      FROM roles r
      LEFT JOIN roles_permisos rp ON rp.rol_id = r.id
      LEFT JOIN permisos p ON p.id = rp.permiso_id
      WHERE r.nombre IN ('ADMINISTRADOR', 'COORDINADOR', 'FINANZAS', 'CAMPO', 'CONSULTA', 'DONANTE')
      GROUP BY r.id, r.nombre, r.activo
    `);
    res.json({ roles: rows });
  } catch (error) {
    console.error('Error consultando catálogo de roles:', error);
    res.status(500).json({ message: 'No fue posible consultar los roles.' });
  }
});

// Cada administrador gestiona solamente cuentas de su propia organización.
// Los roles son perfiles del catálogo existente, no permisos globales editables.
const perfilesAsignables = ['ADMINISTRADOR', 'COORDINADOR', 'CAMPO', 'FINANZAS', 'DONANTE'];
const validarRoles = (valor: unknown): string[] | null => {
  if (!Array.isArray(valor) || !valor.length || valor.length > perfilesAsignables.length ||
      !valor.every((rol) => typeof rol === 'string' && perfilesAsignables.includes(rol)) ||
      new Set(valor).size !== valor.length || (valor.includes('DONANTE') && valor.length !== 1)) return null;
  return valor as string[];
};
const validarEmail = (valor: unknown) => typeof valor === 'string' &&
  valor.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
const normalizarNombre = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
const validarNombre = (valor: string): boolean =>
  valor.length >= 2 && valor.length <= 100 && !/[\x00-\x1f\x7f]/.test(valor);

const verificarAdministradorActual = async (usuarioId: string, organizacionId: string) => {
  const result = await databasePool!.query(
    `SELECT 1 FROM usuarios u JOIN usuarios_roles ur ON ur.usuario_id=u.id
     JOIN roles r ON r.id=ur.rol_id
     WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo
       AND r.nombre='ADMINISTRADOR' AND r.activo LIMIT 1`,
    [usuarioId, organizacionId],
  );
  return Boolean(result.rows.length);
};
const obtenerRolesActivos = async (roles: string[], client: { query: (...args: any[]) => Promise<any> }) => {
  const { rows } = await client.query('SELECT id,nombre FROM roles WHERE activo AND nombre=ANY($1::text[])', [roles]);
  if (rows.length !== roles.length) throw new Error('ROLES_NO_DISPONIBLES');
  return rows as { id: string; nombre: string }[];
};

usuariosRouter.get('/cuentas', authenticateAccessToken, requireRole('ADMINISTRADOR'),
  requirePermission('usuarios.gestionar'), async (req, res) => {
    if (!databasePool) { res.status(503).json({ message: 'Gestión de cuentas no disponible.' }); return; }
    try {
      const { rows } = await databasePool.query(
        `SELECT u.id, u.email, u.activo, u.debe_cambiar_contrasena AS "debeCambiarContrasena",
           (SELECT pf.nombre_visible FROM perfiles_usuarios pf
             WHERE pf.usuario_id=u.id AND pf.organizacion_id=u.organizacion_id) AS "nombreVisible",
           COALESCE(array_agg(r.nombre ORDER BY r.nombre) FILTER (WHERE r.id IS NOT NULL), '{}'::text[]) AS roles
         FROM usuarios u LEFT JOIN usuarios_roles ur ON ur.usuario_id=u.id
         LEFT JOIN roles r ON r.id=ur.rol_id
         WHERE u.organizacion_id=$1 AND NOT EXISTS (
           SELECT 1 FROM usuarios_roles upr JOIN roles rpr ON rpr.id=upr.rol_id
           WHERE upr.usuario_id=u.id AND rpr.nombre='SUPERADMINISTRADOR'
         ) GROUP BY u.id
         ORDER BY u.email LIMIT 500`,
        [req.auth!.organizacionId],
      );
      res.set('Cache-Control', 'no-store');
      res.json({ cuentas: rows });
    } catch (error) {
      console.error('Error consultando cuentas de la organización:', error);
      res.status(500).json({ message: 'No fue posible consultar las cuentas.' });
    }
  });

usuariosRouter.post('/cuentas', authenticateAccessToken, requireRole('ADMINISTRADOR'),
  requirePermission('usuarios.gestionar'), async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const roles = validarRoles(req.body?.roles);
    const nombre = normalizarNombre(req.body?.nombre);
    const apellido = normalizarNombre(req.body?.apellido);
    const nombreVisible = [nombre, apellido].join(' ');
    if (!validarEmail(email) || !roles || !validarNombre(nombre) ||
        !validarNombre(apellido) || nombreVisible.length > 140) {
      res.status(400).json({ message: 'Revisá nombre, apellido, correo y roles seleccionados.' }); return;
    }
    if (!databasePool) { res.status(503).json({ message: 'Gestión de cuentas no disponible.' }); return; }
    try {
      if (!await verificarAdministradorActual(req.auth!.sub, req.auth!.organizacionId)) {
        res.status(403).json({ message: 'El administrador debe estar activo en su organización.' }); return;
      }
      const contrasenaTemporal = 'Aa1-' + randomBytes(18).toString('base64url');
      const hash = await hashPassword(contrasenaTemporal);
      const client = await databasePool.connect();
      try {
        await client.query('BEGIN');
        const rolesActivos = await obtenerRolesActivos(roles, client);
        const { rows } = await client.query(
          `INSERT INTO usuarios (email, hash_contrasena, organizacion_id, debe_cambiar_contrasena)
           VALUES ($1,$2,$3,TRUE) RETURNING id,email,activo`,
          [email, hash, req.auth!.organizacionId],
        );
        for (const rol of rolesActivos) {
          await client.query('INSERT INTO usuarios_roles (usuario_id,rol_id) VALUES ($1,$2)',
            [rows[0].id, rol.id]);
        }
        await client.query(
          'INSERT INTO perfiles_usuarios (usuario_id,organizacion_id,nombre_visible) VALUES ($1,$2,$3)',
          [rows[0].id, req.auth!.organizacionId, nombreVisible],
        );
        await client.query(
          `INSERT INTO bitacora_auditoria (usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
           VALUES ($1,'CREAR_USUARIO','usuarios',$2,$3::jsonb)`,
          [req.auth!.sub, rows[0].id, JSON.stringify({ email, roles, nombreVisible })],
        );
        await client.query('COMMIT');
        res.set('Cache-Control', 'no-store');
        res.status(201).json({ cuenta: { ...rows[0], roles, nombreVisible }, contrasenaTemporal });
      } catch (error) {
        await client.query('ROLLBACK'); throw error;
      } finally { client.release(); }
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        res.status(409).json({ message: 'Ese correo ya tiene una cuenta registrada.' }); return;
      }
      if ((error as Error).message === 'ROLES_NO_DISPONIBLES') {
        res.status(400).json({ message: 'Alguno de los roles seleccionados no está activo.' }); return;
      }
      console.error('Error creando usuario de la organización:', error);
      res.status(500).json({ message: 'No fue posible crear la cuenta.' });
    }
  });

// Los administradores reemiten una contraseña temporal solo para cuentas de su organización.
usuariosRouter.post('/cuentas/:usuarioId/credencial-temporal', authenticateAccessToken,
  requireRole('ADMINISTRADOR'), requirePermission('usuarios.gestionar'), async (req, res) => {
    const usuarioId=req.params.usuarioId;
    if (typeof usuarioId !== 'string' || !/^[0-9a-f-]{36}$/i.test(usuarioId)) {
      res.status(400).json({message:'Cuenta inválida.'});return;
    }
    if (!databasePool) {res.status(503).json({message:'Gestión de cuentas no disponible.'});return;}
    if (req.auth!.debeCambiarContrasena) {
      res.status(403).json({message:'Cambiá tu contraseña temporal antes de gestionar cuentas.'});return;
    }
    if (usuarioId===req.auth!.sub) {
      res.status(409).json({message:'Para cambiar tu propia contraseña usá Mi perfil → Seguridad.'});return;
    }
    try {
      if (!await verificarAdministradorActual(req.auth!.sub, req.auth!.organizacionId)) {
        res.status(403).json({message:'Administración no autorizada.'});return;
      }
      const respuesta=await reemitirCredencialTemporalAdministrador(
        {organizacionId:req.auth!.organizacionId,usuarioId,superadministradorId:req.auth!.sub,permitirOtrosRoles:true},
        databasePool,
      );
      res.set('Cache-Control','no-store');
      res.status(201).json(respuesta);
    } catch(error) {
      if (error instanceof ErrorCredencialTemporal) {
        res.status(error.codigoEstado).json({message:error.message});return;
      }
      console.error('Error emitiendo credencial temporal de organización:',error);
      res.status(500).json({message:'No fue posible emitir una credencial temporal.'});
    }
  });

// La edición del nombre visible conserva fotografía, credenciales y roles.
usuariosRouter.put('/cuentas/:usuarioId/nombre', authenticateAccessToken,
  requireRole('ADMINISTRADOR'), requirePermission('usuarios.gestionar'), async (req, res) => {
    const usuarioId = req.params.usuarioId;
    const nombreVisible = normalizarNombre(req.body?.nombreVisible);
    if (typeof usuarioId !== 'string' || !/^[0-9a-f-]{36}$/i.test(usuarioId) ||
        nombreVisible.length < 2 || nombreVisible.length > 140 ||
        /[\x00-\x1f\x7f]/.test(nombreVisible)) {
      res.status(400).json({ message: 'Cuenta o nombre visible no válido (2 a 140 caracteres).' });
      return;
    }
    if (!databasePool) {
      res.status(503).json({ message: 'Gestión de cuentas no disponible.' });
      return;
    }
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const org = req.auth!.organizacionId;
      const organizacion = await client.query(
        'SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE', [org]);
      const administrador = await client.query(`SELECT 1 FROM usuarios u
        JOIN usuarios_roles ur ON ur.usuario_id=u.id
        JOIN roles r ON r.id=ur.rol_id AND r.nombre='ADMINISTRADOR' AND r.activo
        WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo LIMIT 1`,
        [req.auth!.sub, org]);
      if (!organizacion.rowCount || !administrador.rowCount) {
        await client.query('ROLLBACK');
        res.status(403).json({ message: 'Administración no autorizada.' });
        return;
      }
      const cuenta = await client.query(`SELECT u.id, pf.nombre_visible AS "nombreVisible"
        FROM usuarios u
        LEFT JOIN perfiles_usuarios pf ON pf.usuario_id=u.id AND pf.organizacion_id=u.organizacion_id
        WHERE u.id=$1 AND u.organizacion_id=$2 FOR UPDATE OF u`, [usuarioId, org]);
      if (!cuenta.rowCount) {
        await client.query('ROLLBACK');
        res.status(404).json({ message: 'Cuenta no encontrada en tu organización.' });
        return;
      }
      const protegida = await client.query(`SELECT 1 FROM usuarios_roles ur
        JOIN roles r ON r.id=ur.rol_id
        WHERE ur.usuario_id=$1 AND r.nombre='SUPERADMINISTRADOR' LIMIT 1`, [usuarioId]);
      if (protegida.rowCount) {
        await client.query('ROLLBACK');
        res.status(403).json({ message: 'La cuenta global no puede modificarse desde una organización.' });
        return;
      }
      const anterior = cuenta.rows[0].nombreVisible as string | null;
      if (anterior !== nombreVisible) {
        await client.query(`INSERT INTO perfiles_usuarios (usuario_id,organizacion_id,nombre_visible)
          VALUES ($1,$2,$3) ON CONFLICT(usuario_id)
          DO UPDATE SET nombre_visible=EXCLUDED.nombre_visible,actualizado_en=NOW()`,
          [usuarioId, org, nombreVisible]);
        await client.query(`INSERT INTO bitacora_auditoria
          (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
          VALUES ($1,'CAMBIAR_NOMBRE_USUARIO','usuarios',$2,$3::jsonb,$4::jsonb)`,
          [req.auth!.sub, usuarioId,
            JSON.stringify({ nombreVisible: anterior }),
            JSON.stringify({ nombreVisible })]);
      }
      await client.query('COMMIT');
      res.set('Cache-Control', 'no-store');
      res.json({ nombreVisible });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error actualizando nombre visible de cuenta:', error);
      res.status(500).json({ message: 'No fue posible actualizar el nombre visible.' });
    } finally {
      client.release();
    }
  });

// La corrección del correo no modifica roles ni credenciales.
usuariosRouter.put('/cuentas/:usuarioId/email', authenticateAccessToken,
  requireRole('ADMINISTRADOR'), requirePermission('usuarios.gestionar'), async (req, res) => {
    const usuarioId = req.params.usuarioId;
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (typeof usuarioId !== 'string' || !/^[0-9a-f-]{36}$/i.test(usuarioId) || !validarEmail(email)) {
      res.status(400).json({ message: 'Usuario o correo electrónico inválido.' }); return;
    }
    if (!databasePool) { res.status(503).json({ message: 'Gestión de cuentas no disponible.' }); return; }
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const org = await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',
        [req.auth!.organizacionId]);
      const admin = await client.query(`SELECT 1 FROM usuarios u
        JOIN usuarios_roles ur ON ur.usuario_id=u.id
        JOIN roles r ON r.id=ur.rol_id AND r.nombre='ADMINISTRADOR' AND r.activo
        WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo LIMIT 1`,
        [req.auth!.sub, req.auth!.organizacionId]);
      if (!org.rows.length || !admin.rows.length) {
        await client.query('ROLLBACK');
        res.status(403).json({ message: 'Administración no autorizada.' }); return;
      }
      const cuenta = await client.query('SELECT id,email FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo FOR UPDATE',
        [usuarioId, req.auth!.organizacionId]);
      if (!cuenta.rows.length) {
        await client.query('ROLLBACK');
        res.status(404).json({ message: 'Usuario no encontrado en tu organización.' }); return;
      }
      const esPlataforma = await client.query(`SELECT 1 FROM usuarios_roles ur
        JOIN roles r ON r.id=ur.rol_id WHERE ur.usuario_id=$1 AND r.nombre='SUPERADMINISTRADOR' LIMIT 1`, [usuarioId]);
      if (esPlataforma.rows.length) {
        await client.query('ROLLBACK');
        res.status(403).json({ message: 'La cuenta global no puede modificarse desde una organización.' }); return;
      }
      const anterior = cuenta.rows[0].email as string;
      if (anterior === email) {
        await client.query('COMMIT'); res.json({ email }); return;
      }
      await client.query('UPDATE usuarios SET email=$1, actualizado_en=NOW() WHERE id=$2', [email, usuarioId]);
      await client.query('UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW()) WHERE usuario_id=$1', [usuarioId]);
      await client.query(`INSERT INTO bitacora_auditoria (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
        VALUES ($1,'CAMBIAR_EMAIL_USUARIO','usuarios',$2,$3::jsonb,$4::jsonb)`,
        [req.auth!.sub,usuarioId,JSON.stringify({email:anterior}),JSON.stringify({email})]);
      await client.query('COMMIT');
      res.set('Cache-Control','no-store'); res.json({ email });
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as {code?:string}).code === '23505') {
        res.status(409).json({ message: 'El correo ya está registrado en otra cuenta.' }); return;
      }
      console.error('Error cambiando correo de cuenta:', error);
      res.status(500).json({ message: 'No fue posible actualizar el correo.' });
    } finally { client.release(); }
  });

usuariosRouter.put('/cuentas/:usuarioId/roles', authenticateAccessToken,
  requireRole('ADMINISTRADOR'), requirePermission('usuarios.gestionar'), async (req, res) => {
    const roles = validarRoles(req.body?.roles);
    const usuarioId = req.params.usuarioId;
    if (!roles || typeof usuarioId !== 'string' || !/^[0-9a-f-]{36}$/i.test(usuarioId)) {
      res.status(400).json({ message: 'Usuario o roles no válidos.' }); return;
    }
    if (!databasePool) { res.status(503).json({ message: 'Gestión de cuentas no disponible.' }); return; }
    if (usuarioId === req.auth!.sub && !roles.includes('ADMINISTRADOR')) {
      res.status(409).json({ message: 'No podés quitarte tu propio rol de administrador.' }); return;
    }
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      // El bloqueo de la organización serializa modificaciones de administradores.
      const org = await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',
        [req.auth!.organizacionId]);
      const usuario = await client.query('SELECT id FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo FOR UPDATE',
        [usuarioId, req.auth!.organizacionId]);
      if (!org.rows.length || !usuario.rows.length) {
        await client.query('ROLLBACK'); res.status(404).json({ message: 'Usuario no encontrado en tu organización.' }); return;
      }
      const cuentaPlataforma = await client.query(
        `SELECT 1 FROM usuarios_roles upr JOIN roles rpr ON rpr.id=upr.rol_id
         WHERE upr.usuario_id=$1 AND rpr.nombre='SUPERADMINISTRADOR' LIMIT 1`,
        [usuarioId],
      );
      if (cuentaPlataforma.rows.length) {
        await client.query('ROLLBACK');
        res.status(403).json({ message: 'Las cuentas de plataforma no pueden administrarse desde una organización.' });
        return;
      }
      const admin = await verificarAdministradorActual(req.auth!.sub, req.auth!.organizacionId);
      const actuales = await client.query(
        `SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id WHERE ur.usuario_id=$1`,
        [usuarioId],
      );
      const rolesActivos = await obtenerRolesActivos(roles, client);
      if (!admin) {
        await client.query('ROLLBACK'); res.status(403).json({ message: 'Administración no autorizada.' }); return;
      }
      if (actuales.rows.some((r: { nombre: string }) => r.nombre === 'ADMINISTRADOR') &&
          !roles.includes('ADMINISTRADOR')) {
        const otros = await client.query(`SELECT count(DISTINCT u.id)::int AS total FROM usuarios u
          JOIN usuarios_roles ur ON ur.usuario_id=u.id JOIN roles r ON r.id=ur.rol_id
          WHERE u.organizacion_id=$1 AND u.activo AND r.nombre='ADMINISTRADOR' AND u.id<>$2`,
          [req.auth!.organizacionId, usuarioId]);
        if (otros.rows[0].total === 0) {
          await client.query('ROLLBACK');
          res.status(409).json({ message: 'La organización debe conservar al menos un administrador.' }); return;
        }
      }
      await client.query('DELETE FROM usuarios_roles WHERE usuario_id=$1', [usuarioId]);
      for (const rol of rolesActivos) {
        await client.query('INSERT INTO usuarios_roles(usuario_id,rol_id) VALUES($1,$2)', [usuarioId, rol.id]);
      }
      await client.query(`INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
        VALUES ($1,'CAMBIAR_ROLES_USUARIO','usuarios',$2,$3::jsonb)`,
        [req.auth!.sub, usuarioId, JSON.stringify({ roles })]);
      await client.query('COMMIT');
      res.json({ roles });
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as Error).message === 'ROLES_NO_DISPONIBLES') {
        res.status(400).json({ message: 'Alguno de los roles no está activo.' }); return;
      }
      console.error('Error actualizando roles:', error);
      res.status(500).json({ message: 'No fue posible actualizar los roles.' });
    } finally { client.release(); }
  });
