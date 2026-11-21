import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission, requireRole } from '../middleware/auth.middleware.js';

export const auditoriaRouter=Router();
auditoriaRouter.use(authenticateAccessToken,requireRole('ADMINISTRADOR','COORDINADOR'),requirePermission('auditoria.ver'));

const camposSecretos=/password|contrasena|contraseña|hash|token|secret|credencial|authorization|cookie|api.?key|rtn|dni|identidad|cuenta.?bancaria|numero.?cuenta|firma|documento.?identidad|telefono|email|correo|direccion|direccion_ip|agente_usuario/i;
function redactar(valor:unknown,nivel=0):unknown {
 if(nivel>7)return '[Contenido resumido]';
 if(valor===null||typeof valor==='number'||typeof valor==='boolean')return valor;
 if(typeof valor==='string')return valor.length>400?valor.slice(0,400)+'…':valor;
 if(Array.isArray(valor))return valor.slice(0,40).map(item=>redactar(item,nivel+1));
 if(typeof valor==='object')return Object.fromEntries(Object.entries(valor as Record<string,unknown>)
  .slice(0,80).map(([k,v])=>[k,camposSecretos.test(k)?'[REDACTADO]':redactar(v,nivel+1)]));
 return undefined;
}
function fecha(valor:unknown):string|null{
 if(typeof valor!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(valor))return null;
 const d=new Date(valor+'T00:00:00Z');
 return Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==valor?null:valor;
}
function parametros(q:Record<string,unknown>){
 const desde=fecha(q.desde),hasta=fecha(q.hasta);
 if((q.desde&&!desde)||(q.hasta&&!hasta)||(desde&&hasta&&desde>hasta))throw Error('RANGO');
 const usuario=typeof q.usuario==='string'&&/^[a-f0-9-]{36}$/i.test(q.usuario)?q.usuario:null;
 if(q.usuario&&!usuario)throw Error('USUARIO');
 const accion=typeof q.accion==='string'?q.accion.trim().slice(0,80):'';
 const entidad=typeof q.entidad==='string'?q.entidad.trim().slice(0,80):'';
 if((accion&&!/^[A-Z0-9_]+$/.test(accion))||(entidad&&!/^[a-z0-9_]+$/.test(entidad)))throw Error('FILTRO');
 const condiciones=['u.organizacion_id=$1'];
 const args:unknown[]=[];
 if(desde){args.push(desde);condiciones.push('b.creado_en >= $'+(args.length+1)+'::date');}
 if(hasta){args.push(hasta);condiciones.push("b.creado_en < ($"+(args.length+1)+"::date + interval '1 day')");}
 if(usuario){args.push(usuario);condiciones.push('b.usuario_id=$'+(args.length+1));}
 if(accion){args.push(accion);condiciones.push('b.accion=$'+(args.length+1));}
 if(entidad){args.push(entidad);condiciones.push('b.nombre_entidad=$'+(args.length+1));}
 return {condiciones:condiciones.join(' AND '),args};
}
const join='FROM bitacora_auditoria b JOIN usuarios u ON u.id=b.usuario_id';
const columnas=`b.id,b.accion,b.nombre_entidad AS entidad,b.entidad_id AS "entidadId",
 b.creado_en AS fecha,u.email AS usuario,b.usuario_id AS "usuarioId",
 b.valores_anteriores AS antes,b.valores_nuevos AS despues`;
const presentar=(r:Record<string,unknown>)=>({
 id:r.id,accion:r.accion,entidad:r.entidad,entidadId:r.entidadId,
 fecha:r.fecha,usuario:r.usuario,usuarioId:r.usuarioId,
 antes:redactar(r.antes),despues:redactar(r.despues),
});
function errorConsulta(res:import('express').Response,e:unknown){
 if(e instanceof Error&&['RANGO','USUARIO','FILTRO'].includes(e.message)){
  res.status(400).json({message:'Filtros de auditoría no válidos.'});return;
 }
 console.error('Error consultando auditoría:',e);
 res.status(500).json({message:'No fue posible consultar la auditoría.'});
}

auditoriaRouter.get('/resumen',async(req,res)=>{
 if(!databasePool){res.status(503).json({message:'Auditoría no disponible.'});return;}
 try{
  const {condiciones,args}=parametros(req.query as Record<string,unknown>);
  const [totales,acciones,entidades,usuarios]=await Promise.all([
   databasePool.query(`SELECT COUNT(*)::int AS total,
    COUNT(*) FILTER(WHERE b.creado_en >= CURRENT_DATE)::int AS hoy,
    COUNT(*) FILTER(WHERE b.creado_en >= NOW()-interval '7 days')::int AS semana,
    COUNT(DISTINCT b.usuario_id)::int AS actores
    ${join} WHERE ${condiciones}`,[req.auth!.organizacionId,...args]),
   databasePool.query(`SELECT b.accion,COUNT(*)::int AS total ${join}
    WHERE ${condiciones} GROUP BY b.accion ORDER BY total DESC,b.accion LIMIT 30`,
    [req.auth!.organizacionId,...args]),
   databasePool.query(`SELECT b.nombre_entidad AS entidad,COUNT(*)::int AS total ${join}
    WHERE ${condiciones} GROUP BY b.nombre_entidad ORDER BY total DESC,b.nombre_entidad LIMIT 30`,
    [req.auth!.organizacionId,...args]),
   databasePool.query(`SELECT DISTINCT u.id,u.email ${join}
    WHERE ${condiciones} ORDER BY u.email LIMIT 300`,[req.auth!.organizacionId,...args]),
  ]);
  res.set('Cache-Control','no-store');
  res.json({totales:totales.rows[0],acciones:acciones.rows,entidades:entidades.rows,usuarios:usuarios.rows});
 }catch(e){errorConsulta(res,e);}
});

auditoriaRouter.get('/eventos',async(req,res)=>{
 if(!databasePool){res.status(503).json({message:'Auditoría no disponible.'});return;}
 try{
  const {condiciones,args}=parametros(req.query as Record<string,unknown>);
  const pagina=Math.max(1,Math.min(100000,Number(req.query.pagina)||1));
  const tamano=Math.max(1,Math.min(100,Number(req.query.tamano)||25));
  const offset=(pagina-1)*tamano;
  const [conteo,registros]=await Promise.all([
   databasePool.query(`SELECT COUNT(*)::int AS total ${join} WHERE ${condiciones}`,
    [req.auth!.organizacionId,...args]),
   databasePool.query(`SELECT ${columnas} ${join} WHERE ${condiciones}
    ORDER BY b.creado_en DESC,b.id DESC LIMIT $${args.length+2} OFFSET $${args.length+3}`,
    [req.auth!.organizacionId,...args,tamano,offset]),
  ]);
  res.set('Cache-Control','no-store');
  res.json({total:conteo.rows[0].total,pagina,tamano,eventos:registros.rows.map(presentar)});
 }catch(e){errorConsulta(res,e);}
});

function csvCampo(v:unknown){
 const texto=String(v??'').replace(/\r|\n/g,' ').slice(0,500);
 const seguro=/^[=+@\-\t]/.test(texto)?'\''+texto:texto;
 return '"'+seguro.replace(/"/g,'""')+'"';
}
auditoriaRouter.get('/exportar.csv',async(req,res)=>{
 if(!databasePool){res.status(503).json({message:'Auditoría no disponible.'});return;}
 try{
  const {condiciones,args}=parametros(req.query as Record<string,unknown>);
  const {rows}=await databasePool.query(`SELECT ${columnas} ${join} WHERE ${condiciones}
   ORDER BY b.creado_en DESC,b.id DESC LIMIT 5000`,[req.auth!.organizacionId,...args]);
  const encabezado=['Fecha','Acción','Entidad','ID entidad','Usuario','Detalle anterior','Detalle nuevo'];
  const lineas=rows.map(r=>{
   const e=presentar(r);
   return [e.fecha,e.accion,e.entidad,e.entidadId,e.usuario,
    JSON.stringify(e.antes??''),JSON.stringify(e.despues??'')].map(csvCampo).join(',');
  });
  res.set('Cache-Control','no-store');
  res.set('Content-Type','text/csv; charset=utf-8');
  res.set('Content-Disposition','attachment; filename="auditoria-semilla.csv"');
  res.send('\uFEFF'+[encabezado.map(csvCampo).join(','),...lineas].join('\r\n'));
 }catch(e){errorConsulta(res,e);}
});
