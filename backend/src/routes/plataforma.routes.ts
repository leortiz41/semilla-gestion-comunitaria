import { randomBytes } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { databasePool } from '../config/database.js';
import { hashPassword } from '../security/password.js';
import { authenticateAccessToken } from '../middleware/auth.middleware.js';
import {
  ErrorCredencialTemporal,
  reemitirCredencialTemporalAdministrador,
} from '../services/credenciales-temporales.service.js';

export const plataformaRouter = Router();
const rolesPermitidos = ['ADMINISTRADOR', 'COORDINADOR', 'FINANZAS', 'CAMPO', 'DONANTE'];
const esUuid = (valor: unknown): valor is string => typeof valor === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
const rolesValidos = (rolesSolicitados: unknown): rolesSolicitados is string[] => Array.isArray(rolesSolicitados) && rolesSolicitados.length > 0 &&
  rolesSolicitados.length <= rolesPermitidos.length && rolesSolicitados.every((nombreRol) => typeof nombreRol === 'string' && rolesPermitidos.includes(nombreRol)) &&
  new Set(rolesSolicitados).size === rolesSolicitados.length && (!rolesSolicitados.includes('DONANTE') || rolesSolicitados.length === 1);
const esCorreo = (correo: unknown): correo is string => typeof correo === 'string' && correo.length <= 150 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
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

// Resumen de la plataforma para superadministradores, con estadísticas reales.
// Los conteos por tenant se derivan de sus relaciones y no incluyen datos personales.
plataformaRouter.get('/dashboard', async (_req, res) => {
  try {
    const { rows } = await databasePool!.query(`
      SELECT o.id, o.nombre, o.slug, o.activo, o.creado_en AS "creadoEn",
        (SELECT count(*)::int FROM usuarios u WHERE u.organizacion_id=o.id
          AND NOT EXISTS (SELECT 1 FROM bitacora_auditoria b WHERE b.entidad_id=u.id
          AND b.nombre_entidad='usuarios' AND b.accion='RETIRAR_USUARIO_ORGANIZACION')) AS "usuariosVigentes",
        (SELECT count(*)::int FROM usuarios u WHERE u.organizacion_id=o.id AND u.activo
          AND NOT EXISTS (SELECT 1 FROM bitacora_auditoria b WHERE b.entidad_id=u.id
          AND b.nombre_entidad='usuarios' AND b.accion='RETIRAR_USUARIO_ORGANIZACION')) AS "usuariosActivos",
        (SELECT count(*)::int FROM usuarios u WHERE u.organizacion_id=o.id
          AND EXISTS (SELECT 1 FROM bitacora_auditoria b WHERE b.entidad_id=u.id
          AND b.nombre_entidad='usuarios' AND b.accion='RETIRAR_USUARIO_ORGANIZACION')) AS "usuariosRetirados",
        (SELECT count(*)::int FROM comunidades c WHERE c.organizacion_id=o.id) AS "comunidades",
        (SELECT count(*)::int FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
          WHERE c.organizacion_id=o.id) AS "proyectos",
        (SELECT count(*)::int FROM evidencias e JOIN proyectos p ON p.id=e.proyecto_id
          JOIN comunidades c ON c.id=p.comunidad_id WHERE c.organizacion_id=o.id) AS "evidencias",
        (SELECT max(u.ultimo_acceso_en) FROM usuarios u
          WHERE u.organizacion_id=o.id) AS "ultimoAcceso"
      FROM organizaciones o ORDER BY o.nombre,o.id LIMIT 500
    `);
    const totales = rows.reduce((ac: {
      organizaciones: number; activas: number; suspendidas: number;
      usuariosVigentes: number; usuariosActivos: number; usuariosRetirados: number;
      comunidades: number; proyectos: number; evidencias: number;
    }, fila: Record<string,unknown>) => {
      ac.organizaciones += 1;
      if (fila.activo) ac.activas += 1; else ac.suspendidas += 1;
      for (const campo of ['usuariosVigentes','usuariosActivos','usuariosRetirados','comunidades','proyectos','evidencias'] as const) {
        ac[campo] += Number(fila[campo] ?? 0);
      }
      return ac;
    }, {organizaciones:0,activas:0,suspendidas:0,usuariosVigentes:0,
        usuariosActivos:0,usuariosRetirados:0,comunidades:0,proyectos:0,evidencias:0});
    res.set('Cache-Control','no-store');
    res.json({totales,organizaciones:rows,consultadoEn:new Date().toISOString()});
  } catch(error) {
    console.error('Error consultando métricas SaaS:',errorHttp(error));
    res.status(500).json({message:'No fue posible consultar el dashboard de plataforma.'});
  }
});


plataformaRouter.get('/organizaciones/:organizacionId/accesos',async(req,res)=>{
 const org=req.params.organizacionId;
 if(!esUuid(org)){res.status(400).json({message:'Tenant ID inválido.'});return;}
 try{
  const existe=await databasePool!.query('SELECT id FROM organizaciones WHERE id=$1',[org]);
  if(!existe.rowCount){res.status(404).json({message:'Organización no encontrada.'});return;}
  const [cuentas,permisos,roles]=await Promise.all([
   databasePool!.query('SELECT u.id,u.email,u.activo,'
   +' COALESCE(ARRAY(SELECT DISTINCT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id AND r.activo WHERE ur.usuario_id=u.id ORDER BY r.nombre),ARRAY[]::text[]) AS roles,'
   +' COALESCE(ARRAY(SELECT DISTINCT p.codigo FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id AND r.activo JOIN roles_permisos rp ON rp.rol_id=r.id JOIN permisos p ON p.id=rp.permiso_id WHERE ur.usuario_id=u.id AND NOT EXISTS (SELECT 1 FROM organizaciones_roles_permisos_restringidos b WHERE b.organizacion_id=u.organizacion_id AND b.rol_id=r.id AND b.permiso_id=p.id) ORDER BY p.codigo),ARRAY[]::text[]) AS "permisosBase",'
   +' COALESCE(ARRAY(SELECT p.codigo FROM usuarios_permisos_restringidos b JOIN permisos p ON p.id=b.permiso_id WHERE b.usuario_id=u.id AND b.organizacion_id=$1 ORDER BY p.codigo),ARRAY[]::text[]) AS "permisosRestringidos"'
   +' FROM usuarios u WHERE u.organizacion_id=$1 AND NOT EXISTS(SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id WHERE ur.usuario_id=u.id AND r.nombre=$2)'
   +' AND NOT EXISTS(SELECT 1 FROM bitacora_auditoria b WHERE b.entidad_id=u.id AND b.nombre_entidad=$3 AND b.accion=$4)'
   +' ORDER BY u.email LIMIT 500',[org,'SUPERADMINISTRADOR','usuarios','RETIRAR_USUARIO_ORGANIZACION']),
   databasePool!.query('SELECT codigo,modulo,descripcion FROM permisos ORDER BY modulo,codigo'),
   databasePool!.query('SELECT r.nombre,r.descripcion,r.activo,'
     +' ARRAY(SELECT p.codigo FROM roles_permisos rp JOIN permisos p ON p.id=rp.permiso_id WHERE rp.rol_id=r.id ORDER BY p.codigo) AS permisos,'
     +' ARRAY(SELECT p.codigo FROM organizaciones_roles_permisos_restringidos b JOIN permisos p ON p.id=b.permiso_id WHERE b.organizacion_id=$1 AND b.rol_id=r.id ORDER BY p.codigo) AS "permisosRestringidos"'
     +' FROM roles r WHERE r.nombre=ANY($2::text[]) ORDER BY r.nombre',[org,rolesPermitidos])
  ]);
  res.set('Cache-Control','no-store');
  res.json({cuentas:cuentas.rows,permisos:permisos.rows,roles:roles.rows,yo:req.auth!.sub});
 }catch(error){console.error('Error consultando accesos de tenant:',errorHttp(error));
  res.status(500).json({message:'No fue posible consultar la matriz de accesos.'});}
});

plataformaRouter.put('/organizaciones/:organizacionId/accesos/cuentas/:usuarioId/permisos',async(req,res)=>{
 const {organizacionId:org,usuarioId:id}=req.params,permitidos=req.body?.permisos;
 if(!esUuid(org)||!esUuid(id)||!Array.isArray(permitidos)||permitidos.length>250||
   !permitidos.every((v:unknown)=>typeof v==='string'&&v.length<=100)||
   new Set(permitidos).size!==permitidos.length){
  res.status(400).json({message:'Tenant, cuenta o permisos inválidos.'});return;
 }
 const client=await databasePool!.connect();
 try{
  await client.query('BEGIN');
  const entidad=await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[org]);
  const cuenta=await client.query('SELECT id FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo FOR UPDATE',[id,org]);
  if(!entidad.rowCount||!cuenta.rowCount){await client.query('ROLLBACK');res.status(404).json({message:'Cuenta u organización activa no encontrada.'});return;}
  const retirada=await client.query('SELECT 1 FROM bitacora_auditoria WHERE entidad_id=$1 AND nombre_entidad=$2 AND accion=$3 LIMIT 1',[id,'usuarios','RETIRAR_USUARIO_ORGANIZACION']);
  if(retirada.rowCount){await client.query('ROLLBACK');res.status(409).json({message:'Cuenta retirada.'});return;}
  const roles=await client.query('SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id AND r.activo WHERE ur.usuario_id=$1',[id]);
  if(roles.rows.some((rolAsignado:{nombre:string})=>['ADMINISTRADOR','SUPERADMINISTRADOR'].includes(rolAsignado.nombre))){
   await client.query('ROLLBACK');res.status(403).json({message:'Permisos de administrador protegidos.'});return;
  }
  const base=await client.query('SELECT DISTINCT p.id,p.codigo FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id AND r.activo JOIN roles_permisos rp ON rp.rol_id=r.id JOIN permisos p ON p.id=rp.permiso_id WHERE ur.usuario_id=$1 AND NOT EXISTS(SELECT 1 FROM organizaciones_roles_permisos_restringidos b WHERE b.organizacion_id=$2 AND b.rol_id=r.id AND b.permiso_id=p.id)',[id,org]);
  const validos=new Set(base.rows.map((permisoBase:{codigo:string})=>permisoBase.codigo));
  if(permitidos.some((codigoPermiso:string)=>!validos.has(codigoPermiso))){await client.query('ROLLBACK');res.status(400).json({message:'Los permisos no pueden superar los perfiles asignados.'});return;}
  const previos=await client.query('SELECT p.codigo FROM usuarios_permisos_restringidos r JOIN permisos p ON p.id=r.permiso_id WHERE r.usuario_id=$1 AND r.organizacion_id=$2',[id,org]);
  await client.query('DELETE FROM usuarios_permisos_restringidos WHERE usuario_id=$1 AND organizacion_id=$2',[id,org]);
  for(const permisoBase of base.rows as {id:string;codigo:string}[]){
   if(!permitidos.includes(permisoBase.codigo))await client.query('INSERT INTO usuarios_permisos_restringidos(organizacion_id,usuario_id,permiso_id,actualizado_por_usuario_id) VALUES($1,$2,$3,$4)',[org,id,permisoBase.id,req.auth!.sub]);
  }
  await client.query('INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',[req.auth!.sub,'PLATAFORMA_RESTRINGIR_PERMISOS','usuarios',id,JSON.stringify({organizacionId:org,restringidos:previos.rows.map((permisoPrevio:{codigo:string})=>permisoPrevio.codigo)}),JSON.stringify({organizacionId:org,permitidos})]);
  await client.query('COMMIT');res.set('Cache-Control','no-store');res.json({permisos:permitidos});
 }catch(error){await client.query('ROLLBACK');console.error('Error guardando permisos por tenant:',errorHttp(error));res.status(500).json({message:'No fue posible actualizar permisos.'});}
 finally{client.release();}
});

// Ajustes de permisos del rol limitados exclusivamente al tenant solicitado.
// La tabla de permisos base global nunca se modifica.
plataformaRouter.put('/organizaciones/:organizacionId/accesos/roles/:nombre/permisos', async (req,res)=>{
 const org=req.params.organizacionId, nombre=req.params.nombre, permitidos=req.body?.permisos;
 if(!esUuid(org)||typeof nombre!=='string'||!['COORDINADOR','CAMPO','FINANZAS','DONANTE'].includes(nombre)||
    !Array.isArray(permitidos)||permitidos.length>250||
    !permitidos.every((p:unknown)=>typeof p==='string'&&p.length<=100)||
    new Set(permitidos).size!==permitidos.length){
   res.status(400).json({message:'Tenant, perfil o permisos inválidos.'});return;
 }
 const client=await databasePool!.connect();
 try {
   await client.query('BEGIN');
   // Serializar modificaciones de permisos del mismo tenant.
   const entidad=await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[org]);
   if(!entidad.rowCount){await client.query('ROLLBACK');res.status(404).json({message:'Organización activa no encontrada.'});return;}
   const rol=await client.query('SELECT id FROM roles WHERE nombre=$1 AND activo',[nombre]);
   if(!rol.rowCount){await client.query('ROLLBACK');res.status(404).json({message:'Perfil no disponible.'});return;}
   const id=rol.rows[0].id;
   const base=await client.query('SELECT p.id,p.codigo FROM roles_permisos rp JOIN permisos p ON p.id=rp.permiso_id WHERE rp.rol_id=$1',[id]);
   const autorizados=new Set(base.rows.map((permisoBase:{codigo:string})=>permisoBase.codigo));
   if(permitidos.some((codigoPermiso:string)=>!autorizados.has(codigoPermiso))){
     await client.query('ROLLBACK');res.status(400).json({message:'No se pueden conceder permisos fuera del rol base.'});return;
   }
   const anteriores=await client.query('SELECT p.codigo FROM organizaciones_roles_permisos_restringidos r JOIN permisos p ON p.id=r.permiso_id WHERE r.organizacion_id=$1 AND r.rol_id=$2',[org,id]);
   await client.query('DELETE FROM organizaciones_roles_permisos_restringidos WHERE organizacion_id=$1 AND rol_id=$2',[org,id]);
   for(const permisoBase of base.rows as {id:string;codigo:string}[]){
     if(!permitidos.includes(permisoBase.codigo)){
       await client.query('INSERT INTO organizaciones_roles_permisos_restringidos (organizacion_id,rol_id,permiso_id,actualizado_por_usuario_id) VALUES($1,$2,$3,$4)',[org,id,permisoBase.id,req.auth!.sub]);
     }
   }
   await client.query('INSERT INTO bitacora_auditoria (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',[
     req.auth!.sub,'PLATAFORMA_PERMISOS_ROL_TENANT','roles',id,
     JSON.stringify({organizacionId:org,rol:nombre,restringidos:anteriores.rows.map((permisoAnterior:{codigo:string})=>permisoAnterior.codigo)}),
     JSON.stringify({organizacionId:org,rol:nombre,permisos:permitidos})
   ]);
   await client.query('COMMIT');
   res.set('Cache-Control','no-store');res.json({nombre,permisos:permitidos});
 }catch(error){
   await client.query('ROLLBACK');
   console.error('Error actualizando permisos del rol por tenant:',errorHttp(error));
   res.status(500).json({message:'No fue posible actualizar permisos del rol.'});
 }finally{client.release();}
});

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

// Desactivar un tenant suspende su acceso sin borrar sus datos; reactivar lo restaura.
plataformaRouter.patch('/organizaciones/:organizacionId/estado', async (req,res) => {
  const organizacionId=req.params.organizacionId;
  const activo=req.body?.activo;
  if (!esUuid(organizacionId) || typeof activo!=='boolean') {
    res.status(400).json({message:'Organización o estado inválido.'});return;
  }
  const client=await databasePool!.connect();
  try {
    await client.query('BEGIN');
    const org=await client.query('SELECT id,activo FROM organizaciones WHERE id=$1 FOR UPDATE',[organizacionId]);
    if(!org.rows.length) {
      await client.query('ROLLBACK');res.status(404).json({message:'Organización no encontrada.'});return;
    }
    if (!activo) {
      const propia=await client.query('SELECT 1 FROM usuarios WHERE id=$1 AND organizacion_id=$2',[req.auth!.sub,organizacionId]);
      if(propia.rows.length) {
        await client.query('ROLLBACK');res.status(409).json({message:'No podés desactivar la organización asociada a tu cuenta global.'});return;
      }
    }
    if (org.rows[0].activo!==activo) {
      await client.query('UPDATE organizaciones SET activo=$1 WHERE id=$2',[activo,organizacionId]);
      if(!activo) {
        await client.query(`UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW())
          WHERE usuario_id IN (SELECT id FROM usuarios WHERE organizacion_id=$1)`,[organizacionId]);
      }
      await client.query(`INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
        VALUES($1,'PLATAFORMA_CAMBIAR_ESTADO_ORGANIZACION','organizaciones',$2,$3::jsonb,$4::jsonb)`,
        [req.auth!.sub,organizacionId,JSON.stringify({activo:org.rows[0].activo}),JSON.stringify({activo})]);
    }
    await client.query('COMMIT');
    res.set('Cache-Control','no-store');res.json({id:organizacionId,activo});
  } catch(error) {
    await client.query('ROLLBACK');
    console.error('Error actualizando estado de organización:',errorHttp(error));
    res.status(500).json({message:'No se pudo modificar el estado de la organización.'});
  } finally {client.release();}
});

// Suspender una cuenta conserva su historial, documentos y roles asignados.
plataformaRouter.patch('/organizaciones/:organizacionId/cuentas/:usuarioId/estado', async (req,res) => {
  const {organizacionId,usuarioId}=req.params;
  const activo=req.body?.activo;
  if(!esUuid(organizacionId)||!esUuid(usuarioId)||typeof activo!=='boolean') {
    res.status(400).json({message:'Organización, usuario o estado inválidos.'});return;
  }
  const client=await databasePool!.connect();
  try {
    await client.query('BEGIN');
    const org=await client.query('SELECT id,activo FROM organizaciones WHERE id=$1 FOR UPDATE',[organizacionId]);
    const usuario=await client.query('SELECT id,activo FROM usuarios WHERE id=$1 AND organizacion_id=$2 FOR UPDATE',[usuarioId,organizacionId]);
    if(!org.rows.length||!usuario.rows.length) {
      await client.query('ROLLBACK');res.status(404).json({message:'Cuenta u organización no encontrada.'});return;
    }
    const retirada=await client.query(`SELECT 1 FROM bitacora_auditoria
      WHERE entidad_id=$1 AND nombre_entidad='usuarios' AND accion='RETIRAR_USUARIO_ORGANIZACION' LIMIT 1`,[usuarioId]);
    if(retirada.rowCount){await client.query('ROLLBACK');res.status(409).json({message:'Cuenta retirada: no puede reactivarse.'});return;}
    const global=await client.query(`SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
      WHERE ur.usuario_id=$1 AND r.nombre='SUPERADMINISTRADOR' LIMIT 1`,[usuarioId]);
    if(global.rows.length||usuarioId===req.auth!.sub) {
      await client.query('ROLLBACK');res.status(403).json({message:'No se puede cambiar el estado de una cuenta global desde este módulo.'});return;
    }
    if(usuario.rows[0].activo!==activo) {
      await client.query('UPDATE usuarios SET activo=$1,actualizado_en=NOW() WHERE id=$2',[activo,usuarioId]);
      if(!activo) {
        await client.query('UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW()) WHERE usuario_id=$1',[usuarioId]);
      }
      await client.query(`INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
        VALUES($1,'PLATAFORMA_CAMBIAR_ESTADO_CUENTA','usuarios',$2,$3::jsonb,$4::jsonb)`,
        [req.auth!.sub,usuarioId,JSON.stringify({organizacionId,activo:usuario.rows[0].activo}),JSON.stringify({organizacionId,activo})]);
    }
    await client.query('COMMIT');
    res.set('Cache-Control','no-store');res.json({id:usuarioId,activo});
  } catch(error) {
    await client.query('ROLLBACK');
    console.error('Error actualizando estado de cuenta:',errorHttp(error));
    res.status(500).json({message:'No se pudo modificar el estado de la cuenta.'});
  } finally {client.release();}
});

plataformaRouter.get('/organizaciones/:organizacionId/cuentas', async (req,res) => {
  if (!esUuid(req.params.organizacionId)) { res.status(400).json({message:'Organización inválida.'});return; }
  try {
    const org=await databasePool!.query('SELECT id FROM organizaciones WHERE id=$1', [req.params.organizacionId]);
    if (!org.rows.length) { res.status(404).json({message:'Organización no encontrada.'});return; }
    const {rows}=await databasePool!.query(
      `SELECT u.id,u.email,u.activo,u.debe_cambiar_contrasena AS "debeCambiarContrasena",
         (SELECT pf.nombre_visible FROM perfiles_usuarios pf
           WHERE pf.usuario_id=u.id AND pf.organizacion_id=u.organizacion_id) AS "nombreVisible",
         EXISTS (SELECT 1 FROM bitacora_auditoria b
           WHERE b.entidad_id=u.id AND b.nombre_entidad='usuarios'
             AND b.accion='RETIRAR_USUARIO_ORGANIZACION') AS retirado,
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
  const nombre=typeof req.body?.nombre==='string'?req.body.nombre.trim().replace(/\s+/g,' '):'';
  const apellido=typeof req.body?.apellido==='string'?req.body.apellido.trim().replace(/\s+/g,' '):'';
  const nombreVisible=`${nombre} ${apellido}`.trim();
  const nombreValido=(valor:string)=>valor.length>=2 && valor.length<=100 && !/[\x00-\x1f\x7f]/.test(valor);
  const roles=req.body?.roles;
  if (!esUuid(organizacionId) || !esCorreo(email) || !rolesValidos(roles) ||
      !nombreValido(nombre) || !nombreValido(apellido) || nombreVisible.length>140) {
    res.status(400).json({message:'Revisá organización, nombre, apellido, correo y roles.'});return;
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
      'INSERT INTO perfiles_usuarios(usuario_id,organizacion_id,nombre_visible) VALUES($1,$2,$3)',
      [rows[0].id,organizacionId,nombreVisible]);
    await client.query(
      `INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
       VALUES($1,'PLATAFORMA_CREAR_CUENTA','usuarios',$2,$3::jsonb)`,
      [req.auth!.sub,rows[0].id,JSON.stringify({ organizacionId,email,roles,nombreVisible })]);
    await client.query('COMMIT');
    res.set('Cache-Control','no-store');
    res.status(201).json({cuenta:{...rows[0],roles,nombreVisible},contrasenaTemporal:temporal});
  } catch(error) {
    await client.query('ROLLBACK');
    if(nombreError(error)){res.status(409).json({message:'El correo ya está registrado.'});return;}
    console.error('Error creando cuenta desde plataforma:',errorHttp(error));
    res.status(500).json({message:'No fue posible crear la cuenta.'});
  } finally {client.release();}
});

// Nunca se recupera una contraseña anterior: se invalida y se emite una nueva,
// limitada al administrador de la organización indicada por su identificador.
plataformaRouter.post('/organizaciones/:organizacionId/cuentas/:usuarioId/credencial-temporal', async (req, res) => {
  const { organizacionId, usuarioId } = req.params;
  if (!esUuid(organizacionId) || !esUuid(usuarioId)) {
    res.status(400).json({ message: 'Organización o cuenta inválida.' }); return;
  }

  try {
    const respuesta = await reemitirCredencialTemporalAdministrador(
      { organizacionId, usuarioId, superadministradorId: req.auth!.sub, permitirOtrosRoles: true },
      databasePool!,
    );
    res.set('Cache-Control', 'no-store');
    res.status(201).json(respuesta);
  } catch (error) {
    if (error instanceof ErrorCredencialTemporal) {
      res.status(error.codigoEstado).json({ message: error.message }); return;
    }
    console.error('Error reemitiendo credencial temporal:', errorHttp(error));
    res.status(500).json({ message: 'No fue posible emitir una nueva credencial temporal.' });
  }
});

// El superadministrador puede mantener la identidad visible de cualquier cuenta activa
// de una organización sin cambiar su correo, fotografía ni credenciales.
plataformaRouter.put('/organizaciones/:organizacionId/cuentas/:usuarioId/nombre', async(req,res)=>{
  const {organizacionId,usuarioId}=req.params;
  const nombreVisible=typeof req.body?.nombreVisible==='string'
    ? req.body.nombreVisible.trim().replace(/\s+/g,' '):'';
  if(!esUuid(organizacionId)||!esUuid(usuarioId)||nombreVisible.length<2||
     nombreVisible.length>140||/[\x00-\x1f\x7f]/.test(nombreVisible)){
    res.status(400).json({message:'Organización, cuenta o nombre inválidos.'});return;
  }
  const client=await databasePool!.connect();
  try {
    await client.query('BEGIN');
    const org=await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[organizacionId]);
    const cuenta=await client.query(`SELECT u.id,pf.nombre_visible AS "nombreVisible"
      FROM usuarios u LEFT JOIN perfiles_usuarios pf ON pf.usuario_id=u.id AND pf.organizacion_id=u.organizacion_id
      WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo FOR UPDATE OF u`,[usuarioId,organizacionId]);
    if(!org.rowCount||!cuenta.rowCount){await client.query('ROLLBACK');res.status(404).json({message:'Cuenta u organización no activa.'});return;}
    const protegida=await client.query(`SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
      WHERE ur.usuario_id=$1 AND r.nombre='SUPERADMINISTRADOR' LIMIT 1`,[usuarioId]);
    if(protegida.rowCount){await client.query('ROLLBACK');res.status(403).json({message:'Cuenta de plataforma protegida.'});return;}
    const retirada=await client.query(`SELECT 1 FROM bitacora_auditoria WHERE entidad_id=$1 AND
      nombre_entidad='usuarios' AND accion='RETIRAR_USUARIO_ORGANIZACION' LIMIT 1`,[usuarioId]);
    if(retirada.rowCount){await client.query('ROLLBACK');res.status(409).json({message:'Cuenta retirada.'});return;}
    const anterior=cuenta.rows[0].nombreVisible as string|null;
    if(anterior!==nombreVisible) {
      await client.query(`INSERT INTO perfiles_usuarios(usuario_id,organizacion_id,nombre_visible)
        VALUES($1,$2,$3) ON CONFLICT(usuario_id)
        DO UPDATE SET nombre_visible=EXCLUDED.nombre_visible,actualizado_en=NOW()`,
        [usuarioId,organizacionId,nombreVisible]);
      await client.query(`INSERT INTO bitacora_auditoria
        (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
        VALUES($1,'PLATAFORMA_CAMBIAR_NOMBRE','usuarios',$2,$3::jsonb,$4::jsonb)`,
        [req.auth!.sub,usuarioId,JSON.stringify({organizacionId,nombreVisible:anterior}),
         JSON.stringify({organizacionId,nombreVisible})]);
    }
    await client.query('COMMIT');
    res.set('Cache-Control','no-store');res.json({nombreVisible});
  }catch(error){await client.query('ROLLBACK');console.error('Error editando nombre de cuenta:',errorHttp(error));
    res.status(500).json({message:'No fue posible actualizar el nombre.'});
  }finally{client.release();}
});

// Retiro por soporte de plataforma: baja lógica auditada que no elimina relaciones históricas.
plataformaRouter.post('/organizaciones/:organizacionId/cuentas/:usuarioId/retirar',async(req,res)=>{
  const {organizacionId,usuarioId}=req.params;
  if(!esUuid(organizacionId)||!esUuid(usuarioId)){res.status(400).json({message:'Cuenta u organización inválida.'});return;}
  if(usuarioId===req.auth!.sub){res.status(409).json({message:'No podés retirar tu propia cuenta.'});return;}
  const client=await databasePool!.connect();
  try {
    await client.query('BEGIN');
    const org=await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[organizacionId]);
    const cuenta=await client.query('SELECT id,activo FROM usuarios WHERE id=$1 AND organizacion_id=$2 FOR UPDATE',[usuarioId,organizacionId]);
    if(!org.rowCount||!cuenta.rowCount){await client.query('ROLLBACK');res.status(404).json({message:'Cuenta u organización no disponible.'});return;}
    const roles=await client.query(`SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
      WHERE ur.usuario_id=$1`,[usuarioId]);
    if(roles.rows.some((rolAsignado:{nombre:string})=>rolAsignado.nombre==='SUPERADMINISTRADOR')){
      await client.query('ROLLBACK');res.status(403).json({message:'Cuenta de plataforma protegida.'});return;
    }
    const retirada=await client.query(`SELECT 1 FROM bitacora_auditoria WHERE entidad_id=$1 AND
      nombre_entidad='usuarios' AND accion='RETIRAR_USUARIO_ORGANIZACION' LIMIT 1`,[usuarioId]);
    if(retirada.rowCount){await client.query('ROLLBACK');res.status(409).json({message:'La cuenta ya fue retirada.'});return;}
    if(roles.rows.some((rolAsignado:{nombre:string})=>rolAsignado.nombre==='ADMINISTRADOR')) {
      const otros=await client.query(`SELECT count(DISTINCT u.id)::int AS total FROM usuarios u
        JOIN usuarios_roles ur ON ur.usuario_id=u.id JOIN roles r ON r.id=ur.rol_id AND r.activo
        WHERE u.organizacion_id=$1 AND u.activo AND r.nombre='ADMINISTRADOR' AND u.id<>$2`,[organizacionId,usuarioId]);
      if(!otros.rows[0].total){await client.query('ROLLBACK');
        res.status(409).json({message:'La organización debe conservar al menos un administrador activo.'});return;}
    }
    await client.query('UPDATE usuarios SET activo=FALSE,actualizado_en=NOW() WHERE id=$1',[usuarioId]);
    await client.query('UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW()) WHERE usuario_id=$1',[usuarioId]);
    await client.query(`INSERT INTO bitacora_auditoria
      (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
      VALUES($1,'RETIRAR_USUARIO_ORGANIZACION','usuarios',$2,$3::jsonb,$4::jsonb)`,
      [req.auth!.sub,usuarioId,JSON.stringify({activo:cuenta.rows[0].activo}),
       JSON.stringify({activo:false,retirado:true,organizacionId,desdePlataforma:true})]);
    await client.query('COMMIT');res.set('Cache-Control','no-store');res.json({id:usuarioId,activo:false,retirado:true});
  }catch(error){await client.query('ROLLBACK');console.error('Error retirando cuenta desde plataforma:',errorHttp(error));
    res.status(500).json({message:'No fue posible retirar la cuenta.'});
  }finally{client.release();}
});

// El superadministrador puede corregir correos de cuentas de organizaciones, nunca el suyo.
plataformaRouter.put('/organizaciones/:organizacionId/cuentas/:usuarioId/email', async (req,res) => {
  const { organizacionId, usuarioId } = req.params;
  const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
  if (!esUuid(organizacionId) || !esUuid(usuarioId) || !esCorreo(email)) {
    res.status(400).json({message:'Organización, usuario o correo inválidos.'});return;
  }
  const client=await databasePool!.connect();
  try {
    await client.query('BEGIN');
    const org=await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[organizacionId]);
    const usuario=await client.query(
      'SELECT id,email FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo FOR UPDATE',[usuarioId,organizacionId]);
    if (!org.rows.length || !usuario.rows.length) {
      await client.query('ROLLBACK');res.status(404).json({message:'La cuenta o su organización no están activas.'});return;
    }
    const roles=await client.query(`SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
      WHERE ur.usuario_id=$1 AND r.nombre='SUPERADMINISTRADOR' LIMIT 1`,[usuarioId]);
    if (roles.rows.length) {
      await client.query('ROLLBACK');res.status(403).json({message:'La cuenta global no admite edición desde este módulo.'});return;
    }
    const anterior=usuario.rows[0].email as string;
    if (anterior===email) { await client.query('COMMIT');res.json({email});return; }
    await client.query('UPDATE usuarios SET email=$1,actualizado_en=NOW() WHERE id=$2',[email,usuarioId]);
    await client.query('UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW()) WHERE usuario_id=$1',[usuarioId]);
    await client.query(`INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
      VALUES($1,'PLATAFORMA_CAMBIAR_EMAIL','usuarios',$2,$3::jsonb,$4::jsonb)`,
      [req.auth!.sub,usuarioId,JSON.stringify({organizacionId,email:anterior}),JSON.stringify({organizacionId,email})]);
    await client.query('COMMIT');
    res.set('Cache-Control','no-store');res.json({email});
  } catch(error) {
    await client.query('ROLLBACK');
    if(nombreError(error)) {res.status(409).json({message:'El correo ya está registrado en otra cuenta.'});return;}
    console.error('Error cambiando correo desde plataforma:',errorHttp(error));
    res.status(500).json({message:'No fue posible actualizar el correo.'});
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
    if(actuales.rows.some((rolAsignado:{nombre:string})=>rolAsignado.nombre==='SUPERADMINISTRADOR')) {
      await client.query('ROLLBACK');res.status(403).json({message:'La cuenta de plataforma no admite edición desde este módulo.'});return;
    }
    if(actuales.rows.some((rolAsignado:{nombre:string})=>rolAsignado.nombre==='ADMINISTRADOR') && !roles.includes('ADMINISTRADOR')) {
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
