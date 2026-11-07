import type { Pool } from 'pg';
import { databasePool } from '../config/database.js';
import { ErrorExpediente } from '../domain/expediente.js';

export interface CapacidadesComunidad {
  revision: number;
  organizaciones: string[];
  actividadesProductivas: string[];
  productosServicios: string[];
  observacionesOrganizaciones: string;
  potencialProductivo: string;
}
export function validarCapacidades(valor: unknown): CapacidadesComunidad {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor))
    throw new ErrorExpediente('Datos de capacidades inválidos.');
  const d = valor as Record<string, unknown>;
  if (
    typeof d.revision !== 'number' ||
    !Number.isInteger(d.revision) ||
    d.revision < 0 ||
    d.revision >= 2147483647
  )
    throw new ErrorExpediente('Versión de la sección inválida.');
  function lista(k: string) {
    const v = d[k];
    if (
      !Array.isArray(v) ||
      v.length > 50 ||
      v.some((x) => typeof x !== 'string' || !x.trim() || x.trim().length > 150)
    )
      throw new ErrorExpediente(
        `Revisa ${k}: máximo 50 elementos de 150 caracteres, sin filas vacías.`,
      );
    const r = v.map((x) => (x as string).trim());
    if (new Set(r.map((x) => x.toLocaleLowerCase('es'))).size !== r.length)
      throw new ErrorExpediente(`No repitas elementos en ${k}.`);
    return r;
  }
  function texto(k: string) {
    if (typeof d[k] !== 'string' || (d[k] as string).length > 3000)
      throw new ErrorExpediente(`Revisa ${k}: máximo 3000 caracteres.`);
    return (d[k] as string).trim();
  }
  return {
    revision: d.revision,
    organizaciones: lista('organizaciones'),
    actividadesProductivas: lista('actividadesProductivas'),
    productosServicios: lista('productosServicios'),
    observacionesOrganizaciones: texto('observacionesOrganizaciones'),
    potencialProductivo: texto('potencialProductivo'),
  };
}
export async function obtenerCapacidades(
  org: string,
  id: string,
  pool: Pool | null = databasePool,
): Promise<CapacidadesComunidad | null> {
  if (!pool) throw new Error('Base de datos no configurada.');
  const r = await pool.query(
    `SELECT COALESCE(c.revision,0) AS revision, COALESCE(c.observaciones_organizaciones,'') AS "observacionesOrganizaciones",COALESCE(c.potencial_productivo,'') AS "potencialProductivo",
 COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo',e.tipo,'nombre',e.nombre) ORDER BY e.nombre) FROM elementos_capacidad e WHERE e.capacidad_id=c.id AND e.organizacion_id=u.organizacion_id),'[]'::jsonb) AS elementos
 FROM comunidades u LEFT JOIN LATERAL (SELECT * FROM capacidades_comunitarias cc WHERE cc.comunidad_id=u.id AND cc.organizacion_id=u.organizacion_id ORDER BY revision DESC LIMIT 1) c ON TRUE WHERE u.id=$1 AND u.organizacion_id=$2`,
    [id, org],
  );
  if (!r.rowCount) return null;
  const { elementos, ...datos } = r.rows[0];
  const lista = (tipo: string) =>
    (elementos as { tipo: string; nombre: string }[])
      .filter((e) => e.tipo === tipo)
      .map((e) => e.nombre);
  return {
    ...datos,
    organizaciones: lista('organizacion'),
    actividadesProductivas: lista('actividad_productiva'),
    productosServicios: lista('producto_servicio'),
  } as CapacidadesComunidad;
}
export async function guardarCapacidades(
  org: string,
  id: string,
  usuario: string,
  datos: CapacidadesComunidad,
  pool: Pool | null = databasePool,
): Promise<CapacidadesComunidad> {
  if (!pool) throw new Error('Base de datos no configurada.');
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    if (
      !(
        await c.query(
          'SELECT id FROM comunidades WHERE id=$1 AND organizacion_id=$2 FOR UPDATE',
          [id, org],
        )
      ).rowCount
    )
      throw new ErrorExpediente('Comunidad no encontrada.', 404);
    if (
      !(
        await c.query(
          'SELECT id FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo=TRUE FOR SHARE',
          [usuario, org],
        )
      ).rowCount
    )
      throw new ErrorExpediente('Usuario no autorizado.', 403);
    const anterior = await c.query(
      'SELECT revision FROM capacidades_comunitarias WHERE comunidad_id=$1 AND organizacion_id=$2 ORDER BY revision DESC LIMIT 1',
      [id, org],
    );
    if ((anterior.rows[0]?.revision ?? 0) !== datos.revision)
      throw new ErrorExpediente(
        'Otra persona actualizó esta sección. Cancela y recarga antes de editar nuevamente.',
        409,
      );
    const revision = datos.revision + 1;
    const r = await c.query(
      'INSERT INTO capacidades_comunitarias(comunidad_id,organizacion_id,revision,observaciones_organizaciones,potencial_productivo,registrado_por_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [
        id,
        org,
        revision,
        datos.observacionesOrganizaciones,
        datos.potencialProductivo,
        usuario,
      ],
    );
    const capacidadId = r.rows[0].id;
    for (const [tipo, lista] of Object.entries({
      organizacion: datos.organizaciones,
      actividad_productiva: datos.actividadesProductivas,
      producto_servicio: datos.productosServicios,
    }))
      for (const nombre of lista)
        await c.query(
          'INSERT INTO elementos_capacidad(capacidad_id,organizacion_id,tipo,nombre) VALUES ($1,$2,$3,$4)',
          [capacidadId, org, tipo, nombre],
        );
    await c.query(
      "INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos) VALUES ($1,'GUARDAR_CAPACIDADES','comunidades',$2,$3::jsonb)",
      [
        usuario,
        id,
        JSON.stringify({ organizacionId: org, capacidadId, revision }),
      ],
    );
    await c.query('COMMIT');
    return { ...datos, revision };
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
