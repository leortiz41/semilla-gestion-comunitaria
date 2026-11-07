-- Organización y productividad del expediente por secciones. Requiere 007.
-- Migración nueva: no modificar 005, 006 ni 007. Respaldar development antes de aplicar.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_id_organizacion ON usuarios(id,organizacion_id);
CREATE TABLE capacidades_comunitarias (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 comunidad_id UUID NOT NULL,
 organizacion_id UUID NOT NULL,
 revision INTEGER NOT NULL CHECK (revision > 0),
 observaciones_organizaciones TEXT NOT NULL DEFAULT '' CHECK (length(observaciones_organizaciones)<=3000),
 potencial_productivo TEXT NOT NULL DEFAULT '' CHECK (length(potencial_productivo)<=3000),
 registrado_por_id UUID,
 FOREIGN KEY (registrado_por_id,organizacion_id) REFERENCES usuarios(id,organizacion_id) ON DELETE RESTRICT,
 origen VARCHAR(20) NOT NULL DEFAULT 'CAPTURA' CHECK (origen IN ('CAPTURA','MIGRACION')),
 creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE (comunidad_id,revision),
 UNIQUE (id,organizacion_id),
 FOREIGN KEY (comunidad_id,organizacion_id) REFERENCES comunidades(id,organizacion_id) ON DELETE RESTRICT
);
CREATE INDEX idx_capacidades_organizacion_comunidad ON capacidades_comunitarias(organizacion_id,comunidad_id,revision DESC);
CREATE TABLE elementos_capacidad (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 capacidad_id UUID NOT NULL,
 organizacion_id UUID NOT NULL,
 tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('organizacion','actividad_productiva','producto_servicio')),
 nombre VARCHAR(150) NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 150),
 FOREIGN KEY (capacidad_id,organizacion_id) REFERENCES capacidades_comunitarias(id,organizacion_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_elementos_capacidad ON elementos_capacidad(capacidad_id,tipo,lower(nombre));
-- Recuperar capacidades del último diagnóstico alternativo si existió ese flujo.
-- Los diagnósticos originales y todos sus detalles permanecen intactos.
DO $$
BEGIN
 IF to_regclass('public.diagnosticos_comunidad') IS NOT NULL THEN
   INSERT INTO capacidades_comunitarias(comunidad_id,organizacion_id,revision,observaciones_organizaciones,potencial_productivo,origen)
   SELECT DISTINCT ON (comunidad_id) comunidad_id,organizacion_id,1,observaciones_organizaciones,potencial_productivo,'MIGRACION'
   FROM diagnosticos_comunidad ORDER BY comunidad_id,creado_en DESC,id DESC;
   INSERT INTO elementos_capacidad(capacidad_id,organizacion_id,tipo,nombre)
   SELECT c.id,c.organizacion_id,e.tipo,e.nombre
   FROM capacidades_comunitarias c
   JOIN (SELECT DISTINCT ON (comunidad_id) * FROM diagnosticos_comunidad ORDER BY comunidad_id,creado_en DESC,id DESC) d
     ON d.comunidad_id=c.comunidad_id AND d.organizacion_id=c.organizacion_id
   JOIN elementos_diagnostico e ON e.diagnostico_id=d.id AND e.organizacion_id=d.organizacion_id
   WHERE e.tipo IN ('organizacion','actividad_productiva','producto_servicio');
 END IF;
END $$;
COMMIT;
