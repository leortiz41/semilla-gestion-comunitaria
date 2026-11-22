import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { esUuid } from '../domain/expediente.js';

export const proveedoresRouter=Router();
proveedoresRouter.use(authenticateAccessToken,requireRole('ADMINISTRADOR','COORDINADOR','CAMPO'),requirePermission('pagos.ver'));
const modificar=[requireRole('ADMINISTRADOR','COORDINADOR'),requirePermission('pagos.gestionar')];
const tiposBase=[
  {codigo:'PROVEEDOR',nombre:'Proveedor',descripcion:'Suministra materiales, alimentos, equipos u otros bienes.'},
  {codigo:'CONTRATISTA',nombre:'Contratista',descripcion:'Realiza una obra o actividad contratada, por ejemplo construcción.'},
  {codigo:'SERVICIOS',nombre:'Servicios',descripcion:'Brinda transporte, mantenimiento, logística u otros servicios.'},
  {codigo:'PROFESIONAL',nombre:'Profesional independiente',descripcion:'Presta servicios técnicos, profesionales o de consultoría.'},
];

async function tipoAutorizado(tipo:string,organizacionId:string):Promise<boolean>{
  if(tiposBase.some(tipoProveedor=>tipoProveedor.codigo===tipo))return true;
  if(!databasePool)return false;
  const {rowCount}=await databasePool.query(
    'SELECT 1 FROM tipos_proveedor WHERE codigo=$1 AND organizacion_id=$2 AND activo',
    [tipo,organizacionId],
  );
  return Boolean(rowCount);
}

proveedoresRouter.get('/tipos',async(req,res)=>{
  if(!databasePool){res.status(503).json({message:'Base de datos no disponible.'});return;}
  try{
    const {rows}=await databasePool.query(
      `SELECT codigo,nombre,descripcion FROM tipos_proveedor
       WHERE organizacion_id=$1 AND activo ORDER BY nombre,id`,[req.auth!.organizacionId]);
    res.set('Cache-Control','no-store');
    res.json({tipos:[...tiposBase,...rows]});
  }catch(error){console.error('Error consultando tipos de proveedor:',error);
    res.status(500).json({message:'No fue posible consultar los tipos.'});}
});

proveedoresRouter.post('/tipos',...modificar,async(req,res)=>{
  const nombre=typeof req.body?.nombre==='string'?req.body.nombre.trim():'';
  const descripcion=typeof req.body?.descripcion==='string'?req.body.descripcion.trim():'';
  if(nombre.length<2||nombre.length>80||descripcion.length>240){
    res.status(400).json({message:'Ingresá un nombre de 2 a 80 caracteres y una descripción de hasta 240.'});return;
  }
  if(tiposBase.some(tipoProveedor=>tipoProveedor.nombre.toLocaleLowerCase('es')===nombre.toLocaleLowerCase('es'))){
    res.status(409).json({message:'Este tipo ya está en la lista.'});return;
  }
  if(!databasePool){res.status(503).json({message:'Base de datos no disponible.'});return;}
  try{
    const codigo='TIPO_'+randomUUID().replaceAll('-','').slice(0,20).toUpperCase();
    const {rows}=await databasePool.query(
      `INSERT INTO tipos_proveedor(organizacion_id,codigo,nombre,descripcion)
       VALUES($1,$2,$3,NULLIF($4,'')) RETURNING codigo,nombre,descripcion`,
      [req.auth!.organizacionId,codigo,nombre,descripcion]);
    res.status(201).json({tipo:rows[0]});
  }catch(error){
    if((error as {code?:string}).code==='23505'){
      res.status(409).json({message:'Ya existe un tipo con ese nombre en la organización.'});return;
    }
    console.error('Error registrando tipo de proveedor:',error);
    res.status(500).json({message:'No fue posible registrar el tipo.'});
  }
});

function validarProveedor(entradaProveedor:unknown){
  const datosProveedor=entradaProveedor && typeof entradaProveedor==='object' && !Array.isArray(entradaProveedor)?entradaProveedor as Record<string,unknown>:{};
  const campo=(nombre:string,longitudMaxima:number)=>datosProveedor[nombre] == null?'':typeof datosProveedor[nombre]==='string'&&datosProveedor[nombre].trim().length<=longitudMaxima?datosProveedor[nombre].trim():null;
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
  const proveedorValidado=validarProveedor(req.body);
  if(!proveedorValidado.nombre||!proveedorValidado.tipo||!(await tipoAutorizado(proveedorValidado.tipo,req.auth!.organizacionId))||
     [proveedorValidado.categoria,proveedorValidado.rtn,proveedorValidado.propietario,proveedorValidado.direccion,proveedorValidado.telefono,proveedorValidado.email,proveedorValidado.observaciones].some(valorOpcional=>valorOpcional===null)||
     (proveedorValidado.email&& !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proveedorValidado.email))){
    res.status(400).json({message:'Revisá nombre, tipo y datos de contacto.'});return;
  }
  if(!databasePool){res.status(503).json({message:'Base de datos no disponible.'});return;}
  try{
    const {rows}=await databasePool.query(
      `INSERT INTO proveedores(organizacion_id,nombre_comercial,tipo,categoria,rtn,propietario,direccion,telefono,email,observaciones)
       VALUES($1,$2,$3,NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),NULLIF($10,''))
       RETURNING id`,
       [req.auth!.organizacionId,proveedorValidado.nombre,proveedorValidado.tipo,proveedorValidado.categoria,proveedorValidado.rtn,proveedorValidado.propietario,proveedorValidado.direccion,proveedorValidado.telefono,proveedorValidado.email,proveedorValidado.observaciones]);
    res.status(201).json({id:rows[0].id});
  }catch(error){
    if((error as {code?:string}).code==='23505'){res.status(409).json({message:'El RTN ya está registrado en esta organización.'});return;}
    console.error('Error creando proveedor:',error);res.status(500).json({message:'No se pudo registrar el proveedor.'});
  }
});

proveedoresRouter.put('/:id',...modificar,async(req,res)=>{
  if(!esUuid(req.params.id)){res.status(400).json({message:'Identificador no válido.'});return;}
  const proveedorValidado=validarProveedor(req.body),activo=req.body?.activo;
  if(!proveedorValidado.nombre||!proveedorValidado.tipo||!(await tipoAutorizado(proveedorValidado.tipo,req.auth!.organizacionId))||typeof activo!=='boolean'||
     [proveedorValidado.categoria,proveedorValidado.rtn,proveedorValidado.propietario,proveedorValidado.direccion,proveedorValidado.telefono,proveedorValidado.email,proveedorValidado.observaciones].some(valorOpcional=>valorOpcional===null)||
     (proveedorValidado.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proveedorValidado.email))){
    res.status(400).json({message:'Datos del proveedor no válidos.'});return;
  }
  if(!databasePool){res.status(503).json({message:'Base de datos no disponible.'});return;}
  try{
    const {rowCount}=await databasePool.query(
      `UPDATE proveedores SET nombre_comercial=$3,tipo=$4,categoria=NULLIF($5,''),rtn=NULLIF($6,''),
         propietario=NULLIF($7,''),direccion=NULLIF($8,''),telefono=NULLIF($9,''),
         email=NULLIF($10,''),observaciones=NULLIF($11,''),activo=$12,actualizado_en=NOW()
       WHERE id=$1 AND organizacion_id=$2`,
      [req.params.id,req.auth!.organizacionId,proveedorValidado.nombre,proveedorValidado.tipo,proveedorValidado.categoria,proveedorValidado.rtn,proveedorValidado.propietario,proveedorValidado.direccion,proveedorValidado.telefono,proveedorValidado.email,proveedorValidado.observaciones,activo]);
    if(!rowCount){res.status(404).json({message:'Proveedor no encontrado.'});return;}
    res.sendStatus(204);
  }catch(error){
    if((error as {code?:string}).code==='23505'){res.status(409).json({message:'RTN duplicado.'});return;}
    console.error('Error actualizando proveedor:',error);res.status(500).json({message:'No se pudo actualizar el proveedor.'});
  }
});
