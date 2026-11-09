# Matriz de permisos — Semilla

Fecha de revisión: 8 de noviembre de 2026. Base: rama `develop`, commit `b52ed03`; esta entrega agrega la migración 019 para avances por actividad.

## Alcance y fuente de verdad

Esta matriz cruza las acciones de HU-01 a HU-20 de [mapa-historias.md](mapa-historias.md), las ampliaciones del expediente #11, el aislamiento #19 y las entregas de necesidades #27 con los cinco roles sembrados. Los números HU y los números de issue son identificadores diferentes.

Se distingue lo que el backend permite hoy de las propuestas para historias pendientes. Una página de navegación, una tabla o un permiso sembrado no equivalen a una operación implementada. Este documento no modifica permisos, roles ni bases de datos. Describe la configuración versionada; no certifica que asignaciones manuales en cada ambiente coincidan con ella.

Fuentes revisadas:

- [001: roles y catálogo de permisos](../database/sql/001_esquema_inicial.sql) y [002: asignaciones a roles](../database/sql/002_configurar_roles_permisos.sql).
- [Middleware de autenticación y autorización](../backend/src/middleware/auth.middleware.ts), [servicio de autenticación](../backend/src/services/auth.service.ts) y [montaje de rutas](../backend/src/server.ts).
- Rutas de [comunidades](../backend/src/routes/comunidades.routes.ts), [zonas](../backend/src/routes/zonas.routes.ts), [dashboard](../backend/src/routes/dashboard.routes.ts), [capacidades](../backend/src/routes/capacidades.routes.ts), [necesidades](../backend/src/routes/necesidades.routes.ts) y [proyectos](../backend/src/routes/proyectos.routes.ts), junto con sus servicios.
- Migraciones 003–019, [modelo de datos](modelo-datos.md) y [diseño de necesidades](arquitectura/necesidades-comunitarias.md).

## Roles y lectura de las matrices

| Columna | Rol técnico | Responsabilidad de referencia |
|---|---|---|
| A | ADMINISTRADOR | Administración de la organización; no es un superadministrador entre organizaciones. |
| C | COORDINADOR | Coordinación comunitaria y de proyectos. |
| F | FINANZAS | Solicitudes, pagos y contexto financiero. |
| T | CAMPO | Captura de información y evidencias según permisos asignados. |
| L | CONSULTA | Lectura autorizada; no es acceso público. |

**✓**: permitido actualmente, sujeto a autenticación y propiedad. **—**: no autorizado por la configuración base. **P**: acceso propuesto para una acción pendiente; no habilitado todavía. **S**: permiso sembrado para ese rol, pero acción sin API operativa montada. **H**: hereda permisos y restricciones de la operación de origen; no otorga acceso adicional. En filas pendientes, «—» significa que no se propone acceso en esta versión de la matriz.

Los roles se pueden acumular: el servicio reúne los permisos de los roles activos del usuario. No existe una denegación por rol que anule otro permiso concedido. El backend comprueba códigos de permisos, no estos nombres como excepción. ADMINISTRADOR recibe el catálogo disponible al ejecutar 002; no tiene un comodín que conceda automáticamente cualquier permiso futuro.

## Catálogo RBAC versionado

Esta tabla representa las asignaciones versionadas de las migraciones 002 y 019.

| Permiso | A | C | F | T | L |
|---|---|---|---|---|---|
| usuarios.ver | ✓ | — | — | — | ✓ |
| usuarios.gestionar | ✓ | — | — | — | — |
| comunidades.ver | ✓ | ✓ | — | ✓ | ✓ |
| comunidades.gestionar | ✓ | ✓ | — | — | — |
| familias.ver | ✓ | ✓ | ✓ | ✓ | ✓ |
| familias.gestionar | ✓ | ✓ | — | ✓ | — |
| proyectos.ver | ✓ | ✓ | ✓ | ✓ | ✓ |
| proyectos.gestionar | ✓ | ✓ | — | — | — |
| actividades.avance.gestionar | ✓ | ✓ | — | ✓ | — |
| pagos.ver | ✓ | ✓ | ✓ | — | ✓ |
| pagos.gestionar | ✓ | — | ✓ | — | — |
| evidencias.gestionar | ✓ | ✓ | — | ✓ | — |
| auditoria.ver | ✓ | — | — | — | — |

## Reglas de propiedad y alcance

| Regla | Propiedad del dato y condición | Situación |
|---|---|---|
| R1 | Identidad propia: `/me` y cambio de contraseña usan el `sub` autenticado. Login acredita credenciales; refresh/logout operan sobre la sesión asociada a la cookie, no sobre un usuario arbitrario recibido en el cuerpo. | Implementado en autenticación. |
| R2 | Organización activa de la sesión: las consultas y escrituras territoriales usan `organizacionId` del token. Un ID conocido de otra organización no concede acceso. Administrador tampoco cruza organizaciones. | Implementado en zonas, comunidades, dashboard y expediente. |
| R3 | Relaciones territoriales: comunidad y zona deben pertenecer a la organización correspondiente. Ser autor de un registro no permite trasladarlo a otra organización. | Implementado por servicios y claves compuestas donde aplica. |
| R4 | Origen de la necesidad: meta, visión, área, comunidad y organización deben coincidir. Solo puede vincularse una meta activa al registrar; archivarla después conserva la necesidad y su referencia. | Implementado en 010 y servicio de necesidades. |
| R5 | Autoría no equivale a propiedad exclusiva: con el permiso de gestión se puede modificar información comunitaria de la propia organización, aunque la haya capturado otro usuario. Autor/fecha sirven para auditoría; no hay filtro «solo mis registros» ni asignación de comunidades por usuario. | Comportamiento actual. |
| R6 | Concurrencia e historia: capacidades y visión/metas rechazan revisiones obsoletas; las metas retiradas se archivan. No hay edición/borrado de necesidades ni de auditoría mediante la API actual. | Implementado en esos flujos; no extender esta garantía a todas las pantallas. |
| R7 | Familia/persona/beneficiario debe pertenecer a una comunidad de la organización; datos personales no se vuelven públicos por tener acceso a un reporte. | Regla requerida; API y alcance detallado de datos pendientes. |
| R8 | Proyecto, actividad y necesidad vinculada deben compartir organización y ámbito comunitario. Una relación multicomunidad exige autorización territorial explícita. | El alcance de proyectos, actividades y avances se verifica por organización; la vinculación proyectos-necesidades sigue pendiente. |
| R9 | Donación, compra, gasto, proveedor, solicitud y pago deben validar organización y destino autorizado. Registrar, aprobar y pagar deben poder separarse para evitar autoaprobación. | Regla propuesta; catálogo actual agrupa acciones en pagos.gestionar y no implementa esa separación. |
| R10 | Evidencias y archivos deben validar organización y objeto padre autorizado en carga, lectura y descarga. Un enlace o conocer un ID no reemplaza autorización. Evidencia de necesidad debe poder existir sin proyecto ficticio. | Pendiente; el esquema actual de evidencias requiere proyecto. |
| R11 | Reportes/auditoría deben filtrar organización y datos permitidos. El historial es de solo lectura para usuarios operativos. Exportar no debe ampliar lo visible. | Registro de auditoría existe; consulta/exportación y alcance futuro pendientes. |
| R12 | Offline/sincronización conservan usuario y organización originales; al sincronizar se revalidan sesión, permisos, relaciones y revisión vigente. El almacenamiento local no concede permisos. | Diseñado; pendiente de implementación. |

El aislamiento operativo actual reside en API/servicios y restricciones relacionales. No se afirma que exista una política RLS general para todas las tablas. El rol PostgreSQL usado por el backend no es uno de los roles funcionales de esta matriz.

## Acciones implementadas

Todas las celdas ✓ requieren las reglas de la última columna. Los permisos de lectura no habilitan escritura.

| Historia / acción | Control actual | A | C | F | T | L | Propiedad |
|---|---|---|---|---|---|---|---|
| HU-01: iniciar sesión | Credenciales válidas; usuario y organización activos | ✓ | ✓ | ✓ | ✓ | ✓ | R1 |
| HU-01: renovar sesión | Cookie refresh válida; autorización recargada | ✓ | ✓ | ✓ | ✓ | ✓ | R1 |
| HU-01: cerrar sesión | Cookie de la sesión a revocar | ✓ | ✓ | ✓ | ✓ | ✓ | R1 |
| HU-01: consultar perfil propio | Token y sub | ✓ | ✓ | ✓ | ✓ | ✓ | R1 |
| HU-03: cambiar contraseña propia | Token, contraseña actual y nueva válida | ✓ | ✓ | ✓ | ✓ | ✓ | R1 |
| HU-04/HU-08: consultar resumen y conteos del dashboard | comunidades.ver | ✓ | ✓ | — | ✓ | ✓ | R2 |
| HU-05/HU-06: listar/buscar/filtrar comunidades | comunidades.ver; filtros de la interfaz sobre datos autorizados | ✓ | ✓ | — | ✓ | ✓ | R2 |
| HU-07: crear comunidad | comunidades.gestionar | ✓ | ✓ | — | — | — | R2, R3 |
| HU-07: editar información general | comunidades.gestionar | ✓ | ✓ | — | — | — | R2, R3, R5 |
| HU-07: activar/desactivar comunidad | comunidades.gestionar | ✓ | ✓ | — | — | — | R2, R5 |
| Territorio #19: consultar zonas | comunidades.ver | ✓ | ✓ | — | ✓ | ✓ | R2 |
| Territorio #19: crear/editar/activar/desactivar zona | comunidades.gestionar | ✓ | ✓ | — | — | — | R2, R3, R5 |
| HU-07/#11: consultar población y vivienda | comunidades.ver | ✓ | ✓ | — | ✓ | ✓ | R2 |
| HU-07/#11: guardar población y vivienda | comunidades.gestionar | ✓ | ✓ | — | — | — | R2, R5 |
| HU-07/#11: consultar visión y metas por área | comunidades.ver | ✓ | ✓ | — | ✓ | ✓ | R2 |
| HU-07/#11: guardar situación y prioridad del área | comunidades.gestionar | ✓ | ✓ | — | — | — | R2, R5, R6 |
| HU-07/#11: agregar/editar/quitar metas | comunidades.gestionar; quitar archiva | ✓ | ✓ | — | — | — | R2, R5, R6 |
| HU-07/#11: consultar organización y productividad | comunidades.ver | ✓ | ✓ | — | ✓ | ✓ | R2 |
| HU-07/#11: guardar listas, observaciones y potencial | comunidades.gestionar; revisión completa | ✓ | ✓ | — | — | — | R2, R5, R6 |
| #27 entrega 1: consultar necesidades por área | comunidades.ver | ✓ | ✓ | — | ✓ | ✓ | R2, R4 |
| #27 entrega 1: registrar necesidad y prioridad inicial justificada | comunidades.gestionar; estado IDENTIFICADA asignado por servidor | ✓ | ✓ | — | — | — | R2, R4, R5 |
| HU-12: consultar actividades y avances de proyectos propios | proyectos.ver | ✓ | ✓ | ✓ | ✓ | ✓ | R2, R8 |
| HU-12: planificar/reprogramar actividades | proyectos.gestionar | ✓ | ✓ | — | — | — | R2, R8 |
| HU-12: registrar avance de ejecución por actividad | actividades.avance.gestionar; porcentaje 0–100; responsable tomado de sesión | ✓ | ✓ | — | ✓ | — | R2, R5, R8 |
| #11 compatibilidad: consultar diagnóstico integral anterior | comunidades.ver | ✓ | ✓ | — | ✓ | ✓ | R2 |
| #11 compatibilidad: crear/actualizar diagnóstico integral anterior | comunidades.gestionar | ✓ | ✓ | — | — | — | R2, R5 |

El flujo integral anterior conserva endpoints por compatibilidad y no es la navegación principal. No sincroniza bidireccionalmente con las secciones nuevas; su retiro sigue pendiente antes de producción. Los endpoints públicos `/` y `/api/health` no requieren rol y no son consultas de expedientes.

## Acciones pendientes y política propuesta

S conserva exactamente un permiso ya sembrado; P expresa una propuesta que debe concretarse en códigos, migración incremental, API y pruebas. Ninguna celda S o P autoriza hoy una ruta inexistente.

| Historia / acción | Permiso existente o decisión pendiente | A | C | F | T | L | Propiedad |
|---|---|---|---|---|---|---|---|
| HU-02: listar usuarios | usuarios.ver; API pendiente | S | — | — | — | S | R2, R11 |
| HU-02: crear/editar/desactivar usuario y emitir contraseña temporal | usuarios.gestionar; API pendiente | S | — | — | — | — | R2; nunca cambiar otra organización |
| HU-02: administrar roles/asignaciones | Permiso específico y límite de administración pendientes | P | — | — | — | — | R2; catálogos globales no editables por cualquier tenant |
| HU-09: consultar expediente familiar | familias.ver | S | S | S | S | S | R7 |
| HU-09: registrar/editar familia | familias.gestionar | S | S | — | S | — | R7 |
| HU-10: consultar integrantes y beneficiarios | familias.ver; detalle sensible por definir | S | S | S | S | S | R7 |
| HU-10: registrar/asociar/corregir integrantes y beneficiarios | familias.gestionar | S | S | — | S | — | R7 |
| HU-11: consultar programas/proyectos | proyectos.ver | S | S | S | S | S | R8 |
| HU-11: registrar/editar/asignar comunidad a programa/proyecto | proyectos.gestionar | S | S | — | — | — | R8 |
| HU-11: aprobar/cerrar proyecto | Separar aprobación/cierre del permiso genérico | P | P | — | — | — | R8; no resuelve automáticamente necesidades |
| HU-13: consultar donaciones/recursos y asignaciones | Permiso específico pendiente | P | P | P | — | — | R9 |
| HU-13: registrar donante/donación/recurso recibido | Permiso específico pendiente | P | — | P | — | — | R9 |
| HU-13: asignar recursos a proyecto | Permiso y separación autorización/registro pendientes | P | P | P | — | — | R8, R9 |
| HU-14: consultar solicitudes/pagos | pagos.ver | S | S | S | — | S | R9 |
| HU-14: registrar/editar solicitud y registrar pago | pagos.gestionar actual; API pendiente | S | — | S | — | — | R9 |
| HU-14: aprobar solicitud de pago | pagos.gestionar incluye aprobar; separación pendiente | S | — | S | — | — | R9; no hay prohibición de autoaprobación implementada |
| HU-14: registrar proveedor/compra/gasto y relacionarlo a proyecto | Códigos específicos pendientes | P | — | P | — | — | R8, R9 |
| HU-15: adjuntar/registrar evidencia | evidencias.gestionar | S | S | — | S | — | R10 |
| HU-15: consultar/descargar evidencia | Lectura específica y autorización del padre pendientes | P | P | P | P | P | R10; alcance depende del objeto, no acceso total |
| HU-15: corregir metadatos/retirar evidencia | Permiso y tratamiento de autoría pendientes | P | P | — | P | — | R10; conservar trazabilidad, no borrar historial |
| HU-16: consultar/exportar trazabilidad e impacto | Permiso de reportes pendiente | P | P | P | — | P | R8–R11; limitar detalle por destinatario |
| HU-17: consultar auditoría | auditoria.ver | S | — | — | — | — | R11 |
| HU-17: exportar auditoría | Permiso/exportación pendientes | P | — | — | — | — | R11 |
| #27: corregir datos de necesidad con historial | API e historial pendientes | P | P | — | — | — | R2, R4–R6 |
| #27: registrar evaluación inicial/seguimiento | Permiso de evaluación pendiente | P | P | — | — | — | R2, R4–R6, R10 |
| #27: cambiar prioridad/estado con motivo | Permiso de evaluación pendiente | P | P | — | — | — | R2, R6; nunca por gasto automático |
| #27: asignar responsable y próxima revisión | Permiso de coordinación pendiente | P | P | — | — | — | R2; responsable de la misma organización |
| #27: resolver/reabrir necesidad | Evaluación, resultado y evidencia obligatorios para cierre | P | P | — | — | — | R2, R6, R10 |
| #27: vincular/desvincular proyecto y necesidad | Relación N:M y permisos pendientes | P | P | — | — | — | R8; conservar historial del vínculo |
| #27: consultar historial de evaluaciones | Lectura pendiente; se propone comunidades.ver | P | P | — | P | P | R2, R10 |
| HU-18: consultar datos autorizados offline | Operación offline pendiente | H | H | H | H | H | R12; solo datos y módulos autorizados |
| HU-18: capturar borrador offline | Operación offline pendiente | H | H | H | H | — | R12; requiere permiso de escritura de origen |
| HU-19: sincronizar cola propia | Operación de sincronización pendiente | H | H | H | H | — | R12; revisión y autorización en servidor |
| HU-19: resolver conflictos de sincronización | Permiso de escritura del objeto, resolución pendiente | H | H | H | H | — | R5, R6, R12 |

## Acciones prohibidas y controles transversales (HU-20)

| Acción / regla | A | C | F | T | L | Condición |
|---|---|---|---|---|---|---|
| Leer/escribir datos de otra organización por conocer su ID | — | — | — | — | — | R2 y relaciones; ver alcance implementado arriba. |
| Cambiar la organización del dato mediante un cuerpo de solicitud | — | — | — | — | — | La sesión determina la organización. |
| Modificar/borrar auditoría o evaluaciones históricas desde la app | — | — | — | — | — | No hay API de edición de auditoría; evaluaciones futuras serán inmutables. |
| Eliminar físicamente metas/necesidades mediante la app | — | — | — | — | — | Metas se archivan; necesidades no tienen endpoint de borrado. |
| Marcar necesidad resuelta solo por aprobar inversión o cerrar proyecto | — | — | — | — | — | Regla de negocio acordada para las siguientes entregas. |
| Saltar validaciones por usar cuenta Administrador | — | — | — | — | — | Mismos controles de propiedad y validación. |

HU-20 no es un permiso adicional: token obligatorio en rutas protegidas (401), código requerido (403), alcance de organización y validación de relaciones. La UI puede ocultar botones, pero no reemplaza el backend. Los servicios de capacidades, metas y necesidades verifican además usuario activo de la organización al escribir; no se debe asumir esa revalidación en cada ruta antigua.

## Diferencias y pendientes detectados

1. **HU-07 frente a CAMPO:** la historia pide captura por personal de campo, pero 002 no concede comunidades.gestionar a CAMPO. Hoy registra Administrador/Coordinador. Decidir un permiso de captura más estrecho o una ampliación explícita antes de cambiarlo; no otorgar administración territorial completa por documentación.
2. **HU-02:** existen tablas, semillas y carga RBAC, pero server.ts no monta API administrativa de usuarios/roles. roles y roles_permisos son catálogos globales: una futura administración tenant no debe alterar permisos de todas las organizaciones.
3. **CONSULTA:** tiene usuarios.ver y pagos.ver sembrados. Confirmar el detalle que podrá ver cuando se implementen esas APIs; no interpretar consulta como acceso público ni a todos los datos personales/financieros.
4. **FINANZAS:** no tiene comunidades.ver, por lo que no accede al dashboard territorial ni al expediente actual. Sus permisos sembrados de familias/proyectos no conceden ese acceso indirectamente.
5. **Pagos:** pagos.gestionar agrupa crear, aprobar y registrar. Segregación y prohibición de autoaprobación aún no implementadas.
6. **Contraseña temporal y revocación:** el frontend conduce al cambio de contraseña, pero authenticateAccessToken no exige ese cambio antes de cualquier operación. Tampoco recarga roles de la base en cada request: cambios de permisos se reflejan al emitir/renovar tokens; no prometer revocación instantánea del access token.
7. **Aislamiento pendiente:** familias, proyectos, recursos, pagos, evidencias, reportes y offline requieren implementar sus reglas antes de exponer APIs. La matriz futura no acredita controles ya existentes.
8. **Pruebas:** las pruebas integrales actuales cubren persistencia, aislamiento y relaciones de expedientes/necesidades; no constituyen una prueba HTTP exhaustiva de cada combinación rol/acción de esta matriz.

## Criterios de verificación para nuevas entregas

- Probar cada ruta con token ausente, permiso ausente y permiso válido.
- Probar IDs de otra organización y relaciones de comunidad/área/meta incompatibles.
- Probar el usuario autor y otro usuario autorizado de la misma organización para documentar si aplica R5 o una restricción más estrecha.
- Probar una cuenta con varios roles y una sesión con permisos antiguos tras cambios de autorización.
- Confirmar que consulta no puede escribir, que el cierre requiere evidencia cuando se implemente y que no se filtran archivos por URL.
- Actualizar conjuntamente esta matriz, la historia, las pruebas y la bitácora. Nuevos permisos o asignaciones requieren una migración nueva; no editar semillas ya aplicadas.

Flujo de trabajo: cambios directamente en develop; PR de develop a main cuando la entrega esté validada. Esta entrega es documental y no requiere ejecutar SQL en Neon.
