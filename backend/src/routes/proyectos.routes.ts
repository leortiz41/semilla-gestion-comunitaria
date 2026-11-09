import { Router, type RequestHandler } from 'express';
import { databasePool } from '../config/database.js';
import { areasNecesidad } from '../domain/necesidades.js';
import { esUuid } from '../domain/expediente.js';
import { authenticateAccessToken, requirePermission } from '../middleware/auth.middleware.js';

export const proyectosRouter = Router();
const estados = ['PLANIFICADO', 'EN_EJECUCION', 'PAUSADO', 'FINALIZADO', 'CANCELADO'];

function esFecha(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(valor);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

proyectosRouter.use(authenticateAccessToken, requirePermission('proyectos.ver'), (req, res, next) => {
  if (req.auth?.roles.includes('DONANTE')) {
    res.status(403).json({ message: 'Consultá tus proyectos desde el portal de donantes.' });
    return;
  }
  next();
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

proyectosRouter.get('/:proyectoId/actividades', async (req, res) => {
  const { proyectoId } = req.params;
  if (!esUuid(proyectoId)) {
    res.status(400).json({ message: 'Seleccioná un proyecto válido.' });
    return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const { rows } = await databasePool.query(
      `SELECT COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'id', a.id, 'nombre', a.nombre, 'descripcion', a.descripcion, 'estado', a.estado,
           'fechaInicio', a.fecha_inicio, 'fechaFin', a.fecha_fin
         ) ORDER BY a.fecha_inicio NULLS LAST, a.nombre, a.id)
         FROM actividades_programadas a WHERE a.proyecto_id = p.id
       ), '[]'::jsonb) AS actividades
       FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
       WHERE p.id = $1 AND c.organizacion_id = $2`,
      [proyectoId, req.auth!.organizacionId],
    );
    if (!rows.length) {
      res.status(404).json({ message: 'No se encontró el proyecto.' });
      return;
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error consultando actividades:', error);
    res.status(500).json({ message: 'No fue posible consultar las actividades.' });
  }
});

const guardarActividad: RequestHandler = async (req, res) => {
  const { proyectoId, actividadId } = req.params;
  const { estado, fechaInicio, fechaFin } = req.body ?? {};
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  const descripcion = req.body?.descripcion ?? '';
  if (!esUuid(proyectoId) || (actividadId !== undefined && !esUuid(actividadId)) ||
      !nombre || nombre.length > 180 || typeof descripcion !== 'string' || descripcion.length > 3000 ||
      !estadosActividad.includes(estado) ||
      (fechaInicio != null && !esFecha(fechaInicio)) ||
      (fechaFin != null && (!esFecha(fechaFin) || (fechaInicio != null && fechaFin < fechaInicio)))) {
    res.status(400).json({ message: 'Revisá el nombre, el estado y las fechas de la actividad.' });
    return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const valores = [proyectoId, req.auth!.organizacionId, nombre, descripcion.trim() || null,
      estado, fechaInicio ?? null, fechaFin ?? null];
    const { rows } = actividadId
      ? await databasePool.query(
        `UPDATE actividades_programadas a SET nombre = $3, descripcion = $4, estado = $5,
           fecha_inicio = $6, fecha_fin = $7, actualizado_en = NOW()
         FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
         WHERE p.id = $1 AND c.organizacion_id = $2 AND a.proyecto_id = p.id AND a.id = $8
         RETURNING a.id`, [...valores, actividadId],
      )
      : await databasePool.query(
        `INSERT INTO actividades_programadas (proyecto_id, nombre, descripcion, estado, fecha_inicio, fecha_fin)
         SELECT p.id, $3, $4, $5, $6, $7
         FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
         WHERE p.id = $1 AND c.organizacion_id = $2 RETURNING id`, valores,
      );
    if (!rows.length) {
      res.status(404).json({ message: 'No se encontró el proyecto o la actividad.' });
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
