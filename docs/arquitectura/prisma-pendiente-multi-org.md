# Alineación pendiente de Prisma para multi-organización

Este documento deja registrado temporalmente el trabajo pendiente de sincronizar `backend/prisma/schema.prisma` con las migraciones SQL `003_multi_organizacion_base.sql` y `004_aislamiento_territorial.sql`.

No debe considerarse una sustitución del esquema Prisma. Su propósito es evitar que la diferencia entre la base de datos objetivo y el archivo Prisma quede implícita durante la transición incremental del issue #19.

## Cambios que Prisma debe reflejar

### Nueva entidad `organizaciones`

Campos principales:

- `id`
- `nombre`
- `slug`
- `descripcion`
- `logo_url`
- `activo`
- `creado_en`
- `actualizado_en`

Relaciones iniciales:

- organización → usuarios
- organización → zonas
- organización → comunidades

### `usuarios`

Agregar:

- `organizacion_id UUID NOT NULL`
- relación hacia `organizaciones`
- índice por `organizacion_id`

### `zonas`

Agregar:

- `organizacion_id UUID NOT NULL`
- relación hacia `organizaciones`
- unicidad de nombre dentro de la organización, no global
- índice por organización

### `comunidades`

Agregar:

- `organizacion_id UUID NOT NULL`
- relación hacia `organizaciones`
- unicidad de nombre/municipio/departamento dentro de la organización
- relación territorial que garantice que comunidad y zona sean de la misma organización

## Regla

Antes de considerar terminada la fase multi-organización, `schema.prisma` debe quedar alineado con la estructura real aplicada en PostgreSQL.
