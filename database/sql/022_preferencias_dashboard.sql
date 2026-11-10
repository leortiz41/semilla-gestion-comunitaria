-- HU Dashboard: preferencias privadas de cada usuario y organización.
-- Ejecutar una sola vez en la rama de desarrollo; no altera los datos existentes.
CREATE TABLE IF NOT EXISTS preferencias_dashboard (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  configuracion JSONB NOT NULL DEFAULT '{}'::jsonb,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, organizacion_id),
  CONSTRAINT preferencias_dashboard_configuracion_objeto CHECK (jsonb_typeof(configuracion) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_preferencias_dashboard_organizacion
  ON preferencias_dashboard (organizacion_id);
