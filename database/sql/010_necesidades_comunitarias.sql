-- Historia #27, entrega 1: registro y consulta. Requiere 008 y 009.
BEGIN;
ALTER TABLE visiones_desarrollo_comunitarias ADD CONSTRAINT uq_vision_territorio_area UNIQUE(id,comunidad_id,organizacion_id,area);
ALTER TABLE metas_vision_desarrollo ADD CONSTRAINT uq_meta_vision_organizacion UNIQUE(id,vision_id,organizacion_id);
CREATE TABLE necesidades_comunitarias (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 comunidad_id UUID NOT NULL,
 organizacion_id UUID NOT NULL,
 area VARCHAR(60) NOT NULL CHECK(area IN ('EVANGELISMO','EDUCACION_FORMAL','EDUCACION_COMUNITARIA','INFRAESTRUCTURA')),
 vision_id UUID,
 meta_id UUID,
 titulo VARCHAR(180) NOT NULL CHECK(length(trim(titulo)) > 0),
 descripcion TEXT NOT NULL CHECK(length(trim(descripcion)) BETWEEN 1 AND 3000),
 situacion_inicial TEXT NOT NULL CHECK(length(trim(situacion_inicial)) BETWEEN 1 AND 3000),
 poblacion_afectada TEXT CHECK(length(poblacion_afectada)<=2000),
 cantidad_afectada INTEGER CHECK(cantidad_afectada>=0),
 resultado_esperado TEXT NOT NULL CHECK(length(trim(resultado_esperado)) BETWEEN 1 AND 3000),
 unidad_medida VARCHAR(80),
 cantidad_objetivo NUMERIC(14,2) CHECK(cantidad_objetivo>0),
 prioridad VARCHAR(15) NOT NULL DEFAULT 'POR_EVALUAR' CHECK(prioridad IN ('POR_EVALUAR','ALTA','MEDIA','BAJA')),
 motivo_prioridad TEXT NOT NULL CHECK(length(trim(motivo_prioridad)) BETWEEN 1 AND 2000),
 estado VARCHAR(20) NOT NULL DEFAULT 'IDENTIFICADA' CHECK(estado IN ('IDENTIFICADA','EVALUADA','APROBADA','EN_EJECUCION','EN_VERIFICACION','RESUELTA')),
 registrado_por_id UUID NOT NULL,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(id,organizacion_id),
 CHECK(meta_id IS NULL OR vision_id IS NOT NULL),
 CHECK((cantidad_objetivo IS NULL AND unidad_medida IS NULL) OR (cantidad_objetivo IS NOT NULL AND unidad_medida IS NOT NULL AND length(trim(unidad_medida))>0)),
 FOREIGN KEY(comunidad_id,organizacion_id) REFERENCES comunidades(id,organizacion_id) ON DELETE RESTRICT,
 FOREIGN KEY(vision_id,comunidad_id,organizacion_id,area) REFERENCES visiones_desarrollo_comunitarias(id,comunidad_id,organizacion_id,area) ON DELETE RESTRICT,
 FOREIGN KEY(meta_id,vision_id,organizacion_id) REFERENCES metas_vision_desarrollo(id,vision_id,organizacion_id) ON DELETE RESTRICT,
 FOREIGN KEY(registrado_por_id,organizacion_id) REFERENCES usuarios(id,organizacion_id) ON DELETE RESTRICT
);
CREATE INDEX idx_necesidades_comunidad_area ON necesidades_comunitarias(organizacion_id,comunidad_id,area,creado_en);
COMMIT;
