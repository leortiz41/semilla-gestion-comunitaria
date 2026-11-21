-- 029: relación explícita de cuentas DONANTE a brigadas (sin depender del correo).
CREATE TABLE IF NOT EXISTS cuentas_brigadas_donantes (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  brigada_id UUID NOT NULL REFERENCES brigadas_donantes(id) ON DELETE CASCADE,
  asignado_por_usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, brigada_id)
);
CREATE INDEX IF NOT EXISTS idx_cuentas_brigadas_donantes_brigada ON cuentas_brigadas_donantes(brigada_id);
COMMENT ON TABLE cuentas_brigadas_donantes IS 'Autorización explícita de cuentas donantes para consultar los proyectos de sus brigadas.';
