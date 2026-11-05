-- Validación manual no destructiva del aislamiento territorial multi-organización.
-- No es una migración. Todos los cambios de prueba se revierten al finalizar.
-- Requiere 003_multi_organizacion_base.sql y 004_aislamiento_territorial.sql.

BEGIN;

DO $$
DECLARE
  organizacion_a UUID;
  organizacion_b UUID;
  zona_a UUID;
  zona_b UUID;
  bloqueo_cruzado_confirmado BOOLEAN := FALSE;
BEGIN
  SELECT id
    INTO organizacion_a
    FROM organizaciones
   WHERE slug = 'ministerio-sal-y-luz'
   LIMIT 1;

  IF organizacion_a IS NULL THEN
    RAISE EXCEPTION 'No existe Ministerio Sal y Luz. Ejecute primero la migración 003.';
  END IF;

  INSERT INTO organizaciones (nombre, slug, descripcion, activo)
  VALUES (
    'ONG Prueba Aislamiento',
    'ong-prueba-aislamiento',
    'Registro temporal utilizado únicamente para validar el aislamiento multi-organización.',
    TRUE
  )
  ON CONFLICT (slug) DO UPDATE
     SET nombre = EXCLUDED.nombre,
         activo = TRUE,
         actualizado_en = NOW()
  RETURNING id INTO organizacion_b;

  INSERT INTO zonas (organizacion_id, nombre, descripcion, activo)
  VALUES (organizacion_a, '__Zona prueba Sal y Luz__', 'Temporal', TRUE)
  RETURNING id INTO zona_a;

  INSERT INTO zonas (organizacion_id, nombre, descripcion, activo)
  VALUES (organizacion_b, '__Zona prueba ONG B__', 'Temporal', TRUE)
  RETURNING id INTO zona_b;

  -- Caso permitido: comunidad y zona pertenecen a la misma organización.
  INSERT INTO comunidades (
    organizacion_id,
    zona_id,
    nombre,
    municipio,
    departamento,
    activo
  ) VALUES (
    organizacion_b,
    zona_b,
    '__Comunidad válida ONG B__',
    '__Municipio prueba__',
    '__Departamento prueba__',
    TRUE
  );

  -- Caso prohibido: la comunidad de ONG B intenta usar una zona de Sal y Luz.
  BEGIN
    INSERT INTO comunidades (
      organizacion_id,
      zona_id,
      nombre,
      municipio,
      departamento,
      activo
    ) VALUES (
      organizacion_b,
      zona_a,
      '__Comunidad cruzada no permitida__',
      '__Municipio prueba__',
      '__Departamento prueba__',
      TRUE
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      bloqueo_cruzado_confirmado := TRUE;
      RAISE NOTICE 'Correcto: PostgreSQL bloqueó la relación Comunidad ONG B -> Zona Sal y Luz.';
  END;

  IF NOT bloqueo_cruzado_confirmado THEN
    RAISE EXCEPTION 'ERROR DE AISLAMIENTO: PostgreSQL permitió una relación territorial entre organizaciones distintas.';
  END IF;

  RAISE NOTICE 'Validación completada: el aislamiento territorial funciona a nivel de base de datos.';
END $$;

ROLLBACK;
