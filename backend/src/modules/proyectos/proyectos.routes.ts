import { randomUUID } from 'node:crypto';
import { Router, raw, type RequestHandler } from 'express';
import { firmarObjetoR2, r2Disponible, verificarObjetoR2, cargarObjetoR2, leerObjetoR2, diagnosticarErrorR2 } from '../../services/r2-evidencias.service.js';
import { databasePool } from '../../config/database.js';
import { consultarAccesoEvidenciaAvance, consultarIndiceEvidencias, consultarCatalogoProyectos, consultarResponsablesProyecto, consultarAvancesPendientes, consultarMetaActividad, consultarEvidenciasAvance, consultarClaveEvidencia, guardarActividadEnRepositorio, existeProyectoEnOrganizacion, consultarSaldoActividad, guardarProyectoEnRepositorio, registrarEvidenciaEnRepositorio, consultarLimiteDeValidacion } from './proyectos.repository.js';
import { listarBrigadasRecursos, guardarRecursosBrigada } from './brigadas-recursos.repository.js';
import { consultarCierreProyecto, finalizarProyecto, reabrirProyecto } from './cierre-proyecto.repository.js';
import { areasNecesidad } from '../../domain/necesidades.js';
import { esUuid } from '../../domain/expediente.js';
import { esFecha } from '../../domain/fecha.js';
import { validarAvanceActividad } from './avances-actividad.domain.js';
import { authenticateAccessToken, requirePermission } from '../../middleware/auth.middleware.js';
import {
  editarAvanceActividad,
  listarActividadesProyecto,
  registrarAvanceActividad,
  transicionarAvanceActividad,
} from './avances-actividad.service.js';

export const proyectosRouter = Router();
const estados = ['PLANIFICADO', 'EN_EJECUCION', 'PAUSADO', 'CANCELADO'];

proyectosRouter.use(authenticateAccessToken, requirePermission('proyectos.ver'), (req, res, next) => {
  if (req.auth?.roles.includes('DONANTE')) {
    res.status(403).json({ message: 'Consultá tus proyectos desde el portal de donantes.' });
    return;
  }
  next();
});


const tiposFoto = ['image/jpeg', 'image/png', 'image/webp'];

// Compatibilidad con las llamadas del router: el repositorio verifica el tenant.
async function accesoEvidenciaAvance(proyectoId: string, actividadId: string, avanceId: string, organizacionId: string) {
  return consultarAccesoEvidenciaAvance(databasePool, proyectoId, actividadId, avanceId, organizacionId);
}
// Índice de evidencias por organización: permite localizar las fotos sin adivinar el avance.
proyectosRouter.get('/evidencias/indice', async (req, res) => {
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const { avances: rows, proyectosFinalizados: finalizados } =
      await consultarIndiceEvidencias(databasePool, req.auth!.organizacionId);
    res.json({ avances: rows, proyectosFinalizados: finalizados });
  } catch (error) {
    console.error('Error consultando índice de evidencias:', error);
    res.status(500).json({ message: 'No fue posible consultar el expediente documental de avances.' });
  }
});

const rutaEvidencias = '/:proyectoId/actividades/:actividadId/avances/:avanceId/evidencias';

proyectosRouter.get(rutaEvidencias, async (req, res) => {
  const { proyectoId, actividadId, avanceId } = req.params;
  try {
    if (!await accesoEvidenciaAvance(proyectoId, actividadId, avanceId, req.auth!.organizacionId)) {
      res.status(404).json({ message: 'Avance no disponible.' }); return;
    }
    const rows = await consultarEvidenciasAvance(databasePool!, proyectoId, avanceId);
    res.json({ evidencias: await Promise.all(rows.map(async (e) => ({
      id: e.id, titulo: e.titulo, descripcion: e.descripcion, tipoMime: e.tipoMime,
      creadoEn: e.creadoEn,
      url: typeof e.archivoUrl === 'string' && e.archivoUrl.startsWith('r2:') && r2Disponible()
        ? await firmarObjetoR2(e.archivoUrl.slice(3), 'GET', undefined, 3600)
        : e.archivoUrl?.startsWith('https://') ? e.archivoUrl : null,
    }))) });
  } catch (error) {
    console.error('Error consultando fotografías de avance:', error);
    res.status(500).json({ message: 'No fue posible consultar las fotografías.' });
  }
});


// Descarga de evidencia: sesión y tenant validados antes de consultar R2.
proyectosRouter.get(rutaEvidencias + '/:evidenciaId/imagen', async (req,res) => {
  const {proyectoId,actividadId,avanceId,evidenciaId}=req.params;
  if(![proyectoId,actividadId,avanceId,evidenciaId].every((id)=>typeof id==='string'&&esUuid(id))){res.status(400).json({message:'Evidencia inválida.'});return;}
  try {
    if(!await accesoEvidenciaAvance(String(proyectoId),String(actividadId),String(avanceId),req.auth!.organizacionId)){
      res.status(404).json({message:'Avance no disponible.'});return;
    }
    const clave = await consultarClaveEvidencia(databasePool!, String(evidenciaId), String(proyectoId), String(avanceId));
    if(!clave?.startsWith('r2:')){
      res.status(404).json({message:'Fotografía privada no disponible.'});return;
    }
    const foto=await leerObjetoR2(clave.slice(3));
    res.set('Content-Type',foto.mime);
    res.set('Cache-Control','private, no-store');
    res.set('X-Content-Type-Options','nosniff');
    res.send(Buffer.from(foto.datos));
  }catch(error){
    console.error('Error leyendo fotografía desde backend:',error instanceof Error?error.name:'Error');
    res.status(502).json({message:'No se pudo leer la fotografía del almacenamiento R2 desde el servidor.'});
  }
});

// Subida por proxy autenticado: el navegador nunca se conecta al endpoint S3.
proyectosRouter.post(rutaEvidencias+'/subir',
  requirePermission('evidencias.gestionar'),
  raw({type:['image/jpeg','image/png','image/webp'],limit:'10mb'}),
  async(req,res)=>{
    const {proyectoId,actividadId,avanceId}=req.params;
    const mime=req.headers['content-type']?.split(';')[0].trim().toLowerCase()||'';
    const titulo=typeof req.query.titulo==='string'?req.query.titulo.trim():'';
    const bytes=req.body;
    if(![proyectoId,actividadId,avanceId].every((id)=>typeof id==='string'&&esUuid(id))||!tiposFoto.includes(mime)||
      !Buffer.isBuffer(bytes)||!bytes.length||bytes.length>10*1024*1024||
      titulo.length>180 || /[<>\\\x00-\x1f]/.test(titulo)){
      res.status(400).json({message:'La fotografía o su ubicación no son válidas.'});return;
    }
    const firmaValida=mime==='image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255
      : bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
    if(!firmaValida){res.status(400).json({message:'El contenido no corresponde al formato de fotografía indicado.'});return;}
    if(!r2Disponible()||!databasePool){
      res.status(503).json({message:'Almacenamiento de evidencias no disponible.'});return;
    }
    try{
      const avance=await accesoEvidenciaAvance(String(proyectoId),String(actividadId),String(avanceId),req.auth!.organizacionId);
      if(!avance){res.status(404).json({message:'Avance no disponible.'});return;}
      if(!['BORRADOR','DEVUELTO'].includes(avance.estado)||avance.responsable!==req.auth!.sub){
        res.status(409).json({message:'Solo el responsable puede subir fotos a un borrador o avance devuelto.'});return;
      }
      const clave=`organizaciones/${req.auth!.organizacionId}/proyectos/${proyectoId}/avances/${avanceId}/${randomUUID()}`;
      await cargarObjetoR2(clave,mime,bytes);
      if(!await verificarObjetoR2(clave,mime)){
        res.status(502).json({message:'R2 recibió la carga, pero no pudo verificarse el archivo.'});return;
      }
      const registro = await registrarEvidenciaEnRepositorio(databasePool, {
        proyectoId: String(proyectoId), actividadId: String(actividadId), avanceId: String(avanceId),
        organizacionId: req.auth!.organizacionId, usuarioId: req.auth!.sub,
        clave, mime, titulo, modo: 'proxy',
      });
      if (registro.tipo === 'CAMBIO_ESTADO') {
        res.status(409).json({ message: 'El estado del avance cambió durante la carga.' }); return;
      }
      res.status(201).json({ id: registro.id });
    }catch(error){
      const diagnostico=diagnosticarErrorR2(error);
      console.error('Error cargando fotografía por proxy R2:',diagnostico);
      res.status(502).json({
        message:'El servidor no pudo guardar la fotografía en R2.',
        diagnostico:diagnostico.categoria,
        codigo:diagnostico.codigo,
      });
    }
  }
);

proyectosRouter.post(rutaEvidencias + '/preparar', requirePermission('evidencias.gestionar'), async (req, res) => {
  const { proyectoId, actividadId, avanceId } = req.params;
  if (typeof proyectoId !== 'string' || typeof actividadId !== 'string' || typeof avanceId !== 'string') {
    res.status(400).json({ message: 'La ubicación del avance no es válida.' }); return;
  }
  const mime = typeof req.body?.tipoMime === 'string' ? req.body.tipoMime.toLowerCase().trim() : '';
  if (!tiposFoto.includes(mime) || !r2Disponible()) {
    res.status(r2Disponible() ? 400 : 503).json({ message: r2Disponible()
      ? 'Solo se permiten fotografías JPEG, PNG o WebP.' : 'El almacenamiento de evidencias todavía no está configurado.' });
    return;
  }
  try {
    const avance = await accesoEvidenciaAvance(proyectoId, actividadId, avanceId, req.auth!.organizacionId);
    if (!avance) { res.status(404).json({ message: 'Avance no disponible.' }); return; }
    if (!['BORRADOR', 'DEVUELTO'].includes(avance.estado) || avance.responsable !== req.auth!.sub) {
      res.status(409).json({ message: 'Solo el responsable puede añadir fotografías a su avance en borrador o devuelto.' }); return;
    }
    const clave = `organizaciones/${req.auth!.organizacionId}/proyectos/${proyectoId}/avances/${avanceId}/${randomUUID()}`;
    res.json({ clave, url: await firmarObjetoR2(clave, 'PUT', mime, 300), tipoMime: mime, maxBytes: 10485760 });
  } catch (error) {
    console.error('Error preparando fotografía:', error);
    res.status(500).json({ message: 'No fue posible preparar la carga de la fotografía.' });
  }
});

proyectosRouter.post(rutaEvidencias + '/confirmar', requirePermission('evidencias.gestionar'), async (req, res) => {
  const { proyectoId, actividadId, avanceId } = req.params;
  if (typeof proyectoId !== 'string' || typeof actividadId !== 'string' || typeof avanceId !== 'string') {
    res.status(400).json({ message: 'La ubicación del avance no es válida.' }); return;
  }
  const clave = req.body?.clave;
  const mime = req.body?.tipoMime;
  const titulo = typeof req.body?.titulo === 'string' ? req.body.titulo.trim() : '';
  const descripcion = typeof req.body?.descripcion === 'string' ? req.body.descripcion.trim() : '';
  const prefijo = `organizaciones/${req.auth!.organizacionId}/proyectos/${proyectoId}/avances/${avanceId}/`;
  if (!r2Disponible()) { res.status(503).json({ message: 'Almacenamiento R2 no configurado.' }); return; }
  if (typeof clave !== 'string' || !clave.startsWith(prefijo) ||
      !/^[0-9a-f-]{36}$/.test(clave.slice(prefijo.length)) ||
      !tiposFoto.includes(mime) || titulo.length > 180 || descripcion.length > 3000) {
    res.status(400).json({ message: 'Los datos de la fotografía no son válidos.' }); return;
  }
  try {
    const avance = await accesoEvidenciaAvance(proyectoId, actividadId, avanceId, req.auth!.organizacionId);
    if (!avance) { res.status(404).json({ message: 'Avance no disponible.' }); return; }
    if (!['BORRADOR', 'DEVUELTO'].includes(avance.estado) || avance.responsable !== req.auth!.sub) {
      res.status(409).json({ message: 'El avance ya no admite nuevas fotografías.' }); return;
    }
    if (!await verificarObjetoR2(clave, mime)) {
      res.status(422).json({ message: 'La fotografía no existe en R2 o no cumple el tamaño y tipo permitido (10 MB).' }); return;
    }
    const registro = await registrarEvidenciaEnRepositorio(databasePool!, {
      proyectoId, actividadId, avanceId, organizacionId: req.auth!.organizacionId,
      usuarioId: req.auth!.sub, clave, mime, titulo, descripcion, modo: 'confirmar',
    });
    if (registro.tipo === 'CAMBIO_ESTADO') {
      res.status(409).json({ message: 'El avance cambió de estado antes de confirmar la fotografía.' }); return;
    }
    res.status(registro.tipo === 'EXISTENTE' ? 200 : 201).json({ id: registro.id });
  } catch (error) {
    console.error('Error confirmando fotografía:', error);
    res.status(500).json({ message: 'No fue posible registrar la fotografía.' });
  }
});

// Bandeja centralizada: solo avances enviados de proyectos de la organización activa.
proyectosRouter.get('/revision/pendientes', requirePermission('actividades.avance.revisar'), async (req, res) => {
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const rows = await consultarAvancesPendientes(databasePool, req.auth!.organizacionId, req.auth!.sub);
    res.json({ pendientes: rows });
  } catch (error) {
    console.error('Error consultando avances pendientes:', error);
    res.status(500).json({ message: 'No fue posible consultar los avances pendientes.' });
  }
});

proyectosRouter.get('/', async (req, res) => {
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const catalogo = await consultarCatalogoProyectos(databasePool, req.auth!.organizacionId);
    res.json(catalogo);
  } catch (error) {
    console.error('Error consultando proyectos:', error);
    res.status(500).json({ message: 'No fue posible consultar los proyectos.' });
  }
});

// Brigadas y recursos: las asociaciones existentes se reutilizan; los aportes no
// modifican el progreso físico de las actividades.
proyectosRouter.get('/:proyectoId/brigadas-recursos', requirePermission('proyectos.gestionar'), async (req, res) => {
  const { proyectoId } = req.params;
  if (!esUuid(proyectoId)) { res.status(400).json({ message: 'Seleccioná un proyecto válido.' }); return; }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const rows = await listarBrigadasRecursos(databasePool, proyectoId, req.auth!.organizacionId);
    if (!rows) { res.status(404).json({ message: 'Proyecto no disponible.' }); return; }
    res.json({ brigadas: rows });
  } catch (error) {
    console.error('Error consultando brigadas y recursos:', error);
    res.status(500).json({ message: 'No fue posible consultar las brigadas y sus recursos. Revisá si está aplicada la migración 038.' });
  }
});

proyectosRouter.put('/:proyectoId/brigadas-recursos/:brigadaId', requirePermission('proyectos.gestionar'), async (req, res) => {
  const { proyectoId, brigadaId } = req.params;
  const body = req.body ?? {};
  const { vinculada, actividadIds, materialesComprometidos, materialesEntregados, observaciones } = body;
  const montoComprometido = body.montoComprometido;
  const montoRecibido = body.montoRecibido;
  const voluntariosPrevistos = body.voluntariosPrevistos;
  const textoValido = (valor: unknown) => valor === null || (typeof valor === 'string' && valor.length <= 3000);
  const dineroValido = (valor: unknown) => typeof valor === 'number' && Number.isFinite(valor) &&
    valor >= 0 && /^\d{1,12}(?:\.\d{1,2})?$/.test(String(valor));
  if (!esUuid(proyectoId) || !esUuid(brigadaId) || typeof vinculada !== 'boolean' ||
      !Array.isArray(actividadIds) || !actividadIds.every(esUuid) ||
      new Set(actividadIds).size !== actividadIds.length ||
      ![materialesComprometidos, materialesEntregados, observaciones].every(textoValido) ||
      !dineroValido(montoComprometido) || !dineroValido(montoRecibido) ||
      montoRecibido > montoComprometido ||
      !Number.isInteger(voluntariosPrevistos) || voluntariosPrevistos < 0) {
    res.status(400).json({ message: 'Revisá brigada, actividades y cantidades. Lo recibido no puede superar lo comprometido.' });
    return;
  }
  if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
  try {
    const resultado = await guardarRecursosBrigada(databasePool, proyectoId, brigadaId, req.auth!.organizacionId, {
      vinculada, actividadIds, montoComprometido, montoRecibido, voluntariosPrevistos,
      materialesComprometidos, materialesEntregados, observaciones,
    });
    if (resultado !== 'OK') {
      const mensajes = {
        NO_ENCONTRADO: 'Brigada o proyecto no disponibles en tu organización.',
        SIN_VINCULO: 'No es posible asignar actividades sin vincular la brigada.',
        ACTIVIDAD_INVALIDA: 'Una actividad no corresponde a este proyecto.',
        TIENE_ENTREGAS: 'La brigada tiene recursos entregados. Conservá su historial antes de desvincularla.',
      };
      res.status(resultado === 'NO_ENCONTRADO' ? 404 : resultado === 'TIENE_ENTREGAS' ? 409 : 400)
        .json({ message: mensajes[resultado] });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error actualizando brigada de proyecto:', error);
    res.status(500).json({ message: 'No fue posible actualizar la brigada y sus recursos.' });
  }
});

const guardarProyecto: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { comunidadId, estado, fechaInicio } = req.body ?? {};
  // El cierre y la reapertura usan rutas dedicadas con validación y auditoría.
  if (estado === 'FINALIZADO') { res.status(409).json({ message: 'Finalizá el proyecto desde Resultados, después de verificar sus requisitos.' }); return; }
  const fechaFin = req.body?.fechaFin ?? '';
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  const tipo = typeof req.body?.tipo === 'string' ? req.body.tipo.trim() : '';
  const descripcion = req.body?.descripcion ?? '';
  const presupuesto = req.body?.presupuesto;
  const donanteIds = req.body?.donanteIds;
  const tipoDeDiagnostico = areasNecesidad.some((area) => area === tipo);
  if ((presupuesto !== undefined && (typeof presupuesto !== 'string' || !/^\d{1,12}(\.\d{1,2})?$/.test(presupuesto))) ||
      (donanteIds !== undefined && (!Array.isArray(donanteIds) || !donanteIds.every(esUuid) ||
        new Set(donanteIds.map((valor: string) => valor.toLowerCase())).size !== donanteIds.length))) {
    res.status(400).json({ message: 'Revisá el presupuesto y los donantes seleccionados.' });
    return;
  }
  if ((id !== undefined && !esUuid(id)) || !esUuid(comunidadId) ||
      !nombre || nombre.length > 200 || !tipo || tipo.length > 60 || (!id && !tipoDeDiagnostico) ||
      !estados.includes(estado) || !esFecha(fechaInicio) ||
      (fechaFin !== '' && (!esFecha(fechaFin) || fechaFin < fechaInicio)) ||
      typeof descripcion !== 'string' || descripcion.length > 3000) {
    res.status(400).json({ message: 'Revisá la comunidad, el nombre, el tipo, el estado y las fechas del proyecto.' });
    return;
  }
  const parametros = [comunidadId, req.auth!.organizacionId, nombre, tipo, estado,
    fechaInicio, fechaFin || null, descripcion.trim() || null, presupuesto ?? null];

  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const resultado = await guardarProyectoEnRepositorio(databasePool, {
      id, organizacionId: req.auth!.organizacionId, presupuesto, donanteIds,
      tipoDeDiagnostico, parametros,
    });
    if (resultado.tipo === 'PRESUPUESTO_INSUFICIENTE') {
      res.status(400).json({ message: 'El presupuesto del proyecto no puede ser menor que las asignaciones estimadas de sus actividades.' });
      return;
    }
    if (resultado.tipo === 'NO_ENCONTRADO') {
      res.status(404).json({ message: 'El proyecto, su categoría o la comunidad no están disponibles.' });
      return;
    }
    if (resultado.tipo === 'DONANTES_INVALIDOS') {
      res.status(400).json({ message: 'Hay donantes seleccionados que no están disponibles.' });
      return;
    }
    res.status(id ? 200 : 201).json({ id: resultado.id });
  } catch (error) {
    console.error('Error guardando proyecto:', error);
    res.status(500).json({ message: 'No fue posible guardar el proyecto.' });
  }
};

proyectosRouter.post('/', requirePermission('proyectos.gestionar'), guardarProyecto);
proyectosRouter.put('/:id', requirePermission('proyectos.gestionar'), guardarProyecto);

// Cierre administrativo separado de los cálculos de avance físico.
proyectosRouter.get('/:proyectoId/cierre', async (req, res) => {
  const { proyectoId } = req.params;
  if (!esUuid(proyectoId)) { res.status(400).json({ message: 'Proyecto no válido.' }); return; }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const estado = await consultarCierreProyecto(databasePool, proyectoId, req.auth!.organizacionId);
    if (!estado) { res.status(404).json({ message: 'Proyecto no encontrado.' }); return; }
    res.json({ ...estado, puedeReabrir: req.auth!.roles.includes('ADMINISTRADOR') });
  } catch (error) {
    console.error('Error consultando cierre:', error);
    res.status(500).json({ message: 'No fue posible consultar el cierre del proyecto.' });
  }
});

proyectosRouter.post('/:proyectoId/finalizar', requirePermission('proyectos.gestionar'), async (req, res) => {
  const { proyectoId } = req.params;
  if (!esUuid(proyectoId) ||
      req.body?.evidenciasRevisadas !== true || req.body?.recursosRevisados !== true) {
    res.status(400).json({ message: 'Confirmá la revisión de evidencias y recursos.' }); return;
  }
  if (!req.auth!.roles.some((rol) => rol === 'COORDINADOR' || rol === 'ADMINISTRADOR')) {
    res.status(403).json({ message: 'El cierre requiere coordinación o administración.' }); return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const resultado = await finalizarProyecto(databasePool, proyectoId, req.auth!.organizacionId,
      req.auth!.sub, true, true);
    if (resultado.tipo !== 'OK') {
      res.status(resultado.tipo === 'NO_ENCONTRADO' ? 404 : 409).json({
        message: resultado.tipo === 'INCOMPLETO'
          ? 'No se puede finalizar: verificá las metas, los avances pendientes y las evidencias por actividad.'
          : 'Este proyecto no está disponible para finalizar.',
        ...(resultado.tipo === 'INCOMPLETO' ? { revision: resultado.revision } : {}),
      });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error finalizando proyecto:', error);
    res.status(500).json({ message: 'No fue posible finalizar el proyecto.' });
  }
});

proyectosRouter.post('/:proyectoId/reabrir', requirePermission('proyectos.gestionar'), async (req, res) => {
  const { proyectoId } = req.params;
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
  if (!esUuid(proyectoId) || motivo.length < 10 || motivo.length > 3000) {
    res.status(400).json({ message: 'Indica un motivo de reapertura de al menos 10 caracteres.' }); return;
  }
  if (!req.auth!.roles.includes('ADMINISTRADOR')) {
    res.status(403).json({ message: 'La reapertura requiere un administrador.' }); return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const resultado = await reabrirProyecto(databasePool, proyectoId, req.auth!.organizacionId,
      req.auth!.sub, motivo);
    if (resultado !== 'OK') {
      res.status(resultado === 'NO_ENCONTRADO' ? 404 : 409)
        .json({ message: 'El proyecto no existe o no está finalizado.' }); return;
    }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error reabriendo proyecto:', error);
    res.status(500).json({ message: 'No fue posible reabrir el proyecto.' });
  }
});

const estadosActividad = ['PLANIFICADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'];

export function crearRouterActividades(pool: typeof databasePool = databasePool) {
  const router = Router();

  router.get('/:proyectoId/actividades', async (req, res) => {
    const { proyectoId } = req.params;
    if (!esUuid(proyectoId)) {
      res.status(400).json({ message: 'Seleccioná un proyecto válido.' });
      return;
    }
    try {
      if (!pool) throw new Error('Base de datos no disponible');
      const resultado = await listarActividadesProyecto(
        pool, proyectoId, req.auth!.organizacionId,
      );
      if (!resultado) {
        res.status(404).json({ message: 'No se encontró el proyecto.' });
        return;
      }
      res.json(resultado);
    } catch (error) {
      console.error('Error consultando actividades:', error);
      res.status(500).json({ message: 'No fue posible consultar las actividades.' });
    }
  });

  router.get('/:proyectoId/responsables', requirePermission('proyectos.gestionar'), async (req, res) => {
    const { proyectoId } = req.params;
    if (!esUuid(proyectoId)) {
      res.status(400).json({ message: 'Seleccioná un proyecto válido.' });
      return;
    }
    try {
      if (!pool) throw new Error('Base de datos no disponible');
      const rows = await consultarResponsablesProyecto(pool, proyectoId, req.auth!.organizacionId);
      res.json({ responsables: rows });
    } catch (error) {
      console.error('Error consultando responsables de actividad:', error);
      res.status(500).json({ message: 'No fue posible consultar los responsables.' });
    }
  });

  router.post(
    '/:proyectoId/actividades/:actividadId/avances',
    requirePermission('actividades.avance.gestionar'),
    async (req, res) => {
      const { proyectoId, actividadId } = req.params;
      const datos = validarAvanceActividad(req.body);
      if (!esUuid(proyectoId) || !esUuid(actividadId) || !datos) {
        res.status(400).json({ message: 'Revisá la actividad, el porcentaje, la fecha y la descripción del avance.' });
        return;
      }
      try {
        if (!pool) throw new Error('Base de datos no disponible');
        const contexto = { rows: await consultarMetaActividad(pool, proyectoId, actividadId, req.auth!.organizacionId) };
        if (!contexto.rows.length) {
          res.status(404).json({ message: 'No se encontró la actividad del proyecto en la organización activa.' });
          return;
        }
        const cuantificable = contexto.rows[0].meta_cantidad !== null;
        if (cuantificable !== (datos.cantidadReportada !== null)) {
          res.status(400).json({ message: 'El avance debe reportar una cantidad para esta meta o una estimación justificada.' });
          return;
        }
        const avance = await registrarAvanceActividad(
          pool,
          proyectoId,
          actividadId,
          req.auth!.organizacionId,
          req.auth!.sub,
          datos,
        );
        if (!avance) {
          res.status(409).json({ message: 'No se pudo crear el avance. Es posible que la meta ya esté alcanzada, que la actividad esté cerrada o que el envío se haya registrado anteriormente. Actualizá la ejecución y revisá el historial antes de reintentar.' });
          return;
        }
        res.status(201).json(avance);
      } catch (error) {
        console.error('Error registrando avance de actividad:', error);
        res.status(500).json({ message: 'No fue posible registrar el avance de la actividad.' });
      }
    },
  );

  router.put(
    '/:proyectoId/actividades/:actividadId/avances/:avanceId',
    requirePermission('actividades.avance.gestionar'),
    async (req, res) => {
      const { proyectoId, actividadId, avanceId } = req.params;
      const datos = validarAvanceActividad(req.body);
      if (!esUuid(proyectoId) || !esUuid(actividadId) || !esUuid(avanceId) || !datos) {
        res.status(400).json({ message: 'Revisá los datos del avance antes de guardarlo.' });
        return;
      }
      try {
        if (!pool) throw new Error('Base de datos no disponible');
        const actualizado = await editarAvanceActividad(
          pool, proyectoId, actividadId, avanceId, req.auth!.organizacionId,
          req.auth!.sub, datos,
        );
        if (!actualizado) {
          res.status(409).json({ message: 'Solo podés editar un borrador o un avance devuelto de tu organización.' });
          return;
        }
        res.sendStatus(204);
      } catch (error) {
        console.error('Error editando borrador de avance:', error);
        res.status(500).json({ message: 'No fue posible guardar los cambios del avance.' });
      }
    },
  );

  router.post(
    '/:proyectoId/actividades/:actividadId/avances/:avanceId/enviar',
    requirePermission('actividades.avance.gestionar'),
    async (req, res) => {
      const { proyectoId, actividadId, avanceId } = req.params;
      if (!esUuid(proyectoId) || !esUuid(actividadId) || !esUuid(avanceId)) {
        res.status(400).json({ message: 'Seleccioná un avance válido.' });
        return;
      }
      try {
        if (!pool) throw new Error('Base de datos no disponible');
        const enviado = await transicionarAvanceActividad(
          pool, proyectoId, actividadId, avanceId, req.auth!.organizacionId,
          req.auth!.sub, 'ENVIAR',
        );
        if (!enviado) {
          res.status(409).json({ message: 'El avance no está disponible para enviar en su estado actual.' });
          return;
        }
        res.sendStatus(204);
      } catch (error) {
        console.error('Error enviando avance a revisión:', error);
        res.status(500).json({ message: 'No fue posible enviar el avance a revisión.' });
      }
    },
  );

  for (const accion of ['validar', 'devolver'] as const) {
    router.post(
      `/:proyectoId/actividades/:actividadId/avances/:avanceId/${accion}`,
      requirePermission('actividades.avance.revisar'),
      async (req, res) => {
        const { proyectoId, actividadId, avanceId } = req.params;
        const motivo = req.body?.motivo;
        if (!esUuid(proyectoId) || !esUuid(actividadId) || !esUuid(avanceId) ||
            (accion === 'devolver' && (typeof motivo !== 'string' || !motivo.trim() || motivo.trim().length > 3000))) {
          res.status(400).json({ message: 'Revisá el avance y el motivo de devolución.' });
          return;
        }
        try {
          if (!pool) throw new Error('Base de datos no disponible');
          const actualizado = await transicionarAvanceActividad(
            pool, proyectoId, actividadId, avanceId, req.auth!.organizacionId,
            req.auth!.sub, accion === 'validar' ? 'VALIDAR' : 'DEVOLVER',
            accion === 'devolver' ? motivo.trim() : undefined,
            req.auth!.roles.some((rol) => rol === 'ADMINISTRADOR' || rol === 'COORDINADOR'),
          );
          if (!actualizado) {
            if (accion === 'validar') {
              const limite = await consultarLimiteDeValidacion(pool, avanceId, actividadId,
                proyectoId, req.auth!.organizacionId);
              if (limite && limite.total > limite.meta) {
                res.status(409).json({
                  message: `No se puede validar: el total reportado (${limite.total} ${limite.unidad ?? 'unidades'}) supera la meta planificada (${limite.meta}). Corregí la planificación o devolvé el avance.`,
                });
                return;
              }
            }
            res.status(409).json({ message: 'El avance no está disponible para esta revisión o no tenés autorización para revisarlo.' });
            return;
          }
          res.sendStatus(204);
        } catch (error) {
          console.error(`Error al ${accion} avance:`, error);
          res.status(500).json({ message: `No fue posible ${accion} el avance.` });
        }
      },
    );
  }

  router.post(
    '/:proyectoId/actividades/:actividadId/avances/:avanceId/corregir',
    requirePermission('actividades.avance.corregir'),
    async (req, res) => {
      const { proyectoId, actividadId, avanceId } = req.params;
      const datos = validarAvanceActividad(req.body);
      const motivo = req.body?.motivoCorreccion;
      if (!esUuid(proyectoId) || !esUuid(actividadId) || !esUuid(avanceId) || !datos ||
          typeof motivo !== 'string' || motivo.trim().length < 3 || motivo.trim().length > 3000) {
        res.status(400).json({ message: 'La corrección debe incluir datos válidos y un motivo.' });
        return;
      }
      try {
        if (!pool) throw new Error('Base de datos no disponible');
        const corregido = await editarAvanceActividad(
          pool, proyectoId, actividadId, avanceId, req.auth!.organizacionId,
          req.auth!.sub, datos, true, motivo.trim(),
        );
        if (!corregido) {
          res.status(409).json({ message: 'Solo se puede corregir explícitamente un avance validado del proyecto.' });
          return;
        }
        res.sendStatus(204);
      } catch (error) {
        console.error('Error corrigiendo avance validado:', error);
        res.status(500).json({ message: 'No fue posible corregir el avance validado.' });
      }
    },
  );

  return router;
}

proyectosRouter.use(crearRouterActividades());

const guardarActividad: RequestHandler = async (req, res) => {
  const { proyectoId, actividadId } = req.params;
  const { estado, fechaInicio, fechaFin } = req.body ?? {};
  const responsableAsignadoId = req.body?.responsableAsignadoId || null;
  const metaCantidad = req.body?.metaCantidad === '' ? null : req.body?.metaCantidad ?? null;
  const unidadMedida = typeof req.body?.unidadMedida === 'string' ? req.body.unidadMedida.trim() : '';
  const presupuestoEstimado = req.body?.presupuestoEstimado === '' ? null : req.body?.presupuestoEstimado ?? null;
  const pesoResultado = req.body?.pesoResultado === '' ? null : req.body?.pesoResultado ?? null;
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  const descripcion = req.body?.descripcion ?? '';
  const metaValida = metaCantidad === null || (typeof metaCantidad === 'number' &&
    Number.isFinite(metaCantidad) && metaCantidad > 0 &&
    /^\d{1,11}(?:\.\d{1,3})?$/.test(String(metaCantidad)));
  const presupuestoValido = presupuestoEstimado === null || (typeof presupuestoEstimado === 'number' &&
    Number.isFinite(presupuestoEstimado) && presupuestoEstimado >= 0 &&
    /^\d{1,12}(?:\.\d{1,2})?$/.test(String(presupuestoEstimado)));
  const pesoValido = pesoResultado === null || (typeof pesoResultado === 'number' &&
    Number.isFinite(pesoResultado) && pesoResultado >= 0 && pesoResultado <= 100 &&
    /^\d{1,3}(?:\.\d{1,2})?$/.test(String(pesoResultado)));
  if (!esUuid(proyectoId) || (actividadId !== undefined && !esUuid(actividadId)) ||
      !nombre || nombre.length > 180 || typeof descripcion !== 'string' || descripcion.length > 3000 ||
      (responsableAsignadoId !== null && !esUuid(responsableAsignadoId)) ||
      !metaValida || (metaCantidad === null) !== !unidadMedida ||
      unidadMedida.length > 80 || !presupuestoValido || !pesoValido ||
      !estadosActividad.includes(estado) ||
      (fechaInicio != null && !esFecha(fechaInicio)) ||
      (fechaFin != null && (!esFecha(fechaFin) || (fechaInicio != null && fechaFin < fechaInicio)))) {
    res.status(400).json({ message: 'Revisá el nombre, las metas, la unidad, los recursos, el responsable, el estado y las fechas de la actividad.' });
    return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const valores = [proyectoId, req.auth!.organizacionId, nombre, descripcion.trim() || null,
      estado, fechaInicio ?? null, fechaFin ?? null, actividadId ?? null,
      presupuestoEstimado, responsableAsignadoId, metaCantidad, unidadMedida || null, pesoResultado];
    const rows = await guardarActividadEnRepositorio(databasePool, actividadId ?? null, valores);
    if (!rows.length) {
      const disponible = await existeProyectoEnOrganizacion(databasePool, proyectoId, req.auth!.organizacionId);
      if (!disponible) {
        res.status(404).json({ message: 'No se encontró el proyecto o la actividad.' });
        return;
      }
      const saldos = await consultarSaldoActividad(databasePool, proyectoId, req.auth!.organizacionId, actividadId ?? null);
      if (saldos.length && Number(presupuestoEstimado ?? 0) >
        Number(saldos[0].presupuesto) - Number(saldos[0].asignado)) {
        res.status(400).json({
          message: 'El presupuesto estimado supera el saldo disponible del proyecto. Revisá las asignaciones de las demás actividades.',
        });
        return;
      }
      res.status(400).json({
        message: 'Revisá el responsable asignado: debe ser un usuario activo de esta organización.',
      });
      return;
    }
    res.status(actividadId ? 200 : 201).json(rows[0]);
  } catch (error) {
    console.error('Error guardando actividad:', error);
    res.status(500).json({ message: 'No fue posible guardar la actividad.' });
  }
};

proyectosRouter.post('/:proyectoId/actividades', requirePermission('proyectos.gestionar'), guardarActividad);
proyectosRouter.put('/:proyectoId/actividades/:actividadId', requirePermission('proyectos.gestionar'), guardarActividad);
