BEGIN;

CREATE TABLE proyectos_donantes (
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, proyecto_id)
);

ALTER TABLE evidencias
    ADD COLUMN visible_para_donantes BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
