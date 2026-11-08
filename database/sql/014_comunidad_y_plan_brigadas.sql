BEGIN;

ALTER TABLE brigadas_donantes
    ADD COLUMN comunidad_id UUID REFERENCES comunidades(id),
    ADD COLUMN lista_actividades TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN lista_contrataciones TEXT[] NOT NULL DEFAULT '{}';

UPDATE brigadas_donantes
SET lista_actividades = CASE WHEN NULLIF(trim(actividades), '') IS NULL
        THEN '{}'::text[] ELSE ARRAY[actividades] END,
    lista_contrataciones = CASE WHEN NULLIF(trim(contrataciones), '') IS NULL
        THEN '{}'::text[] ELSE ARRAY[contrataciones] END;

UPDATE brigadas_donantes b
SET comunidad_id = p.comunidad_id
FROM proyectos p JOIN comunidades c ON c.id = p.comunidad_id, donantes d
WHERE b.proyecto_id = p.id AND b.donante_id = d.id AND d.organizacion_id = c.organizacion_id;

CREATE INDEX idx_brigadas_comunidad ON brigadas_donantes(comunidad_id);

COMMIT;
