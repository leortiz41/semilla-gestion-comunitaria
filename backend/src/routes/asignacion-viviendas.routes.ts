import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requireRole, requirePermission } from '../middleware/auth.middleware.js';
import { esUuid } from '../domain/expediente.js';

export const asignacionViviendasRouter = Router();
asignacionViviendasRouter.use(
  authenticateAccessToken,
  requireRole('ADMINISTRADOR', 'COORDINADOR'),
  requirePermission('comunidades.gestionar'),
  requirePermission('proyectos.gestionar'),
);

asignacionViviendasRouter.get('/opciones', async (req, res) => {
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const org = req.auth!.organizacionId;
    const [familias, brigadas, proyectos, cuentas] = await Promise.all([
      databasePool.query(
        `SELECT f.id, f.nombre_referencia AS nombre, c.nombre AS comunidad, f.comunidad_id AS "comunidadId"
         FROM familias f JOIN comunidades c ON c.id=f.comunidad_id
         WHERE c.organizacion_id=$1 AND f.activo ORDER BY c.nombre,f.nombre_referencia,f.id`, [org]),
      databasePool.query(
        `SELECT b.id,b.lider,d.nombre AS donante,d.id AS "donanteId"
         FROM brigadas_donantes b JOIN donantes d ON d.id=b.donante_id
         WHERE d.organizacion_id=$1 AND d.activo AND b.activo
         ORDER BY d.nombre,b.lider,b.id`, [org]),
      databasePool.query(
        `SELECT p.id,p.nombre,p.comunidad_id AS "comunidadId"
         FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
         WHERE c.organizacion_id=$1 AND p.estado <> 'CANCELADO' AND lower(p.tipo)='vivienda'
         ORDER BY p.nombre,p.id`, [org]),
      databasePool.query(
        `SELECT u.id,u.email FROM usuarios u WHERE u.organizacion_id=$1 AND u.activo
          AND EXISTS (SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
                      WHERE ur.usuario_id=u.id AND r.nombre='DONANTE' AND r.activo)
         ORDER BY u.email,u.id`, [org]),
    ]);
    res.set('Cache-Control','no-store');
    res.json({ familias: familias.rows, brigadas: brigadas.rows, proyectos: proyectos.rows, cuentas: cuentas.rows });
  } catch(error) {
    console.error('Error consultando opciones de asignación:',error);
    res.status(500).json({ message: 'No se pudo cargar el asistente de viviendas.' });
  }
});

asignacionViviendasRouter.post('/asignar', async (req,res) => {
  const { familiaId,brigadaId,cuentaId,proyectoId }=req.body||{};
  const nuevo = !proyectoId;
  const nombre=typeof req.body?.nombreProyecto==='string'?req.body.nombreProyecto.trim():'';
  const fechaInicio=req.body?.fechaInicio;
  const nivelRiesgo=req.body?.nivelRiesgo;
  const numeroIntegrantes=req.body?.numeroIntegrantes;
  const habitaciones=req.body?.numeroHabitaciones;
  if(!esUuid(familiaId)||!esUuid(brigadaId)||!esUuid(cuentaId)||
     (!nuevo&&!esUuid(proyectoId))||
     (nuevo&&(!nombre||nombre.length>200||typeof fechaInicio!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)))||
     !['BAJO','MEDIO','ALTO','CRITICO'].includes(nivelRiesgo)||
     !Number.isInteger(numeroIntegrantes)||numeroIntegrantes<1||numeroIntegrantes>100||
     !Number.isInteger(habitaciones)||habitaciones<0||habitaciones>50){
    res.status(400).json({message:'Seleccioná familia, brigada, cuenta y datos de evaluación válidos.'});return;
  }
  if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
  const client=await databasePool.connect();
  try {
    await client.query('BEGIN');
    const org=req.auth!.organizacionId;
    const familia=await client.query(
      `SELECT f.id,f.comunidad_id AS comunidad FROM familias f JOIN comunidades c ON c.id=f.comunidad_id
       WHERE f.id=$1 AND f.activo AND c.organizacion_id=$2 AND c.activo FOR UPDATE OF f`,
      [familiaId,org]);
    if(!familia.rowCount){await client.query('ROLLBACK');res.status(404).json({message:'Familia no disponible.'});return;}
    const brigada=await client.query(
      `SELECT b.id,d.id AS donante_id FROM brigadas_donantes b JOIN donantes d ON d.id=b.donante_id
       WHERE b.id=$1 AND b.activo AND d.activo AND d.organizacion_id=$2 FOR UPDATE OF b`,
      [brigadaId,org]);
    const cuenta=await client.query(
      `SELECT u.id FROM usuarios u WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo
       AND EXISTS(SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
                  WHERE ur.usuario_id=u.id AND r.nombre='DONANTE' AND r.activo)`,
      [cuentaId,org]);
    if(!brigada.rowCount||!cuenta.rowCount){await client.query('ROLLBACK');res.status(404).json({message:'Brigada o cuenta donante no disponible.'});return;}
    // No mover una familia a otro tenant, ni crear proyectos de otra comunidad.
    let destino:string;
    if(nuevo){
      const creado=await client.query(
        `INSERT INTO proyectos(comunidad_id,nombre,tipo,estado,fecha_inicio,descripcion)
         VALUES($1,$2,'vivienda','PLANIFICADO',$3,'Proyecto habitacional vinculado a expediente familiar.')
         RETURNING id`,
        [familia.rows[0].comunidad,nombre,fechaInicio]);
      destino=creado.rows[0].id;
    }else{
      const existente=await client.query(
        `SELECT p.id FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
         WHERE p.id=$1 AND p.comunidad_id=$2 AND c.organizacion_id=$3 AND p.estado<>'CANCELADO' AND lower(p.tipo)='vivienda'
         FOR UPDATE OF p`,
        [proyectoId,familia.rows[0].comunidad,org]);
      if(!existente.rowCount){await client.query('ROLLBACK');res.status(404).json({message:'Proyecto no disponible para la comunidad.'});return;}
      destino=proyectoId;
    }
    // No sobrescribir evaluaciones previas ni su estado documental.
    const perfil=await client.query(
      `INSERT INTO perfiles_familia(familia_id,proyecto_id,numero_integrantes,nivel_riesgo,numero_habitaciones)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (familia_id,proyecto_id) DO NOTHING RETURNING id`,
      [familiaId,destino,numeroIntegrantes,nivelRiesgo,habitaciones]);
    if(!perfil.rowCount){
      await client.query('ROLLBACK');
      res.status(409).json({message:'Esta familia ya tiene una evaluación para el proyecto. Abrí su expediente para cambiar la brigada.'});return;
    }
    const perfilId=perfil.rows[0].id;
    await client.query(
      `INSERT INTO brigadas_donantes_proyectos(brigada_id,proyecto_id)
       VALUES($1,$2) ON CONFLICT DO NOTHING`,[brigadaId,destino]);
    await client.query(
      `INSERT INTO proyectos_fichas_donantes(proyecto_id,donante_id)
       VALUES($1,$2) ON CONFLICT DO NOTHING`,[destino,brigada.rows[0].donante_id]);
    await client.query(
      `INSERT INTO asignaciones_familias_brigadas(perfil_id,brigada_id,asignado_por_usuario_id)
       VALUES($1,$2,$3)`,[perfilId,brigadaId,req.auth!.sub]);
    await client.query(
      `INSERT INTO cuentas_brigadas_donantes(usuario_id,brigada_id,asignado_por_usuario_id)
       VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[cuentaId,brigadaId,req.auth!.sub]);
    // Quienes ya tienen acceso a esta brigada ven todos sus proyectos patrocinados.
    // Al vincular una nueva cuenta, también obtiene los proyectos anteriores de su brigada.
    await client.query(
      `INSERT INTO proyectos_donantes(usuario_id,proyecto_id)
       SELECT cbd.usuario_id,bp.proyecto_id
       FROM cuentas_brigadas_donantes cbd
       JOIN usuarios u ON u.id=cbd.usuario_id AND u.organizacion_id=$2 AND u.activo
       JOIN brigadas_donantes_proyectos bp ON bp.brigada_id=cbd.brigada_id
       JOIN proyectos p ON p.id=bp.proyecto_id
       JOIN comunidades c ON c.id=p.comunidad_id AND c.organizacion_id=$2
       WHERE cbd.brigada_id=$1
         AND EXISTS (SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
                     WHERE ur.usuario_id=u.id AND r.nombre='DONANTE' AND r.activo)
       ON CONFLICT DO NOTHING`,[brigadaId,org]);
    await client.query(
      `INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
       VALUES($1,'ASIGNACION_VIVIENDA','perfiles_familia',$2,$3::jsonb)`,
      [req.auth!.sub,perfilId,JSON.stringify({familiaId,brigadaId,cuentaId,proyectoId:destino})]);
    await client.query('COMMIT');
    res.status(201).json({proyectoId:destino,perfilId,brigadaId,cuentaId});
  }catch(error){
    await client.query('ROLLBACK');
    console.error('Error asignando vivienda:',error);
    res.status(500).json({message:'No fue posible completar la asignación; ningún cambio parcial fue guardado.'});
  }finally{client.release();}
});
