import type { RequestHandler } from 'express';
import { obtenerMatrizTenant, guardarRestriccionesUsuario, guardarRestriccionesRol } from './permisos-tenant.service.js';

const esUuid = (valor:unknown):valor is string => typeof valor==='string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
const permisosValidos=(valor:unknown):valor is string[]=>Array.isArray(valor)&&valor.length<=250&&
  valor.every(v=>typeof v==='string'&&v.length<=100)&&new Set(valor).size===valor.length;
const errorHttp=(error:unknown)=>error instanceof Error?error.message:'ErrorDesconocido';

export const consultarAccesosTenant: RequestHandler=async(req,res)=>{
  const org=req.params.organizacionId;
  if(!esUuid(org)){res.status(400).json({message:'Tenant ID inválido.'});return;}
  try{
    const matriz=await obtenerMatrizTenant(org);
    if(matriz===null){res.status(404).json({message:'Organización no encontrada.'});return;}
    res.set('Cache-Control','no-store');
    res.json({...matriz,yo:req.auth!.sub});
  }catch(error){
    console.error('Error consultando accesos de tenant:',errorHttp(error));
    res.status(500).json({message:'No fue posible consultar la matriz de accesos.'});
  }
};

export const actualizarPermisosCuentaTenant: RequestHandler=async(req,res)=>{
  const {organizacionId:org,usuarioId:id}=req.params,permitidos=req.body?.permisos;
  if(!esUuid(org)||!esUuid(id)||!permisosValidos(permitidos)){
    res.status(400).json({message:'Tenant, cuenta o permisos inválidos.'});return;
  }
  try{
    const resultado=await guardarRestriccionesUsuario({
      organizacionId:org,usuarioId:id,permisos:permitidos,operadorId:req.auth!.sub,
    });
    switch(resultado){
      case 'NO_DISPONIBLE':res.status(404).json({message:'Cuenta u organización activa no encontrada.'});return;
      case 'RETIRADA':res.status(409).json({message:'Cuenta retirada.'});return;
      case 'PROTEGIDA':res.status(403).json({message:'Permisos de administrador protegidos.'});return;
      case 'PERMISOS_INVALIDOS':res.status(400).json({message:'Los permisos no pueden superar los perfiles asignados.'});return;
    }
    res.set('Cache-Control','no-store');res.json({permisos:permitidos});
  }catch(error){
    console.error('Error guardando permisos por tenant:',errorHttp(error));
    res.status(500).json({message:'No fue posible actualizar permisos.'});
  }
};

export const actualizarPermisosRolTenant: RequestHandler=async(req,res)=>{
  const org=req.params.organizacionId,nombre=req.params.nombre,permitidos=req.body?.permisos;
  if(!esUuid(org)||typeof nombre!=='string'||!['COORDINADOR','CAMPO','FINANZAS','DONANTE'].includes(nombre)||
     !permisosValidos(permitidos)){
    res.status(400).json({message:'Tenant, perfil o permisos inválidos.'});return;
  }
  try{
    const resultado=await guardarRestriccionesRol({
      organizacionId:org,nombre,permisos:permitidos,operadorId:req.auth!.sub,
    });
    switch(resultado){
      case 'ORGANIZACION_INACTIVA':res.status(404).json({message:'Organización activa no encontrada.'});return;
      case 'ROL_INACTIVO':res.status(404).json({message:'Perfil no disponible.'});return;
      case 'PERMISOS_INVALIDOS':res.status(400).json({message:'No se pueden conceder permisos fuera del rol base.'});return;
    }
    res.set('Cache-Control','no-store');res.json({nombre,permisos:permitidos});
  }catch(error){
    console.error('Error actualizando permisos del rol por tenant:',errorHttp(error));
    res.status(500).json({message:'No fue posible actualizar permisos del rol.'});
  }
};
