import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { ErrorCredencialTemporal, reemitirCredencialTemporalAdministrador } from '../services/credenciales-temporales.service.js';
import { obtenerRolesUsuarios, obtenerCuentasUsuarios } from '../modules/usuarios/usuarios.controller.js';
import { validarRoles, validarEmail, normalizarNombre } from '../modules/usuarios/usuarios.domain.js';
import { registrarCuentaOrganizacion } from '../modules/usuarios/cuentas.controller.js';
import { actualizarRolesUsuario } from '../modules/usuarios/roles.controller.js';

export const usuariosRouter = Router();

usuariosRouter.get('/roles', authenticateAccessToken, requirePermission('usuarios.ver'), obtenerRolesUsuarios);

// Cada administrador gestiona solamente cuentas de su propia organización.
// Los roles son perfiles del catálogo existente, no permisos globales editables.
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
usuariosRouter.get('/cuentas', authenticateAccessToken, requireRole('ADMINISTRADOR'),
  requirePermission('usuarios.gestionar'), obtenerCuentasUsuarios);

usuariosRouter.post('/cuentas', authenticateAccessToken, requireRole('ADMINISTRADOR'),
  requirePermission('usuarios.gestionar'), registrarCuentaOrganizacion);

// Retirada lógica: preserva datos relacionados e impide reactivar desde paneles.
usuariosRouter.post('/cuentas/:usuarioId/retirar', authenticateAccessToken,
  requireRole('ADMINISTRADOR'), requirePermission('usuarios.gestionar'), async(req,res)=>{
    const id=req.params.usuarioId, org=req.auth!.organizacionId;
    if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)){res.status(400).json({message:'Cuenta inválida.'});return;}
    if(id===req.auth!.sub){res.status(409).json({message:'No podés retirar tu propia cuenta.'});return;}
    if(!databasePool){res.status(503).json({message:'Gestión de cuentas no disponible.'});return;}
    const client=await databasePool.connect();
    try{
      await client.query('BEGIN');
      const organizacion=await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[org]);
      const admin=await client.query(`SELECT 1 FROM usuarios u JOIN usuarios_roles ur ON ur.usuario_id=u.id
        JOIN roles r ON r.id=ur.rol_id AND r.nombre='ADMINISTRADOR' AND r.activo
        WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo LIMIT 1`,[req.auth!.sub,org]);
      if(!organizacion.rowCount||!admin.rowCount){
        await client.query('ROLLBACK');res.status(403).json({message:'Administración no autorizada.'});return;
      }
      const cuenta=await client.query('SELECT id,activo FROM usuarios WHERE id=$1 AND organizacion_id=$2 FOR UPDATE',[id,org]);
      if(!cuenta.rowCount){await client.query('ROLLBACK');res.status(404).json({message:'Cuenta no encontrada.'});return;}
      const roles=await client.query(`SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id WHERE ur.usuario_id=$1`,[id]);
      if(roles.rows.some((r:{nombre:string})=>r.nombre==='SUPERADMINISTRADOR')){
        await client.query('ROLLBACK');res.status(403).json({message:'Cuenta de plataforma protegida.'});return;
      }
      const retirada=await client.query(`SELECT 1 FROM bitacora_auditoria
        WHERE entidad_id=$1 AND nombre_entidad='usuarios' AND accion='RETIRAR_USUARIO_ORGANIZACION' LIMIT 1`,[id]);
      if(retirada.rowCount){await client.query('ROLLBACK');res.status(409).json({message:'Cuenta ya retirada.'});return;}
      if(roles.rows.some((r:{nombre:string})=>r.nombre==='ADMINISTRADOR')){
        const otros=await client.query(`SELECT COUNT(DISTINCT u.id)::int AS total FROM usuarios u
          JOIN usuarios_roles ur ON ur.usuario_id=u.id JOIN roles r ON r.id=ur.rol_id AND r.activo
          WHERE u.organizacion_id=$1 AND u.activo AND r.nombre='ADMINISTRADOR' AND u.id<>$2`,[org,id]);
        if(!otros.rows[0].total){await client.query('ROLLBACK');
          res.status(409).json({message:'La organización debe conservar al menos un administrador.'});return;}
      }
      await client.query('UPDATE usuarios SET activo=FALSE,actualizado_en=NOW() WHERE id=$1',[id]);
      await client.query('UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW()) WHERE usuario_id=$1',[id]);
      await client.query(`INSERT INTO bitacora_auditoria
        (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
        VALUES ($1,'RETIRAR_USUARIO_ORGANIZACION','usuarios',$2,$3::jsonb,$4::jsonb)`,
        [req.auth!.sub,id,JSON.stringify({activo:cuenta.rows[0].activo}),
          JSON.stringify({activo:false,retirado:true,organizacionId:org})]);
      await client.query('COMMIT');res.set('Cache-Control','no-store');res.json({id,activo:false,retirado:true});
    }catch(error){await client.query('ROLLBACK');console.error('Error retirando usuario:',error);
      res.status(500).json({message:'No fue posible retirar la cuenta.'});
    }finally{client.release();}
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
  requireRole('ADMINISTRADOR'), requirePermission('usuarios.gestionar'), actualizarRolesUsuario);
