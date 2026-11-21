-- 032: Trazabilidad de solicitudes y pagos. Aditiva, Development.
ALTER TABLE solicitudes_pago
  ADD COLUMN IF NOT EXISTS solicitado_por_usuario_id UUID REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS revisado_por_usuario_id UUID REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS revisado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_revision TEXT;
ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS registrado_por_usuario_id UUID REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS confirmado_por_usuario_id UUID REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS confirmado_en TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_solicitudes_pago_proyecto_estado ON solicitudes_pago(proyecto_id,estado);
CREATE INDEX IF NOT EXISTS idx_pagos_solicitud_estado ON pagos(solicitud_pago_id,estado_pago);
-- Quien solicita no puede aprobar su propia solicitud: se comprueba en la API,
-- al igual que el saldo y la autorización por organización.
