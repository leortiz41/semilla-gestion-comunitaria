-- HU-12.5: permitir revisión propia autorizada en el backend.
-- Ejecutar en Neon development después de 020; no altera registros históricos.
BEGIN;

ALTER TABLE avances_proyecto
  DROP CONSTRAINT chk_avances_estado_revision;

ALTER TABLE avances_proyecto
  ADD CONSTRAINT chk_avances_estado_revision CHECK (
    (estado_revision IN ('BORRADOR', 'ENVIADO')
      AND revisor_usuario_id IS NULL AND revisado_en IS NULL)
    OR
    (estado_revision = 'VALIDADO'
      AND revisor_usuario_id IS NOT NULL AND revisado_en IS NOT NULL
      AND responsable_usuario_id IS NOT NULL AND motivo_devolucion IS NULL)
    OR
    (estado_revision = 'DEVUELTO'
      AND revisor_usuario_id IS NOT NULL AND revisado_en IS NOT NULL
      AND responsable_usuario_id IS NOT NULL
      AND motivo_devolucion IS NOT NULL AND btrim(motivo_devolucion) <> '')
  );

COMMIT;
