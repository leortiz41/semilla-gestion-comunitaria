import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { esUuid } from '../domain/expediente.js';

export const integrantesFamiliaRouter = Router();
integrantesFamiliaRouter.use(
  authenticateAccessToken, requireRole('ADMINISTRADOR','COORDINADOR','CAMPO'),
  requirePermission('comunidades.ver'),
);
const gestion = [requireRole('ADMINISTRADOR','COORDINADOR'), requirePermission('comunidades.gestionar')];

integrantesFamiliaRouter.get('/:familiaId/integrantes', async (req,res) => {
  if (!esUuid(req.params.familiaId)) { res.status(400).json({ message:'Familia no válida.' }); return; }
  try {
    if (!databasePool) { res.status(503).json({message:'Base no disponible.'}); return; }
    const { rows } = await databasePool.query(
      `SELECT mf.id, mf.persona_id AS "personaId", p.primer_nombre AS "primerNombre",
         p.segundo_nombre AS "segundoNombre", p.primer_apellido AS "primerApellido",
         p.segundo_apellido AS "segundoApellido", p.fecha_nacimiento::text AS "fechaNacimiento",
         p.ocupacion, mf.es_jefe_hogar AS "esJefeHogar", mf.parentesco_id AS "parentescoId",
         par.nombre AS parentesco, mf.fecha_ingreso::text AS "fechaIngreso",
         mf.fecha_salida::text AS "fechaSalida"
       FROM miembros_familia mf
       JOIN familias f ON f.id=mf.familia_id
       JOIN comunidades c ON c.id=f.comunidad_id AND c.organizacion_id=$2
       JOIN personas p ON p.id=mf.persona_id
       LEFT JOIN parentescos par ON par.id=mf.parentesco_id
       WHERE mf.familia_id=$1
       ORDER BY mf.fecha_salida NULLS FIRST, mf.es_jefe_hogar DESC, p.primer_nombre, mf.id`,
      [req.params.familiaId,req.auth!.organizacionId],
    );
    res.set('Cache-Control','no-store');
    res.json({ integrantes: rows });
  } catch(error) {
    console.error('Error consultando integrantes familiares:',error);
    res.status(500).json({message:'No fue posible consultar los integrantes.'});
  }
});

integrantesFamiliaRouter.get('/catalogos/parentescos', async (_req,res) => {
  try {
    if (!databasePool) { res.status(503).json({message:'Base no disponible.'}); return; }
    const {rows}=await databasePool.query('SELECT id,nombre FROM parentescos WHERE activo ORDER BY nombre');
    res.json({parentescos:rows});
  } catch(error) {
    console.error('Error consultando parentescos:',error);
    res.status(500).json({message:'No fue posible consultar parentescos.'});
  }
});

integrantesFamiliaRouter.post('/:familiaId/integrantes',...gestion, async(req,res)=>{
  const f=req.params.familiaId;
  const v=req.body||{};
  const nombre=typeof v.primerNombre==='string'?v.primerNombre.trim():'';
  const apellido=typeof v.primerApellido==='string'?v.primerApellido.trim():'';
  const segundoNombre=typeof v.segundoNombre==='string'?v.segundoNombre.trim():'';
  const segundoApellido=typeof v.segundoApellido==='string'?v.segundoApellido.trim():'';
  const ocupacion=typeof v.ocupacion==='string'?v.ocupacion.trim():'';
  const parentescoId=v.parentescoId||null;
  const fecha=v.fechaNacimiento||null;
  if(!esUuid(f)||!nombre||!apellido||nombre.length>100||apellido.length>100||
     segundoNombre.length>100||segundoApellido.length>100||ocupacion.length>120||
     (parentescoId!==null&&!esUuid(parentescoId))||
     (fecha!==null&&(typeof fecha!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(fecha)))||
     typeof v.esJefeHogar!=='boolean') {
    res.status(400).json({message:'Revisá nombre, apellido, fecha y parentesco.'});return;
  }
  if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
  const cliente=await databasePool.connect();
  try {
    await cliente.query('BEGIN');
    const familia=await cliente.query(
      `SELECT f.id FROM familias f JOIN comunidades c ON c.id=f.comunidad_id
       WHERE f.id=$1 AND c.organizacion_id=$2 AND f.activo FOR UPDATE OF f`,
      [f,req.auth!.organizacionId],
    );
    if(!familia.rows.length){await cliente.query('ROLLBACK');res.status(404).json({message:'Familia no disponible.'});return;}
    if(parentescoId){
      const par=await cliente.query('SELECT 1 FROM parentescos WHERE id=$1 AND activo',[parentescoId]);
      if(!par.rows.length){await cliente.query('ROLLBACK');res.status(400).json({message:'Parentesco inválido.'});return;}
    }
    const persona=await cliente.query(
      `INSERT INTO personas (primer_nombre,segundo_nombre,primer_apellido,segundo_apellido,
                             fecha_nacimiento,ocupacion)
       VALUES($1,NULLIF($2,''),$3,NULLIF($4,''),$5::date,NULLIF($6,''))
       RETURNING id`,
      [nombre,segundoNombre,apellido,segundoApellido,fecha,ocupacion],
    );
    if(v.esJefeHogar){
      await cliente.query('UPDATE miembros_familia SET es_jefe_hogar=FALSE,actualizado_en=NOW() WHERE familia_id=$1',[f]);
    }
    const {rows}=await cliente.query(
      `INSERT INTO miembros_familia(familia_id,persona_id,parentesco_id,es_jefe_hogar)
       VALUES($1,$2,$3,$4) RETURNING id`,
      [f,persona.rows[0].id,parentescoId,v.esJefeHogar],
    );
    await cliente.query('COMMIT');
    res.status(201).json({id:rows[0].id});
  }catch(error){
    await cliente.query('ROLLBACK');
    console.error('Error registrando integrante:',error);
    res.status(500).json({message:'No fue posible registrar el integrante.'});
  }finally{cliente.release();}
});

integrantesFamiliaRouter.post('/:familiaId/integrantes/:miembroId/salida',...gestion,async(req,res)=>{
  const {familiaId,miembroId}=req.params;
  if(!esUuid(familiaId)||!esUuid(miembroId)){res.status(400).json({message:'Integrante inválido.'});return;}
  try{
    if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
    const {rowCount}=await databasePool.query(
      `UPDATE miembros_familia mf SET fecha_salida=CURRENT_DATE,es_jefe_hogar=FALSE,actualizado_en=NOW()
       FROM familias f JOIN comunidades c ON c.id=f.comunidad_id
       WHERE mf.id=$1 AND mf.familia_id=$2 AND f.id=mf.familia_id
         AND c.organizacion_id=$3 AND mf.fecha_salida IS NULL`,
      [miembroId,familiaId,req.auth!.organizacionId],
    );
    if(!rowCount){res.status(404).json({message:'Integrante no disponible.'});return;}
    res.sendStatus(204);
  }catch(error){
    console.error('Error registrando salida de integrante:',error);
    res.status(500).json({message:'No fue posible registrar la salida.'});
  }
});
