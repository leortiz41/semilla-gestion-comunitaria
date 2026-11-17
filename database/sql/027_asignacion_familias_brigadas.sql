-- 027: Relacionar una evaluación familiar de vivienda con la brigada patrocinadora.
-- Cada perfil (familia + proyecto) tiene como máximo una brigada activa.
-- Se conserva historial de cambios en bitacora_auditoria desde API.
CREATE TABLE IF NOT EXISTS asignaciones_familias_brigadas (
  perfil_id UUID PRIMARY KEY REFERENCES perfiles_familia(id) ON DELETE CASCADE,
  brigada_id UUID NOT NULL REFERENCES brigadas_donantes(id) ON DELETE RESTRICT,
  asignado_por_usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asignaciones_familias_brigadas_brigada
  ON asignaciones_familias_brigadas (brigada_id);
COMMENT ON TABLE asignaciones_familias_brigadas IS 'Relacion de patrocinio por brigada y evaluacion; no concede acceso a datos personales al donante.';