import type { Pool } from 'pg';
import { ErrorExpediente } from '../domain/expediente.js';
import { validarMetasVision, type MetaVision } from '../domain/metas-vision.js';
import { databasePool } from '../config/database.js';

export interface ComunidadListado {
  id: string;
  zonaId: string | null;
  nombre: string;
  barrioColonia: string | null;
  localidad: string | null;
  municipio: string;
  departamento: string;
  activo: boolean;
  nombreZona: string | null;
  zonaActiva: boolean | null;
}

interface ComunidadFila {
  id: string;
  zona_id: string | null;
  nombre: string;
  barrio_colonia: string | null;
  localidad: string | null;
  municipio: string;
  departamento: string;
  activo: boolean;
  nombre_zona: string | null;
  zona_activa: boolean | null;
}

export interface DiagnosticoPoblacionVivienda {
  poblacionAproximada: number | null;
  viviendasAproximadas: number | null;
  viviendasIntervencion: number | null;
  tiposVivienda: string | null;
}

export type AreaVisionDesarrollo =
  | 'EVANGELISMO'
  | 'EDUCACION_FORMAL'
  | 'EDUCACION_COMUNITARIA'
  | 'INFRAESTRUCTURA';

export interface VisionDesarrolloComunitaria {
  area: AreaVisionDesarrollo;
  situacionActual: string | null;
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA' | null;
  metaDesarrollo: string | null;
  metas: MetaVision[];
  revision: number;
}

interface DiagnosticoPoblacionViviendaFila {
  poblacion_aproximada: number | null;
  viviendas_aproximadas: number | null;
  viviendas_intervencion: number | null;
  tipos_vivienda: string | null;
}

interface VisionDesarrolloComunitariaFila {
  area: AreaVisionDesarrollo;
  situacion_actual: string | null;
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA' | null;
  meta_desarrollo: string | null;
  metas: MetaVision[];
  revision: number;
}

function obtenerPool() {
  if (!databasePool) {
    throw new Error('La base de datos no está configurada.');
  }

  return databasePool;
}

function mapearComunidad(comunidad: ComunidadFila): ComunidadListado {
  return {
    id: comunidad.id,
    zonaId: comunidad.zona_id,
    nombre: comunidad.nombre,
    barrioColonia: comunidad.barrio_colonia,
    localidad: comunidad.localidad,
    municipio: comunidad.municipio,
    departamento: comunidad.departamento,
    activo: comunidad.activo,
    nombreZona: comunidad.nombre_zona,
    zonaActiva: comunidad.zona_activa,
  };
}

function mapearDiagnosticoPoblacionVivienda(
  diagnostico: DiagnosticoPoblacionViviendaFila,
): DiagnosticoPoblacionVivienda {
  return {
    poblacionAproximada: diagnostico.poblacion_aproximada,
    viviendasAproximadas: diagnostico.viviendas_aproximadas,
    viviendasIntervencion: diagnostico.viviendas_intervencion,
    tiposVivienda: diagnostico.tipos_vivienda,
  };
}

function mapearVisionDesarrollo(
  vision: VisionDesarrolloComunitariaFila,
): VisionDesarrolloComunitaria {
  return {
    area: vision.area,
    situacionActual: vision.situacion_actual,
    prioridad: vision.prioridad,
    metaDesarrollo: vision.meta_desarrollo,
    metas: vision.metas,
    revision: vision.revision,
  };
}

export async function listarComunidadesPorOrganizacion(
  organizacionId: string,
): Promise<ComunidadListado[]> {
  const pool = obtenerPool();

  const resultado = await pool.query<ComunidadFila>(
    `SELECT
       c.id,
       c.zona_id,
       c.nombre,
       c.barrio_colonia,
       c.localidad,
       c.municipio,
       c.departamento,
       c.activo,
       z.nombre AS nombre_zona,
       z.activo AS zona_activa
     FROM comunidades c
     LEFT JOIN zonas z
       ON z.id = c.zona_id
      AND z.organizacion_id = c.organizacion_id
     WHERE c.organizacion_id = $1
     ORDER BY c.nombre ASC`,
    [organizacionId],
  );

  return resultado.rows.map(mapearComunidad);
}

export async function crearComunidadBasica(
  organizacionId: string,
  datos: {
    zonaId: string;
    nombre: string;
    municipio: string;
    departamento: string;
  },
): Promise<ComunidadListado | null> {
  const pool = obtenerPool();

  const resultado = await pool.query<ComunidadFila>(
    `WITH nueva_comunidad AS (
       INSERT INTO comunidades (
         organizacion_id,
         zona_id,
         nombre,
         municipio,
         departamento
       )
       SELECT $1, z.id, $3, $4, $5
         FROM zonas z
        WHERE z.id = $2
          AND z.organizacion_id = $1
          AND z.activo = TRUE
       RETURNING
         id,
         zona_id,
         nombre,
         barrio_colonia,
         localidad,
         municipio,
         departamento,
         activo
     )
     SELECT
       c.id,
       c.zona_id,
       c.nombre,
       c.barrio_colonia,
       c.localidad,
       c.municipio,
       c.departamento,
       c.activo,
       z.nombre AS nombre_zona,
       z.activo AS zona_activa
     FROM nueva_comunidad c
     LEFT JOIN zonas z
       ON z.id = c.zona_id
      AND z.organizacion_id = $1`,
    [
      organizacionId,
      datos.zonaId,
      datos.nombre.trim(),
      datos.municipio.trim(),
      datos.departamento.trim(),
    ],
  );

  if (resultado.rowCount === 0) {
    return null;
  }

  return mapearComunidad(resultado.rows[0]);
}

export async function editarComunidadBasica(
  organizacionId: string,
  comunidadId: string,
  datos: {
    zonaId: string;
    nombre: string;
    municipio: string;
    departamento: string;
  },
): Promise<ComunidadListado | null> {
  const pool = obtenerPool();

  const resultado = await pool.query<ComunidadFila>(
    `WITH comunidad_actualizada AS (
       UPDATE comunidades c
          SET zona_id = z.id,
              nombre = $4,
              municipio = $5,
              departamento = $6,
              actualizado_en = NOW()
         FROM zonas z
        WHERE c.id = $1
          AND c.organizacion_id = $2
          AND z.id = $3
          AND z.organizacion_id = $2
          AND z.activo = TRUE
       RETURNING
         c.id,
         c.zona_id,
         c.nombre,
         c.barrio_colonia,
         c.localidad,
         c.municipio,
         c.departamento,
         c.activo
     )
     SELECT
       c.id,
       c.zona_id,
       c.nombre,
       c.barrio_colonia,
       c.localidad,
       c.municipio,
       c.departamento,
       c.activo,
       z.nombre AS nombre_zona,
       z.activo AS zona_activa
     FROM comunidad_actualizada c
     LEFT JOIN zonas z
       ON z.id = c.zona_id
      AND z.organizacion_id = $2`,
    [
      comunidadId,
      organizacionId,
      datos.zonaId,
      datos.nombre.trim(),
      datos.municipio.trim(),
      datos.departamento.trim(),
    ],
  );

  if (resultado.rowCount === 0) {
    return null;
  }

  return mapearComunidad(resultado.rows[0]);
}

export async function cambiarEstadoComunidad(
  organizacionId: string,
  comunidadId: string,
  activo: boolean,
): Promise<ComunidadListado | null> {
  const pool = obtenerPool();

  const resultado = await pool.query<ComunidadFila>(
    `WITH comunidad_actualizada AS (
       UPDATE comunidades
          SET activo = $3,
              actualizado_en = NOW()
        WHERE id = $1
          AND organizacion_id = $2
       RETURNING
         id,
         zona_id,
         nombre,
         barrio_colonia,
         localidad,
         municipio,
         departamento,
         activo
     )
     SELECT
       c.id,
       c.zona_id,
       c.nombre,
       c.barrio_colonia,
       c.localidad,
       c.municipio,
       c.departamento,
       c.activo,
       z.nombre AS nombre_zona,
       z.activo AS zona_activa
     FROM comunidad_actualizada c
     LEFT JOIN zonas z
       ON z.id = c.zona_id
      AND z.organizacion_id = $2`,
    [comunidadId, organizacionId, activo],
  );

  if (resultado.rowCount === 0) {
    return null;
  }

  return mapearComunidad(resultado.rows[0]);
}

export async function obtenerDiagnosticoPoblacionVivienda(
  organizacionId: string,
  comunidadId: string,
): Promise<DiagnosticoPoblacionVivienda | null | undefined> {
  const pool = obtenerPool();

  const resultado = await pool.query<DiagnosticoPoblacionViviendaFila>(
    `SELECT
       d.poblacion_aproximada,
       d.viviendas_aproximadas,
       d.viviendas_intervencion,
       d.tipos_vivienda
     FROM comunidades c
     LEFT JOIN diagnosticos_comunitarios d
       ON d.comunidad_id = c.id
      AND d.organizacion_id = c.organizacion_id
     WHERE c.id = $1
       AND c.organizacion_id = $2`,
    [comunidadId, organizacionId],
  );

  if (resultado.rowCount === 0) {
    return undefined;
  }

  const fila = resultado.rows[0];
  if (
    fila.poblacion_aproximada === null &&
    fila.viviendas_aproximadas === null &&
    fila.viviendas_intervencion === null &&
    fila.tipos_vivienda === null
  ) {
    return null;
  }

  return mapearDiagnosticoPoblacionVivienda(fila);
}

export async function guardarDiagnosticoPoblacionVivienda(
  organizacionId: string,
  comunidadId: string,
  datos: DiagnosticoPoblacionVivienda,
): Promise<DiagnosticoPoblacionVivienda | null> {
  const pool = obtenerPool();

  const resultado = await pool.query<DiagnosticoPoblacionViviendaFila>(
    `INSERT INTO diagnosticos_comunitarios (
       comunidad_id,
       organizacion_id,
       poblacion_aproximada,
       viviendas_aproximadas,
       viviendas_intervencion,
       tipos_vivienda
     )
     SELECT c.id, c.organizacion_id, $3, $4, $5, $6
       FROM comunidades c
      WHERE c.id = $1
        AND c.organizacion_id = $2
     ON CONFLICT (comunidad_id) DO UPDATE
       SET poblacion_aproximada = EXCLUDED.poblacion_aproximada,
           viviendas_aproximadas = EXCLUDED.viviendas_aproximadas,
           viviendas_intervencion = EXCLUDED.viviendas_intervencion,
           tipos_vivienda = EXCLUDED.tipos_vivienda,
           actualizado_en = NOW()
     RETURNING
       poblacion_aproximada,
       viviendas_aproximadas,
       viviendas_intervencion,
       tipos_vivienda`,
    [
      comunidadId,
      organizacionId,
      datos.poblacionAproximada,
      datos.viviendasAproximadas,
      datos.viviendasIntervencion,
      datos.tiposVivienda?.trim() || null,
    ],
  );

  if (resultado.rowCount === 0) {
    return null;
  }

  return mapearDiagnosticoPoblacionVivienda(resultado.rows[0]);
}

const consultaVisiones = `SELECT v.area, v.situacion_actual, v.prioridad, v.meta_desarrollo, v.revision,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'descripcion',m.descripcion) ORDER BY m.orden,m.id)
 FROM metas_vision_desarrollo m WHERE m.vision_id=v.id AND m.organizacion_id=v.organizacion_id AND m.activa), '[]'::jsonb) AS metas
 FROM visiones_desarrollo_comunitarias v WHERE v.comunidad_id=$1 AND v.organizacion_id=$2`;

export async function obtenerVisionesDesarrolloComunitaria(
  organizacionId: string, comunidadId: string, pool: Pool = obtenerPool(),
): Promise<VisionDesarrolloComunitaria[] | undefined> {
  const comunidad = await pool.query('SELECT id FROM comunidades WHERE id=$1 AND organizacion_id=$2', [comunidadId,organizacionId]);
  if (!comunidad.rowCount) return undefined;
  const r = await pool.query<VisionDesarrolloComunitariaFila>(consultaVisiones + ' ORDER BY v.area', [comunidadId,organizacionId]);
  return r.rows.map(mapearVisionDesarrollo);
}

export async function guardarVisionDesarrolloComunitaria(
  organizacionId: string, comunidadId: string, datos: VisionDesarrolloComunitaria,
  usuarioId: string, pool: Pool = obtenerPool(),
): Promise<VisionDesarrolloComunitaria | null> {
  const {metas,revision} = validarMetasVision(datos.metas, datos.revision);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const comunidad = await c.query('SELECT id FROM comunidades WHERE id=$1 AND organizacion_id=$2 FOR UPDATE', [comunidadId,organizacionId]);
    if (!comunidad.rowCount) { await c.query('ROLLBACK'); return null; }
    const usuario = await c.query('SELECT id FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo=TRUE FOR SHARE',[usuarioId,organizacionId]);
    if (!usuario.rowCount) throw new ErrorExpediente('Usuario no autorizado.',403);
    const anterior = await c.query('SELECT id,revision FROM visiones_desarrollo_comunitarias WHERE comunidad_id=$1 AND organizacion_id=$2 AND area=$3',[comunidadId,organizacionId,datos.area]);
    if ((anterior.rows[0]?.revision ?? 0) !== revision) throw new ErrorExpediente('Otra persona actualizó esta área. Cancela y recarga la sección antes de editar.',409);
    const r = await c.query(`INSERT INTO visiones_desarrollo_comunitarias(comunidad_id,organizacion_id,area,situacion_actual,prioridad,revision)
      VALUES ($1,$2,$3,$4,$5,1) ON CONFLICT (comunidad_id,area) DO UPDATE
      SET situacion_actual=EXCLUDED.situacion_actual,prioridad=EXCLUDED.prioridad,revision=visiones_desarrollo_comunitarias.revision+1,actualizado_en=NOW() RETURNING id`,
      [comunidadId,organizacionId,datos.area,datos.situacionActual,datos.prioridad]);
    const visionId=r.rows[0].id;
    // Quitar archiva la meta; no borra su identificador ni su último texto.
    await c.query('UPDATE metas_vision_desarrollo SET activa=FALSE,actualizado_en=NOW() WHERE vision_id=$1 AND organizacion_id=$2 AND activa',[visionId,organizacionId]);
    for (const [orden,m] of metas.entries()) {
      const fila=await c.query(`INSERT INTO metas_vision_desarrollo(id,vision_id,organizacion_id,descripcion,orden)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET descripcion=EXCLUDED.descripcion,orden=EXCLUDED.orden,activa=TRUE,actualizado_en=NOW()
        WHERE metas_vision_desarrollo.vision_id=EXCLUDED.vision_id AND metas_vision_desarrollo.organizacion_id=EXCLUDED.organizacion_id RETURNING id`,[m.id,visionId,organizacionId,m.descripcion,orden]);
      if (!fila.rowCount) throw new ErrorExpediente('Una meta no pertenece a esta área.',400);
    }
    await c.query("INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos) VALUES($1,'GUARDAR_METAS_VISION','visiones_desarrollo_comunitarias',$2,$3::jsonb)",[usuarioId,visionId,JSON.stringify({revision:revision+1,metas})]);
    const resultado=await c.query<VisionDesarrolloComunitariaFila>(consultaVisiones+' AND v.area=$3',[comunidadId,organizacionId,datos.area]);
    await c.query('COMMIT');
    return mapearVisionDesarrollo(resultado.rows[0]);
  } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
