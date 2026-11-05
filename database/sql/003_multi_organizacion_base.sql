-- Semilla - Fase 1 de arquitectura multi-organización
-- Issue #19
-- Objetivo: crear la organización inicial y vincular cada usuario a una organización.

BEGIN;

CREATE TABLE IF NOT EXISTS organizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(180) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    nombre_legal VARCHAR(220),
    email_contacto VARCHAR(150),
    telefono_contacto VARCHAR(40),
    pais VARCHAR(100) NOT NULL DEFAULT 'Honduras',
    moneda VARCHAR(10) NOT NULL DEFAULT 'HNL',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO organizaciones (nombre, slug, nombre_legal, pais, moneda)
VALUES (
    'Ministerio Sal y Luz',
    'ministerio-sal-y-luz',
    'Ministerio Sal y Luz',
    'Honduras',
    'HNL'
)
ON CONFLICT (slug) DO UPDATE
SET nombre = EXCLUDED.nombre,
    nombre_legal = EXCLUDED.nombre_legal,
    actualizado_en = NOW();

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS organizacion_id UUID;

UPDATE usuarios
SET organizacion_id = (
    SELECT id
    FROM organizaciones
    WHERE slug = 'ministerio-sal-y-luz'
    LIMIT 1
)
WHERE organizacion_id IS NULL;

ALTER TABLE usuarios
    ALTER COLUMN organizacion_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_usuarios_organizacion'
    ) THEN
        ALTER TABLE usuarios
            ADD CONSTRAINT fk_usuarios_organizacion
            FOREIGN KEY (organizacion_id)
            REFERENCES organizaciones(id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_usuarios_organizacion_id
    ON usuarios(organizacion_id);

COMMIT;
