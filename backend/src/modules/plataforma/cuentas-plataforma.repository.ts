import type { Pool, PoolClient } from 'pg';

export type ResultadoEstadoCuenta =
  | { estado: 'NO_ENCONTRADA' }
  | { estado: 'RETIRADA' }
  | { estado: 'PROTEGIDA' }
  | { estado: 'ULTIMO_ADMINISTRADOR' }
  | { estado: 'ACTUALIZADA'; id: string; activo: boolean };

export type ResultadoAltaCuenta =
  | { estado: 'ORGANIZACION_INACTIVA' }
  | { estado: 'ROLES_NO_DISPONIBLES' }
  | { estado: 'CREADA'; cuenta: Record<string, unknown> };

export async function consultarCuentasPlataforma(pool: Pool, organizacionId: string) {
  const org=await pool.query('SELECT id FROM organizaciones WHERE id=$1', [organizacionId]);
  if (!org.rows.length) return null;
  const { rows }=await pool.query(
    `SELECT u.id,u.email,u.activo,u.debe_cambiar_contrasena AS "debeCambiarContrasena",
       (SELECT pf.nombre_visible FROM perfiles_usuarios pf
         WHERE pf.usuario_id=u.id AND pf.organizacion_id=u.organizacion_id) AS "nombreVisible",
       EXISTS (SELECT 1 FROM bitacora_auditoria b
         WHERE b.entidad_id=u.id AND b.nombre_entidad='usuarios'
           AND b.accion='RETIRAR_USUARIO_ORGANIZACION') AS retirado,
       COALESCE(array_agg(r.nombre ORDER BY r.nombre) FILTER(WHERE r.id IS NOT NULL),'{}'::text[]) AS roles
     FROM usuarios u LEFT JOIN usuarios_roles ur ON ur.usuario_id=u.id
     LEFT JOIN roles r ON r.id=ur.rol_id
     WHERE u.organizacion_id=$1 GROUP BY u.id ORDER BY u.email LIMIT 500`, [organizacionId],
  );
  return rows;
}

/** Alta transaccional de una cuenta de tenant operada por la plataforma. */
export async function insertarCuentaPlataforma(pool: Pool, datos: {
  organizacionId: string; email: string; nombreVisible: string;
  roles: string[]; hash: string; operadorId: string;
}): Promise<ResultadoAltaCuenta> {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const org=await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[datos.organizacionId]);
    if (!org.rows.length) {
      await client.query('ROLLBACK');
      return {estado:'ORGANIZACION_INACTIVA'};
    }
    const rs=await client.query('SELECT id,nombre FROM roles WHERE nombre=ANY($1::text[]) AND activo',[datos.roles]);
    if (rs.rows.length!==datos.roles.length) {
      await client.query('ROLLBACK');
      return {estado:'ROLES_NO_DISPONIBLES'};
    }
    const {rows}=await client.query(
      `INSERT INTO usuarios(email,hash_contrasena,organizacion_id,debe_cambiar_contrasena)
       VALUES($1,$2,$3,TRUE) RETURNING id,email,activo`,[datos.email,datos.hash,datos.organizacionId]);
    for(const rol of rs.rows) await client.query(
      'INSERT INTO usuarios_roles(usuario_id,rol_id) VALUES($1,$2)',[rows[0].id,rol.id]);
    await client.query(
      'INSERT INTO perfiles_usuarios(usuario_id,organizacion_id,nombre_visible) VALUES($1,$2,$3)',
      [rows[0].id,datos.organizacionId,datos.nombreVisible]);
    await client.query(
      `INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_nuevos)
       VALUES($1,'PLATAFORMA_CREAR_CUENTA','usuarios',$2,$3::jsonb)`,
      [datos.operadorId,rows[0].id,JSON.stringify({
        organizacionId:datos.organizacionId,email:datos.email,roles:datos.roles,nombreVisible:datos.nombreVisible,
      })]);
    await client.query('COMMIT');
    return {estado:'CREADA',cuenta:{...rows[0],roles:datos.roles,nombreVisible:datos.nombreVisible}};
  } catch(error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {client.release();}
}

/**
 * Puerto transaccional para el caso de uso de cambio de estado.
 * Cada método usa la MISMA conexión y conserva el bloqueo de la organización.
 * No toma decisiones de negocio: devuelve hechos y ejecuta persistencia.
 */
export interface PersistenciaEstadoCuenta {
  obtenerCuentaBloqueada(organizacionId: string, usuarioId: string): Promise<{activoAnterior: boolean} | null>;
  fueRetirada(usuarioId: string): Promise<boolean>;
  esCuentaGlobal(usuarioId: string): Promise<boolean>;
  tieneRolAdministradorActivo(usuarioId: string): Promise<boolean>;
  contarOtrosAdministradoresActivos(organizacionId: string, usuarioId: string): Promise<number>;
  guardarCambio(datos: {
    organizacionId: string; usuarioId: string; operadorId: string;
    activoAnterior: boolean; activoSolicitado: boolean;
  }): Promise<void>;
}

function crearPersistenciaEstadoCuenta(client: PoolClient): PersistenciaEstadoCuenta {
  return {
    async obtenerCuentaBloqueada(organizacionId, usuarioId) {
      // Este bloqueo serializa cambios con roles y retiro lógico.
      const org = await client.query('SELECT id,activo FROM organizaciones WHERE id=$1 FOR UPDATE', [organizacionId]);
      const usuario = await client.query(
        'SELECT id,activo FROM usuarios WHERE id=$1 AND organizacion_id=$2 FOR UPDATE',
        [usuarioId,organizacionId],
      );
      if (!org.rows.length || !usuario.rows.length) return null;
      return { activoAnterior: usuario.rows[0].activo as boolean };
    },
    async fueRetirada(usuarioId) {
      const retirada = await client.query(`SELECT 1 FROM bitacora_auditoria
        WHERE entidad_id=$1 AND nombre_entidad='usuarios' AND accion='RETIRAR_USUARIO_ORGANIZACION' LIMIT 1`,
        [usuarioId],
      );
      return Boolean(retirada.rowCount);
    },
    async esCuentaGlobal(usuarioId) {
      const global = await client.query(`SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id
        WHERE ur.usuario_id=$1 AND r.nombre='SUPERADMINISTRADOR' LIMIT 1`, [usuarioId]);
      return global.rows.length > 0;
    },
    async tieneRolAdministradorActivo(usuarioId) {
      const asignado = await client.query(
        `SELECT 1 FROM usuarios_roles ur
         JOIN roles r ON r.id=ur.rol_id AND r.activo
         WHERE ur.usuario_id=$1 AND r.nombre='ADMINISTRADOR' LIMIT 1`,
        [usuarioId],
      );
      return asignado.rows.length > 0;
    },
    async contarOtrosAdministradoresActivos(organizacionId, usuarioId) {
      const otros = await client.query(
        `SELECT COUNT(DISTINCT u.id)::int AS total FROM usuarios u
         JOIN usuarios_roles ur ON ur.usuario_id=u.id
         JOIN roles r ON r.id=ur.rol_id AND r.activo
         WHERE u.organizacion_id=$1 AND u.activo AND r.nombre='ADMINISTRADOR' AND u.id<>$2`,
        [organizacionId, usuarioId],
      );
      return Number(otros.rows[0]?.total ?? 0);
    },
    async guardarCambio({organizacionId,usuarioId,operadorId,activoAnterior,activoSolicitado}) {
      await client.query('UPDATE usuarios SET activo=$1,actualizado_en=NOW() WHERE id=$2',
        [activoSolicitado,usuarioId]);
      if (!activoSolicitado) {
        await client.query(
          'UPDATE tokens_refresco SET revocado_en=COALESCE(revocado_en,NOW()) WHERE usuario_id=$1',
          [usuarioId],
        );
      }
      await client.query(`INSERT INTO bitacora_auditoria
        (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos)
        VALUES($1,'PLATAFORMA_CAMBIAR_ESTADO_CUENTA','usuarios',$2,$3::jsonb,$4::jsonb)`,
        [operadorId,usuarioId,
          JSON.stringify({organizacionId,activo:activoAnterior}),
          JSON.stringify({organizacionId,activo:activoSolicitado})],
      );
    },
  };
}

/**
 * Unidad de trabajo: mantiene consultas, bloqueo y modificación atómicos.
 * La política de negocio se decide en el servicio durante esta transacción.
 */
export async function ejecutarCambioEstadoCuentaTransaccional(
  pool: Pool,
  casoDeUso: (persistencia: PersistenciaEstadoCuenta) => Promise<ResultadoEstadoCuenta>,
): Promise<ResultadoEstadoCuenta> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await casoDeUso(crearPersistenciaEstadoCuenta(client));
    await client.query(resultado.estado === 'ACTUALIZADA' ? 'COMMIT' : 'ROLLBACK');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
