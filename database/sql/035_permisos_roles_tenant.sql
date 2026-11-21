-- 035: Permisos de perfiles base restringidos por organización.
-- No se edita roles_permisos global, no se permite conceder privilegios nuevos.
CREATE TABLE IF NOT EXISTS organizaciones_roles_permisos_restringidos (
 organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
 rol_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
 permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
 actualizado_por_usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(organizacion_id,rol_id,permiso_id)
);
CREATE INDEX IF NOT EXISTS idx_org_roles_permisos_restringidos
 ON organizaciones_roles_permisos_restringidos(organizacion_id,rol_id);
