-- 028: CRUD de integrantes y catalogo de escolaridad.
CREATE TABLE IF NOT EXISTS grados_estudio (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organizacion_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
 nombre VARCHAR(100) NOT NULL,
 nivel VARCHAR(60) NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT TRUE,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(length(trim(nombre)) > 0),
 CHECK(length(trim(nivel)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_grados_estudio_global ON grados_estudio (lower(nombre), lower(nivel)) WHERE organizacion_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_grados_estudio_organizacion ON grados_estudio (organizacion_id, lower(nombre), lower(nivel)) WHERE organizacion_id IS NOT NULL;
INSERT INTO grados_estudio (nivel,nombre) VALUES
 ('Prebásica','Prekínder'),('Prebásica','Kínder'),('Prebásica','Preparatoria'),
 ('Básica','Primer grado'),('Básica','Segundo grado'),('Básica','Tercer grado'),
 ('Básica','Cuarto grado'),('Básica','Quinto grado'),('Básica','Sexto grado'),
 ('Básica','Séptimo grado'),('Básica','Octavo grado'),('Básica','Noveno grado'),
 ('Media','Décimo grado'),('Media','Undécimo grado'),('Media','Duodécimo grado'),
 ('Superior','Universidad'),('Otra formación','Educación alternativa')
ON CONFLICT DO NOTHING;
ALTER TABLE miembros_familia
 ADD COLUMN IF NOT EXISTS asiste_escuela BOOLEAN,
 ADD COLUMN IF NOT EXISTS grado_estudio_id UUID REFERENCES grados_estudio(id) ON DELETE SET NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'miembros_familia_grado_si_asiste') THEN
   ALTER TABLE miembros_familia ADD CONSTRAINT miembros_familia_grado_si_asiste
     CHECK (asiste_escuela IS DISTINCT FROM FALSE OR grado_estudio_id IS NULL);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_miembros_familia_grado ON miembros_familia(grado_estudio_id);
