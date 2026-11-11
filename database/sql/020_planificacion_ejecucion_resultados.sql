BEGIN;

ALTER TABLE actividades_programadas
    ADD COLUMN responsable_asignado_usuario_id UUID,
    ADD COLUMN meta_cantidad NUMERIC(14,3),
    ADD COLUMN unidad_medida VARCHAR(80),
    ADD COLUMN presupuesto_estimado NUMERIC(14,2),
    ADD COLUMN peso_resultado NUMERIC(5,2),
    ADD CONSTRAINT fk_actividades_responsable_asignado
        FOREIGN KEY (responsable_asignado_usuario_id)
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    ADD CONSTRAINT chk_actividades_meta_unidad
        CHECK (
            (meta_cantidad IS NULL AND unidad_medida IS NULL)
            OR (meta_cantidad > 0 AND unidad_medida IS NOT NULL AND btrim(unidad_medida) <> '')
        ),
    ADD CONSTRAINT chk_actividades_presupuesto_estimado
        CHECK (presupuesto_estimado IS NULL OR presupuesto_estimado >= 0),
    ADD CONSTRAINT chk_actividades_peso_resultado
        CHECK (peso_resultado IS NULL OR peso_resultado BETWEEN 0 AND 100);

ALTER TABLE avances_proyecto
    ALTER COLUMN porcentaje_avance DROP NOT NULL,
    ADD COLUMN clave_idempotencia UUID,
    ADD COLUMN cantidad_reportada NUMERIC(14,3),
    ADD COLUMN observaciones TEXT,
    ADD COLUMN estado_revision VARCHAR(20) NOT NULL DEFAULT 'ENVIADO',
    ADD COLUMN revisor_usuario_id UUID,
    ADD COLUMN revisado_en TIMESTAMPTZ,
    ADD COLUMN motivo_devolucion TEXT,
    ADD CONSTRAINT fk_avances_revisor_usuario
        FOREIGN KEY (revisor_usuario_id)
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    ADD CONSTRAINT chk_avances_cantidad_reportada
        CHECK (cantidad_reportada IS NULL OR cantidad_reportada > 0),
    ADD CONSTRAINT chk_avances_un_solo_tipo_de_resultado
        CHECK ((cantidad_reportada IS NULL) <> (porcentaje_avance IS NULL)),
    ADD CONSTRAINT chk_avances_estado_revision
        CHECK (
            (estado_revision IN ('BORRADOR', 'ENVIADO')
                AND revisor_usuario_id IS NULL AND revisado_en IS NULL)
            OR
            (estado_revision = 'VALIDADO'
                AND revisor_usuario_id IS NOT NULL AND revisado_en IS NOT NULL
                AND responsable_usuario_id IS NOT NULL
                AND revisor_usuario_id <> responsable_usuario_id
                AND motivo_devolucion IS NULL)
            OR
            (estado_revision = 'DEVUELTO'
                AND revisor_usuario_id IS NOT NULL AND revisado_en IS NOT NULL
                AND responsable_usuario_id IS NOT NULL
                AND revisor_usuario_id <> responsable_usuario_id
                AND motivo_devolucion IS NOT NULL AND btrim(motivo_devolucion) <> '')
        );

ALTER TABLE avances_proyecto
    ALTER COLUMN estado_revision SET DEFAULT 'BORRADOR';

INSERT INTO bitacora_auditoria (
    accion, nombre_entidad, entidad_id, valores_anteriores, valores_nuevos
)
SELECT
    'MIGRACION_HU12_LEGACY_ENVIADO',
    'avances_proyecto',
    id,
    jsonb_build_object(
        'porcentaje_avance', porcentaje_avance,
        'fecha_avance', fecha_avance,
        'comentarios', comentarios
    ),
    jsonb_build_object(
        'estado_revision', 'ENVIADO',
        'motivo', 'Registro previo al flujo de revisión HU-12; requiere revisión antes de consolidar resultados.'
    )
FROM avances_proyecto;

CREATE UNIQUE INDEX uq_avances_clave_idempotencia
    ON avances_proyecto (clave_idempotencia);

CREATE INDEX IF NOT EXISTS idx_avances_responsable_usuario_id
    ON avances_proyecto (responsable_usuario_id);

CREATE INDEX idx_avances_estado_actividad
    ON avances_proyecto (estado_revision, actividad_id);

INSERT INTO permisos (codigo, modulo, descripcion)
VALUES
    ('actividades.avance.revisar', 'proyectos', 'Revisar, validar o devolver avances de actividad'),
    ('actividades.avance.corregir', 'proyectos', 'Corregir explícitamente un avance validado con trazabilidad')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('ADMINISTRADOR', 'COORDINADOR')
  AND p.codigo = 'actividades.avance.revisar'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'ADMINISTRADOR'
  AND p.codigo = 'actividades.avance.corregir'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

COMMIT;
