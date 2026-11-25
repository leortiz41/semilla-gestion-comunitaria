import type { Pool } from 'pg';

export interface NuevaOrganizacion {
  nombre: string;
  slug: string;
  emailContacto: string | null;
}

export type ResultadoEstadoOrganizacion =
  | { estado: 'NO_ENCONTRADA' }
  | { estado: 'ORGANIZACION_GLOBAL_PROTEGIDA' }
  | { estado: 'ACTUALIZADA'; id: string; activo: boolean };

/** Crear tenant y registrar auditoría en una única transacción. */
export async function insertarOrganizacion(
  pool: Pool, datos: NuevaOrganizacion, administradorId: string,
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO organizaciones(nombre,slug,email_contacto)
       VALUES($1,$2,$3) RETURNING id,nombre,slug,activo,email_contacto AS "emailContacto"`,
      [datos.nombre, datos.slug, datos.emailContacto],
    );
    await client.query(
      `INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
       VALUES($1,'PLATAFORMA_CREAR_ORGANIZACION','organizaciones',$2,$3::jsonb)`,
      [administradorId,rows[0].id,JSON.stringify({ nombre: datos.nombre, slug: datos.slug })],
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** La suspensión revoca sesiones pero conserva usuarios, proyectos y evidencias. */
export async function actualizarEstadoOrganizacion(
  pool: Pool, organizacionId: string, activo: boolean, administradorId: string,
): Promise<ResultadoEstadoOrganizacion> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const org = await client.query(
      'SELECT id,activo FROM organizaciones WHERE id=$1 FOR UPDATE', [organizacionId],
    );
    if (!org.rows.length) {
      await client.query('ROLLBACK');
      return { estado: 'NO_ENCONTRADA' };
    }
    if (!activo) {
      const propia = await client.query(
        'SELECT 1 FROM usuarios WHERE id=$1 AND organizacion_id=$2', [administradorId,organizacionId],
      );
      if (propia.rows.length) {
        await client.query('ROLLBACK');
        return { estado: 'ORGANIZACION_GLOBAL_PROTEGIDA' };
      }
    }
    if (org.rows[0].activo !== activo) {
      await client.query('UPDATE organizaciones SET activo=$1 WHERE id=$2',[activo,organizacionId]);
      if (!activo) {
        await client.query(`UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW())
          WHERE usuario_id IN (SELECT id FROM usuarios WHERE organizacion_id=$1)`,[organizacionId]);
      }
      await client.query(`INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
        VALUES($1,'PLATAFORMA_CAMBIAR_ESTADO_ORGANIZACION','organizaciones',$2,$3::jsonb,$4::jsonb)`,
        [administradorId,organizacionId,JSON.stringify({activo:org.rows[0].activo}),JSON.stringify({activo})]);
    }
    await client.query('COMMIT');
    return { estado: 'ACTUALIZADA', id: organizacionId, activo };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
