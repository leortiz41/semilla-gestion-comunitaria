-- 036: Identidad visual y opciones documentales por organización (Neon Development).
CREATE TABLE IF NOT EXISTS configuraciones_institucionales (
 organizacion_id UUID PRIMARY KEY REFERENCES organizaciones(id) ON DELETE CASCADE,
 nombre_publico VARCHAR(150),
 lema VARCHAR(240),
 bienvenida_titulo VARCHAR(160),
 bienvenida_texto VARCHAR(500),
 color_primario CHAR(7) NOT NULL DEFAULT '#2D7545',
 color_secundario CHAR(7) NOT NULL DEFAULT '#D98B36',
 color_fondo CHAR(7) NOT NULL DEFAULT '#F5F8F2',
 logo_base64 TEXT,
 logo_tipo VARCHAR(20),
 pdf_papel VARCHAR(10) NOT NULL DEFAULT 'A4' CHECK (pdf_papel IN ('A4','LETTER','LEGAL')),
 pdf_orientacion VARCHAR(12) NOT NULL DEFAULT 'portrait' CHECK (pdf_orientacion IN ('portrait','landscape')),
 pdf_margen_mm SMALLINT NOT NULL DEFAULT 18 CHECK (pdf_margen_mm BETWEEN 8 AND 35),
 pdf_mostrar_logo BOOLEAN NOT NULL DEFAULT TRUE,
 pdf_mostrar_lema BOOLEAN NOT NULL DEFAULT TRUE,
 actualizado_por_usuario_id UUID REFERENCES usuarios(id),
 actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT identidad_logo_tipo_valido CHECK (logo_tipo IS NULL OR logo_tipo IN ('image/png','image/jpeg','image/webp')),
 CONSTRAINT identidad_logo_pareja CHECK ((logo_base64 IS NULL) = (logo_tipo IS NULL)),
 CONSTRAINT identidad_logo_tamano CHECK (logo_base64 IS NULL OR length(logo_base64) <= 280000),
 CONSTRAINT identidad_color_valido CHECK (
   color_primario ~ '^#[0-9A-Fa-f]{6}$' AND
   color_secundario ~ '^#[0-9A-Fa-f]{6}$' AND
   color_fondo ~ '^#[0-9A-Fa-f]{6}$'
 )
);
COMMENT ON TABLE configuraciones_institucionales IS 'Preferencias visuales y PDF independientes por tenant. Logo compacto embebido, no utilizado como documento probatorio.';
