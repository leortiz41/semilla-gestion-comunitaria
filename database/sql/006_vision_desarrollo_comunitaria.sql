-- Fase 3 de Comunidades: visión de desarrollo por área del expediente.
BEGIN;

CREATE TABLE IF NOT EXISTS visiones_desarrollo_comunitarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comunidad_id UUID NOT NULL,
  organizacion_id UUID NOT NULL,
  area VARCHAR(60) NOT NULL,
  situacion_actual TEXT,
  prioridad VARCHAR(10),
  meta_desarrollo TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_visiones_desarrollo_area
    CHECK (area IN ('EVANGELISMO', 'EDUCACION_FORMAL', 'EDUCACION_COMUNITARIA', 'INFRAESTRUCTURA')),
  CONSTRAINT chk_visiones_desarrollo_prioridad
    CHECK (prioridad IS NULL OR prioridad IN ('ALTA', 'MEDIA', 'BAJA')),
  CONSTRAINT uq_visiones_desarrollo_comunidad_area
    UNIQUE (comunidad_id, area),
  CONSTRAINT uq_visiones_desarrollo_comunidad_organizacion_area
    UNIQUE (comunidad_id, organizacion_id, area),
  CONSTRAINT visiones_desarrollo_organizacion_fkey
    FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT visiones_desarrollo_comunidad_organizacion_fkey
    FOREIGN KEY (comunidad_id, organizacion_id)
    REFERENCES comunidades(id, organizacion_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_visiones_desarrollo_organizacion_id
  ON visiones_desarrollo_comunitarias(organizacion_id);

COMMIT;
