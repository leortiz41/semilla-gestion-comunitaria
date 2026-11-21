-- 031: Tipos adicionales de proveedores configurables por organización.
-- Se conservan los cuatro códigos originales para no alterar registros anteriores.
CREATE TABLE IF NOT EXISTS tipos_proveedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  nombre VARCHAR(80) NOT NULL,
  descripcion VARCHAR(240),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tipos_proveedor_nombre_no_vacio CHECK (length(trim(nombre)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tipos_proveedor_organizacion_nombre
  ON tipos_proveedor (organizacion_id, lower(trim(nombre)));
CREATE INDEX IF NOT EXISTS idx_tipos_proveedor_organizacion
  ON tipos_proveedor (organizacion_id, activo);
ALTER TABLE proveedores DROP CONSTRAINT IF EXISTS proveedores_tipo_check;
ALTER TABLE proveedores ADD CONSTRAINT proveedores_tipo_no_vacio
  CHECK (tipo IS NOT NULL AND length(trim(tipo)) > 0 AND length(tipo) <= 30);
-- La validez del código personalizado y su pertenencia a la organización se comprueba en la API.
