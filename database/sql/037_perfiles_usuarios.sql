-- 037 — Datos de presentación del perfil, por usuario y tenant.
CREATE TABLE IF NOT EXISTS perfiles_usuarios (
 usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
 organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
 nombre_visible VARCHAR(140),
 foto_base64 TEXT,
 foto_tipo VARCHAR(20),
 actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT foto_perfil_pareja CHECK ((foto_base64 IS NULL) = (foto_tipo IS NULL)),
 CONSTRAINT foto_perfil_tipo CHECK (foto_tipo IS NULL OR foto_tipo IN ('image/jpeg','image/png','image/webp')),
 CONSTRAINT foto_perfil_tamano CHECK (foto_base64 IS NULL OR length(foto_base64) <= 280000)
);
CREATE INDEX IF NOT EXISTS idx_perfiles_usuarios_organizacion ON perfiles_usuarios(organizacion_id);
