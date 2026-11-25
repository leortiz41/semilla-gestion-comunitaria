import type { Pool } from 'pg';

const rolesAsignables = ['ADMINISTRADOR','COORDINADOR','FINANZAS','CAMPO','DONANTE'];

/** Lectura aislada al tenant; excluye cuentas de plataforma y cuentas retiradas. */
export async function consultarMatrizAccesos(pool: Pool, organizacionId: string) {
  const existe=await pool.query('SELECT id FROM organizaciones WHERE id=$1',[organizacionId]);
  if (!existe.rowCount) return null;
  const [cuentas,permisos,roles]=await Promise.all([
    pool.query('SELECT u.id,u.email,u.activo,'
      +' COALESCE(ARRAY(SELECT DISTINCT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id AND r.activo WHERE ur.usuario_id=u.id ORDER BY r.nombre),ARRAY[]::text[]) AS roles,'
      +' COALESCE(ARRAY(SELECT DISTINCT p.codigo FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id AND r.activo JOIN roles_permisos rp ON rp.rol_id=r.id JOIN permisos p ON p.id=rp.permiso_id WHERE ur.usuario_id=u.id AND NOT EXISTS (SELECT 1 FROM organizaciones_roles_permisos_restringidos b WHERE b.organizacion_id=u.organizacion_id AND b.rol_id=r.id AND b.permiso_id=p.id) ORDER BY p.codigo),ARRAY[]::text[]) AS "permisosBase",'
      +' COALESCE(ARRAY(SELECT p.codigo FROM usuarios_permisos_restringidos b JOIN permisos p ON p.id=b.permiso_id WHERE b.usuario_id=u.id AND b.organizacion_id=$1 ORDER BY p.codigo),ARRAY[]::text[]) AS "permisosRestringidos"'
      +' FROM usuarios u WHERE u.organizacion_id=$1 AND NOT EXISTS(SELECT 1 FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id WHERE ur.usuario_id=u.id AND r.nombre=$2)'
      +' AND NOT EXISTS(SELECT 1 FROM bitacora_auditoria b WHERE b.entidad_id=u.id AND b.nombre_entidad=$3 AND b.accion=$4)'
      +' ORDER BY u.email LIMIT 500',
      [organizacionId,'SUPERADMINISTRADOR','usuarios','RETIRAR_USUARIO_ORGANIZACION']),
    pool.query('SELECT codigo,modulo,descripcion FROM permisos ORDER BY modulo,codigo'),
    pool.query('SELECT r.nombre,r.descripcion,r.activo,'
      +' ARRAY(SELECT p.codigo FROM roles_permisos rp JOIN permisos p ON p.id=rp.permiso_id WHERE rp.rol_id=r.id ORDER BY p.codigo) AS permisos,'
      +' ARRAY(SELECT p.codigo FROM organizaciones_roles_permisos_restringidos b JOIN permisos p ON p.id=b.permiso_id WHERE b.organizacion_id=$1 AND b.rol_id=r.id ORDER BY p.codigo) AS "permisosRestringidos"'
      +' FROM roles r WHERE r.nombre=ANY($2::text[]) ORDER BY r.nombre',[organizacionId,rolesAsignables]),
  ]);
  return {cuentas:cuentas.rows,permisos:permisos.rows,roles:roles.rows};
}

export type ResultadoRestriccionUsuario =
  | 'NO_DISPONIBLE' | 'RETIRADA' | 'PROTEGIDA' | 'PERMISOS_INVALIDOS' | 'OK';
export type ResultadoRestriccionRol =
  | 'ORGANIZACION_INACTIVA' | 'ROL_INACTIVO' | 'PERMISOS_INVALIDOS' | 'OK';

/** Restricciones individuales: únicamente se quitan permisos existentes en el rol efectivo. */
export async function actualizarRestriccionesUsuario(pool: Pool, datos: {
  organizacionId:string; usuarioId:string; permisos:string[]; operadorId:string;
}): Promise<ResultadoRestriccionUsuario> {
  const {organizacionId:org,usuarioId:id,permisos:permitidos,operadorId}=datos;
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const entidad=await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[org]);
    const cuenta=await client.query('SELECT id FROM usuarios WHERE id=$1 AND organizacion_id=$2 AND activo FOR UPDATE',[id,org]);
    if(!entidad.rowCount||!cuenta.rowCount){await client.query('ROLLBACK');return 'NO_DISPONIBLE';}
    const retirada=await client.query('SELECT 1 FROM bitacora_auditoria WHERE entidad_id=$1 AND nombre_entidad=$2 AND accion=$3 LIMIT 1',[id,'usuarios','RETIRAR_USUARIO_ORGANIZACION']);
    if(retirada.rowCount){await client.query('ROLLBACK');return 'RETIRADA';}
    const roles=await client.query('SELECT r.nombre FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id AND r.activo WHERE ur.usuario_id=$1',[id]);
    if(roles.rows.some((r:{nombre:string})=>['ADMINISTRADOR','SUPERADMINISTRADOR'].includes(r.nombre))){
      await client.query('ROLLBACK');return 'PROTEGIDA';
    }
    const base=await client.query('SELECT DISTINCT p.id,p.codigo FROM usuarios_roles ur JOIN roles r ON r.id=ur.rol_id AND r.activo JOIN roles_permisos rp ON rp.rol_id=r.id JOIN permisos p ON p.id=rp.permiso_id WHERE ur.usuario_id=$1 AND NOT EXISTS(SELECT 1 FROM organizaciones_roles_permisos_restringidos b WHERE b.organizacion_id=$2 AND b.rol_id=r.id AND b.permiso_id=p.id)',[id,org]);
    const validos=new Set(base.rows.map((p:{codigo:string})=>p.codigo));
    if(permitidos.some(codigo=>!validos.has(codigo))){await client.query('ROLLBACK');return 'PERMISOS_INVALIDOS';}
    const previos=await client.query('SELECT p.codigo FROM usuarios_permisos_restringidos r JOIN permisos p ON p.id=r.permiso_id WHERE r.usuario_id=$1 AND r.organizacion_id=$2',[id,org]);
    await client.query('DELETE FROM usuarios_permisos_restringidos WHERE usuario_id=$1 AND organizacion_id=$2',[id,org]);
    for(const permiso of base.rows as {id:string;codigo:string}[]){
      if(!permitidos.includes(permiso.codigo)) await client.query(
        'INSERT INTO usuarios_permisos_restringidos(organizacion_id,usuario_id,permiso_id,actualizado_por_usuario_id) VALUES($1,$2,$3,$4)',
        [org,id,permiso.id,operadorId]);
    }
    await client.query('INSERT INTO bitacora_auditoria(usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',[
      operadorId,'PLATAFORMA_RESTRINGIR_PERMISOS','usuarios',id,
      JSON.stringify({organizacionId:org,restringidos:previos.rows.map((p:{codigo:string})=>p.codigo)}),
      JSON.stringify({organizacionId:org,permitidos}),
    ]);
    await client.query('COMMIT');return 'OK';
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}

/** Restricciones de rol por tenant: no escribe en roles_permisos global. */
export async function actualizarRestriccionesRol(pool: Pool, datos: {
  organizacionId:string; nombre:string; permisos:string[]; operadorId:string;
}): Promise<ResultadoRestriccionRol> {
  const {organizacionId:org,nombre,permisos:permitidos,operadorId}=datos;
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const entidad=await client.query('SELECT id FROM organizaciones WHERE id=$1 AND activo FOR UPDATE',[org]);
    if(!entidad.rowCount){await client.query('ROLLBACK');return 'ORGANIZACION_INACTIVA';}
    const rol=await client.query('SELECT id FROM roles WHERE nombre=$1 AND activo',[nombre]);
    if(!rol.rowCount){await client.query('ROLLBACK');return 'ROL_INACTIVO';}
    const id=rol.rows[0].id;
    const base=await client.query('SELECT p.id,p.codigo FROM roles_permisos rp JOIN permisos p ON p.id=rp.permiso_id WHERE rp.rol_id=$1',[id]);
    const autorizados=new Set(base.rows.map((p:{codigo:string})=>p.codigo));
    if(permitidos.some(codigo=>!autorizados.has(codigo))){
      await client.query('ROLLBACK');return 'PERMISOS_INVALIDOS';
    }
    const anteriores=await client.query('SELECT p.codigo FROM organizaciones_roles_permisos_restringidos r JOIN permisos p ON p.id=r.permiso_id WHERE r.organizacion_id=$1 AND r.rol_id=$2',[org,id]);
    await client.query('DELETE FROM organizaciones_roles_permisos_restringidos WHERE organizacion_id=$1 AND rol_id=$2',[org,id]);
    for(const permiso of base.rows as {id:string;codigo:string}[]){
      if(!permitidos.includes(permiso.codigo)){
        await client.query('INSERT INTO organizaciones_roles_permisos_restringidos (organizacion_id,rol_id,permiso_id,actualizado_por_usuario_id) VALUES($1,$2,$3,$4)',[org,id,permiso.id,operadorId]);
      }
    }
    await client.query('INSERT INTO bitacora_auditoria (usuario_id,accion,nombre_entidad,entidad_id,valores_anteriores,valores_nuevos) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',[
      operadorId,'PLATAFORMA_PERMISOS_ROL_TENANT','roles',id,
      JSON.stringify({organizacionId:org,rol:nombre,restringidos:anteriores.rows.map((p:{codigo:string})=>p.codigo)}),
      JSON.stringify({organizacionId:org,rol:nombre,permisos:permitidos}),
    ]);
    await client.query('COMMIT');return 'OK';
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}
