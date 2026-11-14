import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission } from '../middleware/auth.middleware.js';
import { esUuid } from '../domain/expediente.js';
import { firmarObjetoR2, r2Disponible } from '../services/r2-evidencias.service.js';

export const mapaImpactoRouter = Router();

// Primera etapa: exploración institucional, nunca editor de datos.
// El portal DONANTE tendrá una ruta independiente con visibilidad restringida.
mapaImpactoRouter.use(authenticateAccessToken, requirePermission('proyectos.ver'), (req, res, next) => {
  if (req.auth?.roles.some((rol) => rol === 'DONANTE' || rol === 'CONSULTA')) {
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
           av.comentarios AS descripcion, av.observaciones,
           av.cantidad_reportada::float8 AS "cantidadReportada",
           av.porcentaje_avance::float8 AS "porcentajeAvance",
           av.estado_revision AS estado
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
    const fotos = await Promise.all(evidencias.rows.map(async (foto) => ({
      id: foto.id, avanceId: foto.avanceId, titulo: foto.titulo,
      descripcion: foto.descripcion, tipoMime: foto.tipoMime,
      url: typeof foto.archivoUrl === 'string' && foto.archivoUrl.startsWith('r2:') && r2Disponible()
        ? await firmarObjetoR2(foto.archivoUrl.slice(3), 'GET', undefined, 3600)
        : typeof foto.archivoUrl === 'string' && foto.archivoUrl.startsWith('https://')
          ? foto.archivoUrl : null,
    })));

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


// Renovación de lectura bajo demanda para fotografías privadas.
// No acepta claves R2 ni URLs desde el navegador: resuelve por UUID y verifica la organización.
mapaImpactoRouter.get('/proyectos/:proyectoId/evidencias/:evidenciaId/enlace', async (req, res) => {
  const { proyectoId, evidenciaId } = req.params;
  if (!esUuid(proyectoId) || !esUuid(evidenciaId)) {
    res.status(400).json({ message: 'La fotografía solicitada no es válida.' });
    return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    const { rows } = await databasePool.query<{ archivoUrl: string }>(
      `SELECT e.archivo_url AS "archivoUrl"
       FROM evidencias e
       JOIN proyectos p ON p.id=e.proyecto_id
       JOIN comunidades c ON c.id=p.comunidad_id
       WHERE e.id=$1 AND e.proyecto_id=$2 AND c.organizacion_id=$3
         AND e.tipo_mime IN ('image/jpeg','image/png','image/webp')`,
      [evidenciaId, proyectoId, req.auth!.organizacionId],
    );
    if (!rows.length) {
      res.status(404).json({ message: 'Fotografía no encontrada en tu organización.' });
      return;
    }
    const archivoUrl = rows[0].archivoUrl;
    if (archivoUrl.startsWith('r2:')) {
      if (!r2Disponible()) {
        res.status(503).json({ message: 'El almacenamiento R2 no está configurado.' });
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.json({ url: await firmarObjetoR2(archivoUrl.slice(3), 'GET', undefined, 3600) });
      return;
    }
    if (archivoUrl.startsWith('https://')) {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ url: archivoUrl });
      return;
    }
    res.status(404).json({ message: 'La fotografía no tiene una ubicación válida.' });
  } catch (error) {
    console.error('Error renovando enlace de evidencia del mapa:', error);
    res.status(500).json({ message: 'No fue posible renovar el enlace de la fotografía.' });
  }
});

type PosicionPanel = { id: 'diagrama' | 'detalle'; x: number; y: number; w: number; h: number };
type PosicionNodo = { x: number; y: number };
const patronNodo = /^(comunidad|proyecto|actividad|avance|evidencia):[0-9a-f-]{36}$/i;
const numeroEntero = (x: unknown, min: number, max: number) =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
function validarPaneles(valor: unknown): valor is PosicionPanel[] {
  if (!Array.isArray(valor) || valor.length !== 2) return false;
  const ids = valor.map((p) => p && typeof p === 'object' ? p.id : null);
  return new Set(ids).size === 2 && ids.includes('diagrama') && ids.includes('detalle') &&
    valor.every((p) => p && typeof p === 'object' &&
      numeroEntero(p.x, 0, 11) && numeroEntero(p.y, 0, 79) &&
      numeroEntero(p.w, 1, 12) && numeroEntero(p.h, 4, 14) && p.x + p.w <= 12);
}
function validarNodos(valor: unknown): valor is Record<string, PosicionNodo> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const posiciones = Object.entries(valor);
  return posiciones.length <= 200 && posiciones.every(([id, p]) =>
    patronNodo.test(id) && p && typeof p === 'object' && !Array.isArray(p) &&
    typeof (p as PosicionNodo).x === 'number' && Number.isFinite((p as PosicionNodo).x) &&
    Math.abs((p as PosicionNodo).x) <= 20000 &&
    typeof (p as PosicionNodo).y === 'number' && Number.isFinite((p as PosicionNodo).y) &&
    Math.abs((p as PosicionNodo).y) <= 20000);
}
async function proyectoDeOrganizacion(proyectoId: string, organizacionId: string) {
  if (!databasePool) throw new Error('Base de datos no disponible');
  const { rowCount } = await databasePool.query(
    `SELECT 1 FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
      WHERE p.id=$1 AND c.organizacion_id=$2`, [proyectoId, organizacionId],
  );
  return !!rowCount;
}

// Lectura y guardado independientes por usuario/proyecto. Se actualiza solo una
// parte del JSON para que mover nodos no sobrescriba la posición de GridStack.
mapaImpactoRouter.get('/proyectos/:proyectoId/preferencias', async (req, res) => {
  const { proyectoId } = req.params;
  if (!esUuid(proyectoId)) { res.status(400).json({ message: 'Proyecto inválido.' }); return; }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    if (!await proyectoDeOrganizacion(proyectoId, req.auth!.organizacionId)) {
      res.status(404).json({ message: 'Proyecto no disponible.' }); return;
    }
    const { rows } = await databasePool.query(
      `SELECT configuracion FROM preferencias_mapa_impacto
        WHERE usuario_id=$1 AND organizacion_id=$2 AND proyecto_id=$3`,
      [req.auth!.sub, req.auth!.organizacionId, proyectoId],
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json({ configuracion: rows[0]?.configuracion ?? null });
  } catch (error) {
    console.error('Error leyendo preferencias del mapa:', error);
    res.status(500).json({ message: 'No se pudo recuperar la configuración del mapa.' });
  }
});

mapaImpactoRouter.patch('/proyectos/:proyectoId/preferencias', async (req, res) => {
  const { proyectoId } = req.params;
  const tipo = req.body?.tipo;
  const valor = req.body?.valor;
  if (!esUuid(proyectoId) || !(
    (tipo === 'paneles' && validarPaneles(valor)) ||
    (tipo === 'nodos' && validarNodos(valor))
  )) {
    res.status(400).json({ message: 'La configuración del mapa no es válida.' }); return;
  }
  try {
    if (!databasePool) throw new Error('Base de datos no disponible');
    if (!await proyectoDeOrganizacion(proyectoId, req.auth!.organizacionId)) {
      res.status(404).json({ message: 'Proyecto no disponible.' }); return;
    }
    const { rowCount } = await databasePool.query(
      `INSERT INTO preferencias_mapa_impacto
        (usuario_id, organizacion_id, proyecto_id, configuracion)
       SELECT u.id, u.organizacion_id, $3::uuid,
         jsonb_build_object($4::text, $5::jsonb)
       FROM usuarios u WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo
       ON CONFLICT (usuario_id, organizacion_id, proyecto_id)
       DO UPDATE SET configuracion=jsonb_set(
         COALESCE(preferencias_mapa_impacto.configuracion, '{}'::jsonb),
         ARRAY[$4::text], $5::jsonb, true
       ), actualizado_en=NOW()`,
      [req.auth!.sub, req.auth!.organizacionId, proyectoId, tipo, JSON.stringify(valor)],
    );
    if (!rowCount) { res.status(403).json({ message: 'Usuario no autorizado.' }); return; }
    res.sendStatus(204);
  } catch (error) {
    console.error('Error guardando preferencias del mapa:', error);
    res.status(500).json({ message: 'No se pudo guardar la configuración del mapa.' });
  }
});
