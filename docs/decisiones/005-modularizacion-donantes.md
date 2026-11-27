# ADR 005 — Modularización incremental de Donantes y brigadas

**Estado:** En implementación. **Fecha:** 22/11/2026.

## Contexto
El backend Semilla es un monolito Express multi-organización. El módulo Donantes agrupa portal del donante, administración de fichas, brigadas, accesos a proyectos y evidencias. La implementación anterior contenía estas rutas en `src/routes/donantes.routes.ts`.

## Decisión — Primera etapa
- Reubicar la implementación del router en `src/modules/donantes/donantes.routes.ts`.
- Dejar `src/routes/donantes.routes.ts` como adaptador de compatibilidad mediante reexportación.
- Actualizar el punto de entrada para importar directamente el nuevo módulo y mantener el montaje y los endpoints actuales.
- No modificar reglas de negocio, sentencias SQL, contratos HTTP, autenticación, permisos, almacenamiento o esquema de datos durante esta primera etapa.
- Incorporar una prueba que verifique que los exports del router antiguo y nuevo son idénticos.

## Separación pendiente
1. Extraer consultas SQL a un repositorio de Donantes con `organizacionId` obligatorio en operaciones multi-tenant.
2. Extraer aplicación/reglas de negocio a servicios del módulo, comenzando con fichas y asignaciones de brigadas, sin alterar las transacciones.
3. Separar servicios del portal de donantes y administración, manteniendo las verificaciones de acceso del usuario y las evidencias.
4. Integrar las operaciones de compromisos y entregas desde Proyectos mediante contratos entre módulos, sin duplicar su persistencia.
5. Consolidar pruebas de roles DONANTE/COORDINADOR/ADMINISTRADOR, aislamiento entre organizaciones y regresión.

## Criterios de aceptación
- Compilación TypeScript y suite de pruebas del backend correctas.
- Endpoints y permisos originales sin cambios.
- Ningún dato de producción modificado por la reorganización.
- Pruebas de aislamiento y de relación entre brigadas y proyectos completadas antes de fusionar a `main`.

La reubicación inicial **no equivale** a una separación completa por capas: el código SQL seguirá en las rutas hasta su extracción gradual.
