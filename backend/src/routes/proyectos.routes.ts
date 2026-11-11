import { randomUUID } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { firmarObjetoR2, r2Disponible, verificarObjetoR2 } from '../services/r2-evidencias.service.js';
import { databasePool } from '../config/database.js';
import { areasNecesidad } from '../domain/necesidades.js';
import { esUuid } from '../domain/expediente.js';
import { esFecha } from '../domain/fecha.js';
import { validarAvanceActividad } from '../domain/avances-actividad.js';
import { authenticateAccessToken, requirePermission } from '../middleware/auth.middleware.js';
import {
  editarAvanceActividad,
  listarActividadesProyecto,
  registrarAvanceActividad,
  transicionarAvanceActividad,
} from '../services/avances-actividad.service.js';

export const proyectosRouter = Router();
const estados = ['PLANIFICADO', 'EN_EJECUCION', 'PAUSADO', 'FINALIZADO', 'CANCELADO'];

proyectosRouter.use(authenticateAccessToken, requirePermission('proyectos.ver'), (req, res, next) => {
  if (req.auth?.roles.includes('DONANTE')) {
    res.status(403).json({ message: 'Consultá tus proyectos desde el portal de donantes.' });
    return;
  }
  next();
});


const tiposFoto = ['image/jpeg', 'image/png', 'image/webp'];

// Verifica pertenencia del avance a la actividad, proyecto y organización de la sesión.
async function accesoEvidenciaAvance(proyectoId: string, actividadId: string, avanceId: string, organizacionId: string) {
  if (!databasePool || ![proyectoId, actividadId, avanceId, organizacionId].every(esUuid)) return null;
  const { rows } = await databasePool.query(
    `SELECT av.id, av.estado_revision AS estado, av.responsable_usuario_id AS responsable
     FROM avances_proyecto av
     JOIN actividades_programadas a ON a.id = av.actividad_id AND a.proyecto_id = av.proyecto_id
     JOIN proyectos p ON p.id = a.proyecto_id
     JOIN comunidades c ON c.id = p.comunidad_id
     WHERE p.id = $1 AND a.id = $2 AND av.id = $3 AND c.organizacion_id = $4`,
    [proyectoId, actividadId, avanceId, organizacionId],
  );
  return rows[0] as { id: string; estado: string; responsable: string } | undefined;
}
// Índice de evidencias por organización: permite localizar las fotos sin adivinar el avance.
proyectosRouter.get('/evidencias/indice', async (req, res) => {
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const { rows } = await databasePool.query(
      `SELECT av.id AS "avanceId", a.id AS "actividadId", p.id AS "proyectoId",
         p.nombre AS proyecto, a.nombre AS actividad, c.nombre AS comunidad,
         av.fecha_avance::text AS fecha, av.estado_revision AS "estadoRevision",
         av.comentarios AS descripcion, av.observaciones,
         av.cantidad_reportada::float8 AS "cantidadReportada",
         av.porcentaje_avance::float8 AS "porcentajeAvance",
         av.revisado_en AS "revisadoEn", av.motivo_devolucion AS "motivoDevolucion",
         COALESCE(u.email, '') AS responsable,
         COALESCE(rev.email, '') AS revisor,
         (SELECT COUNT(*)::int FROM evidencias ev
           WHERE ev.proyecto_id=p.id AND ev.avance_proyecto_id=av.id
             AND ev.tipo_mime IN ('image/jpeg','image/png','image/webp')) AS "cantidadEvidencias"
       FROM avances_proyecto av
       JOIN actividades_programadas a ON a.id=av.actividad_id AND a.proyecto_id=av.proyecto_id
       JOIN proyectos p ON p.id=a.proyecto_id
       JOIN comunidades c ON c.id=p.comunidad_id
       LEFT JOIN usuarios u ON u.id=av.responsable_usuario_id
       LEFT JOIN usuarios rev ON rev.id=av.revisor_usuario_id
       WHERE c.organizacion_id=$1
       ORDER BY av.fecha_avance DESC, av.creado_en DESC, av.id DESC
       LIMIT 500`,
      [req.auth!.organizacionId],
    );
    res.json({ avances: rows });
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
    const { rows } = await databasePool!.query(
      `SELECT id, titulo, descripcion, tipo_mime AS "tipoMime", archivo_url AS "archivoUrl", creado_en AS "creadoEn"
       FROM evidencias WHERE proyecto_id=$1 AND avance_proyecto_id=$2
       ORDER BY creado_en DESC, id DESC`, [proyectoId, avanceId],
    );
    res.json({ evidencias: rows.map((e) => ({
      id: e.id, titulo: e.titulo, descripcion: e.descripcion, tipoMime: e.tipoMime,
      creadoEn: e.creadoEn,
      url: typeof e.archivoUrl === 'string' && e.archivoUrl.startsWith('r2:') && r2Disponible()
        ? firmarObjetoR2(e.archivoUrl.slice(3), 'GET', undefined, 300)
        : e.archivoUrl?.startsWith('https://') ? e.archivoUrl : null,
    })) });
  } catch (error) {
    console.error('Error consultando fotografías de avance:', error);
    res.status(500).json({ message: 'No fue posible consultar las fotografías.' });
  }
});

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
    res.json({ clave, url: firmarObjetoR2(clave, 'PUT', mime, 300), tipoMime: mime, maxBytes: 10485760 });
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
    const cliente = await databasePool!.connect();
    try {
      await cliente.query('BEGIN');
      // Revalidar el estado dentro de la misma transacción que escribe la evidencia.
      const validacion = await cliente.query(
        `SELECT av.id FROM avances_proyecto av
         JOIN actividades_programadas a ON a.id=av.actividad_id AND a.proyecto_id=av.proyecto_id
         JOIN proyectos p ON p.id=a.proyecto_id JOIN comunidades c ON c.id=p.comunidad_id
         WHERE av.id=$1 AND a.id=$2 AND p.id=$3 AND c.organizacion_id=$4
           AND av.responsable_usuario_id=$5 AND av.estado_revision IN ('BORRADOR','DEVUELTO')
         FOR UPDATE OF av`,
        [avanceId, actividadId, proyectoId, req.auth!.organizacionId, req.auth!.sub],
      );
      if (!validacion.rows.length) {
        await cliente.query('ROLLBACK');
        res.status(409).json({ message: 'El avance cambió de estado antes de confirmar la fotografía.' }); return;
      }
      const existente = await cliente.query(
        'SELECT id FROM evidencias WHERE proyecto_id=$1 AND avance_proyecto_id=$2 AND archivo_url=$3 LIMIT 1',
        [proyectoId, avanceId, 'r2:' + clave],
      );
      if (existente.rows.length) {
        await cliente.query('COMMIT');
        res.json({ id: existente.rows[0].id }); return;
      }
      const { rows } = await cliente.query(
        `INSERT INTO evidencias (proyecto_id, avance_proyecto_id, tipo_evidencia, titulo, descripcion,
           archivo_url, tipo_mime, subido_por_usuario_id, visible_para_donantes)
         VALUES ($1,$2,'FOTOGRAFIA',$3,$4,$5,$6,$7,false) RETURNING id`,
        [proyectoId, avanceId, titulo || null, descripcion || null, 'r2:' + clave, mime, req.auth!.sub],
      );
      await cliente.query(
        `INSERT INTO bitacora_auditoria (usuario_id, accion, nombre_entidad, entidad_id, valores_nuevos)
         VALUES ($1, 'REGISTRAR_EVIDENCIA', 'evidencias', $2, $3::jsonb)`,
        [req.auth!.sub, rows[0].id, JSON.stringify({ proyectoId, actividadId, avanceId, tipoMime: mime })],
      );
      await cliente.query('COMMIT');
      res.status(201).json({ id: rows[0].id });
    } catch (error) { await cliente.query('ROLLBACK'); throw error; }
    finally { cliente.release(); }
  } catch (error) {
    console.error('Error confirmando fotografía:', error);
    res.status(500).json({ message: 'No fue posible registrar la fotografía.' });
  }
});

// Bandeja centralizada: solo avances enviados de proyectos de la organización activa.
proyectosRouter.get('/revision/pendientes', requirePermission('actividades.avance.revisar'), async (req, res) => {
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const { rows } = await databasePool.query(
      `SELECT av.id, av.actividad_id AS "actividadId", av.proyecto_id AS "proyectoId",
         a.nombre AS actividad, p.nombre AS proyecto, c.nombre AS comunidad,
         av.fecha_avance::text AS fecha, av.comentarios AS descripcion,
         av.observaciones, av.cantidad_reportada::double precision AS "cantidadReportada",
         av.porcentaje_avance::double precision AS "porcentajeAvance",
         a.unidad_medida AS "unidadMedida", autor.email AS responsable,
         (SELECT COUNT(*)::int FROM evidencias ev WHERE ev.avance_proyecto_id = av.id
           AND ev.proyecto_id = p.id
           AND ev.tipo_mime IN ('image/jpeg', 'image/png', 'image/webp')) AS "cantidadEvidencias",
         (av.responsable_usuario_id = $2::uuid) AS "esPropio"
       FROM avances_proyecto av
       JOIN actividades_programadas a ON a.id = av.actividad_id AND a.proyecto_id = av.proyecto_id
       JOIN proyectos p ON p.id = a.proyecto_id
       JOIN comunidades c ON c.id = p.comunidad_id
       JOIN usuarios autor ON autor.id = av.responsable_usuario_id
       WHERE c.organizacion_id = $1 AND av.estado_revision = 'ENVIADO'
       ORDER BY av.fecha_avance DESC, av.creado_en DESC, av.id DESC
       LIMIT 200`,
      [req.auth!.organizacionId, req.auth!.sub],
    );
    res.json({ pendientes: rows });
  } catch (error) {
    console.error('Error consultando avances pendientes:', error);
    res.status(500).json({ message: 'No fue posible consultar los avances pendientes.' });
  }
});

proyectosRouter.get('/', async (req, res) => {
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const parametros = [req.auth!.organizacionId];
    const [proyectos, comunidades, donantes, organizacion] = await Promise.all([
      databasePool.query(
        `SELECT p.id, p.nombre, p.tipo, p.estado, p.descripcion, p.presupuesto_asignado::text AS "presupuesto",
                ARRAY(SELECT donante_id FROM proyectos_fichas_donantes WHERE proyecto_id = p.id) AS "donanteIds",
                ARRAY(SELECT d.nombre FROM donantes d
                  WHERE d.organizacion_id = c.organizacion_id AND (
                    EXISTS (SELECT 1 FROM proyectos_fichas_donantes pd WHERE pd.proyecto_id = p.id AND pd.donante_id = d.id)
                    OR EXISTS (SELECT 1 FROM brigadas_donantes_proyectos bp
                      JOIN brigadas_donantes b ON b.id = bp.brigada_id
                      WHERE bp.proyecto_id = p.id AND b.donante_id = d.id)
                  ) ORDER BY d.nombre, d.id) AS donantes,
                p.comunidad_id AS "comunidadId", c.nombre AS comunidad,
                p.fecha_inicio::text AS "fechaInicio", p.fecha_fin::text AS "fechaFin"
         FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
         WHERE c.organizacion_id = $1 ORDER BY p.fecha_inicio DESC, p.nombre, p.id`,
        parametros,
      ),
      databasePool.query(
        `SELECT id, nombre, municipio FROM comunidades
         WHERE organizacion_id = $1 AND activo ORDER BY nombre, municipio, id`,
        parametros,
      ),
      databasePool.query('SELECT id, nombre, activo FROM donantes WHERE organizacion_id = $1 ORDER BY nombre, id', parametros),
      databasePool.query('SELECT moneda FROM organizaciones WHERE id = $1', parametros),
    ]);
    res.json({ proyectos: proyectos.rows, comunidades: comunidades.rows, donantes: donantes.rows,
      moneda: organizacion.rows[0]?.moneda ?? 'HNL' });
  } catch (error) {
    console.error('Error consultando proyectos:', error);
    res.status(500).json({ message: 'No fue posible consultar los proyectos.' });
  }
});

const guardarProyecto: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { comunidadId, estado, fechaInicio } = req.body ?? {};
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
    const cliente = await databasePool.connect();
    try {
      await cliente.query('BEGIN');
      if (id && presupuesto !== undefined) {
        const asignacion = await cliente.query(
          `SELECT p.presupuesto_asignado::text AS presupuesto_actual,
             COALESCE((SELECT SUM(a.presupuesto_estimado) FROM actividades_programadas a
               WHERE a.proyecto_id = p.id), 0)::text AS presupuesto_actividades
           FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
           WHERE p.id = $1 AND c.organizacion_id = $2
           FOR UPDATE OF p`,
          [id, req.auth!.organizacionId],
        );
        if (asignacion.rows.length && Number(presupuesto) < Number(asignacion.rows[0].presupuesto_actividades)) {
          await cliente.query('ROLLBACK');
          res.status(400).json({ message: 'El presupuesto del proyecto no puede ser menor que las asignaciones estimadas de sus actividades.' });
          return;
        }
      }
      const resultado = id
      ? await cliente.query(
        `UPDATE proyectos p SET nombre = $3, tipo = $4, estado = $5,
           fecha_inicio = $6, fecha_fin = $7, descripcion = $8, presupuesto_asignado = COALESCE($9, p.presupuesto_asignado), actualizado_en = NOW()
         FROM comunidades c
         WHERE p.id = $10 AND ($11::boolean OR p.tipo = $4) AND p.comunidad_id = c.id AND c.id = $1 AND c.organizacion_id = $2
         RETURNING p.id`,
        [...parametros, id, tipoDeDiagnostico],
      )
      : await cliente.query(
        `INSERT INTO proyectos (comunidad_id, nombre, tipo, estado, fecha_inicio, fecha_fin, descripcion, presupuesto_asignado)
         SELECT id, $3, $4, $5, $6, $7, $8, COALESCE($9::numeric, 0) FROM comunidades
         WHERE id = $1 AND organizacion_id = $2 AND activo RETURNING id`,
        parametros,
      );
      if (!resultado.rowCount) {
        await cliente.query('ROLLBACK');
        res.status(404).json({ message: 'El proyecto, su categoría o la comunidad no están disponibles.' });
        return;
      }
      const proyectoId = resultado.rows[0].id;
      if (donanteIds !== undefined) {
        const seleccion = await cliente.query(
          `SELECT id FROM donantes d WHERE d.organizacion_id = $1 AND d.id = ANY($2::uuid[])
             AND (d.activo OR EXISTS (
               SELECT 1 FROM proyectos_fichas_donantes pd WHERE pd.proyecto_id = $3 AND pd.donante_id = d.id
             )) FOR SHARE OF d`,
          [req.auth!.organizacionId, donanteIds, proyectoId],
        );
        if (seleccion.rowCount !== donanteIds.length) {
          await cliente.query('ROLLBACK');
          res.status(400).json({ message: 'Hay donantes seleccionados que no están disponibles.' });
          return;
        }
        await cliente.query('DELETE FROM proyectos_fichas_donantes WHERE proyecto_id = $1', [proyectoId]);
        await cliente.query(
          'INSERT INTO proyectos_fichas_donantes (proyecto_id, donante_id) SELECT $1, unnest($2::uuid[])',
          [proyectoId, donanteIds],
        );
      }
      await cliente.query('COMMIT');
      res.status(id ? 200 : 201).json({ id: proyectoId });
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  } catch (error) {
    console.error('Error guardando proyecto:', error);
    res.status(500).json({ message: 'No fue posible guardar el proyecto.' });
  }
};

proyectosRouter.post('/', requirePermission('proyectos.gestionar'), guardarProyecto);
proyectosRouter.put('/:id', requirePermission('proyectos.gestionar'), guardarProyecto);

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
      const { rows } = await pool.query(
        `SELECT u.id, u.email AS nombre
         FROM usuarios u
         JOIN comunidades c ON c.organizacion_id = u.organizacion_id
         JOIN proyectos p ON p.comunidad_id = c.id
         WHERE p.id = $1 AND c.organizacion_id = $2 AND u.activo
           AND NOT EXISTS (
             SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
             WHERE ur.usuario_id = u.id AND r.nombre = 'DONANTE'
           )
         ORDER BY u.email, u.id`,
        [proyectoId, req.auth!.organizacionId],
      );
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
        const contexto = await pool.query(
          `SELECT a.meta_cantidad
           FROM actividades_programadas a
           JOIN proyectos p ON p.id = a.proyecto_id
           JOIN comunidades c ON c.id = p.comunidad_id
           WHERE p.id = $1 AND a.id = $2 AND c.organizacion_id = $3`,
          [proyectoId, actividadId, req.auth!.organizacionId],
        );
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
          res.status(409).json({ message: 'La clave de envío ya fue utilizada; actualizá el historial antes de reintentar.' });
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
    // La creación no tiene actividadId: no enviar un parámetro $8 sin tipo.
    const valoresCreacion = [...valores.slice(0, 7), ...valores.slice(8)];
    const { rows } = actividadId
      ? await databasePool.query(
        `WITH proyecto AS MATERIALIZED (
           SELECT p.id, p.presupuesto_asignado, c.organizacion_id
           FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
           WHERE p.id = $1 AND c.organizacion_id = $2
           FOR UPDATE OF p
         ), otros AS (
           SELECT COALESCE(SUM(a.presupuesto_estimado), 0) AS total
           FROM actividades_programadas a JOIN proyecto p ON p.id = a.proyecto_id
           WHERE a.id IS DISTINCT FROM $8::uuid
         )
         UPDATE actividades_programadas a SET nombre = $3, descripcion = $4, estado = $5,
           fecha_inicio = $6, fecha_fin = $7, responsable_asignado_usuario_id = $10,
           meta_cantidad = $11, unidad_medida = $12, presupuesto_estimado = $9,
           peso_resultado = $13, actualizado_en = NOW()
         FROM proyecto p CROSS JOIN otros o
         WHERE a.proyecto_id = p.id AND a.id = $8
           AND COALESCE($9::numeric, 0) + o.total <= p.presupuesto_asignado
           AND ($10::uuid IS NULL OR EXISTS (
             SELECT 1 FROM usuarios u WHERE u.id = $10 AND u.organizacion_id = p.organizacion_id AND u.activo
           ))
         RETURNING a.id`, valores,
      )
      : await databasePool.query(
        `WITH proyecto AS MATERIALIZED (
           SELECT p.id, p.presupuesto_asignado, c.organizacion_id
           FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
           WHERE p.id = $1 AND c.organizacion_id = $2
           FOR UPDATE OF p
         ), otros AS (
           SELECT COALESCE(SUM(a.presupuesto_estimado), 0) AS total
           FROM actividades_programadas a JOIN proyecto p ON p.id = a.proyecto_id
         )
         INSERT INTO actividades_programadas (
           proyecto_id, nombre, descripcion, estado, fecha_inicio, fecha_fin,
           responsable_asignado_usuario_id, meta_cantidad, unidad_medida,
           presupuesto_estimado, peso_resultado
         )
         SELECT p.id, $3, $4, $5, $6, $7, $9, $10, $11, $8, $12
         FROM proyecto p CROSS JOIN otros o
         WHERE COALESCE($8::numeric, 0) + o.total <= p.presupuesto_asignado
           AND ($9::uuid IS NULL OR EXISTS (
             SELECT 1 FROM usuarios u WHERE u.id = $9 AND u.organizacion_id = p.organizacion_id AND u.activo
           ))
         RETURNING id`, valoresCreacion,
      );
    if (!rows.length) {
      const disponible = await databasePool.query(
        `SELECT 1 FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
         WHERE p.id = $1 AND c.organizacion_id = $2`,
        [proyectoId, req.auth!.organizacionId],
      );
      if (!disponible.rows.length) {
        res.status(404).json({ message: 'No se encontró el proyecto o la actividad.' });
        return;
      }
      res.status(400).json({ message: 'El responsable debe estar activo en la organización y las asignaciones estimadas no pueden superar el presupuesto del proyecto.' });
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
