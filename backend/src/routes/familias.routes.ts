import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { esUuid } from '../domain/expediente.js';

export const familiasRouter = Router();

// Expedientes con datos personales: jamás permitir rol DONANTE ni cuentas de consulta externa.
familiasRouter.use(
  authenticateAccessToken,
  requireRole('ADMINISTRADOR', 'COORDINADOR', 'CAMPO'),
  requirePermission('comunidades.ver'),
);

const gestion = [requireRole('ADMINISTRADOR', 'COORDINADOR'), requirePermission('comunidades.gestionar')];

const columnas = `
  f.id, f.comunidad_id AS "comunidadId", c.nombre AS comunidad,
  f.numero_casa AS "numeroCasa", f.nombre_referencia AS "nombreReferencia",
  f.direccion_referencia AS "direccionReferencia", f.activo,
  f.creado_en AS "creadoEn", f.actualizado_en AS "actualizadoEn"
`;

function campos(entrada: unknown) {
  const v = entrada && typeof entrada === 'object' && !Array.isArray(entrada)
    ? entrada as Record<string, unknown> : {};
  const texto = (clave: string, limite: number, obligatorio = false): string | null => {
    const valor = v[clave];
    if (valor === null || valor === undefined || valor === '') return obligatorio ? null : '';
    return typeof valor === 'string' && valor.trim().length <= limite ? valor.trim() : null;
  };
  return {
    comunidadId: texto('comunidadId', 36, true),
    nombreReferencia: texto('nombreReferencia', 180, true),
    numeroCasa: texto('numeroCasa', 60),
    direccionReferencia: texto('direccionReferencia', 1200),
  };
}

familiasRouter.get('/comunidades', async (req, res) => {
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const { rows } = await databasePool.query(
      `SELECT id, nombre, municipio FROM comunidades
       WHERE organizacion_id = $1 AND activo ORDER BY nombre, id`,
      [req.auth!.organizacionId],
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json({ comunidades: rows });
  } catch (error) {
    console.error('Error consultando comunidades de familias:', error);
    res.status(500).json({ message: 'No fue posible consultar comunidades.' });
  }
});

familiasRouter.get('/', async (req, res) => {
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const { rows } = await databasePool.query(
      `SELECT ${columnas},
          (SELECT count(*)::int FROM miembros_familia mf
           WHERE mf.familia_id = f.id AND mf.fecha_salida IS NULL) AS "integrantesRegistrados",
          (SELECT count(*)::int FROM perfiles_familia pf
           WHERE pf.familia_id = f.id) AS "evaluacionesRegistradas"
       FROM familias f
       JOIN comunidades c ON c.id=f.comunidad_id
       WHERE c.organizacion_id = $1
       ORDER BY f.activo DESC, f.actualizado_en DESC, f.id DESC LIMIT 500`,
      [req.auth!.organizacionId],
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json({ familias: rows });
  } catch (error) {
    console.error('Error consultando familias:', error);
    res.status(500).json({ message: 'No fue posible consultar las familias.' });
  }
});

familiasRouter.get('/:familiaId', async (req, res) => {
  if (!esUuid(req.params.familiaId)) { res.status(400).json({ message: 'Familia no válida.' }); return; }
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const { rows } = await databasePool.query(
      `SELECT ${columnas}
       FROM familias f JOIN comunidades c ON c.id=f.comunidad_id
       WHERE f.id = $1 AND c.organizacion_id = $2`,
      [req.params.familiaId, req.auth!.organizacionId],
    );
    if (!rows.length) { res.status(404).json({ message: 'Familia no encontrada.' }); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ familia: rows[0] });
  } catch (error) {
    console.error('Error consultando perfil familiar:', error);
    res.status(500).json({ message: 'No fue posible recuperar el perfil.' });
  }
});

familiasRouter.post('/', ...gestion, async (req, res) => {
  const datos = campos(req.body);
  if (!datos.comunidadId || !esUuid(datos.comunidadId) ||
      !datos.nombreReferencia || datos.nombreReferencia.length > 180 ||
      datos.numeroCasa === null || datos.direccionReferencia === null) {
    res.status(400).json({ message: 'Revisá la comunidad, el nombre y la dirección de referencia.' }); return;
  }
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const { rows } = await databasePool.query(
      `INSERT INTO familias (comunidad_id, nombre_referencia, numero_casa, direccion_referencia)
       SELECT c.id, $2, NULLIF($3, ''), NULLIF($4, '')
       FROM comunidades c WHERE c.id = $1 AND c.organizacion_id = $5 AND c.activo
       RETURNING id`,
      [datos.comunidadId, datos.nombreReferencia, datos.numeroCasa, datos.direccionReferencia, req.auth!.organizacionId],
    );
    if (!rows.length) { res.status(404).json({ message: 'Comunidad no autorizada o inactiva.' }); return; }
    res.status(201).json({ id: rows[0].id });
  } catch (error) {
    console.error('Error registrando familia:', error);
    res.status(500).json({ message: 'No fue posible registrar la familia.' });
  }
});

familiasRouter.put('/:familiaId', ...gestion, async (req, res) => {
  const datos = campos(req.body);
  const activo = req.body?.activo;
  if (!esUuid(req.params.familiaId) || !datos.comunidadId || !esUuid(datos.comunidadId) ||
      !datos.nombreReferencia || datos.numeroCasa === null || datos.direccionReferencia === null ||
      typeof activo !== 'boolean') {
    res.status(400).json({ message: 'Datos del expediente no válidos.' }); return;
  }
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const { rowCount } = await databasePool.query(
      `UPDATE familias f
       SET comunidad_id=$2, nombre_referencia=$3, numero_casa=NULLIF($4, ''),
           direccion_referencia=NULLIF($5, ''), activo=$6, actualizado_en=NOW()
       WHERE f.id=$1
         AND EXISTS (SELECT 1 FROM comunidades origen
                     WHERE origen.id=f.comunidad_id AND origen.organizacion_id=$7)
         AND EXISTS (SELECT 1 FROM comunidades destino
                     WHERE destino.id=$2 AND destino.organizacion_id=$7 AND destino.activo)`,
      [req.params.familiaId, datos.comunidadId, datos.nombreReferencia, datos.numeroCasa,
        datos.direccionReferencia, activo, req.auth!.organizacionId],
    );
    if (!rowCount) { res.status(404).json({ message: 'Familia o comunidad no disponible.' }); return; }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error actualizando familia:', error);
    res.status(500).json({ message: 'No fue posible actualizar la familia.' });
  }
});
