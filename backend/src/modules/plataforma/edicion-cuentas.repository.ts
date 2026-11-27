import type { Pool, PoolClient } from 'pg';

export type ResultadoOperacionCuenta =
  | 'NO_DISPONIBLE' | 'PROTEGIDA' | 'RETIRADA' | 'ULTIMO_ADMINISTRADOR' | 'OK';

type Contexto = { organizacionId: string; usuarioId: string; operadorId: string };

async function transaccion(
  pool: Pool, operacion: (client: PoolClient) => Promise<ResultadoOperacionCuenta>,
): Promise<ResultadoOperacionCuenta> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await operacion(client);
    await client.query(resultado === 'OK' ? 'COMMIT' : 'ROLLBACK');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function editarNombreDesdePlataforma(
  pool: Pool, datos: Contexto & { nombreVisible: string },
): Promise<ResultadoOperacionCuenta> {
  const { organizacionId, usuarioId, operadorId, nombreVisible } = datos;
  return transaccion(pool, async client => {
    const org = await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[organizacionId]);
    const cuenta = await client.query(`SELECT u.id,pf.nombre_visible AS "nombreVisible"
      FROM usuarios u LEFT JOIN perfiles_usuarios pf ON pf.usuario_id=u.id AND pf.organizacion_id=u.organizacion_id
      WHERE u.id=$1 AND u.organizacion_id=$2 AND u.activo FOR UPDATE OF u`,[usuarioId,organizacionId]);
    if (!org.rowCount || !cuenta.rowCount) return 'NO_DISPONIBLE';
    const protegida = await client.query(`SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
      WHERE ur.usuario_id=$1 AND r.nombre='SUPERADMINISTRADOR' LIMIT 1`,[usuarioId]);
    if (protegida.rowCount) return 'PROTEGIDA';
    const retirada = await client.query(`SELECT 1 FROM bitacora_auditoria WHERE entidad_id=$1 AND
      nombre_entidad='usuarios' AND accion='RETIRAR_USUARIO_ORGANIZACION' LIMIT 1`,[usuarioId]);
    if (retirada.rowCount) return 'RETIRADA';
    const anterior = cuenta.rows[0].nombreVisible as string | null;
    if (anterior !== nombreVisible) {
      await client.query(`INSERT INTO perfiles_usuarios(usuario_id,organizacion_id,nombre_visible)
        VALUES($1,$2,$3) ON CONFLICT(usuario_id)
        DO UPDATE SET nombre_visible=EXCLUDED.nombre_visible,actualizado_en=NOW()`,
        [usuarioId,organizacionId,nombreVisible]);
      await client.query(`INSERT INTO bitacora_auditoria
        (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
        VALUES($1,'PLATAFORMA_CAMBIAR_NOMBRE','usuarios',$2,$3::jsonb,$4::jsonb)`,
        [operadorId,usuarioId,JSON.stringify({organizacionId,nombreVisible:anterior}),
         JSON.stringify({organizacionId,nombreVisible})]);
    }
    return 'OK';
  });
}

export function editarEmailDesdePlataforma(
  pool: Pool, datos: Contexto & { email: string },
): Promise<ResultadoOperacionCuenta> {
  const { organizacionId, usuarioId, operadorId, email } = datos;
  return transaccion(pool, async client => {
    const org = await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[organizacionId]);
    const usuario = await client.query(
      'SELECT id,email FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo FOR UPDATE',[usuarioId,organizacionId]);
    if (!org.rows.length || !usuario.rows.length) return 'NO_DISPONIBLE';
    const roles = await client.query(`SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
      WHERE ur.usuario_id=$1 AND r.nombre='SUPERADMINISTRADOR' LIMIT 1`,[usuarioId]);
    if (roles.rows.length) return 'PROTEGIDA';
    const anterior = usuario.rows[0].email as string;
    if (anterior !== email) {
      await client.query('UPDATE usuarios SET email=$1,actualizado_en=NOW() WHERE id=$2',[email,usuarioId]);
      await client.query('UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW()) WHERE usuario_id=$1',[usuarioId]);
      await client.query(`INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
        VALUES($1,'PLATAFORMA_CAMBIAR_EMAIL','usuarios',$2,$3::jsonb,$4::jsonb)`,
        [operadorId,usuarioId,JSON.stringify({organizacionId,email:anterior}),JSON.stringify({organizacionId,email})]);
    }
    return 'OK';
  });
}

export function retirarCuentaDesdePlataforma(
  pool: Pool, datos: Contexto,
): Promise<ResultadoOperacionCuenta> {
  const { organizacionId, usuarioId, operadorId } = datos;
  return transaccion(pool, async client => {
    const org = await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[organizacionId]);
    const cuenta = await client.query('SELECT id,activo FROM usuarios WHERE id=$1 AND organizacion_id=$2 FOR UPDATE',[usuarioId,organizacionId]);
    if (!org.rowCount || !cuenta.rowCount) return 'NO_DISPONIBLE';
    const roles = await client.query(`SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
      WHERE ur.usuario_id=$1`,[usuarioId]);
    if (roles.rows.some((rol: {nombre:string}) => rol.nombre === 'SUPERADMINISTRADOR')) return 'PROTEGIDA';
    const retirada = await client.query(`SELECT 1 FROM bitacora_auditoria WHERE entidad_id=$1 AND
      nombre_entidad='usuarios' AND accion='RETIRAR_USUARIO_ORGANIZACION' LIMIT 1`,[usuarioId]);
    if (retirada.rowCount) return 'RETIRADA';
    if (roles.rows.some((rol: {nombre:string}) => rol.nombre === 'ADMINISTRADOR')) {
      const otros = await client.query(`SELECT count(DISTINCT u.id)::int AS total FROM usuarios u
        JOIN usuarios_roles ur ON ur.usuario_id=u.id JOIN roles r ON r.id=ur.rol_id AND r.activo
        WHERE u.organizacion_id=$1 AND u.activo AND r.nombre='ADMINISTRADOR' AND u.id<>$2`,[organizacionId,usuarioId]);
      if (!otros.rows[0].total) return 'ULTIMO_ADMINISTRADOR';
    }
    await client.query('UPDATE usuarios SET activo=FALSE,actualizado_en=NOW() WHERE id=$1',[usuarioId]);
    await client.query('UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW()) WHERE usuario_id=$1',[usuarioId]);
    await client.query(`INSERT INTO bitacora_auditoria
      (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
      VALUES($1,'RETIRAR_USUARIO_ORGANIZACION','usuarios',$2,$3::jsonb,$4::jsonb)`,
      [operadorId,usuarioId,JSON.stringify({activo:cuenta.rows[0].activo}),
       JSON.stringify({activo:false,retirado:true,organizacionId,desdePlataforma:true})]);
    return 'OK';
  });
}
