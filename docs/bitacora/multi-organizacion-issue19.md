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

### Fase siguiente

- Clasificar las tablas en globales y pertenecientes a una organización.
- Agregar `organizacion_id` primero a las entidades raíz, especialmente zonas, comunidades, proyectos y datos financieros.
- Modificar servicios del backend para filtrar por `req.auth.organizacionId`.
- Agregar pruebas de acceso cruzado entre organizaciones.
- Actualizar el esquema Prisma para reflejar la nueva estructura.

## Commits de esta fase

- `8e0deb8` - `db: crear base multi-organizacion`
- `87e425a` - `backend: incluir organizacion en token de acceso`
- `05be170` - `backend: cargar organizacion activa en autenticacion`
- `515da9c` - `frontend: reconocer organizacion de la sesion`

## Estado del issue

El issue #19 permanece abierto porque todavía falta aplicar el aislamiento organizacional a las entidades y consultas del dominio y validar que no exista acceso cruzado entre organizaciones.
