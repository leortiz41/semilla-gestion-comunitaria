-- Semilla: compromisos, entregas y asignaciones de brigadas por proyecto.
-- Aplicar tras 020. No modifica avances físicos ni porcentajes validados.
BEGIN;

CREATE TABLE brigadas_recursos_proyecto (
  brigada_id UUID NOT NULL,
  proyecto_id UUID NOT NULL,
  monto_comprometido NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monto_comprometido >= 0),
  monto_recibido NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monto_recibido >= 0 AND monto_recibido <= monto_comprometido),
  voluntarios_previstos INTEGER NOT NULL DEFAULT 0 CHECK (voluntarios_previstos >= 0),
  materiales_comprometidos TEXT,
  materiales_entregados TEXT,
  observaciones TEXT,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (brigada_id, proyecto_id),
  FOREIGN KEY (brigada_id, proyecto_id)
    REFERENCES brigadas_donantes_proyectos (brigada_id, proyecto_id) ON DELETE CASCADE
);

CREATE TABLE brigadas_actividades_proyecto (
  brigada_id UUID NOT NULL,
  proyecto_id UUID NOT NULL,
  actividad_id UUID NOT NULL REFERENCES actividades_programadas(id) ON DELETE CASCADE,
  PRIMARY KEY (brigada_id, proyecto_id, actividad_id),
  FOREIGN KEY (brigada_id, proyecto_id)
    REFERENCES brigadas_donantes_proyectos (brigada_id, proyecto_id) ON DELETE CASCADE
);

CREATE INDEX idx_brigadas_recursos_proyecto_proyecto ON brigadas_recursos_proyecto(proyecto_id);
CREATE INDEX idx_brigadas_actividades_proyecto_actividad ON brigadas_actividades_proyecto(actividad_id);
COMMIT;
