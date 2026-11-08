BEGIN;

CREATE TABLE proyectos_fichas_donantes (
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    donante_id UUID NOT NULL REFERENCES donantes(id) ON DELETE CASCADE,
    PRIMARY KEY (proyecto_id, donante_id)
);

CREATE INDEX idx_proyectos_fichas_donante ON proyectos_fichas_donantes(donante_id);

CREATE TABLE brigadas_donantes_proyectos (
    brigada_id UUID NOT NULL REFERENCES brigadas_donantes(id) ON DELETE CASCADE,
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    PRIMARY KEY (brigada_id, proyecto_id)
);

CREATE INDEX idx_brigadas_proyectos_proyecto ON brigadas_donantes_proyectos(proyecto_id);

INSERT INTO brigadas_donantes_proyectos (brigada_id, proyecto_id)
SELECT id, proyecto_id FROM brigadas_donantes WHERE proyecto_id IS NOT NULL;

COMMIT;
