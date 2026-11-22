import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken,requirePermission,requireRole } from '../middleware/auth.middleware.js';
import { esUuid } from '../domain/expediente.js';

export const pagosOperacionesRouter=Router();
pagosOperacionesRouter.use(
 authenticateAccessToken,requireRole('ADMINISTRADOR','COORDINADOR','CAMPO'),requirePermission('pagos.ver'),
);
const gestionar=[requireRole('ADMINISTRADOR','COORDINADOR'),requirePermission('pagos.gestionar')];
const dinero=(valor:unknown)=>typeof valor==='number'&&Number.isFinite(valor)&&valor>0&&valor<=100000000
  &&Math.abs(Math.round(valor*100)-valor*100)<0.000001;
const texto=(valor:unknown,longitudMaxima:number)=>typeof valor==='string'&&valor.trim().length>0&&valor.trim().length<=longitudMaxima;
const auditar=async(clienteTransaccion:import('pg').PoolClient,usuarioId:string,accion:string,entidad:string,id:string,detalle:object)=>{
 await clienteTransaccion.query(
  `INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
    VALUES($1,$2,$3,$4,$5::jsonb)`,[usuarioId,accion,entidad,id,JSON.stringify(detalle)]);
};

pagosOperacionesRouter.get('/opciones',async(req,res)=>{
 if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
 try{
  const organizacionId=req.auth!.organizacionId;
  const [proyectos,proveedores,personal]=await Promise.all([
   databasePool.query(`SELECT p.id,p.nombre,p.presupuesto_asignado::float8 AS presupuesto
     FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
     WHERE c.organizacion_id=$1 AND p.estado NOT IN ('CANCELADO','FINALIZADO')
     ORDER BY p.nombre`,[organizacionId]),
   databasePool.query(`SELECT id,nombre_comercial AS nombre FROM proveedores
     WHERE organizacion_id=$1 AND activo ORDER BY nombre_comercial`,[organizacionId]),
   databasePool.query(`SELECT pc.id,pc.proyecto_id AS "proyectoId",pc.cargo,
     pe.primer_nombre||' '||pe.primer_apellido AS nombre,pc.valor_contrato::float8 AS valor
     FROM personal_contratado pc JOIN proyectos p ON p.id=pc.proyecto_id
     JOIN comunidades c ON c.id=p.comunidad_id AND c.organizacion_id=$1
     JOIN personas pe ON pe.id=pc.persona_id WHERE pc.estado='ACTIVO'
     ORDER BY pe.primer_nombre,pe.primer_apellido`,[organizacionId]),
  ]);
  res.set('Cache-Control','no-store');
  res.json({proyectos:proyectos.rows,proveedores:proveedores.rows,personal:personal.rows});
 }catch(error){console.error('Error en catálogos de pagos:',error);
  res.status(500).json({message:'No se pudieron consultar las opciones.'});}
});

// Contratación de trabajador vinculada a un proyecto, con persona registrada en la misma operación.
pagosOperacionesRouter.post('/contratos',...gestionar,async(req,res)=>{
 const datosSolicitud=req.body||{};
 if(!esUuid(datosSolicitud.proyectoId)||!texto(datosSolicitud.primerNombre,100)||!texto(datosSolicitud.primerApellido,100)||
    !texto(datosSolicitud.cargo,120)||!texto(datosSolicitud.tipoContrato,80)||!dinero(datosSolicitud.valorContrato)){
  res.status(400).json({message:'Completá proyecto, persona, cargo, tipo y valor del contrato.'});return;
 }
 if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
 const clienteTransaccion=await databasePool.connect();
 try{
  await clienteTransaccion.query('BEGIN');
  const proyecto=await clienteTransaccion.query(`SELECT p.id FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
    WHERE p.id=$1 AND c.organizacion_id=$2 AND p.estado NOT IN ('CANCELADO','FINALIZADO') FOR UPDATE OF p`,
    [datosSolicitud.proyectoId,req.auth!.organizacionId]);
  if(!proyecto.rowCount){await clienteTransaccion.query('ROLLBACK');res.status(404).json({message:'Proyecto no autorizado.'});return;}
  const persona=await clienteTransaccion.query(`INSERT INTO personas(primer_nombre,primer_apellido)
    VALUES($1,$2) RETURNING id`,[datosSolicitud.primerNombre.trim(),datosSolicitud.primerApellido.trim()]);
  const contrato=await clienteTransaccion.query(`INSERT INTO personal_contratado
    (persona_id,proyecto_id,cargo,valor_contrato,tipo_contrato)
    VALUES($1,$2,$3,$4,$5) RETURNING id`,[
    persona.rows[0].id,datosSolicitud.proyectoId,datosSolicitud.cargo.trim(),datosSolicitud.valorContrato,datosSolicitud.tipoContrato.trim()]);
  await auditar(clienteTransaccion,req.auth!.sub,'CREAR_CONTRATO','personal_contratado',contrato.rows[0].id,
    {proyectoId:datosSolicitud.proyectoId,valorContrato:datosSolicitud.valorContrato});
  await clienteTransaccion.query('COMMIT');
  res.status(201).json({id:contrato.rows[0].id});
 }catch(error){await clienteTransaccion.query('ROLLBACK');console.error('Error creando contrato:',error);
  res.status(500).json({message:'No se pudo registrar la contratación.'});
 }finally{clienteTransaccion.release();}
});

pagosOperacionesRouter.post('/solicitudes',...gestionar,async(req,res)=>{
 const datosSolicitud=req.body||{};
 if(!esUuid(datosSolicitud.proyectoId)||!texto(datosSolicitud.concepto,400)||!dinero(datosSolicitud.monto)||
    !['PROVEEDOR','PERSONAL'].includes(datosSolicitud.destinatarioTipo)||!esUuid(datosSolicitud.destinatarioId)){
  res.status(400).json({message:'Seleccioná proyecto, beneficiario, concepto e importe válido.'});return;
 }
 if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
 const clienteTransaccion=await databasePool.connect();
 try{
  await clienteTransaccion.query('BEGIN');
  const proyecto=await clienteTransaccion.query(`SELECT p.id FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
    WHERE p.id=$1 AND c.organizacion_id=$2 AND p.estado NOT IN ('CANCELADO','FINALIZADO') FOR UPDATE OF p`,
    [datosSolicitud.proyectoId,req.auth!.organizacionId]);
  if(!proyecto.rowCount){await clienteTransaccion.query('ROLLBACK');res.status(404).json({message:'Proyecto no autorizado.'});return;}
  const destinatario=datosSolicitud.destinatarioTipo==='PROVEEDOR'
    ?await clienteTransaccion.query(`SELECT id FROM proveedores WHERE id=$1 AND organizacion_id=$2 AND activo`,
       [datosSolicitud.destinatarioId,req.auth!.organizacionId])
    :await clienteTransaccion.query(`SELECT id FROM personal_contratado
       WHERE id=$1 AND proyecto_id=$2 AND estado='ACTIVO'`,[datosSolicitud.destinatarioId,datosSolicitud.proyectoId]);
  if(!destinatario.rowCount){await clienteTransaccion.query('ROLLBACK');res.status(409).json({message:'Beneficiario no disponible para el proyecto.'});return;}
  const solicitud=await clienteTransaccion.query(`INSERT INTO solicitudes_pago
    (proyecto_id,proveedor_id,personal_contratado_id,concepto,valor_solicitado,solicitado_por_usuario_id)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[
    datosSolicitud.proyectoId,datosSolicitud.destinatarioTipo==='PROVEEDOR'?datosSolicitud.destinatarioId:null,
    datosSolicitud.destinatarioTipo==='PERSONAL'?datosSolicitud.destinatarioId:null,datosSolicitud.concepto.trim(),datosSolicitud.monto,req.auth!.sub]);
  await auditar(clienteTransaccion,req.auth!.sub,'SOLICITAR_PAGO','solicitudes_pago',solicitud.rows[0].id,
    {proyectoId:datosSolicitud.proyectoId,monto:datosSolicitud.monto,destinatarioTipo:datosSolicitud.destinatarioTipo});
  await clienteTransaccion.query('COMMIT');res.status(201).json({id:solicitud.rows[0].id});
 }catch(error){await clienteTransaccion.query('ROLLBACK');console.error('Error solicitando pago:',error);
  res.status(500).json({message:'No se pudo registrar la solicitud.'});
 }finally{clienteTransaccion.release();}
});

pagosOperacionesRouter.post('/solicitudes/:id/revisar',...gestionar,async(req,res)=>{
 const id=req.params.id,estado=req.body?.estado;
 const motivo=typeof req.body?.motivo==='string'?req.body.motivo.trim():'';
 if(!esUuid(id)||!['APROBADA','RECHAZADA'].includes(estado)||
    (estado==='RECHAZADA'&&!motivo)||motivo.length>2000){
  res.status(400).json({message:'Estado o motivo de revisión no válido.'});return;
 }
 if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
 const clienteTransaccion=await databasePool.connect();
 try{
  await clienteTransaccion.query('BEGIN');
  const {rows}=await clienteTransaccion.query(`SELECT sp.id,sp.estado,sp.solicitado_por_usuario_id AS autor,
    sp.valor_solicitado::float8 AS monto,p.id AS proyecto_id,p.presupuesto_asignado::float8 AS presupuesto
    FROM solicitudes_pago sp JOIN proyectos p ON p.id=sp.proyecto_id
    JOIN comunidades c ON c.id=p.comunidad_id AND c.organizacion_id=$2
    WHERE sp.id=$1 FOR UPDATE OF sp,p`,[id,req.auth!.organizacionId]);
  const solicitudPago=rows[0];
  if(!solicitudPago){await clienteTransaccion.query('ROLLBACK');res.status(404).json({message:'Solicitud no disponible.'});return;}
  if(solicitudPago.estado!=='SOLICITADA'||!solicitudPago.autor||solicitudPago.autor===req.auth!.sub){
   await clienteTransaccion.query('ROLLBACK');res.status(409).json({message:'Solicitud ya revisada, sin autor, o autoaprobación no permitida.'});return;
  }
  // Control presupuestario: no aprobar sin presupuesto asignado y disponible.
  if(estado==='APROBADA'){
   const {rows:compromisos}=await clienteTransaccion.query(`SELECT COALESCE(SUM(valor_solicitado),0)::float8 AS total
    FROM solicitudes_pago WHERE proyecto_id=$1 AND estado IN ('APROBADA','PAGADA')`,[solicitudPago.proyecto_id]);
   if(solicitudPago.presupuesto<=0||compromisos[0].total+solicitudPago.monto>solicitudPago.presupuesto){
    await clienteTransaccion.query('ROLLBACK');res.status(409).json({message:'El proyecto no tiene presupuesto suficiente para aprobar esta solicitud.'});return;
   }
  }
  await clienteTransaccion.query(`UPDATE solicitudes_pago SET estado=$2, revisado_por_usuario_id=$3,
    revisado_en=NOW(),fecha_confirmacion=CASE WHEN $2='APROBADA' THEN CURRENT_DATE ELSE NULL END,
    motivo_revision=NULLIF($4,''),actualizado_en=NOW() WHERE id=$1`,[id,estado,req.auth!.sub,motivo]);
  await auditar(clienteTransaccion,req.auth!.sub,'REVISAR_SOLICITUD','solicitudes_pago',id,{estado,motivo});
  await clienteTransaccion.query('COMMIT');res.json({id,estado});
 }catch(error){await clienteTransaccion.query('ROLLBACK');console.error('Error revisando pago:',error);
  res.status(500).json({message:'No se pudo revisar la solicitud.'});
 }finally{clienteTransaccion.release();}
});

// Registro administrativo de un abono: sin transferencia bancaria externa.
pagosOperacionesRouter.post('/solicitudes/:id/abonos',...gestionar,async(req,res)=>{
 const id=req.params.id,datosSolicitud=req.body||{};
 if(!esUuid(id)||!dinero(datosSolicitud.monto)||!['EFECTIVO','TRANSFERENCIA','CHEQUE','OTRO'].includes(datosSolicitud.metodo)||
    (datosSolicitud.referencia!=null&&(typeof datosSolicitud.referencia!=='string'||datosSolicitud.referencia.length>120))){
  res.status(400).json({message:'Importe, método o referencia inválidos.'});return;
 }
 if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
 const clienteTransaccion=await databasePool.connect();
 try{
  await clienteTransaccion.query('BEGIN');
  const {rows}=await clienteTransaccion.query(`SELECT sp.id,sp.estado,sp.valor_solicitado::float8 AS monto
    FROM solicitudes_pago sp JOIN proyectos p ON p.id=sp.proyecto_id
    JOIN comunidades c ON c.id=p.comunidad_id AND c.organizacion_id=$2
    WHERE sp.id=$1 FOR UPDATE OF sp`,[id,req.auth!.organizacionId]);
  if(!rows[0]||!['APROBADA','PAGADA'].includes(rows[0].estado)){
   await clienteTransaccion.query('ROLLBACK');res.status(409).json({message:'Solicitud no aprobada.'});return;
  }
  const {rows:totales}=await clienteTransaccion.query(`SELECT COALESCE(SUM(monto),0)::float8 AS reservado
    FROM pagos WHERE solicitud_pago_id=$1 AND estado_pago<>'ANULADO'`,[id]);
  if(totales[0].reservado+datosSolicitud.monto>rows[0].monto){
   await clienteTransaccion.query('ROLLBACK');res.status(409).json({message:'El abono supera el saldo autorizado.'});return;
  }
  const {rows:pagos}=await clienteTransaccion.query(`INSERT INTO pagos
    (solicitud_pago_id,tipo_pago,monto,metodo_pago,referencia,registrado_por_usuario_id)
    VALUES($1,'ABONO',$2,$3,NULLIF($4,''),$5) RETURNING id`,
    [id,datosSolicitud.monto,datosSolicitud.metodo,typeof datosSolicitud.referencia==='string'?datosSolicitud.referencia.trim():'',req.auth!.sub]);
  await auditar(clienteTransaccion,req.auth!.sub,'REGISTRAR_ABONO','pagos',pagos[0].id,{solicitudId:id,monto:datosSolicitud.monto});
  await clienteTransaccion.query('COMMIT');res.status(201).json({id:pagos[0].id,estado:'REGISTRADO'});
 }catch(error){await clienteTransaccion.query('ROLLBACK');console.error('Error registrando abono:',error);
  res.status(500).json({message:'No se pudo registrar el abono.'});
 }finally{clienteTransaccion.release();}
});

pagosOperacionesRouter.post('/abonos/:id/confirmar',...gestionar,async(req,res)=>{
 const id=req.params.id;
 if(!esUuid(id)){res.status(400).json({message:'Abono no válido.'});return;}
 if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
 const clienteTransaccion=await databasePool.connect();
 try{
  await clienteTransaccion.query('BEGIN');
  // Bloquear la solicitud primero para serializar confirmaciones concurrentes.
  const {rows:datos}=await clienteTransaccion.query(`SELECT sp.id AS solicitud_id
    FROM pagos pa JOIN solicitudes_pago sp ON sp.id=pa.solicitud_pago_id
    JOIN proyectos p ON p.id=sp.proyecto_id JOIN comunidades c ON c.id=p.comunidad_id
    WHERE pa.id=$1 AND c.organizacion_id=$2`,[id,req.auth!.organizacionId]);
  if(!datos[0]){await clienteTransaccion.query('ROLLBACK');res.status(404).json({message:'Abono no disponible.'});return;}
  const solicitudId=datos[0].solicitud_id;
  const {rows:solicitudes}=await clienteTransaccion.query(
    'SELECT id,estado,valor_solicitado::float8 AS monto FROM solicitudes_pago WHERE id=$1 FOR UPDATE',
    [solicitudId]);
  const {rows:abonos}=await clienteTransaccion.query(`SELECT id,estado_pago,monto::float8 AS monto,
     registrado_por_usuario_id AS autor FROM pagos WHERE id=$1 AND solicitud_pago_id=$2 FOR UPDATE`,[id,solicitudId]);
  const abono=abonos[0],solicitud=solicitudes[0];
  if(!abono||abono.estado_pago!=='REGISTRADO'||abono.autor===req.auth!.sub||!abono.autor||
    !['APROBADA','PAGADA'].includes(solicitud.estado)){
   await clienteTransaccion.query('ROLLBACK');res.status(409).json({message:'No se puede confirmar este abono o existe autoaprobación.'});return;
  }
  const {rows:sumas}=await clienteTransaccion.query(`SELECT COALESCE(SUM(monto),0)::float8 AS total
    FROM pagos WHERE solicitud_pago_id=$1 AND estado_pago='CONFIRMADO'`,[solicitudId]);
  if(sumas[0].total+abono.monto>solicitud.monto){
   await clienteTransaccion.query('ROLLBACK');res.status(409).json({message:'El abono supera el monto autorizado.'});return;
  }
  await clienteTransaccion.query(`UPDATE pagos SET estado_pago='CONFIRMADO',confirmado_por_usuario_id=$2,
    confirmado_en=NOW(),actualizado_en=NOW() WHERE id=$1`,[id,req.auth!.sub]);
  if(Math.round((sumas[0].total+abono.monto)*100)===Math.round(solicitud.monto*100)){
   await clienteTransaccion.query(`UPDATE solicitudes_pago SET estado='PAGADA',actualizado_en=NOW()
     WHERE id=$1`,[solicitudId]);
  }
  await auditar(clienteTransaccion,req.auth!.sub,'CONFIRMAR_ABONO','pagos',id,{solicitudId:solicitudId,monto:abono.monto});
  await clienteTransaccion.query('COMMIT');res.json({id,estado:'CONFIRMADO'});
 }catch(error){await clienteTransaccion.query('ROLLBACK');console.error('Error confirmando abono:',error);
  res.status(500).json({message:'No se pudo confirmar el abono.'});
 }finally{clienteTransaccion.release();}
});
