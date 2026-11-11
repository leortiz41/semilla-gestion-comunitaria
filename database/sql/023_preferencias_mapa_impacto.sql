-- HU Mapa de Impacto: distribución individual por proyecto.
-- Aplicar únicamente en desarrollo antes de desplegar el backend.
CREATE TABLE IF NOT EXISTS preferencias_mapa_impacto (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  configuracion JSONB NOT NULL DEFAULT '{}'::jsonb,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, organizacion_id, proyecto_id),
  CONSTRAINT chk_preferencias_mapa_configuracion_objeto
    CHECK (jsonb_typeof(configuracion) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_preferencias_mapa_proyecto
  ON preferencias_mapa_impacto (organizacion_id, proyecto_id);
