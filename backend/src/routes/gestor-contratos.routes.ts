import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requireRole, requirePermission } from '../middleware/auth.middleware.js';
import { esUuid } from '../domain/expediente.js';

export const gestorContratosRouter = Router();
gestorContratosRouter.use(
  authenticateAccessToken,
  requireRole('ADMINISTRADOR', 'COORDINADOR', 'CAMPO'),
  requirePermission('pagos.ver'),
);
const escribir = [requireRole('ADMINISTRADOR', 'COORDINADOR'), requirePermission('pagos.gestionar')];
const tiposNodos = new Set(['doc','paragraph','text','heading','bulletList','orderedList','listItem','blockquote','hardBreak','horizontalRule']);
const tiposMarcas = new Set(['bold','italic','underline','strike','code']);

type Nodo = { type: string; text?: string; attrs?: { level?: number }; marks?: { type: string }[]; content?: Nodo[] };
function documentoValido(entrada: unknown): entrada is Nodo {
  let nodos = 0;
  function revisar(n: unknown, profundidad: number): boolean {
    nodos++;
    if (nodos > 1000 || profundidad > 14 || !n || typeof n !== 'object' || Array.isArray(n)) return false;
    const item = n as Record<string, unknown>;
    if (typeof item.type !== 'string' || !tiposNodos.has(item.type)) return false;
    if (Object.keys(item).some(k => !['type','text','attrs','marks','content'].includes(k))) return false;
    if (item.attrs !== undefined) {
      if (!item.attrs || typeof item.attrs !== 'object' || Array.isArray(item.attrs)) return false;
      const a = item.attrs as Record<string, unknown>;
      if (item.type === 'heading') {
        if (Object.keys(a).length !== 1 || ![1,2,3].includes(a.level as number)) return false;
      } else if (item.type === 'orderedList') {
        if (Object.keys(a).length !== 1 || !Number.isInteger(a.start) ||
            (a.start as number) < 1 || (a.start as number) > 1000) return false;
      } else return false;
    }
    if (item.type === 'heading' && !item.attrs) return false;
    if (item.text !== undefined && (item.type !== 'text' || typeof item.text !== 'string' || item.text.length > 20000)) return false;
    if (item.type === 'text' && (typeof item.text !== 'string' || !item.text.trim())) return false;
    if (item.marks !== undefined) {
      if (item.type !== 'text' || !Array.isArray(item.marks) || item.marks.length > 6 ||
          item.marks.some((m: unknown) => !m || typeof m !== 'object' || Array.isArray(m) ||
            Object.keys(m).length !== 1 || !tiposMarcas.has((m as { type: string }).type))) return false;
    }
    if (item.content !== undefined) {
      if (!Array.isArray(item.content) || item.type === 'text' || item.content.length > 200) return false;
      if (!item.content.every((child: unknown) => revisar(child, profundidad + 1))) return false;
    }
    return true;
  }
  if (!revisar(entrada, 0)) return false;
  const root = entrada as Nodo;
  return root.type === 'doc' && Array.isArray(root.content) &&
    JSON.stringify(entrada).length <= 100000;
}
const tituloValido = (v: unknown, max = 180) => typeof v === 'string' && v.trim().length >= 3 && v.trim().length <= max;
const auditar = async (cliente: import('pg').PoolClient, usuario: string, accion: string, tabla: string, id: string, valores: object) =>
  cliente.query(
    `INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
     VALUES($1,$2,$3,$4,$5::jsonb)`,
    [usuario,accion,tabla,id,JSON.stringify(valores)],
  );

gestorContratosRouter.get('/opciones', async (req, res) => {
  if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
  try {
    const org = req.auth!.organizacionId;
    const [organizacion, proyectos, proveedores, personal] = await Promise.all([
      databasePool.query('SELECT id,nombre,nombre_legal,pais,moneda FROM organizaciones WHERE id=$1 AND activo', [org]),
      databasePool.query(
        `SELECT p.id,p.nombre,p.comunidad_id AS "comunidadId" FROM proyectos p
         JOIN comunidades c ON c.id=p.comunidad_id WHERE c.organizacion_id=$1
         ORDER BY p.nombre,p.id`,[org]),
      databasePool.query(
        `SELECT id,nombre_comercial AS nombre,propietario,direccion
         FROM proveedores WHERE organizacion_id=$1 AND activo ORDER BY nombre_comercial`,[org]),
      databasePool.query(
        `SELECT pc.id,pc.proyecto_id AS "proyectoId",pc.valor_contrato::float8 AS "valorContrato",
                pe.primer_nombre||' '||pe.primer_apellido AS nombre,pc.cargo
         FROM personal_contratado pc JOIN proyectos p ON p.id=pc.proyecto_id
         JOIN comunidades c ON c.id=p.comunidad_id AND c.organizacion_id=$1
         JOIN personas pe ON pe.id=pc.persona_id ORDER BY pe.primer_nombre,pc.id`,[org]),
    ]);
    if (!organizacion.rows.length) { res.status(404).json({message:'Organización no encontrada.'});return; }
    res.set('Cache-Control','no-store');
    res.json({organizacion:organizacion.rows[0],proyectos:proyectos.rows,proveedores:proveedores.rows,personal:personal.rows});
  } catch(error) {
    console.error('Error consultando opciones de contratos:',error);
    res.status(500).json({message:'No fue posible obtener la información para contratos.'});
  }
});
gestorContratosRouter.get('/plantillas', async (req,res) => {
  if (!databasePool) { res.status(503).json({message:'Base no disponible.'});return; }
  try {
    const {rows}=await databasePool.query(
      `SELECT id,nombre,contenido,version,actualizado_en AS "actualizadoEn"
       FROM plantillas_contrato WHERE organizacion_id=$1 AND activo
       ORDER BY nombre,id`,[req.auth!.organizacionId]);
    res.set('Cache-Control','no-store');res.json({plantillas:rows});
  }catch(error){console.error('Error consultando plantillas:',error);
    res.status(500).json({message:'No fue posible consultar plantillas.'});}
});
gestorContratosRouter.post('/plantillas', ...escribir, async (req,res) => {
  const {nombre,contenido}=req.body||{};
  if (!tituloValido(nombre,160)||!documentoValido(contenido)) {
    res.status(400).json({message:'Nombre o formato de plantilla no válido.'});return;
  }
  if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
  const client=await databasePool.connect();
  try{
    await client.query('BEGIN');
    const {rows}=await client.query(
      `INSERT INTO plantillas_contrato(organizacion_id,nombre,contenido,creado_por_usuario_id)
       VALUES($1,$2,$3::jsonb,$4) RETURNING id,version`,
      [req.auth!.organizacionId,nombre.trim(),JSON.stringify(contenido),req.auth!.sub]);
    await auditar(client,req.auth!.sub,'CREAR_PLANTILLA_CONTRATO','plantillas_contrato',rows[0].id,{nombre:nombre.trim()});
    await client.query('COMMIT');res.status(201).json({id:rows[0].id,version:rows[0].version});
  }catch(error){await client.query('ROLLBACK');
    if((error as {code?:string}).code==='23505'){res.status(409).json({message:'Ya existe una plantilla con ese nombre.'});return;}
    console.error('Error creando plantilla:',error);res.status(500).json({message:'No se pudo guardar la plantilla.'});
  }finally{client.release();}
});
gestorContratosRouter.put('/plantillas/:id',...escribir,async(req,res)=>{
  const {contenido,version}=req.body||{};
  if(!esUuid(req.params.id)||!documentoValido(contenido)||!Number.isInteger(version)||version<1){
    res.status(400).json({message:'Plantilla o versión no válida.'});return;
  }
  if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
  const client=await databasePool.connect();
  try {
    await client.query('BEGIN');
    const {rows}=await client.query(
      `UPDATE plantillas_contrato SET contenido=$4::jsonb,version=version+1,actualizado_en=NOW()
       WHERE id=$1 AND organizacion_id=$2 AND version=$3 AND activo RETURNING id,version`,
      [req.params.id,req.auth!.organizacionId,version,JSON.stringify(contenido)]);
    if(!rows.length){await client.query('ROLLBACK');
      res.status(409).json({message:'Plantilla modificada por otro usuario o no disponible.'});return;}
    await auditar(client,req.auth!.sub,'EDITAR_PLANTILLA_CONTRATO','plantillas_contrato',rows[0].id,{version:rows[0].version});
    await client.query('COMMIT');res.json(rows[0]);
  }catch(error){await client.query('ROLLBACK');
    console.error('Error actualizando plantilla:',error);res.status(500).json({message:'No fue posible actualizar la plantilla.'});
  }finally{client.release();}
});
gestorContratosRouter.get('/documentos',async(req,res)=>{
  if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
  try{
    const {rows}=await databasePool.query(
      `SELECT cd.id,cd.titulo,cd.estado,cd.version,cd.proyecto_id AS "proyectoId",
         cd.proveedor_id AS "proveedorId",cd.personal_contratado_id AS "personalId",
         cd.plantilla_id AS "plantillaId",cd.contenido,
         cd.actualizado_en AS "actualizadoEn",p.nombre AS proyecto
       FROM contratos_documento cd JOIN proyectos p ON p.id=cd.proyecto_id
       JOIN comunidades c ON c.id=p.comunidad_id AND c.organizacion_id=cd.organizacion_id
       WHERE cd.organizacion_id=$1 ORDER BY cd.actualizado_en DESC LIMIT 200`,[req.auth!.organizacionId]);
    res.set('Cache-Control','no-store');res.json({documentos:rows});
  }catch(error){console.error('Error consultando borradores:',error);res.status(500).json({message:'No fue posible consultar contratos.'});}
});
gestorContratosRouter.post('/documentos',...escribir,async(req,res)=>{
  const {titulo,contenido,proyectoId,proveedorId,personalId,plantillaId}=req.body||{};
  if(!tituloValido(titulo)||!documentoValido(contenido)||!esUuid(proyectoId)||
     (Boolean(proveedorId)===Boolean(personalId))||
     (proveedorId&&!esUuid(proveedorId))||(personalId&&!esUuid(personalId))||
     (plantillaId&&!esUuid(plantillaId))){
    res.status(400).json({message:'Completá título, proyecto, contratista y contenido.'});return;
  }
  if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
  const client=await databasePool.connect();
  try{
    await client.query('BEGIN');
    const org=req.auth!.organizacionId;
    const proyecto=await client.query(
      `SELECT p.id FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
       WHERE p.id=$1 AND c.organizacion_id=$2`,[proyectoId,org]);
    const proveedor=proveedorId?await client.query('SELECT id FROM proveedores WHERE id=$1 AND organizacion_id=$2 AND activo',[proveedorId,org]):null;
    const personal=personalId?await client.query('SELECT pc.id FROM personal_contratado pc JOIN proyectos p ON p.id=pc.proyecto_id JOIN comunidades c ON c.id=p.comunidad_id AND c.organizacion_id=$3 WHERE pc.id=$1 AND p.id=$2',[personalId,proyectoId,org]):null;
    const plantilla=plantillaId?await client.query('SELECT id FROM plantillas_contrato WHERE id=$1 AND organizacion_id=$2 AND activo',[plantillaId,org]):null;
    if(!proyecto.rowCount||(proveedor&&!proveedor.rowCount)||(personal&&!personal.rowCount)||(plantilla&&!plantilla.rowCount)){
      await client.query('ROLLBACK');res.status(404).json({message:'Proyecto, contratista o plantilla fuera de la organización.'});return;
    }
    const {rows}=await client.query(
      `INSERT INTO contratos_documento
        (organizacion_id,proyecto_id,proveedor_id,personal_contratado_id,plantilla_id,titulo,contenido,creado_por_usuario_id)
       VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING id,version`,
      [org,proyectoId,proveedorId||null,personalId||null,plantillaId||null,titulo.trim(),JSON.stringify(contenido),req.auth!.sub]);
    await client.query(
      `INSERT INTO contratos_documento_versiones(contrato_id,version,contenido,guardado_por_usuario_id)
       VALUES($1,1,$2::jsonb,$3)`,[rows[0].id,JSON.stringify(contenido),req.auth!.sub]);
    await auditar(client,req.auth!.sub,'CREAR_BORRADOR_CONTRATO','contratos_documento',rows[0].id,{proyectoId});
    await client.query('COMMIT');res.status(201).json(rows[0]);
  }catch(error){await client.query('ROLLBACK');console.error('Error creando borrador:',error);
    res.status(500).json({message:'No fue posible crear el borrador.'});
  }finally{client.release();}
});
gestorContratosRouter.put('/documentos/:id',...escribir,async(req,res)=>{
  const {titulo,contenido,version}=req.body||{};
  if(!esUuid(req.params.id)||!tituloValido(titulo)||!documentoValido(contenido)||
     !Number.isInteger(version)||version<1){
    res.status(400).json({message:'Contrato o versión no válidos.'});return;
  }
  if(!databasePool){res.status(503).json({message:'Base no disponible.'});return;}
  const client=await databasePool.connect();
  try{
    await client.query('BEGIN');
    const {rows}=await client.query(
      `UPDATE contratos_documento SET titulo=$4,contenido=$5::jsonb,version=version+1,
         actualizado_por_usuario_id=$6,actualizado_en=NOW()
       WHERE id=$1 AND organizacion_id=$2 AND version=$3 AND estado='BORRADOR'
       RETURNING id,version`,[req.params.id,req.auth!.organizacionId,version,titulo.trim(),JSON.stringify(contenido),req.auth!.sub]);
    if(!rows.length){await client.query('ROLLBACK');
      res.status(409).json({message:'Este borrador fue modificado o no está disponible para edición.'});return;}
    await client.query(
      `INSERT INTO contratos_documento_versiones(contrato_id,version,contenido,guardado_por_usuario_id)
       VALUES($1,$2,$3::jsonb,$4)`,[rows[0].id,rows[0].version,JSON.stringify(contenido),req.auth!.sub]);
    await auditar(client,req.auth!.sub,'EDITAR_BORRADOR_CONTRATO','contratos_documento',rows[0].id,{version:rows[0].version});
    await client.query('COMMIT');res.json(rows[0]);
  }catch(error){await client.query('ROLLBACK');console.error('Error guardando versión:',error);
    res.status(500).json({message:'No fue posible guardar la versión.'});
  }finally{client.release();}
});
