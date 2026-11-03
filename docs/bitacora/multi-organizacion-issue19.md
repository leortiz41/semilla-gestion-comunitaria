# Bitácora - Issue #19 Multi-organización

## Objetivo

Preparar Semilla para que varias organizaciones puedan utilizar la misma aplicación manteniendo aislados sus usuarios y datos. Ministerio Sal y Luz se mantiene como la primera organización de referencia.

## Fase 1 - Contexto de organización en autenticación

Esta primera fase se concentra en establecer la identidad organizacional del usuario autenticado antes de aplicar el aislamiento a todas las tablas del dominio.

### Cambios implementados

1. Se creó `database/sql/003_multi_organizacion_base.sql`.
2. Se definió la tabla `organizaciones`.
3. Se agregó la organización inicial `Ministerio Sal y Luz` con slug `ministerio-sal-y-luz`.
4. Se agregó `organizacion_id` a `usuarios`.
5. Los usuarios existentes se asignan inicialmente a Ministerio Sal y Luz durante la migración.
6. Se agregó la relación de clave foránea entre `usuarios.organizacion_id` y `organizaciones.id`.
7. El JWT de acceso ahora incorpora `organizacionId`.
8. Los flujos de login, refresh y `/me` cargan la organización activa directamente desde la base de datos.
9. El frontend reconoce la organización como parte de la sesión del usuario.

## Decisión de seguridad

El identificador de la organización no se tomará de parámetros arbitrarios enviados por el frontend para autorizar consultas. El contexto se obtiene desde el usuario autenticado y se incorpora al token de acceso.

Flujo:

```text
Usuario
   ↓
Login
   ↓
Base de datos
   ↓
Organización asociada al usuario
   ↓
JWT con organizacionId
   ↓
req.auth.organizacionId
   ↓
Servicios y consultas filtradas por organización
```

## Decisión de implementación incremental

No se agregó `organizacion_id` a todas las tablas en el mismo cambio. La implementación se divide para mantener commits pequeños, validables y fáciles de revertir.

## Fase 2 - Aislamiento territorial

La segunda fase comienza por las entidades territoriales porque Comunidades será el primer módulo funcional que pasará de datos visuales a persistencia real.

### Cambios implementados

1. Se creó `database/sql/004_aislamiento_territorial.sql`.
2. Se agregó `organizacion_id` a `zonas`.
3. Se agregó `organizacion_id` a `comunidades`.
4. Los registros existentes se asignan a Ministerio Sal y Luz durante la migración.
5. La unicidad de zonas pasa de global a organizacional.
6. La unicidad de comunidades pasa de global a organizacional.
7. PostgreSQL impide que una comunidad quede vinculada a una zona perteneciente a otra organización.
8. Se agregaron índices por `organizacion_id` para las consultas territoriales.
9. El resumen del Dashboard ahora filtra las comunidades mediante `req.auth.organizacionId`.
10. Se documentó la clasificación entre tablas globales, directamente organizacionales y aisladas por relación en `docs/arquitectura/multi-organizacion.md`.

### Ejemplo de aislamiento

Dos organizaciones pueden registrar una zona llamada `Zona 1` sin entrar en conflicto:

```text
Ministerio Sal y Luz
└── Zona 1

ONG Early Adopter
└── Zona 1
```

La unicidad se evalúa dentro de cada organización, no en toda la plataforma.

### Regla reforzada en base de datos

No dependemos únicamente del frontend o del backend para evitar cruces territoriales. La propia base de datos valida que:

```text
Comunidad.organizacion_id = Zona.organizacion_id
```

Esto reduce el riesgo de contaminación de información entre ONG por un error de programación posterior.

## Clasificación arquitectónica

Se definió como regla que los módulos nuevos —Donantes, Donaciones, Asignaciones, Territorio, Evidencias y portales externos— deben construirse desde el inicio bajo contexto multi-organización.

Los catálogos técnicos como `permisos` y `parentescos` pueden mantenerse globales, mientras que usuarios, territorio, personas, proveedores, proyectos y datos operativos deben quedar aislados.

## Commits registrados

### Fase 1

- `8e0deb8` - `db: crear base multi-organizacion`
- `87e425a` - `backend: incluir organizacion en token de acceso`
- `05be170` - `backend: cargar organizacion activa en autenticacion`
- `515da9c` - `frontend: reconocer organizacion de la sesion`

### Fase 2

- `df40c44` - `db: aislar zonas y comunidades por organizacion`
- `2fd0fc3` - `backend: filtrar dashboard por organizacion`
- `e0b41c3` - `backend: usar organizacion autenticada en dashboard`
- `36d5c07` - `docs: definir alcance multi-organizacion por tabla`

## Pendiente del issue #19

El issue permanece abierto. Todavía falta:

- alinear completamente `schema.prisma` con las nuevas columnas y relaciones;
- aplicar aislamiento a personas, proveedores, equipos misioneros, proyectos y auditoría;
- revisar las entidades dependientes;
- crear una segunda organización de prueba;
- probar explícitamente intentos de acceso cruzado;
- validar los scripts en Neon y el backend desplegado;
- actualizar las bitácoras académicas al cerrar el bloque.
