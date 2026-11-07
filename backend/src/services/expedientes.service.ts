import { databasePool } from '../config/database.js';
import {
  ErrorExpediente,
  type ExpedienteComunidad,
} from '../domain/expediente.js';
import type { Pool } from 'pg';

export async function guardarExpediente(
  organizacionId: string,
  usuarioId: string,
  datos: ExpedienteComunidad,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Base de datos no configurada.');
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const zona = await c.query(
      'SELECT id FROM zonas WHERE id=$1 AND organizacion_id=$2 AND activo=TRUE FOR SHARE',
      [datos.zonaId, organizacionId],
    );
    if (!zona.rowCount)
      throw new ErrorExpediente(
        'Selecciona una zona activa de tu organización.',
      );
    const usuario = await c.query(
      'SELECT id FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo=TRUE FOR SHARE',
      [usuarioId, organizacionId],
    );
    if (!usuario.rowCount)
      throw new ErrorExpediente(
        'La sesión no corresponde a un usuario activo de la organización.',
        403,
      );
    const nueva = await c.query(
      `INSERT INTO comunidades (organizacion_id,zona_id,nombre,municipio,departamento,latitud,longitud) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        organizacionId,
        datos.zonaId,
        datos.nombre,
        datos.municipio,
        datos.departamento,
        datos.latitud,
        datos.longitud,
      ],
    );
    const id = nueva.rows[0].id as string;
    const diagnostico = await c.query(
      `INSERT INTO diagnosticos_comunidad (organizacion_id,comunidad_id,poblacion,viviendas,viviendas_intervencion,observaciones_organizaciones,potencial_productivo,creado_por_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        organizacionId,
        id,
        datos.poblacion,
        datos.viviendas,
        datos.viviendasIntervencion,
        datos.observacionesOrganizaciones,
        datos.potencialProductivo,
        usuarioId,
      ],
    );
    const diagnosticoId = diagnostico.rows[0].id;
    for (const v of datos.visiones)
      await c.query(
        'INSERT INTO visiones_comunidad (organizacion_id,diagnostico_id,categoria,situacion,meta,prioridad) VALUES ($1,$2,$3,$4,$5,$6)',
        [
          organizacionId,
          diagnosticoId,
          v.categoria,
          v.situacion,
          v.meta,
          v.prioridad,
        ],
      );
    const grupos = {
      vivienda: datos.tiposVivienda,
      organizacion: datos.organizaciones,
      actividad_productiva: datos.actividadesProductivas,
      producto_servicio: datos.productosServicios,
    };
    for (const [tipo, valores] of Object.entries(grupos))
      for (const nombre of valores)
        await c.query(
          'INSERT INTO elementos_diagnostico (organizacion_id,diagnostico_id,tipo,nombre) VALUES ($1,$2,$3,$4)',
          [organizacionId, diagnosticoId, tipo, nombre],
        );
    await c.query(
      `INSERT INTO bitacora_auditoria (usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos) VALUES ($1,'CREAR_EXPEDIENTE','comunidades',$2,$3::jsonb)`,
      [usuarioId, id, JSON.stringify({ organizacionId, diagnosticoId })],
    );
    await c.query('COMMIT');
    return { id };
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

export async function obtenerExpediente(
  organizacionId: string,
  comunidadId: string,
  pool: Pool | null = databasePool,
) {
  if (!pool) throw new Error('Base de datos no configurada.');
  // Una consulta garantiza que comunidad, diagnóstico y detalles procedan del mismo snapshot.
  const r = await pool.query(
    `SELECT c.id,c.nombre,c.zona_id AS "zonaId",c.municipio,c.departamento,
    c.latitud::float8 AS latitud,c.longitud::float8 AS longitud,
    d.poblacion,d.viviendas,d.viviendas_intervencion AS "viviendasIntervencion",
    COALESCE(d.observaciones_organizaciones,'') AS "observacionesOrganizaciones",
    COALESCE(d.potencial_productivo,'') AS "potencialProductivo",
    d.creado_en AS "fechaDiagnostico",
    COALESCE((SELECT jsonb_agg(jsonb_build_object('categoria',v.categoria,'situacion',v.situacion,'meta',v.meta,'prioridad',v.prioridad) ORDER BY v.categoria) FROM visiones_comunidad v WHERE v.diagnostico_id=d.id AND v.organizacion_id=c.organizacion_id),'[]'::jsonb) AS visiones,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo',e.tipo,'nombre',e.nombre) ORDER BY e.nombre) FROM elementos_diagnostico e WHERE e.diagnostico_id=d.id AND e.organizacion_id=c.organizacion_id),'[]'::jsonb) AS elementos
    FROM comunidades c LEFT JOIN LATERAL (SELECT * FROM diagnosticos_comunidad dc WHERE dc.comunidad_id=c.id AND dc.organizacion_id=c.organizacion_id ORDER BY dc.creado_en DESC,dc.id DESC LIMIT 1) d ON TRUE
    WHERE c.id=$1 AND c.organizacion_id=$2`,
    [comunidadId, organizacionId],
  );
  if (!r.rowCount) return null;
  const { elementos, ...datos } = r.rows[0];
  const lista = (tipo: string) =>
    (elementos as { tipo: string; nombre: string }[])
      .filter((e) => e.tipo === tipo)
      .map((e) => e.nombre);
  return {
    ...datos,
    tiposVivienda: lista('vivienda'),
    organizaciones: lista('organizacion'),
    actividadesProductivas: lista('actividad_productiva'),
    productosServicios: lista('producto_servicio'),
  };
}
