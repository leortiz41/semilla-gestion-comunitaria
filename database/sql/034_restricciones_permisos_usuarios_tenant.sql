-- 034: Restricciones de permisos individuales por organización.
-- El administrador del tenant sólo puede quitar permisos incluidos en los roles base.
-- No modifica roles_permisos global ni concede permisos adicionales.
CREATE TABLE IF NOT EXISTS usuarios_permisos_restringidos (
 organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
 usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
 actualizado_por_usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(usuario_id,permiso_id)
);
CREATE INDEX IF NOT EXISTS idx_usuarios_permisos_restringidos_organizacion
 ON usuarios_permisos_restringidos(organizacion_id,usuario_id);
COMMENT ON TABLE usuarios_permisos_restringidos IS 'Sólo revoca permisos de roles globales para usuarios del tenant; nunca concede privilegios adicionales.';
