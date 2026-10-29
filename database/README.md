# Base de datos de Semilla

Este directorio contiene la documentación y los artefactos de PostgreSQL para **Semilla - Gestión Comunitaria**.

## Estado actual

- PostgreSQL desplegado en Neon.
- Rama `production` reservada para producción.
- Rama `development` utilizada para desarrollo.
- 37 tablas relacionadas creadas y normalizadas según el dominio funcional.
- UUID utilizados como claves primarias en las entidades principales.
- Prisma 7 integrado en el backend.
- Auditoría, seguridad y sincronización offline contempladas desde el diseño.

## Convención de nombres

A partir de esta etapa, el modelo de negocio se manejará en **español** para mantener consistencia con el dominio, la documentación y el equipo del proyecto.

Reglas principales:

- Tablas: plural y `snake_case`, por ejemplo `usuarios`, `objetivos_estrategicos` y `movimientos_recursos`.
- Campos: español y `snake_case`, por ejemplo `creado_en`, `fecha_inicio` y `usuario_responsable_id`.
- Sin tildes, espacios ni caracteres especiales en identificadores SQL.
- Claves foráneas terminan en `_id`.
- Se conservan términos técnicos universales como `id`, `UUID`, `email`, `URL` y `JSON` cuando mejoran la claridad.
- En Prisma se buscará utilizar modelos en singular y PascalCase, manteniendo el mapeo a las tablas físicas en español cuando sea necesario.

## Scripts SQL

```text
database/sql/
├── 001_esquema_inicial.sql
└── 002_renombrar_esquema_espanol.sql
```

### 001_esquema_inicial.sql

Crea la primera versión relacional de Semilla con 37 tablas, relaciones, restricciones, índices y datos base.

### 002_renombrar_esquema_espanol.sql

Migración no destructiva que cambia los nombres de las tablas y campos del esquema inicial al español. PostgreSQL conserva las relaciones, claves foráneas y datos existentes durante los renombrados.

## Flujo actual

1. Desarrollar y probar cambios sobre Neon `development`.
2. Aplicar scripts o migraciones sobre `development`.
3. Ejecutar `prisma db pull` para sincronizar Prisma con PostgreSQL cuando corresponda.
4. Ejecutar `prisma generate`.
5. Validar el backend con `npm run build` y las pruebas de conexión.
6. Llevar a producción únicamente los cambios validados mediante Pull Request.

## Estructura

```text
database/
├── sql/
├── diagrams/
└── seed/
```
