-- Compatibilidad entre 005 publicada y 005 local aplicada. No modifica ni elimina datos existentes.
-- Aplicar en development tras respaldo. No volver a ejecutar variantes de 005.
BEGIN;
-- Fase 3 de Comunidades: expediente comunitario por secciones.
-- Esta primera tabla registra únicamente el diagnóstico de población y vivienda.



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



-- Fase 3 de Comunidades: visión de desarrollo por área del expediente.


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



-- Copiar solo registros que no tienen diagnóstico por secciones; nunca sobrescribir capturas locales.
DO $$
BEGIN
 IF to_regclass('public.diagnosticos_comunidad') IS NOT NULL THEN
   INSERT INTO diagnosticos_comunitarios(comunidad_id,organizacion_id,poblacion_aproximada,viviendas_aproximadas,viviendas_intervencion,tipos_vivienda)
   SELECT DISTINCT ON (d.comunidad_id) d.comunidad_id,d.organizacion_id,d.poblacion,d.viviendas,d.viviendas_intervencion,
     (SELECT string_agg(e.nombre, E'\n' ORDER BY e.nombre) FROM elementos_diagnostico e WHERE e.diagnostico_id=d.id AND e.organizacion_id=d.organizacion_id AND e.tipo='vivienda')
   FROM diagnosticos_comunidad d ORDER BY d.comunidad_id,d.creado_en DESC,d.id DESC
   ON CONFLICT (comunidad_id) DO NOTHING;
   INSERT INTO visiones_desarrollo_comunitarias(comunidad_id,organizacion_id,area,situacion_actual,prioridad,meta_desarrollo)
   SELECT d.comunidad_id,d.organizacion_id,
     CASE v.categoria WHEN 'Evangelismo' THEN 'EVANGELISMO' WHEN 'Educación formal' THEN 'EDUCACION_FORMAL' WHEN 'Educación comunitaria' THEN 'EDUCACION_COMUNITARIA' WHEN 'Infraestructura' THEN 'INFRAESTRUCTURA' END,
     v.situacion,upper(v.prioridad),v.meta
   FROM (SELECT DISTINCT ON (comunidad_id) * FROM diagnosticos_comunidad ORDER BY comunidad_id,creado_en DESC,id DESC) d
   JOIN visiones_comunidad v ON v.diagnostico_id=d.id AND v.organizacion_id=d.organizacion_id
   ON CONFLICT (comunidad_id,area) DO NOTHING;
 END IF;
END $$;
COMMIT;
