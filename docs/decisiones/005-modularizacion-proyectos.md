# ADR 005 — Separación multicapa del módulo Proyectos

**Estado:** Aceptada como implementación en `develop`, pendiente de aceptación funcional antes de `main`. **Fecha:** 22/11/2026.

## Contexto
En el monolito Express de Semilla, el archivo de rutas de Proyectos combinaba HTTP, acceso a datos, coordinación de evidencias R2 y las transacciones de presupuestos, donantes, actividades y auditoría. Esta mezcla dificultaba el mantenimiento y la revisión de aislamiento multitenant.

## Decisión
Migración incremental sin cambiar `/api/proyectos`, payloads ni SQL de negocio:
- **`proyectos.routes.ts`** conserva endpoints, middleware de permisos, validación del cuerpo y traducción de errores HTTP.
- **`avances-actividad.service.ts`** mantiene el cálculo ponderado del resultado, la coordinación de avances y las funciones públicas de aplicación.
- **`avances-actividad.domain.ts`** conserva la validación de avances.
- **`proyectos.repository.ts`** contiene las consultas de listado, responsables, índices y evidencias, las escrituras de actividades y los procedimientos transaccionales de proyectos y fotografías.
- **`avances-actividad.repository.ts`** contiene las sentencias SQL atómicas para listar, registrar, revisar y corregir avances.
- Se mantienen los adaptadores `export *` en las rutas, servicios y dominios anteriores para no romper consumidores.

El identificador `organizacionId` siempre viene de la sesión autenticada y se pasa explícitamente a persistencia. Se conservan `FOR UPDATE`, `BEGIN/COMMIT/ROLLBACK`, auditoría, idempotencia de fotografías, restricciones de presupuesto y prohibición de autorrevisión salvo excepción autorizada.

## Límites
La arquitectura sigue siendo un solo backend desplegable. Las rutas de evidencias aún coordinan la subida y firma R2 desde un servicio compartido, y los módulos de Mapa de Impacto y Donantes tienen su propio alcance. El trabajo no aplica migraciones SQL ni crea nuevas bases de datos.

## Pruebas y aceptación
- Compilar TypeScript; ejecutar toda la suite de backend y el CI de frontend.
- Pruebas de repositorios con consultas filtradas por tenant, presupuesto, auditoría, control de estados, reintentos idempotentes y rollback.
- Validar manualmente, en la base de desarrollo, CRUD de proyectos y actividades, avances, revisión, evidencias y visibilidad entre organizaciones.
- No integrar el PR en producción hasta confirmar esta aceptación funcional.

## Evolución
El siguiente módulo funcional será `donantes`, en un PR independiente una vez consolidada la validación de Proyectos.
