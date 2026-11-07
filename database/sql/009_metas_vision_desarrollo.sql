-- Metas individuales por área. Requiere 007. No sustituye migraciones aplicadas.
BEGIN;
ALTER TABLE visiones_desarrollo_comunitarias ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);
ALTER TABLE visiones_desarrollo_comunitarias ADD CONSTRAINT uq_vision_id_organizacion UNIQUE(id, organizacion_id);
CREATE TABLE metas_vision_desarrollo (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 vision_id UUID NOT NULL,
 organizacion_id UUID NOT NULL,
 descripcion TEXT NOT NULL CHECK (length(trim(descripcion)) BETWEEN 1 AND 2000),
 orden INTEGER NOT NULL CHECK (orden >= 0),
 activa BOOLEAN NOT NULL DEFAULT TRUE,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 FOREIGN KEY (vision_id, organizacion_id) REFERENCES visiones_desarrollo_comunitarias(id, organizacion_id) ON DELETE CASCADE
);
CREATE INDEX idx_metas_vision ON metas_vision_desarrollo(vision_id, organizacion_id, activa, orden);
-- Conservar el párrafo original como una meta; la persona lo separará sin inferencias automáticas.
INSERT INTO metas_vision_desarrollo(vision_id,organizacion_id,descripcion,orden)
SELECT id,organizacion_id,meta_desarrollo,0 FROM visiones_desarrollo_comunitarias
WHERE meta_desarrollo IS NOT NULL AND length(trim(meta_desarrollo)) > 0;
COMMIT;
