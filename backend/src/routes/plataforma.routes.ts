import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken } from '../middleware/auth.middleware.js';
import { superadminActual } from '../modules/plataforma/plataforma.middleware.js';
import { obtenerDashboardPlataforma, obtenerOrganizacionesPlataforma } from '../modules/plataforma/plataforma.controller.js';
import { registrarOrganizacion, modificarEstadoOrganizacion } from '../modules/plataforma/organizaciones.controller.js';
import { obtenerCuentasPlataforma, registrarCuentaPlataforma, modificarEstadoCuentaPlataforma } from '../modules/plataforma/cuentas-plataforma.controller.js';
import { modificarRolesCuentaPlataforma } from '../modules/plataforma/roles-cuentas.controller.js';
import { editarNombreCuentaPlataforma, editarEmailCuentaPlataforma, retirarCuentaPlataformaController } from '../modules/plataforma/edicion-cuentas.controller.js';
import { reemitirCredencialCuentaPlataforma } from '../modules/plataforma/credenciales-cuentas.controller.js';

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
plataformaRouter.use(authenticateAccessToken, superadminActual);

// Resumen de la plataforma para superadministradores, con estadísticas reales.
// Los conteos por tenant se derivan de sus relaciones y no incluyen datos personales.
plataformaRouter.get('/dashboard', obtenerDashboardPlataforma);

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

plataformaRouter.get('/organizaciones', obtenerOrganizacionesPlataforma);

plataformaRouter.post('/organizaciones', registrarOrganizacion);

// Desactivar un tenant suspende su acceso sin borrar sus datos; reactivar lo restaura.
plataformaRouter.patch('/organizaciones/:organizacionId/estado', modificarEstadoOrganizacion);

// Suspender una cuenta conserva su historial, documentos y roles asignados.
plataformaRouter.patch('/organizaciones/:organizacionId/cuentas/:usuarioId/estado', modificarEstadoCuentaPlataforma);

plataformaRouter.get('/organizaciones/:organizacionId/cuentas', obtenerCuentasPlataforma);

plataformaRouter.post('/organizaciones/:organizacionId/cuentas', registrarCuentaPlataforma);

// Nunca se recupera una contraseña anterior: se invalida y se emite una nueva.
plataformaRouter.post('/organizaciones/:organizacionId/cuentas/:usuarioId/credencial-temporal',
  reemitirCredencialCuentaPlataforma);

// El superadministrador puede mantener la identidad visible de cualquier cuenta activa
// de una organización sin cambiar su correo, fotografía ni credenciales.
plataformaRouter.put('/organizaciones/:organizacionId/cuentas/:usuarioId/nombre', editarNombreCuentaPlataforma);

// Retiro por soporte de plataforma: baja lógica auditada que no elimina relaciones históricas.
plataformaRouter.post('/organizaciones/:organizacionId/cuentas/:usuarioId/retirar', retirarCuentaPlataformaController);

// El superadministrador puede corregir correos de cuentas de organizaciones, nunca el suyo.
plataformaRouter.put('/organizaciones/:organizacionId/cuentas/:usuarioId/email', editarEmailCuentaPlataforma);

plataformaRouter.put('/organizaciones/:organizacionId/cuentas/:usuarioId/roles',
  modificarRolesCuentaPlataforma);
