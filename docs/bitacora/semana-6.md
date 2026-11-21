# Bitácora — Semana 6

**Proyecto:** Semilla — Recursos que generan desarrollo  
**Fecha de registro:** 21 de noviembre de 2026  
**Tema:** Segundo flujo y decisiones de arquitectura.

## Objetivo

Consolidar el seguimiento de proyectos como flujo complementario a la gestión comunitaria, documentar la arquitectura implementada y estabilizar la versión antes de continuar con nuevas integraciones.

## Trabajo realizado

| Actividad | Resultado |
|---|---|
| Seguimiento de proyectos | Integración de planificación, registro de avances, revisión, resultados y portal de donantes. |
| Aislamiento | Revisión de permisos vigentes, organizaciones y asignación de proyectos por donante. |
| Base de datos | Migraciones 026–037 verificadas y aplicadas en Neon Production, con respaldo previo. |
| Pruebas | Correcciones de HU-12 y firma R2; 13/13 pruebas aprobadas en CI y localmente. |
| Dependencias | Actualización de effect a 3.22.1 sin degradar Prisma; npm audit y npm audit --omit=dev reportaron cero vulnerabilidades. |
| Experiencia de usuario | Corrección del cursor de escritura en botones y logotipos, comprobada en develop. |
| Integración | PR #47 fusionado hacia main y PR #50 cerrado por consolidación; PR #51 fusionado como ajuste visual. |

## Segundo flujo

El personal autorizado registra el avance de una actividad, lo envía a revisión y el revisor valida o devuelve el registro. El sistema usa información validada para determinar resultados. El donante puede consultar sus proyectos y las fotografías autorizadas, sin modificar actividades.

Se confirmaron funcionalmente seis escenarios de donantes en desarrollo: asignación independiente de dos cuentas, avances validados, fotografías compartidas, revocación del permiso de evidencias y solo lectura.

## Decisiones

Se documentaron tres ADR: monolito modular, aislamiento multi-tenant con autorización vigente y resultados validados con evidencias privadas. Se priorizó la estabilidad de la versión actual antes de incorporar Google OAuth.

## Evidencias

- [Arquitectura](../arquitectura.md) y [registro ADR](../decisiones/README.md).
- [Migraciones y respaldo](migraciones-production-026-037-20261121.md).
- [PR #47](https://github.com/leortiz41/semilla-gestion-comunitaria/pull/47): consolidación, merge fed3fcbd.
- [PR #50](https://github.com/leortiz41/semilla-gestion-comunitaria/pull/50): cerrado sin merge duplicado.
- [PR #51](https://github.com/leortiz41/semilla-gestion-comunitaria/pull/51): cursor de interacción, merge 1389bb33.
- [CI backend](https://github.com/leortiz41/semilla-gestion-comunitaria/actions/runs/44883797383): 13 pruebas aprobadas y auditoría sin vulnerabilidades.

## Pendientes

Confirmar la implementación final en el dominio público, continuar el seguimiento de las observaciones de usuarios de la semana 5 sin atribuir resultados no registrados, y evaluar autenticación con Google en una etapa posterior.

## Aprendizaje

La compilación por sí sola no garantiza el funcionamiento de una aplicación. Las pruebas de permisos, la consistencia entre esquema y código, y el control de dependencias permiten integrar cambios con mayor seguridad. La documentación debe reflejar lo que realmente se implementa y distinguir las mejoras futuras.
