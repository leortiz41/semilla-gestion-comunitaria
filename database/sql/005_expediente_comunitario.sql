-- Fase 3 de Comunidades: expediente comunitario por secciones.
-- Esta primera tabla registra únicamente el diagnóstico de población y vivienda.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_comunidades_id_organizacion
  ON comunidades(id, organizacion_id);

CREATE TABLE IF NOT EXISTS diagnosticos_comunitarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comunidad_id UUID NOT NULL,
  organizacion_id UUID NOT NULL,
  poblacion_aproximada INTEGER CHECK (poblacion_aproximada IS NULL OR poblacion_aproximada >= 0),
  viviendas_aproximadas INTEGER CHECK (viviendas_aproximadas IS NULL OR viviendas_aproximadas >= 0),
  viviendas_intervencion INTEGER CHECK (viviendas_intervencion IS NULL OR viviendas_intervencion >= 0),
  tipos_vivienda TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_diagnosticos_comunitarios_comunidad UNIQUE (comunidad_id),
  CONSTRAINT uq_diagnosticos_comunitarios_comunidad_organizacion UNIQUE (comunidad_id, organizacion_id),
  CONSTRAINT diagnosticos_comunitarios_organizacion_fkey
    FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT diagnosticos_comunitarios_comunidad_organizacion_fkey
    FOREIGN KEY (comunidad_id, organizacion_id)
    REFERENCES comunidades(id, organizacion_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_diagnosticos_comunitarios_organizacion_id
  ON diagnosticos_comunitarios(organizacion_id);

COMMIT;
