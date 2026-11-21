-- 026: Expediente social/habitacional de familias.
-- Aditiva e idempotente. NO aplicar automáticamente a production.
-- Preserva las entidades familias, miembros_familia y perfiles_familia.
ALTER TABLE perfiles_familia
  ADD COLUMN IF NOT EXISTS condicion_terreno VARCHAR(120),
  ADD COLUMN IF NOT EXISTS tiene_electricidad BOOLEAN,
  ADD COLUMN IF NOT EXISTS tiene_agua BOOLEAN,
  ADD COLUMN IF NOT EXISTS tiene_pila BOOLEAN,
  ADD COLUMN IF NOT EXISTS tiene_fosa BOOLEAN,
  ADD COLUMN IF NOT EXISTS estado_civil VARCHAR(80),
  ADD COLUMN IF NOT EXISTS telefono_contacto VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fuente_ingresos VARCHAR(200),
  ADD COLUMN IF NOT EXISTS responsable_registro_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revisado_por_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_revision TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_revision TEXT;

CREATE TABLE IF NOT EXISTS documentos_familia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id UUID NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  perfil_id UUID REFERENCES perfiles_familia(id) ON DELETE SET NULL,
  tipo_documento VARCHAR(80) NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  archivo_clave TEXT NOT NULL UNIQUE,
  tipo_mime VARCHAR(40) NOT NULL DEFAULT 'application/pdf'
    CHECK (tipo_mime = 'application/pdf'),
  tamano_bytes INTEGER NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 10485760),
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE','APROBADO','RECHAZADO')),
  observaciones TEXT,
  cargado_por_usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  revisado_por_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  revisado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documentos_familia_familia
  ON documentos_familia (familia_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_documentos_familia_perfil
  ON documentos_familia (perfil_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_familia_estado
  ON perfiles_familia (estado, fecha_perfil DESC);

COMMENT ON TABLE documentos_familia IS
  'Metadatos de PDF privados; el contenido reside en Cloudflare R2 y NO es visible para DONANTE.';
