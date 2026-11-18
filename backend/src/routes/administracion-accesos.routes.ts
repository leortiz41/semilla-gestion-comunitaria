import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { esUuid } from '../domain/expediente.js';

export const administracionAccesosRouter=Router();
administracionAccesosRouter.use(authenticateAccessToken,requireRole('ADMINISTRADOR'),requirePermission('usuarios.gestionar'));

administracionAccesosRouter.get('/configuracion',async(req,res)=>{
 if(!databasePool){res.status(503).json({message:'Base de datos no disponible.'});return;}
 const org=req.auth!.organizacionId;
 try{
  const [cuentas,permisos,perfiles]=await Promise.all([
   databasePool.query(`SELECT u.id,u.email,u.activo,u.debe_cambiar_contrasena AS "debeCambiarContrasena",
     COALESCE(ARRAY(SELECT DISTINCT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id AND r.activo
       WHERE ur.usuario_id=u.id ORDER BY r.nombre),ARRAY[]::text[]) AS roles,
     COALESCE(ARRAY(SELECT DISTINCT p.codigo FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id AND r.activo
       JOIN roles_permisos rp ON rp.rol_id=r.id JOIN permisos p ON p.id=rp.permiso_id
       WHERE ur.usuario_id=u.id AND NOT EXISTS (
        SELECT 1 FROM organizaciones_roles_permisos_restringidos br
        WHERE br.organizacion_id=u.organizacion_id AND br.rol_id=r.id AND br.permiso_id=p.id
       ) ORDER BY p.codigo),ARRAY[]::text[]) AS "permisosBase",
     COALESCE(ARRAY(SELECT p.codigo FROM usuarios_permisos_restringidos restr
       JOIN permisos p ON p.id=restr.permiso_id
       WHERE restr.usuario_id=u.id AND restr.organizacion_id=$1 ORDER BY p.codigo),ARRAY[]::text[]) AS "permisosRestringidos"
     FROM usuarios u WHERE u.organizacion_id=$1
       AND NOT EXISTS (SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
        WHERE ur.usuario_id=u.id AND r.nombre='SUPERADMINISTRADOR')
     ORDER BY u.email LIMIT 500`,[org]),
   databasePool.query('SELECT codigo,modulo,descripcion FROM permisos ORDER BY modulo,codigo'),
   databasePool.query(`SELECT r.nombre,r.descripcion,r.activo,
      ARRAY(SELECT p.codigo FROM roles_permisos rp JOIN permisos p ON p.id=rp.permiso_id
      WHERE rp.rol_id=r.id ORDER BY p.codigo) AS permisos,
      ARRAY(SELECT p.codigo FROM organizaciones_roles_permisos_restringidos bloqueado
        JOIN permisos p ON p.id=bloqueado.permiso_id
        WHERE bloqueado.rol_id=r.id AND bloqueado.organizacion_id=$2 ORDER BY p.codigo)
        AS "permisosRestringidos"
      FROM roles r WHERE r.nombre=ANY($1::text[]) ORDER BY r.nombre`,
      [['ADMINISTRADOR','COORDINADOR','CAMPO','FINANZAS','DONANTE'],org])
  ]);
  res.set('Cache-Control','no-store');
  res.json({cuentas:cuentas.rows,permisos:permisos.rows,roles:perfiles.rows,yo:req.auth!.sub});
 }catch(error){console.error('Error consultando configuración de accesos:',error);
  res.status(500).json({message:'No se pudo consultar la configuración de accesos.'});}
});

administracionAccesosRouter.put('/cuentas/:id/permisos',async(req,res)=>{
 const id=req.params.id;
 const permitidos=req.body?.permisos;
 if(!esUuid(id)||!Array.isArray(permitidos)||permitidos.length>250||
  !permitidos.every((p:unknown)=>typeof p==='string'&&p.length<=100)||
  new Set(permitidos).size!==permitidos.length){
  res.status(400).json({message:'La lista de permisos no es válida.'});return;
 }
 if(!databasePool){res.status(503).json({message:'Base de datos no disponible.'});return;}
 const client=await databasePool.connect();
 try{
  await client.query('BEGIN');
  const org=req.auth!.organizacionId;
  const entidad=await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[org]);
  const admin=await client.query(`SELECT 1 FROM usuarios u JOIN usuarios_roles ur ON ur.usuario_id=u.id
   JOIN roles r ON r.id=ur.rol_id AND r.nombre='ADMINISTRADOR' AND r.activo
   WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo`,[req.auth!.sub,org]);
  const usuario=await client.query('SELECT id FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo FOR UPDATE',[id,org]);
  if(!entidad.rowCount||!admin.rowCount){await client.query('ROLLBACK');res.status(403).json({message:'Administración no autorizada.'});return;}
  if(!usuario.rowCount){await client.query('ROLLBACK');res.status(404).json({message:'Usuario no disponible en tu organización.'});return;}
  const roles=await client.query(`SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
    WHERE ur.usuario_id=$1 AND r.activo`,[id]);
  if(roles.rows.some((r:{nombre:string})=>['SUPERADMINISTRADOR','ADMINISTRADOR'].includes(r.nombre))){
   await client.query('ROLLBACK');res.status(403).json({message:'No se pueden restringir permisos de cuentas administradoras o de plataforma.'});return;
  }
  const base=await client.query(`SELECT DISTINCT p.id,p.codigo FROM usuarios_roles ur
   JOIN roles r ON r.id=ur.rol_id AND r.activo JOIN roles_permisos rp ON rp.rol_id=r.id
   JOIN permisos p ON p.id=rp.permiso_id WHERE ur.usuario_id=$1
     AND NOT EXISTS (
      SELECT 1 FROM organizaciones_roles_permisos_restringidos bloq
      WHERE bloq.organizacion_id=$2 AND bloq.rol_id=r.id AND bloq.permiso_id=p.id
     )`,[id,org]);
  const disponibles=new Set(base.rows.map((p:{codigo:string})=>p.codigo));
  if(permitidos.some((p:string)=>!disponibles.has(p))){
   await client.query('ROLLBACK');res.status(400).json({message:'Solo podés limitar permisos incluidos en los roles asignados.'});return;
  }
  const anteriores=await client.query(`SELECT p.codigo FROM usuarios_permisos_restringidos restr
   JOIN permisos p ON p.id=restr.permiso_id WHERE restr.usuario_id=$1 AND restr.organizacion_id=$2`,[id,org]);
  await client.query('DELETE FROM usuarios_permisos_restringidos WHERE usuario_id=$1 AND organizacion_id=$2',[id,org]);
  for(const p of base.rows as {id:string;codigo:string}[]){
   if(!permitidos.includes(p.codigo))await client.query(`INSERT INTO usuarios_permisos_restringidos
      (organizacion_id,usuario_id,permiso_id,actualizado_por_usuario_id) VALUES($1,$2,$3,$4)`,
      [org,id,p.id,req.auth!.sub]);
  }
  await client.query(`INSERT INTO bitacora_auditoria
    (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
    VALUES($1,'RESTRINGIR_PERMISOS_USUARIO','usuarios',$2,$3::jsonb,$4::jsonb)`,
    [req.auth!.sub,id,JSON.stringify({restringidos:anteriores.rows.map((r:{codigo:string})=>r.codigo)}),JSON.stringify({permitidos})]);
  await client.query('COMMIT');
  res.json({permisos:permitidos});
 }catch(error){await client.query('ROLLBACK');console.error('Error guardando permisos:',error);
  res.status(500).json({message:'No se pudo actualizar la configuración de permisos.'});
 }finally{client.release();}
});

administracionAccesosRouter.patch('/cuentas/:id/estado',async(req,res)=>{
 const id=req.params.id,activo=req.body?.activo;
 if(!esUuid(id)||typeof activo!=='boolean'){res.status(400).json({message:'Cuenta o estado no válido.'});return;}
 if(id===req.auth!.sub){res.status(409).json({message:'No podés desactivar ni modificar tu propia cuenta desde este panel.'});return;}
 if(!databasePool){res.status(503).json({message:'Base de datos no disponible.'});return;}
 const client=await databasePool.connect();
 try{
  await client.query('BEGIN');
  const org=req.auth!.organizacionId;
  const entidad=await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[org]);
  const admin=await client.query(`SELECT 1 FROM usuarios u JOIN usuarios_roles ur ON ur.usuario_id=u.id
   JOIN roles r ON r.id=ur.rol_id AND r.nombre='ADMINISTRADOR' AND r.activo
   WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo`,[req.auth!.sub,org]);
  if(!entidad.rowCount||!admin.rowCount){await client.query('ROLLBACK');res.status(403).json({message:'Administración no autorizada.'});return;}
  const cuenta=await client.query('SELECT id,activo FROM usuarios WHERE id=$1 AND organizacion_id=$2 FOR UPDATE',[id,org]);
  if(!cuenta.rowCount){await client.query('ROLLBACK');res.status(404).json({message:'Cuenta no encontrada en tu organización.'});return;}
  const r=await client.query(`SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
    WHERE ur.usuario_id=$1`,[id]);
  if(r.rows.some((x:{nombre:string})=>x.nombre==='SUPERADMINISTRADOR')){
   await client.query('ROLLBACK');res.status(403).json({message:'Cuenta de plataforma protegida.'});return;
  }
  if(!activo&&r.rows.some((x:{nombre:string})=>x.nombre==='ADMINISTRADOR')){
   const otros=await client.query(`SELECT COUNT(DISTINCT u.id)::int AS total FROM usuarios u
    JOIN usuarios_roles ur ON ur.usuario_id=u.id JOIN roles r ON r.id=ur.rol_id AND r.activo
    WHERE u.organizacion_id=$1 AND u.activo AND r.nombre='ADMINISTRADOR' AND u.id<>$2`,[org,id]);
   if(!otros.rows[0].total){await client.query('ROLLBACK');
    res.status(409).json({message:'La organización debe conservar al menos un administrador activo.'});return;}
  }
  await client.query('UPDATE usuarios SET activo=$1,actualizado_en=NOW() WHERE id=$2',[activo,id]);
  if(!activo)await client.query('UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW()) WHERE usuario_id=$1',[id]);
  await client.query(`INSERT INTO bitacora_auditoria
   (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
   VALUES($1,'ESTADO_CUENTA_ORGANIZACION','usuarios',$2,$3::jsonb,$4::jsonb)`,
   [req.auth!.sub,id,JSON.stringify({activo:cuenta.rows[0].activo}),JSON.stringify({activo})]);
  await client.query('COMMIT');res.json({id,activo});
 }catch(error){await client.query('ROLLBACK');console.error('Error actualizando estado de cuenta:',error);
  res.status(500).json({message:'No se pudo actualizar el estado de la cuenta.'});
 }finally{client.release();}
});
