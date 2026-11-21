-- 033: Editor de contratos. Sólo añadir en la rama Neon Development.
-- Los contratos son documentos en borrador, no equivalen a contratos firmados.
CREATE TABLE IF NOT EXISTS plantillas_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  nombre VARCHAR(160) NOT NULL,
  contenido JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por_usuario_id UUID NOT NULL REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organizacion_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_plantillas_contrato_org ON plantillas_contrato(organizacion_id, activo);
CREATE TABLE IF NOT EXISTS contratos_documento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE RESTRICT,
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE RESTRICT,
  proveedor_id UUID REFERENCES proveedores(id) ON DELETE RESTRICT,
  personal_contratado_id UUID REFERENCES personal_contratado(id) ON DELETE RESTRICT,
  plantilla_id UUID REFERENCES plantillas_contrato(id) ON DELETE SET NULL,
  titulo VARCHAR(180) NOT NULL,
  contenido JSONB NOT NULL,
  estado VARCHAR(24) NOT NULL DEFAULT 'BORRADOR' CHECK(estado IN ('BORRADOR','EN_REVISION','APROBADO','ANULADO')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  creado_por_usuario_id UUID NOT NULL REFERENCES usuarios(id),
  actualizado_por_usuario_id UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contrato_un_beneficiario CHECK (
    (proveedor_id IS NOT NULL AND personal_contratado_id IS NULL) OR
    (proveedor_id IS NULL AND personal_contratado_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_contratos_documento_org_proyecto ON contratos_documento(organizacion_id, proyecto_id);
CREATE TABLE IF NOT EXISTS contratos_documento_versiones (
  contrato_id UUID NOT NULL REFERENCES contratos_documento(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  contenido JSONB NOT NULL,
  guardado_por_usuario_id UUID NOT NULL REFERENCES usuarios(id),
  guardado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contrato_id, version)
);
COMMENT ON TABLE contratos_documento IS 'Borradores editables; no constituyen documentos legales firmados ni autorizan pagos.';
