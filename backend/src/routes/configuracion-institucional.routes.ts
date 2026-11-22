import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requireRole, requirePermission } from '../middleware/auth.middleware.js';

export const configuracionInstitucionalRouter=Router();
configuracionInstitucionalRoutedatosInstitucion.use(authenticateAccessToken);
const administrar=[requireRole('ADMINISTRADOR'),requirePermission('usuarios.gestionar')];
const color=(valorColor:unknown)=>typeof valorColor==='string'&&/^#[0-9a-fA-F]{6}$/.test(valorColor);
const texto=(valorTexto:unknown,longitudMaxima:number)=>typeof valorTexto==='string'&&valorTexto.length<=longitudMaxima&&!/[<>\x00-\x08\x0B\x0C\x0E-\x1F]/.test(valorTexto);
const formatoLogo=(tipo:string,datos:string)=>{
 if(!['image/png','image/jpeg','image/webp'].includes(tipo)||datos.length>280000||
  !/^[A-Za-z0-9+/]+={0,2}$/.test(datos)||datos.length%4!==0)return false;
 const bytes=BuffedatosInstitucion.from(datos,'base64');
 if(bytes.length>210000||bytes.length<20)return false;
 if(tipo==='image/png')return bytes.subarray(0,8).equals(BuffedatosInstitucion.from([137,80,78,71,13,10,26,10]));
 if(tipo==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 return bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
};
const respuesta=(datosInstitucion:Record<string,unknown>)=>({
 organizacionId:datosInstitucion.organizacionId,
 nombrePublico:datosInstitucion.nombrePublico||datosInstitucion.nombreOrganizacion,
 lema:datosInstitucion.lema||'Recursos que generan desarrollo',
 bienvenidaTitulo:datosInstitucion.bienvenidaTitulo||'Bienvenido a Semilla',
 bienvenidaTexto:datosInstitucion.bienvenidaTexto||'Gestioná tus iniciativas y conocé su impacto comunitario.',
 colorPrimario:datosInstitucion.colorPrimario||'#2D7545',
 colorSecundario:datosInstitucion.colorSecundario||'#D98B36',
 colorFondo:datosInstitucion.colorFondo||'#F5F8F2',
 logo:datosInstitucion.logoBase64&&datosInstitucion.logoTipo?'data:'+datosInstitucion.logoTipo+';base64,'+datosInstitucion.logoBase64:null,
 pdfPapel:datosInstitucion.pdfPapel||'A4',pdfOrientacion:datosInstitucion.pdfOrientacion||'portrait',
 pdfMargenMm:datosInstitucion.pdfMargenMm??18,
 pdfMostrarLogo:datosInstitucion.pdfMostrarLogo??true,pdfMostrarLema:datosInstitucion.pdfMostrarLema??true,
});
const query=`SELECT o.id AS "organizacionId",o.nombre AS "nombreOrganizacion",
 c.nombre_publico AS "nombrePublico",c.lema,c.bienvenida_titulo AS "bienvenidaTitulo",
 c.bienvenida_texto AS "bienvenidaTexto",c.color_primario AS "colorPrimario",
 c.color_secundario AS "colorSecundario",c.color_fondo AS "colorFondo",
 c.logo_base64 AS "logoBase64",c.logo_tipo AS "logoTipo",
 c.pdf_papel AS "pdfPapel",c.pdf_orientacion AS "pdfOrientacion",
 c.pdf_margen_mm AS "pdfMargenMm",c.pdf_mostrar_logo AS "pdfMostrarLogo",
 c.pdf_mostrar_lema AS "pdfMostrarLema"
 FROM organizaciones o LEFT JOIN configuraciones_institucionales c ON c.organizacion_id=o.id
 WHERE o.id=$1 AND o.activo`;

configuracionInstitucionalRoutedatosInstitucion.get('/',async(req,res)=>{
 if(!databasePool){res.status(503).json({message:'Configuración no disponible.'});return;}
 try{
  const {rows}=await databasePool.query(query,[req.auth!.organizacionId]);
  if(!rows.length){res.status(404).json({message:'Organización no disponible.'});return;}
  res.set('Cache-Control','no-store');
  res.json({configuracion:respuesta(rows[0])});
 }catch(error){console.error('Error consultando configuración institucional:',error);
  res.status(500).json({message:'No se pudo consultar la configuración.'});}
});

configuracionInstitucionalRoutedatosInstitucion.put('/',...administrar,async(req,res)=>{
 const datosConfiguracion=req.body||{};
 if(!texto(datosConfiguracion.nombrePublico,150)||!datosConfiguracion.nombrePublico.trim()||
  !texto(datosConfiguracion.lema,240)||!texto(datosConfiguracion.bienvenidaTitulo,160)||!datosConfiguracion.bienvenidaTitulo.trim()||
  !texto(datosConfiguracion.bienvenidaTexto,500)||
  !color(datosConfiguracion.colorPrimario)||!color(datosConfiguracion.colorSecundario)||!color(datosConfiguracion.colorFondo)||
  !['A4','LETTER','LEGAL'].includes(datosConfiguracion.pdfPapel)||
  !['portrait','landscape'].includes(datosConfiguracion.pdfOrientacion)||
  !NumbedatosInstitucion.isInteger(datosConfiguracion.pdfMargenMm)||datosConfiguracion.pdfMargenMm<8||datosConfiguracion.pdfMargenMm>35||
  typeof datosConfiguracion.pdfMostrarLogo!=='boolean'||typeof datosConfiguracion.pdfMostrarLema!=='boolean'||
  !(datosConfiguracion.logo===null||datosConfiguracion.logo===undefined||(typeof datosConfiguracion.logo==='string'&&datosConfiguracion.logo.length<=280100))){
  res.status(400).json({message:'Revisá los campos institucionales, colores, logo y opciones de PDF.'});return;
 }
 let tipo:string|null=null,datos:string|null=null;
 if(typeof datosConfiguracion.logo==='string'){
  const coincidenciaLogo=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(datosConfiguracion.logo);
  if(!coincidenciaLogo||!formatoLogo(coincidenciaLogo[1],coincidenciaLogo[2])){res.status(400).json({message:'Logo inválido. Utilizá PNG, JPEG o WEBP de hasta 200 KB.'});return;}
  tipo=coincidenciaLogo[1];datos=coincidenciaLogo[2];
 }
 if(!databasePool){res.status(503).json({message:'Configuración no disponible.'});return;}
 const client=await databasePool.connect();
 try{
  await client.query('BEGIN');
  const org=req.auth!.organizacionId;
  const actual=await client.query(query,[org]);
  if(!actual.rows.length){await client.query('ROLLBACK');res.status(404).json({message:'Organización no disponible.'});return;}
  const nuevo=await client.query(`INSERT INTO configuraciones_institucionales(
   organizacion_id,nombre_publico,lema,bienvenida_titulo,bienvenida_texto,
   color_primario,color_secundario,color_fondo,logo_base64,logo_tipo,
   pdf_papel,pdf_orientacion,pdf_margen_mm,pdf_mostrar_logo,pdf_mostrar_lema,actualizado_por_usuario_id
  ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
  ON CONFLICT(organizacion_id) DO UPDATE SET
   nombre_publico=EXCLUDED.nombre_publico,lema=EXCLUDED.lema,
   bienvenida_titulo=EXCLUDED.bienvenida_titulo,bienvenida_texto=EXCLUDED.bienvenida_texto,
   color_primario=EXCLUDED.color_primario,color_secundario=EXCLUDED.color_secundario,
   color_fondo=EXCLUDED.color_fondo,logo_base64=EXCLUDED.logo_base64,
   logo_tipo=EXCLUDED.logo_tipo,pdf_papel=EXCLUDED.pdf_papel,
   pdf_orientacion=EXCLUDED.pdf_orientacion,pdf_margen_mm=EXCLUDED.pdf_margen_mm,
   pdf_mostrar_logo=EXCLUDED.pdf_mostrar_logo,pdf_mostrar_lema=EXCLUDED.pdf_mostrar_lema,
   actualizado_por_usuario_id=EXCLUDED.actualizado_por_usuario_id,actualizado_en=NOW()
  RETURNING organizacion_id`,[
   org,datosConfiguracion.nombrePublico.trim(),datosConfiguracion.lema.trim(),datosConfiguracion.bienvenidaTitulo.trim(),datosConfiguracion.bienvenidaTexto.trim(),
   datosConfiguracion.colorPrimario.toUpperCase(),datosConfiguracion.colorSecundario.toUpperCase(),datosConfiguracion.colorFondo.toUpperCase(),
   datos,tipo,datosConfiguracion.pdfPapel,datosConfiguracion.pdfOrientacion,datosConfiguracion.pdfMargenMm,datosConfiguracion.pdfMostrarLogo,datosConfiguracion.pdfMostrarLema,req.auth!.sub,
  ]);
  await client.query(`INSERT INTO bitacora_auditoria
   (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
   VALUES($1,'CONFIGURAR_IDENTIDAD_INSTITUCIONAL','configuraciones_institucionales',$2,$3::jsonb,$4::jsonb)`,[
    req.auth!.sub,org,
    JSON.stringify({nombre:actual.rows[0].nombrePublico,colorPrimario:actual.rows[0].colorPrimario}),
    JSON.stringify({nombre:datosConfiguracion.nombrePublico,colorPrimario:datosConfiguracion.colorPrimario,pdfPapel:datosConfiguracion.pdfPapel,logoActualizado:true}),
   ]);
  await client.query('COMMIT');
  if(!nuevo.rows.length)throw Error('NO_GUARDADO');
  const lectura=await databasePool.query(query,[org]);
  res.set('Cache-Control','no-store');res.json({configuracion:respuesta(lectura.rows[0])});
 }catch(error){await client.query('ROLLBACK');console.error('Error guardando identidad institucional:',error);
  res.status(500).json({message:'No fue posible guardar los cambios.'});
 }finally{client.release();}
});
