# Bitácora — Semana 4

## Entrada del 7 de noviembre de 2026: matriz de permisos

Se inicia la bitácora de semana 4 con la documentación de autorización solicitada. La entrada se registra en esta semana por organización del entregable; no supone que se hayan completado todas las actividades previstas para semana 4 en el plan.

### Trabajo realizado

Se creó [docs/permisos.md](../permisos.md), cruzando las acciones de HU-01 a HU-20 y las ampliaciones de Comunidades (#11, #19 y #27) con ADMINISTRADOR, COORDINADOR, FINANZAS, CAMPO y CONSULTA.

La matriz distingue acciones operativas, permisos sembrados sin API y propuestas pendientes. Incluye la propiedad por organización, identidad/sesión propia, relaciones territoriales, metas de origen, autoría, archivo, auditoría y restricciones requeridas para familias, proyectos, recursos, evidencias y sincronización.

### Evidencia y revisión

Se contrastaron las migraciones 001–002, el aislamiento de 003–010, el middleware, el servicio de autenticación, las rutas montadas, los servicios del expediente y el mapa de historias. Se revisó la cobertura de todos los roles e historias y los enlaces relativos. No se atribuye a esta revisión documental una validación HTTP completa por rol ni una inspección de asignaciones manuales de cada base.

### Hallazgos

- CAMPO no posee comunidades.gestionar, aunque HU-07 menciona captura de comunidades por personal de campo.
- FINANZAS no tiene comunidades.ver; el dashboard territorial actual también exige ese permiso.
- CONSULTA tiene usuarios.ver y pagos.ver en las semillas; el detalle de exposición debe revisarse al implementar esas APIs.
- La administración de usuarios/roles carece de API montada; los catálogos RBAC son globales y necesitan límites explícitos antes de ofrecer administración por organización.
- pagos.gestionar todavía agrupa registro y aprobación; la separación de funciones está pendiente.
- La verificación del token no recarga permisos en cada request ni impone universalmente el cambio de contraseña temporal. Se documentan estos límites sin presentarlos como controles resueltos.

### Decisiones y alcance

No se cambiaron roles, permisos, datos ni migraciones. No se ejecutó SQL en Neon. Las reglas de módulos pendientes se marcaron como propuestas y no como funciones terminadas. La historia #27 sigue en su entrega 1; evaluaciones y vínculo con proyectos permanecen pendientes.

Se conserva la convención de trabajar en develop y promover posteriormente a main mediante PR. Esta entrada no crea una etiqueta/release de semana 4 ni declara un despliegue de producción.

### Siguientes pasos

Resolver las diferencias documentadas cuando se aborde cada historia, crear permisos específicos mediante migraciones incrementales cuando corresponda y agregar pruebas negativas de autorización y propiedad junto con cada API nueva.

## Corrección de organización de archivos

Se trasladaron las guías de aplicación desde `docs/migraciones-aplicadas/` a `database/documentacion/`, y la copia histórica de 005 a `database/referencias/`. Se actualizaron la prueba de compatibilidad, los enlaces y el índice de base de datos. La copia SQL se conserva sin cambios de contenido y queda identificada como referencia no ejecutable.

Las migraciones 001–010 permanecen en `database/sql/`. La bitácora conserva únicamente esta constancia. No se modificó ni ejecutó ninguna migración en Neon.
