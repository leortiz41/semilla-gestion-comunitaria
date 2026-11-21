import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken } from '../middleware/auth.middleware.js';

export const perfilRouter=Router();
perfilRouter.use(authenticateAccessToken);

const fotoValida=(entrada:string):{tipo:string;datos:string}|null=>{
 const coincidencia=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(entrada);
 if(!coincidencia)return null;
 const [,tipo,datos]=coincidencia;
 if(datos.length>280000||datos.length%4!==0)return null;
 const bytes=Buffer.from(datos,'base64');
 if(bytes.length<24||bytes.length>200000)return null;
 if(tipo==='image/png'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return null;
 if(tipo==='image/jpeg'&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))return null;
 if(tipo==='image/webp'&&!(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'))return null;
 return {tipo,datos};
};
perfilRouter.get('/',async(req,res)=>{
 if(!databasePool){res.status(503).json({message:'Perfil no disponible.'});return;}
 try{
  const {rows}=await databasePool.query(`SELECT u.id,u.email,u.ultimo_acceso_en AS "ultimoAcceso",
   NULLIF(CONCAT_WS(' ',p.primer_nombre,p.primer_apellido),'') AS "nombreRegistro",
   pf.nombre_visible AS "nombreVisible",pf.foto_base64 AS "fotoBase64",pf.foto_tipo AS "fotoTipo",
   o.nombre AS organizacion
   FROM usuarios u JOIN organizaciones o ON o.id=u.organizacion_id AND o.activo
   LEFT JOIN empleados e ON e.id=u.empleado_id LEFT JOIN personas p ON p.id=e.persona_id
   LEFT JOIN perfiles_usuarios pf ON pf.usuario_id=u.id AND pf.organizacion_id=u.organizacion_id
   WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo LIMIT 1`,
   [req.auth!.sub,req.auth!.organizacionId]);
  if(!rows.length){res.status(404).json({message:'No se encontró tu perfil.'});return;}
  const p=rows[0];
  res.set('Cache-Control','private, no-store');
  res.json({perfil:{nombreVisible:p.nombreVisible||p.nombreRegistro||'',
   foto:p.fotoBase64&&p.fotoTipo?'data:'+p.fotoTipo+';base64,'+p.fotoBase64:null,
   email:p.email,organizacion:p.organizacion,ultimoAcceso:p.ultimoAcceso}});
 }catch(error){console.error('Error consultando perfil:',error);
  res.status(500).json({message:'No fue posible consultar tu perfil.'});}
});
perfilRouter.put('/',async(req,res)=>{
 const nombre=req.body?.nombreVisible,foto=req.body?.foto;
 if(typeof nombre!=='string'||nombre.trim().length>140||/[<>\x00-\x1f]/.test(nombre)||
    !(foto===null||typeof foto==='string'&&foto.length<=280100)){
  res.status(400).json({message:'Nombre o fotografía inválidos.'});return;
 }
 const archivo=typeof foto==='string'?fotoValida(foto):null;
 if(foto!==null&&!archivo){res.status(400).json({message:'La fotografía debe ser JPG, PNG o WEBP y pesar menos de 200 KB.'});return;}
 if(!databasePool){res.status(503).json({message:'Perfil no disponible.'});return;}
 const cliente=await databasePool.connect();
 try{
  await cliente.query('BEGIN');
  const {rows}=await cliente.query(`SELECT id FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo FOR UPDATE`,
   [req.auth!.sub,req.auth!.organizacionId]);
  if(!rows.length){await cliente.query('ROLLBACK');res.status(404).json({message:'Cuenta no disponible.'});return;}
  await cliente.query(`INSERT INTO perfiles_usuarios(usuario_id,organizacion_id,nombre_visible,foto_base64,foto_tipo)
   VALUES ($1,$2,$3,$4,$5)
   ON CONFLICT(usuario_id) DO UPDATE SET
    nombre_visible=EXCLUDED.nombre_visible,foto_base64=EXCLUDED.foto_base64,
    foto_tipo=EXCLUDED.foto_tipo,actualizado_en=NOW()`,
   [req.auth!.sub,req.auth!.organizacionId,nombre.trim()||null,archivo?.datos||null,archivo?.tipo||null]);
  await cliente.query(`INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
   VALUES ($1,'ACTUALIZAR_PERFIL_PROPIO','usuarios',$1,$2::jsonb)`,
   [req.auth!.sub,JSON.stringify({nombreVisibleActualizado:true,fotografiaActualizada:true})]);
  await cliente.query('COMMIT');
  res.set('Cache-Control','private, no-store');
  res.json({perfil:{nombreVisible:nombre.trim(),foto:archivo?'data:'+archivo.tipo+';base64,'+archivo.datos:null}});
 }catch(error){await cliente.query('ROLLBACK');console.error('Error guardando perfil:',error);
  res.status(500).json({message:'No fue posible guardar tu perfil.'});}
 finally{cliente.release();}
});
