-- 030: Proveedores y contratistas por organización.
-- Desarrollo. Revisar datos existentes antes de aplicar en producción.
-- La tabla en Neon Development estaba vacía cuando se preparó esta migración.
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS tipo VARCHAR(30) NOT NULL DEFAULT 'PROVEEDOR'
  CHECK (tipo IN ('PROVEEDOR','CONTRATISTA','SERVICIOS','PROFESIONAL'));
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);
-- Requiere atribuir previamente toda fila existente a su organización.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM proveedores WHERE organizacion_id IS NULL) THEN
   RAISE EXCEPTION 'Existen proveedores sin organización. No se migrarán automáticamente.';
 END IF;
END $$;
ALTER TABLE proveedores ALTER COLUMN organizacion_id SET NOT NULL;
ALTER TABLE proveedores DROP CONSTRAINT IF EXISTS proveedores_rtn_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_proveedores_org_rtn
 ON proveedores(organizacion_id, rtn) WHERE rtn IS NOT NULL AND trim(rtn) <> '';
CREATE INDEX IF NOT EXISTS idx_proveedores_organizacion_tipo
 ON proveedores(organizacion_id,tipo,activo);
