BEGIN;

ALTER TABLE brigadas_donantes ADD COLUMN zona_id UUID REFERENCES zonas(id);

CREATE TABLE brigadas_donantes_comunidades (
    brigada_id UUID NOT NULL REFERENCES brigadas_donantes(id) ON DELETE CASCADE,
    comunidad_id UUID NOT NULL REFERENCES comunidades(id),
    PRIMARY KEY (brigada_id, comunidad_id)
);

INSERT INTO brigadas_donantes_comunidades (brigada_id, comunidad_id)
SELECT b.id, c.id
FROM brigadas_donantes b
JOIN donantes d ON d.id = b.donante_id
JOIN comunidades c ON c.id = b.comunidad_id AND c.organizacion_id = d.organizacion_id;

UPDATE brigadas_donantes b
SET zona_id = z.id
FROM brigadas_donantes_comunidades bc
JOIN comunidades c ON c.id = bc.comunidad_id
JOIN zonas z ON z.id = c.zona_id AND z.organizacion_id = c.organizacion_id
WHERE bc.brigada_id = b.id;

COMMIT;
