import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission } from '../middleware/auth.middleware.js';
import { esUuid } from '../domain/expediente.js';
import { firmarObjetoR2, r2Disponible } from '../services/r2-evidencias.service.js';

export const mapaImpactoRouter = Router();

// Primera etapa: exploración institucional, nunca editor de datos.
// El portal DONANTE tendrá una ruta independiente con visibilidad restringida.
mapaImpactoRouter.use(authenticateAccessToken, requirePermission('proyectos.ver'), (req, res, next) => {
  if (req.auth?.roles.includes('DONANTE')) {
    res.status(403).json({ message: 'El mapa institucional no está disponible para el portal de donantes.' });
    return;
  }
  next();
});

mapaImpactoRouter.get('/proyectos', async (req, res) => {
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const { rows } = await databasePool.query(
      `SELECT p.id, p.nombre, p.estado, p.tipo, c.nombre AS comunidad
       FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
       WHERE c.organizacion_id = $1 ORDER BY p.nombre, p.id LIMIT 500`,
      [req.auth!.organizacionId],
    );
    res.json({ proyectos: rows });
  } catch (error) {
    console.error('Error consultando proyectos para el mapa:', error);
    res.status(500).json({ message: 'No fue posible consultar los proyectos del mapa.' });
  }
});

mapaImpactoRouter.get('/proyectos/:proyectoId', async (req, res) => {
  const { proyectoId } = req.params;
  if (!esUuid(proyectoId)) {
    res.status(400).json({ message: 'Seleccioná un proyecto válido.' });
    return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    // Primero comprobar pertenencia a la organización de la sesión.
    const { rows: proyectos } = await databasePool.query(
      `SELECT p.id, p.nombre, p.descripcion, p.estado, p.tipo,
         c.id AS "comunidadId", c.nombre AS comunidad
       FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
       WHERE p.id = $1 AND c.organizacion_id = $2`,
      [proyectoId, req.auth!.organizacionId],
    );
    if (!proyectos.length) {
      res.status(404).json({ message: 'Proyecto no disponible en tu organización.' });
      return;
    }

    const [actividades, avances, evidencias] = await Promise.all([
      databasePool.query(
        `SELECT a.id, a.nombre, a.descripcion, a.estado
         FROM actividades_programadas a
         WHERE a.proyecto_id = $1 ORDER BY a.fecha_inicio NULLS LAST, a.nombre, a.id LIMIT 100`,
        [proyectoId],
      ),
      databasePool.query(
        `SELECT av.id, av.actividad_id AS "actividadId", av.fecha_avance::text AS fecha,
           av.comentarios AS descripcion, av.estado_revision AS estado
         FROM avances_proyecto av
         WHERE av.proyecto_id = $1 ORDER BY av.fecha_avance DESC, av.creado_en DESC, av.id DESC LIMIT 500`,
        [proyectoId],
      ),
      databasePool.query(
        `SELECT e.id, e.avance_proyecto_id AS "avanceId", e.titulo, e.descripcion,
           e.archivo_url AS "archivoUrl", e.tipo_mime AS "tipoMime"
         FROM evidencias e
         JOIN avances_proyecto av ON av.id = e.avance_proyecto_id AND av.proyecto_id = e.proyecto_id
         WHERE e.proyecto_id = $1 AND e.tipo_mime IN ('image/jpeg','image/png','image/webp')
         ORDER BY e.creado_en DESC, e.id DESC LIMIT 1000`,
        [proyectoId],
      ),
    ]);

    // Enlaces privados: nunca devolver rutas internas R2 ni exponer claves.
    const fotos = evidencias.rows.map((foto) => ({
      id: foto.id, avanceId: foto.avanceId, titulo: foto.titulo,
      descripcion: foto.descripcion, tipoMime: foto.tipoMime,
      url: typeof foto.archivoUrl === 'string' && foto.archivoUrl.startsWith('r2:') && r2Disponible()
        ? firmarObjetoR2(foto.archivoUrl.slice(3), 'GET', undefined, 300)
        : typeof foto.archivoUrl === 'string' && foto.archivoUrl.startsWith('https://')
          ? foto.archivoUrl : null,
    }));

    res.json({
      proyecto: proyectos[0],
      actividades: actividades.rows,
      avances: avances.rows,
      evidencias: fotos,
    });
  } catch (error) {
    console.error('Error construyendo mapa de impacto:', error);
    res.status(500).json({ message: 'No fue posible construir el mapa de impacto.' });
  }
});
