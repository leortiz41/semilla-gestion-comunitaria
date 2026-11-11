BEGIN;

ALTER TABLE actividades_programadas
    ALTER COLUMN equipo_misionero_id DROP NOT NULL;

COMMIT;
