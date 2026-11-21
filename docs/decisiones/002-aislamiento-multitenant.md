# ADR 002 — Aislamiento multi-tenant y permisos vigentes

**Estado:** Aceptada. **Fecha:** 21/11/2026.

## Contexto
Cada organización tiene cuentas y datos independientes; los roles pueden cambiar y los donantes solo pueden consultar proyectos asignados.

## Alternativas
- Base de datos independiente por organización.
- Base compartida confiando únicamente en los permisos del JWT.
- Base compartida con filtros de organización y autorización vigente en servidor.

## Decisión
Utilizar PostgreSQL compartido con relaciones de pertenencia a organizaciones, filtros de alcance en consultas y comprobación de cuenta activa, roles y restricciones en cada solicitud autenticada. Mantener autorizaciones específicas de donantes.

## Consecuencias
Se reducen costos operativos y se centraliza la evolución del esquema. Una consulta sin filtro puede comprometer el aislamiento, por lo que se requieren pruebas negativas y revisión de rutas. Consultar permisos vigentes agrega trabajo a cada solicitud, pero permite aplicar revocaciones sin esperar la expiración del JWT.

## Evidencia
PR #47; pruebas HU-12 de permisos y aislamiento; migraciones 034 y 035.
