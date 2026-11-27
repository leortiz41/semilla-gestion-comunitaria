import { ErrorExpediente, type ExpedienteComunidad } from '../../domain/expediente.js';
import type { Pool } from 'pg';

/** Persistencia del expediente en una sola transacción, sin alterar sentencias ni validaciones. */
export async function guardarExpedienteEnRepositorio(
  organizacionId: string,
  usuarioId: string,
  datos: ExpedienteComunidad,
  pool: Pool | null,
  edicion?: { comunidadId: string; diagnosticoAnteriorId: string | null },
) {
  if (!pool) throw new Error('Base de datos no configurada.');
  const clienteTransaccion = await pool.connect();
  try {
    await clienteTransaccion.query('BEGIN');
    if (!edicion) {
      const zona = await clienteTransaccion.query(
        'SELECT id FROM zonas WHERE id=$1 AND organizacion_id=$2 AND activo=TRUE FOR SHARE',
        [datos.zonaId, organizacionId],
      );
      if (!zona.rowCount)
        throw new ErrorExpediente(
          'Selecciona una zona activa de tu organización.',
        );
    }
    const usuario = await clienteTransaccion.query(
      'SELECT id FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo=TRUE FOR SHARE',
      [usuarioId, organizacionId],
    );
    if (!usuario.rowCount)
      throw new ErrorExpediente(
        'La sesión no corresponde a un usuario activo de la organización.',
        403,
      );
    let comunidadIdRegistrada: string;
    if (edicion) {
      const comunidad = await clienteTransaccion.query(
        'SELECT id FROM comunidades WHERE id=$1 AND organizacion_id=$2 FOR UPDATE',
        [edicion.comunidadId, organizacionId],
      );
      if (!comunidad.rowCount)
        throw new ErrorExpediente('Comunidad no encontrada.', 404);
      const anterior = await clienteTransaccion.query(
        'SELECT id FROM diagnosticos_comunidad WHERE comunidad_id=$1 AND organizacion_id=$2 ORDER BY creado_en DESC,id DESC LIMIT 1',
        [edicion.comunidadId, organizacionId],
      );
      if ((anterior.rows[0]?.id ?? null) !== edicion.diagnosticoAnteriorId)
        throw new ErrorExpediente(
          'El diagnóstico cambió desde que lo abriste. Cierra y vuelve a abrir el expediente antes de editar.',
          409,
        );
      comunidadIdRegistrada = edicion.comunidadId;
    } else {
      const nueva = await clienteTransaccion.query(
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
      comunidadIdRegistrada = nueva.rows[0].id as string;
    }
    const diagnostico = await clienteTransaccion.query(
      `INSERT INTO diagnosticos_comunidad (organizacion_id,comunidad_id,poblacion,viviendas,viviendas_intervencion,observaciones_organizaciones,potencial_productivo,creado_por_id,creado_en) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp()) RETURNING id`,
      [
        organizacionId,
        comunidadIdRegistrada,
        datos.poblacion,
        datos.viviendas,
        datos.viviendasIntervencion,
        datos.observacionesOrganizaciones,
        datos.potencialProductivo,
        usuarioId,
      ],
    );
    const diagnosticoId = diagnostico.rows[0].id;
    for (const vision of datos.visiones)
      await clienteTransaccion.query(
        'INSERT INTO visiones_comunidad (organizacion_id,diagnostico_id,categoria,situacion,meta,prioridad) VALUES ($1,$2,$3,$4,$5,$6)',
        [
          organizacionId,
          diagnosticoId,
          vision.categoria,
          vision.situacion,
          vision.meta,
          vision.prioridad,
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
        await clienteTransaccion.query(
          'INSERT INTO elementos_diagnostico (organizacion_id,diagnostico_id,tipo,nombre) VALUES ($1,$2,$3,$4)',
          [organizacionId, diagnosticoId, tipo, nombre],
        );
    await clienteTransaccion.query(
      `INSERT INTO bitacora_auditoria (usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos) VALUES ($1,$4,'comunidades',$2,$3::jsonb)`,
      [
        usuarioId,
        comunidadIdRegistrada,
        JSON.stringify({
          organizacionId,
          diagnosticoId,
          diagnosticoAnteriorId: edicion?.diagnosticoAnteriorId ?? null,
        }),
        edicion ? 'ACTUALIZAR_DIAGNOSTICO' : 'CREAR_EXPEDIENTE',
      ],
    );
    await clienteTransaccion.query('COMMIT');
    return { id: comunidadIdRegistrada };
  } catch (error) {
    await clienteTransaccion.query('ROLLBACK');
    throw error;
  } finally {
    clienteTransaccion.release();
  }
}

export async function obtenerExpedienteEnRepositorio(
  organizacionId: string,
  comunidadId: string,
  pool: Pool | null,
) {
  if (!pool) throw new Error('Base de datos no configurada.');
  // Una consulta garantiza que comunidad, diagnóstico y detalles procedan del mismo snapshot.
  const resultadoConsulta = await pool.query(
    `SELECT c.id,c.nombre,c.zona_id AS "zonaId",c.municipio,c.departamento,
    c.latitud::float8 AS latitud,c.longitud::float8 AS longitud,
    d.poblacion,d.viviendas,d.viviendas_intervencion AS "viviendasIntervencion",
    COALESCE(d.observaciones_organizaciones,'') AS "observacionesOrganizaciones",
    COALESCE(d.potencial_productivo,'') AS "potencialProductivo",
    d.id AS "diagnosticoId", d.creado_en AS "fechaDiagnostico",
    COALESCE((SELECT jsonb_agg(jsonb_build_object('categoria',v.categoria,'situacion',v.situacion,'meta',v.meta,'prioridad',v.prioridad) ORDER BY v.categoria) FROM visiones_comunidad v WHERE v.diagnostico_id=d.id AND v.organizacion_id=c.organizacion_id),'[]'::jsonb) AS visiones,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo',e.tipo,'nombre',e.nombre) ORDER BY e.nombre) FROM elementos_diagnostico e WHERE e.diagnostico_id=d.id AND e.organizacion_id=c.organizacion_id),'[]'::jsonb) AS elementos
    FROM comunidades c LEFT JOIN LATERAL (SELECT * FROM diagnosticos_comunidad dc WHERE dc.comunidad_id=c.id AND dc.organizacion_id=c.organizacion_id ORDER BY dc.creado_en DESC,dc.id DESC LIMIT 1) d ON TRUE
    WHERE c.id=$1 AND c.organizacion_id=$2`,
    [comunidadId, organizacionId],
  );
  if (!resultadoConsulta.rowCount) return null;
  const { elementos, ...datos } = resultadoConsulta.rows[0];
  const lista = (tipo: string) =>
    (elementos as { tipo: string; nombre: string }[])
      .filter((elemento) => elemento.tipo === tipo)
      .map((elemento) => elemento.nombre);
  return {
    ...datos,
    tiposVivienda: lista('vivienda'),
    organizaciones: lista('organizacion'),
    actividadesProductivas: lista('actividad_productiva'),
    productosServicios: lista('producto_servicio'),
  };
}
