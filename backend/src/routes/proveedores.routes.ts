import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { esUuid } from '../domain/expediente.js';

export const proveedoresRouter=Router();
proveedoresRouter.use(authenticateAccessToken,requireRole('ADMINISTRADOR','COORDINADOR','CAMPO'),requirePermission('pagos.ver'));
const modificar=[requireRole('ADMINISTRADOR','COORDINADOR'),requirePermission('pagos.gestionar')];
const tipos=['PROVEEDOR','CONTRATISTA','SERVICIOS','PROFESIONAL'];

function validar(body:unknown){
  const v=body && typeof body==='object' && !Array.isArray(body)?body as Record<string,unknown>:{};
  const campo=(nombre:string,max:number)=>v[nombre] == null?'':typeof v[nombre]==='string'&&v[nombre].trim().length<=max?v[nombre].trim():null;
  return {nombre:campo('nombre',180),tipo:campo('tipo',30),categoria:campo('categoria',100),
    rtn:campo('rtn',30),propietario:campo('propietario',180),direccion:campo('direccion',1000),
    telefono:campo('telefono',60),email:campo('email',180),observaciones:campo('observaciones',2000)};
}

proveedoresRouter.get('/',async(req,res)=>{
  if(!databasePool){res.status(503).json({message:'Base de datos no disponible.'});return;}
  try{
    const {rows}=await databasePool.query(
      `SELECT id,nombre_comercial AS nombre,tipo,categoria,rtn,propietario,direccion,telefono,email,
         observaciones,activo,creado_en AS "creadoEn"
       FROM proveedores WHERE organizacion_id=$1 ORDER BY activo DESC,nombre_comercial,id LIMIT 500`,
      [req.auth!.organizacionId]);
    res.set('Cache-Control','no-store');res.json({proveedores:rows});
  }catch(error){console.error('Error consultando proveedores:',error);
    res.status(500).json({message:'No se pudieron consultar los proveedores.'});}
});

proveedoresRouter.post('/',...modificar,async(req,res)=>{
  const d=validar(req.body);
  if(!d.nombre||!d.tipo||!tipos.includes(d.tipo)||
     [d.categoria,d.rtn,d.propietario,d.direccion,d.telefono,d.email,d.observaciones].some(x=>x===null)||
     (d.email&& !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))){
    res.status(400).json({message:'Revisá nombre, tipo y datos de contacto.'});return;
  }
  if(!databasePool){res.status(503).json({message:'Base de datos no disponible.'});return;}
  try{
    const {rows}=await databasePool.query(
      `INSERT INTO proveedores(organizacion_id,nombre_comercial,tipo,categoria,rtn,propietario,direccion,telefono,email,observaciones)
       VALUES($1,$2,$3,NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),NULLIF($10,''))
       RETURNING id`,
       [req.auth!.organizacionId,d.nombre,d.tipo,d.categoria,d.rtn,d.propietario,d.direccion,d.telefono,d.email,d.observaciones]);
    res.status(201).json({id:rows[0].id});
  }catch(error){
    if((error as {code?:string}).code==='23505'){res.status(409).json({message:'El RTN ya está registrado en esta organización.'});return;}
    console.error('Error creando proveedor:',error);res.status(500).json({message:'No se pudo registrar el proveedor.'});
  }
});

proveedoresRouter.put('/:id',...modificar,async(req,res)=>{
  if(!esUuid(req.params.id)){res.status(400).json({message:'Identificador no válido.'});return;}
  const d=validar(req.body),activo=req.body?.activo;
  if(!d.nombre||!d.tipo||!tipos.includes(d.tipo)||typeof activo!=='boolean'||
     [d.categoria,d.rtn,d.propietario,d.direccion,d.telefono,d.email,d.observaciones].some(x=>x===null)||
     (d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))){
    res.status(400).json({message:'Datos del proveedor no válidos.'});return;
  }
  if(!databasePool){res.status(503).json({message:'Base de datos no disponible.'});return;}
  try{
    const {rowCount}=await databasePool.query(
      `UPDATE proveedores SET nombre_comercial=$3,tipo=$4,categoria=NULLIF($5,''),rtn=NULLIF($6,''),
         propietario=NULLIF($7,''),direccion=NULLIF($8,''),telefono=NULLIF($9,''),
         email=NULLIF($10,''),observaciones=NULLIF($11,''),activo=$12,actualizado_en=NOW()
       WHERE id=$1 AND organizacion_id=$2`,
      [req.params.id,req.auth!.organizacionId,d.nombre,d.tipo,d.categoria,d.rtn,d.propietario,d.direccion,d.telefono,d.email,d.observaciones,activo]);
    if(!rowCount){res.status(404).json({message:'Proveedor no encontrado.'});return;}
    res.sendStatus(204);
  }catch(error){
    if((error as {code?:string}).code==='23505'){res.status(409).json({message:'RTN duplicado.'});return;}
    console.error('Error actualizando proveedor:',error);res.status(500).json({message:'No se pudo actualizar el proveedor.'});
  }
});
