import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { esUuid } from '../domain/expediente.js';

export const asignacionesFamiliasRouter = Router();
asignacionesFamiliasRouter.use(
  authenticateAccessToken,
  requireRole('ADMINISTRADOR', 'COORDINADOR', 'CAMPO'),
  requirePermission('comunidades.ver'),
);

asignacionesFamiliasRouter.get('/:familiaId/perfiles/:perfilId/brigadas', async (req, res) => {
  const { familiaId, perfilId } = req.params;
  if (!esUuid(familiaId) || !esUuid(perfilId)) {
    res.status(400).json({ message: 'Expediente inválido.' }); return;
  }
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const { rows } = await databasePool.query(
      `SELECT b.id, d.nombre AS donante, b.lider,
              (afb.brigada_id IS NOT NULL) AS asignada
       FROM perfiles_familia pf
       JOIN familias f ON f.id = pf.familia_id
       JOIN comunidades c ON c.id = f.comunidad_id AND c.organizacion_id = $3
       JOIN proyectos p ON p.id = pf.proyecto_id AND p.comunidad_id = f.comunidad_id
       JOIN brigadas_donantes_proyectos bp ON bp.proyecto_id = p.id
       JOIN brigadas_donantes b ON b.id = bp.brigada_id AND b.activo
       JOIN donantes d ON d.id = b.donante_id AND d.organizacion_id = c.organizacion_id AND d.activo
       LEFT JOIN asignaciones_familias_brigadas afb ON afb.perfil_id = pf.id AND afb.brigada_id = b.id
       WHERE pf.familia_id = $1 AND pf.id = $2
       ORDER BY d.nombre, b.lider, b.id`,
      [familiaId, perfilId, req.auth!.organizacionId],
    );
    res.set('Cache-Control', 'no-store');
    res.json({ brigadas: rows });
  } catch (error) {
    console.error('Error consultando brigadas elegibles de familia:', error);
    res.status(500).json({ message: 'No fue posible consultar las brigadas.' });
  }
});

asignacionesFamiliasRouter.put(
  '/:familiaId/perfiles/:perfilId/brigada',
  requireRole('ADMINISTRADOR', 'COORDINADOR'),
  requirePermission('comunidades.gestionar'),
  async (req, res) => {
    const { familiaId, perfilId } = req.params;
    const brigadaId = req.body?.brigadaId;
    if (!esUuid(familiaId) || !esUuid(perfilId) || (brigadaId !== null && !esUuid(brigadaId))) {
      res.status(400).json({ message: 'Familia, perfil o brigada inválidos.' }); return;
    }
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const cliente = await databasePool.connect();
    try {
      await cliente.query('BEGIN');
      const { rows: alcance } = await cliente.query(
        `SELECT pf.id FROM perfiles_familia pf
         JOIN familias f ON f.id = pf.familia_id AND f.activo
         JOIN comunidades c ON c.id = f.comunidad_id AND c.organizacion_id = $3
         JOIN proyectos p ON p.id = pf.proyecto_id AND p.comunidad_id = f.comunidad_id
         WHERE pf.id = $2 AND pf.familia_id = $1 FOR UPDATE OF pf`,
        [familiaId, perfilId, req.auth!.organizacionId],
      );
      if (!alcance.length) {
        await cliente.query('ROLLBACK');
        res.status(404).json({ message: 'Perfil familiar no disponible.' }); return;
      }
      if (brigadaId !== null) {
        const { rows: elegibles } = await cliente.query(
          `SELECT b.id FROM brigadas_donantes b
           JOIN donantes d ON d.id=b.donante_id AND d.organizacion_id=$3 AND d.activo
           JOIN brigadas_donantes_proyectos bp ON bp.brigada_id=b.id
           JOIN perfiles_familia pf ON pf.proyecto_id=bp.proyecto_id
           JOIN familias f ON f.id=pf.familia_id
           WHERE b.id=$1 AND pf.id=$2 AND b.activo
             AND EXISTS (SELECT 1 FROM comunidades c WHERE c.id=f.comunidad_id
                           AND c.organizacion_id=d.organizacion_id)
             AND EXISTS (SELECT 1 FROM proyectos p WHERE p.id=pf.proyecto_id
                           AND p.comunidad_id=f.comunidad_id)
           LIMIT 1`,
          [brigadaId, perfilId, req.auth!.organizacionId],
        );
        if (!elegibles.length) {
          await cliente.query('ROLLBACK');
          res.status(409).json({ message: 'La brigada no patrocina este proyecto o no pertenece a la organización.' }); return;
        }
        await cliente.query(
          `INSERT INTO asignaciones_familias_brigadas
            (perfil_id, brigada_id, asignado_por_usuario_id)
           VALUES ($1,$2,$3)
           ON CONFLICT (perfil_id) DO UPDATE SET
             brigada_id=EXCLUDED.brigada_id,
             asignado_por_usuario_id=EXCLUDED.asignado_por_usuario_id,
             actualizado_en=NOW()`,
          [perfilId, brigadaId, req.auth!.sub],
        );
      } else {
        await cliente.query('DELETE FROM asignaciones_familias_brigadas WHERE perfil_id=$1', [perfilId]);
      }
      await cliente.query(
        `INSERT INTO bitacora_auditoria (usuario_id, accion, nombre_entidad, entidad_id, valores_nuevos)
         VALUES ($1, 'ASIGNAR_BRIGADA_FAMILIAR', 'perfiles_familia', $2, $3::jsonb)`,
        [req.auth!.sub, perfilId, JSON.stringify({ familiaId, brigadaId })],
      );
      await cliente.query('COMMIT');
      res.json({ perfilId, brigadaId });
    } catch (error) {
      await cliente.query('ROLLBACK');
      console.error('Error asignando brigada familiar:', error);
      res.status(500).json({ message: 'No fue posible asignar la brigada.' });
    } finally { cliente.release(); }
  },
);
