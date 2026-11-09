BEGIN;

ALTER TABLE actividades_programadas
    ADD CONSTRAINT uq_actividades_id_proyecto UNIQUE (id, proyecto_id);

ALTER TABLE avances_proyecto
    ADD COLUMN actividad_id UUID,
    ADD COLUMN responsable_usuario_id UUID;

ALTER TABLE avances_proyecto
    ADD CONSTRAINT fk_avances_actividad_proyecto
        FOREIGN KEY (actividad_id, proyecto_id)
        REFERENCES actividades_programadas(id, proyecto_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    ADD CONSTRAINT fk_avances_responsable_usuario
        FOREIGN KEY (responsable_usuario_id)
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    ADD CONSTRAINT chk_avances_actividad_datos
        CHECK (
            actividad_id IS NULL
            OR (
                responsable_usuario_id IS NOT NULL
                AND comentarios IS NOT NULL
                AND btrim(comentarios) <> ''
            )
        );

CREATE INDEX idx_avances_actividad_fecha
    ON avances_proyecto (actividad_id, proyecto_id, fecha_avance DESC, creado_en DESC);

CREATE INDEX idx_avances_responsable_usuario_id
    ON avances_proyecto (responsable_usuario_id);

INSERT INTO permisos (codigo, modulo, descripcion)
VALUES (
    'actividades.avance.gestionar',
    'proyectos',
    'Registrar avances de ejecución por actividad'
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('ADMINISTRADOR', 'COORDINADOR', 'CAMPO')
  AND p.codigo = 'actividades.avance.gestionar'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

COMMIT;
