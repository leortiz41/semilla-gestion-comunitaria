-- Fase 2 de multi-organizacion: aislamiento territorial.
-- Issue relacionado: #19
-- Requiere haber ejecutado previamente 003_multi_organizacion_base.sql.

BEGIN;

DO $$
DECLARE
  organizacion_sal_y_luz UUID;
BEGIN
  SELECT id
    INTO organizacion_sal_y_luz
    FROM organizaciones
   WHERE slug = 'ministerio-sal-y-luz'
   LIMIT 1;

  IF organizacion_sal_y_luz IS NULL THEN
    RAISE EXCEPTION 'No existe la organizacion inicial Ministerio Sal y Luz. Ejecute primero 003_multi_organizacion_base.sql.';
  END IF;

  ALTER TABLE zonas
    ADD COLUMN IF NOT EXISTS organizacion_id UUID;

  ALTER TABLE comunidades
    ADD COLUMN IF NOT EXISTS organizacion_id UUID;

  UPDATE zonas
     SET organizacion_id = organizacion_sal_y_luz
   WHERE organizacion_id IS NULL;

  UPDATE comunidades
     SET organizacion_id = organizacion_sal_y_luz
   WHERE organizacion_id IS NULL;
END $$;

ALTER TABLE zonas
  ALTER COLUMN organizacion_id SET NOT NULL;

ALTER TABLE comunidades
  ALTER COLUMN organizacion_id SET NOT NULL;

ALTER TABLE zonas
  DROP CONSTRAINT IF EXISTS zonas_organizacion_id_fkey;
ALTER TABLE zonas
  ADD CONSTRAINT zonas_organizacion_id_fkey
  FOREIGN KEY (organizacion_id)
  REFERENCES organizaciones(id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE comunidades
  DROP CONSTRAINT IF EXISTS comunidades_organizacion_id_fkey;
ALTER TABLE comunidades
  ADD CONSTRAINT comunidades_organizacion_id_fkey
  FOREIGN KEY (organizacion_id)
  REFERENCES organizaciones(id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- Los nombres dejan de ser unicos globalmente: cada ONG administra su propio territorio.
ALTER TABLE zonas
  DROP CONSTRAINT IF EXISTS zonas_nombre_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_zonas_organizacion_nombre
  ON zonas (organizacion_id, LOWER(nombre));

ALTER TABLE comunidades
  DROP CONSTRAINT IF EXISTS comunidades_nombre_municipio_departamento_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_comunidades_organizacion_ubicacion
  ON comunidades (organizacion_id, LOWER(nombre), LOWER(municipio), LOWER(departamento));

CREATE INDEX IF NOT EXISTS idx_zonas_organizacion_id
  ON zonas (organizacion_id);

CREATE INDEX IF NOT EXISTS idx_comunidades_organizacion_id
  ON comunidades (organizacion_id);

-- Refuerza desde PostgreSQL que una comunidad no pueda apuntar a una zona de otra organizacion.
CREATE UNIQUE INDEX IF NOT EXISTS uq_zonas_id_organizacion
  ON zonas (id, organizacion_id);

ALTER TABLE comunidades
  DROP CONSTRAINT IF EXISTS comunidades_zona_id_fkey;

ALTER TABLE comunidades
  ADD CONSTRAINT comunidades_zona_organizacion_fkey
  FOREIGN KEY (zona_id, organizacion_id)
  REFERENCES zonas(id, organizacion_id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

COMMIT;
