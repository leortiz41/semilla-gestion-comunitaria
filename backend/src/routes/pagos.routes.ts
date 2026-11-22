import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken,requirePermission,requireRole } from '../middleware/auth.middleware.js';

export const pagosRouter=Router();
pagosRouter.use(authenticateAccessToken,requireRole('ADMINISTRADOR','COORDINADOR','CAMPO'),requirePermission('pagos.ver'));

// Fase inicial: solo consulta. Registrar un desembolso exige validaciones y auditoría separadas.
pagosRouter.get('/resumen',async(req,res)=>{
 if(!databasePool){res.status(503).json({message:'Base de datos no disponible.'});return;}
 try{
  const organizacionId=req.auth!.organizacionId;
  const [solicitudes,pagos,contratos]=await Promise.all([
    databasePool.query(
      `SELECT sp.id,sp.proyecto_id AS "proyectoId",p.nombre AS proyecto,
         sp.fecha_solicitud::text AS fecha,sp.concepto,sp.valor_solicitado::float8 AS monto,
         sp.anticipo::float8 AS anticipo,sp.estado,
         sp.solicitado_por_usuario_id AS "solicitanteId",
         sp.revisado_por_usuario_id AS "revisorId",
         solicitante.email AS solicitante,
         revisor.email AS revisor,
         sp.revisado_en AS "revisadoEn",sp.motivo_revision AS "motivoRevision",
         prov.nombre_comercial AS proveedor,
         COALESCE(per.primer_nombre||' '||per.primer_apellido,'') AS contratado
       FROM solicitudes_pago sp
       JOIN proyectos p ON p.id=sp.proyecto_id
       JOIN comunidades c ON c.id=p.comunidad_id AND c.organizacion_id=$1
       LEFT JOIN usuarios solicitante ON solicitante.id=sp.solicitado_por_usuario_id
         AND solicitante.organizacion_id=$1
       LEFT JOIN usuarios revisor ON revisor.id=sp.revisado_por_usuario_id
         AND revisor.organizacion_id=$1
       LEFT JOIN proveedores prov ON prov.id=sp.proveedor_id AND prov.organizacion_id=$1
       LEFT JOIN personal_contratado pc ON pc.id=sp.personal_contratado_id AND pc.proyecto_id=p.id
       LEFT JOIN personas per ON per.id=pc.persona_id
       WHERE (sp.proveedor_id IS NULL OR prov.id IS NOT NULL)
         AND (sp.personal_contratado_id IS NULL OR pc.id IS NOT NULL)
       ORDER BY sp.fecha_solicitud DESC,sp.id DESC LIMIT 250`,[organizacionId]),
    databasePool.query(
      `SELECT pa.id,pa.solicitud_pago_id AS "solicitudId",pa.monto::float8 AS monto,
         pa.fecha_pago::text AS fecha,pa.estado_pago AS estado,pa.metodo_pago AS metodo,
         pa.referencia,p.nombre AS proyecto
       FROM pagos pa JOIN solicitudes_pago sp ON sp.id=pa.solicitud_pago_id
       JOIN proyectos p ON p.id=sp.proyecto_id
       JOIN comunidades c ON c.id=p.comunidad_id AND c.organizacion_id=$1
       ORDER BY pa.fecha_pago DESC,pa.id DESC LIMIT 250`,[organizacionId]),
    databasePool.query(
      `SELECT pc.id,p.nombre AS proyecto,pc.cargo,pc.tipo_contrato AS tipo,
         pc.valor_contrato::float8 AS valor,pc.estado,
         per.primer_nombre||' '||per.primer_apellido AS persona
       FROM personal_contratado pc JOIN proyectos p ON p.id=pc.proyecto_id
       JOIN comunidades c ON c.id=p.comunidad_id AND c.organizacion_id=$1
       JOIN personas per ON per.id=pc.persona_id
       ORDER BY pc.creado_en DESC,pc.id DESC LIMIT 250`,[organizacionId]),
  ]);
  res.set('Cache-Control','no-store');
  res.json({solicitudes:solicitudes.rows,pagos:pagos.rows,contratos:contratos.rows});
 }catch(error){console.error('Error consultando resumen de pagos:',error);
  res.status(500).json({message:'No fue posible consultar la información financiera.'});}
});
