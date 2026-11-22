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
         mf.fecha_salida::text AS "fechaSalida",
         mf.asiste_escuela AS "asisteEscuela", mf.grado_estudio_id AS "gradoEstudioId",
         ge.nombre AS "gradoEstudio", ge.nivel AS "nivelEstudio"
       FROM miembros_familia mf
       JOIN familias f ON f.id=mf.familia_id
       JOIN comunidades c ON c.id=f.comunidad_id AND c.organizacion_id=$2
       JOIN personas p ON p.id=mf.persona_id
       LEFT JOIN parentescos par ON par.id=mf.parentesco_id
       LEFT JOIN grados_estudio ge ON ge.id=mf.grado_estudio_id AND (ge.organizacion_id IS NULL OR ge.organizacion_id=c.organizacion_id)
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

integrantesFamiliaRouter.get('/catalogos/grados-estudio', async (req,res) => {
  try {
    if (!databasePool) { res.status(503).json({message:'Base no disponible.'});return; }
    const {rows}=await databasePool.query(
      `SELECT id,nombre,nivel,organizacion_id AS "organizacionId"
       FROM grados_estudio WHERE activo AND (organizacion_id IS NULL OR organizacion_id=$1)
       ORDER BY nivel,nombre,id`, [req.auth!.organizacionId]);
    res.json({grados:rows});
  } catch(error) {
    console.error('Error consultando grados:',error);
    res.status(500).json({message:'No fue posible consultar los grados.'});
  }
});
integrantesFamiliaRouter.post('/catalogos/grados-estudio',...gestion,async(req,res)=>{
  const nombre=typeof req.body?.nombre==='string'?req.body.nombre.trim():'';
  const nivel=typeof req.body?.nivel==='string'?req.body.nivel.trim():'';
  if(!nombre || nombre.length>100 || !nivel || nivel.length>60){
    res.status(400).json({message:'Ingresá nombre y nivel válidos.'});return;
  }
  try {
    if (!databasePool) {res.status(503).json({message:'Base no disponible.'});return;}
    const {rows}=await databasePool.query(
      `INSERT INTO grados_estudio(organizacion_id,nombre,nivel) VALUES($1,$2,$3)
       ON CONFLICT DO NOTHING RETURNING id,nombre,nivel`,
       [req.auth!.organizacionId,nombre,nivel]);
    if(!rows.length){res.status(409).json({message:'Ese grado ya está registrado.'});return;}
    res.status(201).json({grado:rows[0]});
  }catch(error){
    console.error('Error creando grado de estudio:',error);
    res.status(500).json({message:'No fue posible crear el grado.'});
  }
});

export function datosIntegrante(datosSolicitud: Record<string,unknown>) {
  const obligatorio=(clave:string)=>typeof datosSolicitud[clave]==='string'?(datosSolicitud[clave] as string).trim():'';
  const opcional=(clave:string)=>datosSolicitud[clave]==null?'':obligatorio(clave);
  return {
    primerNombre:obligatorio('primerNombre'),segundoNombre:opcional('segundoNombre'),
    primerApellido:obligatorio('primerApellido'),segundoApellido:opcional('segundoApellido'),
    ocupacion:opcional('ocupacion'),parentescoId:datosSolicitud.parentescoId||null,
    fechaNacimiento:datosSolicitud.fechaNacimiento||null,esJefeHogar:datosSolicitud.esJefeHogar,
    asisteEscuela:datosSolicitud.asisteEscuela??null,gradoEstudioId:datosSolicitud.gradoEstudioId||null,
  };
}
export function validarIntegrante(integranteValidado:ReturnType<typeof datosIntegrante>) {
  return !!integranteValidado.primerNombre && !!integranteValidado.primerApellido &&
    [integranteValidado.primerNombre,integranteValidado.primerApellido,integranteValidado.segundoNombre,integranteValidado.segundoApellido].every(nombreIntegrante=>nombreIntegrante.length<=100) &&
    integranteValidado.ocupacion.length<=120 &&
    (integranteValidado.parentescoId===null || esUuid(integranteValidado.parentescoId)) &&
    (integranteValidado.gradoEstudioId===null || esUuid(integranteValidado.gradoEstudioId)) &&
    (integranteValidado.fechaNacimiento===null || (typeof integranteValidado.fechaNacimiento==='string' && /^\d{4}-\d{2}-\d{2}$/.test(integranteValidado.fechaNacimiento))) &&
    typeof integranteValidado.esJefeHogar==='boolean' &&
    (integranteValidado.asisteEscuela===null || typeof integranteValidado.asisteEscuela==='boolean') &&
    (integranteValidado.asisteEscuela!==false || integranteValidado.gradoEstudioId===null);
}

integrantesFamiliaRouter.post('/:familiaId/integrantes',...gestion, async(req,res)=>{
  const familiaIdSolicitada=req.params.familiaId;
  const datosSolicitud=req.body||{};
  const integranteValidado=datosIntegrante(datosSolicitud);
  if(!esUuid(familiaIdSolicitada)||!validarIntegrante(integranteValidado)){
    res.status(400).json({message:'Revisá los datos y escolaridad del integrante.'});return;
  }
  if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
  const cliente=await databasePool.connect();
  try {
    await cliente.query('BEGIN');
    const familia=await cliente.query(
      `SELECT f.id FROM familias f JOIN comunidades c ON c.id=f.comunidad_id
       WHERE f.id=$1 AND c.organizacion_id=$2 AND f.activo FOR UPDATE OF f`,
      [familiaIdSolicitada,req.auth!.organizacionId],
    );
    if(!familia.rows.length){await cliente.query('ROLLBACK');res.status(404).json({message:'Familia no disponible.'});return;}
    if(integranteValidado.parentescoId){
      const par=await cliente.query('SELECT 1 FROM parentescos WHERE id=$1 AND activo',[integranteValidado.parentescoId]);
      if(!par.rows.length){await cliente.query('ROLLBACK');res.status(400).json({message:'Parentesco inválido.'});return;}
    }
    if(integranteValidado.gradoEstudioId){
      const grado=await cliente.query(
        'SELECT 1 FROM grados_estudio WHERE id=$1 AND activo AND (organizacion_id IS NULL OR organizacion_id=$2)',
        [integranteValidado.gradoEstudioId,req.auth!.organizacionId]);
      if(!grado.rows.length){await cliente.query('ROLLBACK');res.status(400).json({message:'Grado no disponible.'});return;}
    }
    const persona=await cliente.query(
      `INSERT INTO personas (primer_nombre,segundo_nombre,primer_apellido,segundo_apellido,
                             fecha_nacimiento,ocupacion)
       VALUES($1,NULLIF($2,''),$3,NULLIF($4,''),$5::date,NULLIF($6,''))
       RETURNING id`,
      [integranteValidado.primerNombre,integranteValidado.segundoNombre,integranteValidado.primerApellido,integranteValidado.segundoApellido,integranteValidado.fechaNacimiento,integranteValidado.ocupacion],
    );
    if(integranteValidado.esJefeHogar){
      await cliente.query('UPDATE miembros_familia SET es_jefe_hogar=FALSE,actualizado_en=NOW() WHERE familia_id=$1',[familiaIdSolicitada]);
    }
    const {rows}=await cliente.query(
      `INSERT INTO miembros_familia(familia_id,persona_id,parentesco_id,es_jefe_hogar,asiste_escuela,grado_estudio_id)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [familiaIdSolicitada,persona.rows[0].id,integranteValidado.parentescoId,integranteValidado.esJefeHogar,integranteValidado.asisteEscuela,integranteValidado.gradoEstudioId],
    );
    await cliente.query('COMMIT');
    res.status(201).json({id:rows[0].id});
  }catch(error){
    await cliente.query('ROLLBACK');
    console.error('Error registrando integrante:',error);
    res.status(500).json({message:'No fue posible registrar el integrante.'});
  }finally{cliente.release();}
});


integrantesFamiliaRouter.put('/:familiaId/integrantes/:miembroId',...gestion,async(req,res)=>{
  const {familiaId,miembroId}=req.params;
  const integranteValidado=datosIntegrante(req.body||{});
  if(!esUuid(familiaId)||!esUuid(miembroId)||!validarIntegrante(integranteValidado)){
    res.status(400).json({message:'Datos del integrante inválidos.'});return;
  }
  if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
  const cliente=await databasePool.connect();
  try{
    await cliente.query('BEGIN');
    const {rows:miembros}=await cliente.query(
      `SELECT mf.persona_id AS "personaId" FROM miembros_familia mf
       JOIN familias f ON f.id=mf.familia_id AND f.activo
       JOIN comunidades c ON c.id=f.comunidad_id AND c.organizacion_id=$3
       WHERE mf.id=$1 AND mf.familia_id=$2 AND mf.fecha_salida IS NULL
       FOR UPDATE OF mf`,[miembroId,familiaId,req.auth!.organizacionId]);
    if(!miembros.length){await cliente.query('ROLLBACK');res.status(404).json({message:'Integrante activo no encontrado.'});return;}
    if(integranteValidado.parentescoId){
      const {rowCount}=await cliente.query('SELECT id FROM parentescos WHERE id=$1 AND activo',[integranteValidado.parentescoId]);
      if(!rowCount){await cliente.query('ROLLBACK');res.status(400).json({message:'Parentesco inválido.'});return;}
    }
    if(integranteValidado.gradoEstudioId){
      const {rowCount}=await cliente.query(
        'SELECT id FROM grados_estudio WHERE id=$1 AND activo AND (organizacion_id IS NULL OR organizacion_id=$2)',
        [integranteValidado.gradoEstudioId,req.auth!.organizacionId]);
      if(!rowCount){await cliente.query('ROLLBACK');res.status(400).json({message:'Grado inválido.'});return;}
    }
    const {rowCount}=await cliente.query(
      `UPDATE personas SET primer_nombre=$2,segundo_nombre=NULLIF($3,''),primer_apellido=$4,
         segundo_apellido=NULLIF($5,''),fecha_nacimiento=$6::date,ocupacion=NULLIF($7,''),actualizado_en=NOW()
       WHERE id=$1`,
      [miembros[0].personaId,integranteValidado.primerNombre,integranteValidado.segundoNombre,integranteValidado.primerApellido,integranteValidado.segundoApellido,integranteValidado.fechaNacimiento,integranteValidado.ocupacion]);
    if(!rowCount){throw new Error('La persona no está disponible.');}
    if(integranteValidado.esJefeHogar){
      await cliente.query('UPDATE miembros_familia SET es_jefe_hogar=FALSE,actualizado_en=NOW() WHERE familia_id=$1',[familiaId]);
    }
    await cliente.query(
      `UPDATE miembros_familia SET parentesco_id=$2,es_jefe_hogar=$3,
        asiste_escuela=$4,grado_estudio_id=$5,actualizado_en=NOW() WHERE id=$1`,
      [miembroId,integranteValidado.parentescoId,integranteValidado.esJefeHogar,integranteValidado.asisteEscuela,integranteValidado.gradoEstudioId]);
    await cliente.query('COMMIT');res.sendStatus(204);
  }catch(error){
    await cliente.query('ROLLBACK');
    console.error('Error actualizando integrante:',error);
    res.status(500).json({message:'No fue posible actualizar el integrante.'});
  }finally{cliente.release();}
});

// Baja lógica: preserva el historial del hogar y nunca elimina familiaIdSolicitadaísicamente a la persona.
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
