import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { esUuid } from '../domain/expediente.js';
import { firmarObjetoR2, r2Disponible } from '../services/r2-evidencias.service.js';

export const documentosFamiliaRouter = Router();
documentosFamiliaRouter.use(
  authenticateAccessToken,
  requireRole('ADMINISTRADOR', 'COORDINADOR', 'CAMPO'),
  requirePermission('comunidades.ver'),
);
const revision = [
  requireRole('ADMINISTRADOR', 'COORDINADOR'),
  requirePermission('comunidades.gestionar'),
];

// Catálogo orientativo: no confundirlo con los requisitos obligatorios del Ministerio.
export const categoriasDocumentales = [
  { codigo: 'IDENTIFICACION', nombre: 'Identificación del responsable' },
  { codigo: 'TENENCIA_TERRENO', nombre: 'Acreditación de propiedad, posesión o tenencia' },
  { codigo: 'CONSTANCIA_COMUNITARIA', nombre: 'Constancia comunitaria' },
  { codigo: 'SOLICITUD_APOYO', nombre: 'Solicitud de apoyo habitacional' },
  { codigo: 'EVALUACION_SOCIAL', nombre: 'Evaluación socioeconómica' },
  { codigo: 'ACTA_SELECCION', nombre: 'Acta de selección' },
  { codigo: 'ACTA_ENTREGA', nombre: 'Acta de entrega y recepción' },
  { codigo: 'OTRO', nombre: 'Otro documento' },
] as const;

documentosFamiliaRouter.get('/documentos/categorias', (_req, res) => {
  res.json({ categorias: categoriasDocumentales, requisitosObligatoriosDefinidos: false });
});

const consultaBase = `
  FROM documentos_familia d
  JOIN familias f ON f.id = d.familia_id
  JOIN comunidades c ON c.id = f.comunidad_id
  WHERE d.familia_id=$1 AND c.organizacion_id=$2
`;

documentosFamiliaRouter.get('/:familiaId/documentos', async (req, res) => {
  if (!esUuid(req.params.familiaId)) {
    res.status(400).json({ message: 'Familia inválida.' }); return;
  }
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    // No exponer claves privadas de R2 a la interfaz.
    const { rows } = await databasePool.query(
      `SELECT d.id, d.perfil_id AS "perfilId", d.tipo_documento AS "tipoDocumento",
              d.nombre_archivo AS "nombreArchivo", d.tipo_mime AS "tipoMime",
              d.tamano_bytes AS "tamanoBytes", d.estado, d.observaciones,
              d.creado_en AS "creadoEn", d.revisado_en AS "revisadoEn"
       ${consultaBase} ORDER BY d.creado_en DESC, d.id DESC LIMIT 200`,
      [req.params.familiaId, req.auth!.organizacionId],
    );
    res.set('Cache-Control', 'no-store');
    res.json({ documentos: rows });
  } catch (error) {
    console.error('Error consultando documentos familiares:', error);
    res.status(500).json({ message: 'No fue posible consultar los documentos.' });
  }
});

documentosFamiliaRouter.get('/:familiaId/documentos/:documentoId/descarga', async (req, res) => {
  const { familiaId, documentoId } = req.params;
  if (!esUuid(familiaId) || !esUuid(documentoId)) {
    res.status(400).json({ message: 'Documento inválido.' }); return;
  }
  try {
    if (!databasePool || !r2Disponible()) {
      res.status(503).json({ message: 'Almacenamiento privado no disponible.' }); return;
    }
    const { rows } = await databasePool.query(
      `SELECT d.archivo_clave AS clave, d.nombre_archivo AS nombre
       ${consultaBase} AND d.id=$3 LIMIT 1`,
      [familiaId, req.auth!.organizacionId, documentoId],
    );
    if (!rows.length) { res.status(404).json({ message: 'Documento no disponible.' }); return; }
    // Firma temporal de lectura: cada solicitud se autentica y verifica organización.
    const url = await firmarObjetoR2(rows[0].clave, 'GET', undefined, 120);
    res.set('Cache-Control', 'no-store');
    res.json({ url, venceEnSegundos: 120 });
  } catch (error) {
    console.error('Error preparando descarga privada:', error);
    res.status(503).json({ message: 'No fue posible preparar la descarga.' });
  }
});

documentosFamiliaRouter.post('/:familiaId/documentos/:documentoId/revisar', ...revision, async (req, res) => {
  const { familiaId, documentoId } = req.params;
  const estado = req.body?.estado;
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
  if (!esUuid(familiaId) || !esUuid(documentoId) ||
      !['APROBADO', 'RECHAZADO'].includes(estado) ||
      motivo.length > 2000 || (estado === 'RECHAZADO' && !motivo)) {
    res.status(400).json({ message: 'Revisión inválida. El rechazo requiere un motivo.' }); return;
  }
  if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
  const cliente = await databasePool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `UPDATE documentos_familia d SET
          estado=$4, observaciones=NULLIF($5,''), revisado_por_usuario_id=$6,
          revisado_en=NOW(), actualizado_en=NOW()
       FROM familias f JOIN comunidades c ON c.id=f.comunidad_id
       WHERE d.id=$3 AND d.familia_id=$1 AND f.id=d.familia_id
         AND c.organizacion_id=$2 AND d.estado='PENDIENTE'
         AND d.cargado_por_usuario_id<>$6
       RETURNING d.id, d.estado`,
      [familiaId, req.auth!.organizacionId, documentoId, estado, motivo, req.auth!.sub],
    );
    if (!rows.length) {
      await cliente.query('ROLLBACK');
      res.status(409).json({ message: 'Documento no disponible, ya revisado o cargado por el mismo revisor.' });
      return;
    }
    await cliente.query(
      `INSERT INTO bitacora_auditoria (usuario_id, accion, nombre_entidad, entidad_id, valores_nuevos)
       VALUES ($1, 'REVISAR_DOCUMENTO_FAMILIAR', 'documentos_familia', $2, $3::jsonb)`,
      [req.auth!.sub, documentoId, JSON.stringify({ familiaId, estado, motivo })],
    );
    await cliente.query('COMMIT');
    res.json({ id: rows[0].id, estado: rows[0].estado });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error revisando documento familiar:', error);
    res.status(500).json({ message: 'No fue posible revisar el documento.' });
  } finally { cliente.release(); }
});
