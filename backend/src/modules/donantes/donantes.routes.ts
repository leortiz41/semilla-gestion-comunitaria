import { randomBytes } from 'node:crypto';
import { hashPassword } from '../../security/password.js';
import { Router } from 'express';
import { esUuid } from '../../domain/expediente.js';
import { databasePool } from '../../config/database.js';
import { authenticateAccessToken, requirePermission, requireRole } from '../../middleware/auth.middleware.js';
import { obtenerAdministracionDonantes, guardarFichaDonante, modificarEstadoDonante } from './administracion-donantes.controller.js';
import { guardarBrigadaDonante } from './brigadas.controller.js';
import { listarProyectosAutorizadosDonante, obtenerMapaAutorizadoDonante, obtenerImpactoFamiliarAutorizado } from './portal-donantes.controller.js';

export const donantesRouter = Router();

// Consultas del portal: únicamente para donantes autorizados por middleware.
donantesRouter.get('/proyectos', authenticateAccessToken,
  requireRole('DONANTE'), requirePermission('proyectos.ver'), listarProyectosAutorizadosDonante);
donantesRouter.get('/mapa/proyectos/:proyectoId', authenticateAccessToken,
  requireRole('DONANTE'), requirePermission('proyectos.ver'), obtenerMapaAutorizadoDonante);
donantesRouter.get('/mapa/proyectos/:proyectoId/familias', authenticateAccessToken,
  requireRole('DONANTE'), requirePermission('proyectos.ver'), obtenerImpactoFamiliarAutorizado);

const administracionDonantes = Router();

administracionDonantes.use(
  authenticateAccessToken,
  requireRole('ADMINISTRADOR'),
  requirePermission('usuarios.gestionar'),
  requirePermission('proyectos.gestionar'),
  requirePermission('evidencias.gestionar'),
);

administracionDonantes.post('/cuentas', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: 'Ingresá un correo electrónico válido.' });
    return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'La administración de donantes no está disponible.' });
    return;
  }

  const acceso = req.auth!;
  try {
    const contrasenaTemporal = 'Aa1-' + randomBytes(18).toString('base64url');
    const hash = await hashPassword(contrasenaTemporal);
    const { rows } = await databasePool.query(
      `WITH rol AS (
         SELECT id FROM roles WHERE nombre = 'DONANTE' AND activo
       ), cuenta AS (
         INSERT INTO usuarios (email, hash_contrasena, organizacion_id, debe_cambiar_contrasena)
         SELECT $1, $2, u.organizacion_id, TRUE
         FROM usuarios u
         WHERE u.id = $3 AND u.organizacion_id = $4 AND u.activo
           AND EXISTS (SELECT 1 FROM rol)
           AND EXISTS (
             SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
             WHERE ur.usuario_id = u.id AND r.nombre = 'ADMINISTRADOR' AND r.activo
           )
         RETURNING id, email, activo
       ), asignacion AS (
         INSERT INTO usuarios_roles (usuario_id, rol_id)
         SELECT cuenta.id, rol.id FROM cuenta CROSS JOIN rol
       )
       SELECT id, email, activo FROM cuenta`,
      [email, hash, acceso.sub, acceso.organizacionId],
    );
    if (!rows.length) {
      res.status(403).json({ message: 'Se requiere un administrador activo y el rol Donante habilitado.' });
      return;
    }
    res.set('Cache-Control', 'no-store');
    res.status(201).json({ donante: rows[0], contrasenaTemporal });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ message: 'Ya existe una cuenta con ese correo.' });
      return;
    }
    res.status(500).json({ message: 'No fue posible crear la cuenta de donante.' });
  }
});

administracionDonantes.get('/', obtenerAdministracionDonantes);

administracionDonantes.put('/proyectos/:proyectoId/donantes/:donanteId', async (req, res) => {
  const { proyectoId, donanteId } = req.params;
  const asignado = req.body?.asignado;
  if (!esUuid(proyectoId) || !esUuid(donanteId) || typeof asignado !== 'boolean') {
    res.status(400).json({ message: 'Indicá un proyecto, un donante y el estado de acceso válidos.' });
    return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'La administración de donantes no está disponible.' });
    return;
  }
  try {
    const { rows } = await databasePool.query(
      `WITH alcance AS (
         SELECT u.id AS usuario_id, p.id AS proyecto_id
         FROM usuarios u CROSS JOIN proyectos p
         JOIN comunidades c ON c.id = p.comunidad_id
         WHERE u.id = $1 AND p.id = $2 AND u.organizacion_id = $3 AND c.organizacion_id = $3
           AND (NOT $4 OR u.activo)
           AND EXISTS (
             SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id = ur.rol_id
             WHERE ur.usuario_id = u.id AND r.nombre = 'DONANTE' AND r.activo
           )
       ), asignacion AS (
         INSERT INTO proyectos_donantes (usuario_id, proyecto_id)
         SELECT usuario_id, proyecto_id FROM alcance WHERE $4
         ON CONFLICT DO NOTHING
       ), revocacion AS (
         DELETE FROM proyectos_donantes pd USING alcance a
         WHERE NOT $4 AND pd.usuario_id = a.usuario_id AND pd.proyecto_id = a.proyecto_id
       )
       SELECT EXISTS (SELECT 1 FROM alcance) AS permitido`,
      [donanteId, proyectoId, req.auth!.organizacionId, asignado],
    );
    if (!rows[0].permitido) {
      res.status(404).json({ message: 'El proyecto o el donante no está disponible para esta operación.' });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error actualizando asignación de donante:', error);
    res.status(500).json({ message: 'No fue posible guardar el acceso.' });
  }
});

administracionDonantes.put('/proyectos/:proyectoId/evidencias/:evidenciaId', async (req, res) => {
  const { proyectoId, evidenciaId } = req.params;
  const compartida = req.body?.compartida;
  if (!esUuid(proyectoId) || !esUuid(evidenciaId) || typeof compartida !== 'boolean') {
    res.status(400).json({ message: 'Indicá una evidencia y un estado de publicación válidos.' });
    return;
  }
  if (!databasePool) {
    res.status(503).json({ message: 'La administración de donantes no está disponible.' });
    return;
  }
  try {
    const resultado = await databasePool.query(
      `UPDATE evidencias e SET visible_para_donantes = $1, actualizado_en = NOW()
       FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
       WHERE e.id = $2 AND p.id = $3 AND e.proyecto_id = p.id AND c.organizacion_id = $4
         AND (NOT $1 OR (e.solicitud_pago_id IS NULL AND e.archivo_url LIKE 'https://%'))`,
      [compartida, evidenciaId, proyectoId, req.auth!.organizacionId],
    );
    if (!resultado.rowCount) {
      res.status(404).json({ message: 'La evidencia no está disponible para esta operación.' });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error actualizando visibilidad de evidencia:', error);
    res.status(500).json({ message: 'No fue posible guardar la visibilidad.' });
  }
});

administracionDonantes.get('/fichas', async (req, res) => {
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const { rows } = await databasePool.query(
      `SELECT d.id, d.nombre, d.correo, d.telefono, d.activo,
              ARRAY(SELECT p.nombre FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id
                WHERE c.organizacion_id = d.organizacion_id AND (
                  EXISTS (SELECT 1 FROM proyectos_fichas_donantes pd WHERE pd.donante_id = d.id AND pd.proyecto_id = p.id)
                  OR EXISTS (SELECT 1 FROM brigadas_donantes b JOIN brigadas_donantes_proyectos bp ON bp.brigada_id = b.id
                    WHERE b.donante_id = d.id AND bp.proyecto_id = p.id)
                ) ORDER BY p.nombre, p.id) AS proyectos,
              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', b.id, 'lider', b.lider, 'miembros', b.miembros, 'activo', b.activo,
                'zonaId', b.zona_id,
                'proyectoIds', ARRAY(SELECT bp.proyecto_id FROM brigadas_donantes_proyectos bp
                  WHERE bp.brigada_id = b.id),
                'comunidadIds', ARRAY(SELECT bc.comunidad_id FROM brigadas_donantes_comunidades bc
                  WHERE bc.brigada_id = b.id),
                'llegada', b.fecha_llegada::text, 'salida', b.fecha_salida::text,
                'actividades', b.lista_actividades, 'contrataciones', b.lista_contrataciones,
                'zona', (SELECT z.nombre FROM zonas z
                  WHERE z.id = b.zona_id AND z.organizacion_id = d.organizacion_id),
                'comunidades', ARRAY(SELECT c.nombre FROM brigadas_donantes_comunidades bc
                  JOIN comunidades c ON c.id = bc.comunidad_id AND c.organizacion_id = d.organizacion_id
                  WHERE bc.brigada_id = b.id ORDER BY c.nombre, c.id),
                'observaciones', b.observaciones,
                'proyectos', ARRAY(SELECT p.nombre FROM brigadas_donantes_proyectos bp
                  JOIN proyectos p ON p.id = bp.proyecto_id
                  JOIN comunidades c ON c.id = p.comunidad_id
                  WHERE bp.brigada_id = b.id AND c.organizacion_id = d.organizacion_id ORDER BY p.nombre, p.id)
              ) ORDER BY b.fecha_llegada DESC NULLS LAST, b.id)
              FROM brigadas_donantes b WHERE b.donante_id = d.id), '[]'::jsonb) AS brigadas
         FROM donantes d WHERE d.organizacion_id = $1 ORDER BY d.nombre, d.id`,
      [req.auth!.organizacionId],
    );
    const parametros = [req.auth!.organizacionId];
    const [comunidades, zonas] = await Promise.all([
      databasePool.query(
        'SELECT id, nombre, municipio, zona_id AS "zonaId" FROM comunidades WHERE organizacion_id = $1 AND activo ORDER BY nombre, id',
        parametros,
      ),
      databasePool.query(
        'SELECT id, nombre FROM zonas WHERE organizacion_id = $1 AND activo ORDER BY nombre, id',
        parametros,
      ),
    ]);
    res.json({ fichas: rows, comunidades: comunidades.rows, zonas: zonas.rows });
  } catch {
    res.status(500).json({ message: 'No fue posible consultar las fichas.' });
  }
});

administracionDonantes.post('/fichas', guardarFichaDonante);

administracionDonantes.post('/fichas/:id/brigadas', guardarBrigadaDonante);
administracionDonantes.put('/fichas/:id/brigadas/:brigadaId', guardarBrigadaDonante);

administracionDonantes.put('/fichas/:id/estado', modificarEstadoDonante);
administracionDonantes.put('/fichas/:id/brigadas/:brigadaId/estado', modificarEstadoDonante);

donantesRouter.use('/administracion', administracionDonantes);
