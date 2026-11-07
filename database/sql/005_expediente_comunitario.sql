-- Issue #11. Ejecutar después de 004 en desarrollo y verificar antes de producción.
-- Migración incremental: conserva comunidades y registros básicos existentes.
BEGIN;
ALTER TABLE comunidades ADD COLUMN latitud NUMERIC(9,6), ADD COLUMN longitud NUMERIC(9,6);
ALTER TABLE comunidades ADD CONSTRAINT ck_comunidades_coordenadas CHECK (
 (latitud IS NULL AND longitud IS NULL) OR
 (latitud IS NOT NULL AND longitud IS NOT NULL AND latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180));
ALTER TABLE comunidades ADD CONSTRAINT uq_comunidades_id_organizacion UNIQUE (id, organizacion_id);
ALTER TABLE usuarios ADD CONSTRAINT uq_usuarios_id_organizacion UNIQUE (id, organizacion_id);
CREATE TABLE diagnosticos_comunidad (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
 comunidad_id UUID NOT NULL,
 poblacion INTEGER CHECK (poblacion >= 0),
 viviendas INTEGER CHECK (viviendas >= 0),
 viviendas_intervencion INTEGER CHECK (viviendas_intervencion >= 0),
 observaciones_organizaciones TEXT NOT NULL DEFAULT '',
 potencial_productivo TEXT NOT NULL DEFAULT '',
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 creado_por_id UUID NOT NULL,
 FOREIGN KEY (creado_por_id, organizacion_id) REFERENCES usuarios(id, organizacion_id) ON DELETE RESTRICT,
 UNIQUE (id, organizacion_id),
 FOREIGN KEY (comunidad_id, organizacion_id) REFERENCES comunidades(id, organizacion_id) ON DELETE RESTRICT,
 CHECK (viviendas_intervencion IS NULL OR (viviendas IS NOT NULL AND viviendas_intervencion <= viviendas))
);
CREATE INDEX idx_diagnosticos_comunidad_fecha ON diagnosticos_comunidad(organizacion_id, comunidad_id, creado_en DESC);
CREATE TABLE visiones_comunidad (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organizacion_id UUID NOT NULL,
 diagnostico_id UUID NOT NULL,
 categoria VARCHAR(80) NOT NULL CHECK (categoria IN ('Evangelismo','Educación formal','Educación comunitaria','Infraestructura')),
 situacion TEXT NOT NULL CHECK (length(trim(situacion)) BETWEEN 1 AND 3000),
 meta TEXT NOT NULL CHECK (length(trim(meta)) BETWEEN 1 AND 3000),
 prioridad VARCHAR(10) NOT NULL CHECK (prioridad IN ('alta','media','baja')),
 UNIQUE (diagnostico_id,categoria),
 FOREIGN KEY (diagnostico_id,organizacion_id) REFERENCES diagnosticos_comunidad(id,organizacion_id) ON DELETE RESTRICT
);
-- Cada elemento de una selección/lista tiene su propia fila y FK al diagnóstico.
CREATE TABLE elementos_diagnostico (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organizacion_id UUID NOT NULL,
 diagnostico_id UUID NOT NULL,
 tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('vivienda','organizacion','actividad_productiva','producto_servicio')),
 nombre VARCHAR(150) NOT NULL CHECK (length(trim(nombre)) > 0),
 FOREIGN KEY (diagnostico_id,organizacion_id) REFERENCES diagnosticos_comunidad(id,organizacion_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_elementos_diagnostico_nombre ON elementos_diagnostico(diagnostico_id,tipo,lower(nombre));
COMMIT;
