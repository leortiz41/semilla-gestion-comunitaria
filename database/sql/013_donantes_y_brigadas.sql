BEGIN;

CREATE TABLE donantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id UUID NOT NULL REFERENCES organizaciones(id),
    nombre VARCHAR(180) NOT NULL CHECK (length(trim(nombre)) > 0),
    correo VARCHAR(150) NOT NULL,
    telefono VARCHAR(50),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_donantes_organizacion ON donantes(organizacion_id);

CREATE TABLE brigadas_donantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donante_id UUID NOT NULL REFERENCES donantes(id),
    proyecto_id UUID REFERENCES proyectos(id),
    lider VARCHAR(180) NOT NULL CHECK (length(trim(lider)) > 0),
    miembros INTEGER NOT NULL CHECK (miembros > 0),
    fecha_llegada DATE,
    fecha_salida DATE,
    actividades TEXT,
    contrataciones TEXT,
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fecha_salida IS NULL OR (fecha_llegada IS NOT NULL AND fecha_salida >= fecha_llegada))
);

CREATE INDEX idx_brigadas_donante ON brigadas_donantes(donante_id);

COMMIT;
