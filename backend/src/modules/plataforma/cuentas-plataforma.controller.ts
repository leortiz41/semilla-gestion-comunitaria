import type { RequestHandler } from 'express';
import { listarCuentasPlataforma, crearCuentaPlataforma, actualizarEstadoCuentaPlataforma } from './cuentas-plataforma.service.js';

const esUuid = (valor: unknown): valor is string => typeof valor === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
const esCorreo = (correo: unknown): correo is string => typeof correo === 'string' && correo.length <= 150 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
const rolesPermitidos=['ADMINISTRADOR','COORDINADOR','FINANZAS','CAMPO','DONANTE'];
const rolesValidos=(roles:unknown):roles is string[]=>Array.isArray(roles)&&roles.length>0&&
  roles.length<=rolesPermitidos.length && roles.every((r)=>typeof r==='string'&&rolesPermitidos.includes(r))&&
  new Set(roles).size===roles.length&&(!roles.includes('DONANTE')||roles.length===1);
const nombreError=(error:unknown)=>(error as {code?:string}).code==='23505';
const errorHttp=(error:unknown)=>error instanceof Error?error.message:'ErrorDesconocido';

export const obtenerCuentasPlataforma: RequestHandler=async(req,res)=>{
  const organizacionId=req.params.organizacionId;
  if(!esUuid(organizacionId)){res.status(400).json({message:'Organización inválida.'});return;}
  try {
    const cuentas=await listarCuentasPlataforma(organizacionId);
    if(cuentas===null){res.status(404).json({message:'Organización no encontrada.'});return;}
    res.set('Cache-Control','no-store');res.json({cuentas});
  } catch(error) {
    console.error('Error consultando cuentas de plataforma:',errorHttp(error));
    res.status(500).json({message:'No se pudieron consultar las cuentas.'});
  }
};

export const registrarCuentaPlataforma: RequestHandler=async(req,res)=>{
  const organizacionId=req.params.organizacionId;
  const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
  const nombre=typeof req.body?.nombre==='string'?req.body.nombre.trim().replace(/\s+/g,' '):'';
  const apellido=typeof req.body?.apellido==='string'?req.body.apellido.trim().replace(/\s+/g,' '):'';
  const nombreVisible=`${nombre} ${apellido}`.trim();
  const nombreValido=(valor:string)=>valor.length>=2&&valor.length<=100&&!/[\x00-\x1f\x7f]/.test(valor);
  const roles=req.body?.roles;
  if(!esUuid(organizacionId)||!esCorreo(email)||!rolesValidos(roles)||
      !nombreValido(nombre)||!nombreValido(apellido)||nombreVisible.length>140){
    res.status(400).json({message:'Revisá organización, nombre, apellido, correo y roles.'});return;
  }
  try {
    const resultado=await crearCuentaPlataforma({organizacionId,email,nombreVisible,roles},req.auth!.sub);
    if(resultado.estado==='ORGANIZACION_INACTIVA'){
      res.status(404).json({message:'Organización no encontrada o inactiva.'});return;
    }
    if(resultado.estado==='ROLES_NO_DISPONIBLES'){
      res.status(400).json({message:'Hay roles no disponibles.'});return;
    }
    res.set('Cache-Control','no-store');
    res.status(201).json({cuenta:resultado.cuenta,contrasenaTemporal:resultado.contrasenaTemporal});
  } catch(error) {
    if(nombreError(error)){res.status(409).json({message:'El correo ya está registrado.'});return;}
    console.error('Error creando cuenta desde plataforma:',errorHttp(error));
    res.status(500).json({message:'No fue posible crear la cuenta.'});
  }
};

export const modificarEstadoCuentaPlataforma: RequestHandler=async(req,res)=>{
  const {organizacionId,usuarioId}=req.params;
  const activo=req.body?.activo;
  if(!esUuid(organizacionId)||!esUuid(usuarioId)||typeof activo!=='boolean'){
    res.status(400).json({message:'Organización, usuario o estado inválidos.'});return;
  }
  try {
    const resultado=await actualizarEstadoCuentaPlataforma({organizacionId,usuarioId,activo,operadorId:req.auth!.sub});
    if(resultado.estado==='NO_ENCONTRADA'){
      res.status(404).json({message:'Cuenta u organización no encontrada.'});return;
    }
    if(resultado.estado==='RETIRADA'){
      res.status(409).json({message:'Cuenta retirada: no puede reactivarse.'});return;
    }
    if(resultado.estado==='PROTEGIDA'){
      res.status(403).json({message:'No se puede cambiar el estado de una cuenta global desde este módulo.'});return;
    }
    res.set('Cache-Control','no-store');res.json({id:usuarioId,activo});
  } catch(error) {
    console.error('Error actualizando estado de cuenta:',errorHttp(error));
    res.status(500).json({message:'No se pudo modificar el estado de la cuenta.'});
  }
};
