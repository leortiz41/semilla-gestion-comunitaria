import { Router, type RequestHandler } from 'express';
import { databasePool } from '../config/database.js';
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
    const [proyectos, comunidades] = await Promise.all([
      databasePool.query(
        `SELECT p.id, p.nombre, p.tipo, p.estado, p.descripcion,
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
    ]);
    res.json({ proyectos: proyectos.rows, comunidades: comunidades.rows });
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
  if ((id !== undefined && !esUuid(id)) || !esUuid(comunidadId) ||
      !nombre || nombre.length > 200 || !tipo || tipo.length > 60 ||
      !estados.includes(estado) || !esFecha(fechaInicio) ||
      (fechaFin !== '' && (!esFecha(fechaFin) || fechaFin < fechaInicio)) ||
      typeof descripcion !== 'string' || descripcion.length > 3000) {
    res.status(400).json({ message: 'Revisá la comunidad, el nombre, el tipo, el estado y las fechas del proyecto.' });
    return;
  }
  const parametros = [comunidadId, req.auth!.organizacionId, nombre, tipo, estado,
    fechaInicio, fechaFin || null, descripcion.trim() || null];

  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const resultado = id
      ? await databasePool.query(
        `UPDATE proyectos p SET nombre = $3, tipo = $4, estado = $5,
           fecha_inicio = $6, fecha_fin = $7, descripcion = $8, actualizado_en = NOW()
         FROM comunidades c
         WHERE p.id = $9 AND p.comunidad_id = c.id AND c.id = $1 AND c.organizacion_id = $2
         RETURNING p.id`,
        [...parametros, id],
      )
      : await databasePool.query(
        `INSERT INTO proyectos (comunidad_id, nombre, tipo, estado, fecha_inicio, fecha_fin, descripcion)
         SELECT id, $3, $4, $5, $6, $7, $8 FROM comunidades
         WHERE id = $1 AND organizacion_id = $2 AND activo RETURNING id`,
        parametros,
      );
    if (!resultado.rowCount) {
      res.status(404).json({ message: 'El proyecto o la comunidad no están disponibles para esta operación.' });
      return;
    }
    res.status(id ? 200 : 201).json({ id: resultado.rows[0].id });
  } catch (error) {
    console.error('Error guardando proyecto:', error);
    res.status(500).json({ message: 'No fue posible guardar el proyecto.' });
  }
};

proyectosRouter.post('/', requirePermission('proyectos.gestionar'), guardarProyecto);
proyectosRouter.put('/:id', requirePermission('proyectos.gestionar'), guardarProyecto);
