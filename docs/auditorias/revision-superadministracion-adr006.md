# Auditoría arquitectónica — Superadministración (ADR-006)

**Fecha:** 2026-11-25  
**Rama examinada:** `develop`  
**Ámbito:** Backend `backend/src/routes/plataforma.routes.ts`, `backend/src/modules/plataforma/`, `backend/src/modules/usuarios/autorizacion.repository.ts`, middleware de sesión y pruebas del módulo.  
**Referencia normativa:** [ADR-006](../decisiones/006-arquitectura-modular-por-capas.md), [ADR-002](../decisiones/002-aislamiento-multitenant.md).  
**Alcance de la revisión:** inspección estática de código y pruebas versionadas; no se realizaron cambios en Neon, pruebas sobre datos reales ni una validación end-to-end nueva. La aceptación funcional de otros bloques procede de verificaciones anteriores del equipo.

## Dictamen

**Migración estructural avanzada; cumplimiento integral de ADR-006 pendiente.** Los endpoints de la plataforma se registran en un router delgado y delegan a controladores, servicios y repositorios. La autorización de plataforma contrasta la cuenta y los privilegios vigentes con PostgreSQL. Las consultas sensibles utilizan parámetros, filtros de tenant y transacciones auditadas. No es correcto declarar cumplimiento total sin subsanar las brechas indicadas.

## Criterios revisados

| Criterio ADR-006 | Evaluación | Evidencia |
|---|---|---|
| Rutas solo HTTP y middleware | Conforme | `plataforma.routes.ts` delega endpoints; no contiene `.query(` |
| Controladores sin SQL | Conforme en código revisado | `*.controller.ts` llaman servicios |
| Servicios sin Express ni SQL | Conforme en código revisado | `*.service.ts` usan PostgreSQL vía repositorios |
| Reglas de negocio coordinadas por servicios | Parcial | Decisiones de proteger último admin, bloquear retiros y restringir permisos están mayormente en `*.repository.ts`; varios servicios son delegadores |
| Repositorios con SQL parametrizado y tenant | Conforme en operaciones principales inspeccionadas | `cuentas-plataforma.repository.ts`, `roles-cuentas.repository.ts`, `permisos-tenant.repository.ts`, `edicion-cuentas.repository.ts` |
| Autenticación y autorización actualizadas | Conforme en diseño revisado | `plataforma.middleware.ts` y `usuarios/autorizacion.repository.ts` recalculan privilegios efectivos |
| Auditoría/atomicidad | Conforme en rutas sensibles inspeccionadas | Transacciones BEGIN/COMMIT/ROLLBACK, auditoría de cambios de estado, roles y restricciones |
| Contratos/inyección de repositorios | Parcial | Los servicios importan implementaciones concretas de repositorios; ADR-006 promueve interfaces y ensamblaje |
| Pruebas de aislamiento y regresión | Parcial | Pruebas unitarias con dobles de pool, sin evidencia suficiente de tests E2E con dos tenants y BD real |
| Validación funcional específica de matriz | Pendiente | Probar restricción/restauración de permiso individual y por rol en dos organizaciones |
| Frontend por funcionalidades | En transición | Pantalla `PaginaPlataforma.tsx` y cliente HTTP compartido `lib/api.ts` aún concentran responsabilidades |

## Hallazgos priorizados

### H-01 — Alta — Desactivación del último administrador activo

**Archivo:** `backend/src/modules/plataforma/cuentas-plataforma.repository.ts`, función `cambiarEstadoCuentaPlataforma`.

La operación de suspensión comprueba que la cuenta pertenezca a la organización, no esté retirada y no sea SUPERADMINISTRADOR ni la cuenta del operador. Sin embargo, si el usuario posee el rol ADMINISTRADOR, no cuenta los demás administradores activos antes de ejecutar `UPDATE usuarios SET activo=false`.

**Riesgo:** una organización puede quedar sin administrador activo por suspensión, aunque las operaciones de retiro y de cambio de roles sí protegen ese invariante.

**Acción propuesta:** agregar verificación del último ADMINISTRADOR en la misma transacción, bajo bloqueo de organización, conservando contrato y devolución HTTP coherente (409). Probar también concurrencia con dos administradores y que no se revocan tokens ni se registra auditoría ante el rechazo.

### H-02 — Media — Reglas de caso de uso alojadas en repositorios

**Archivos:** `roles-cuentas.repository.ts`, `edicion-cuentas.repository.ts`, `permisos-tenant.repository.ts` y `cuentas-plataforma.repository.ts`.

Los repositorios no se limitan a persistencia: toman decisiones sobre cuándo bloquear cambios, quién es protegido y qué restricciones se permiten. Aunque su transacción es necesaria, conviene expresar esas políticas en contratos y servicios, y reservar al repositorio la comprobación atómica y mutación de datos.

**Acción propuesta:** refactor incremental por operación; crear funciones de dominio puras para invariantes, y contratos tipados de repositorio. No dividir una comprobación transaccional de modo que introduzca TOCTOU; mantener el guardado y la validación crítica atómicos.

### H-03 — Media — Faltan pruebas de integración multitenant y del circuito HTTP completo

**Archivos:** `backend/tests/plataforma-*.test.ts`.

Las pruebas revisadas usan pools simulados y validan SQL esperado, rollback, códigos lógicos y protecciones. No demuestran por sí solas que las operaciones realmente modifiquen solo la organización A en PostgreSQL, que la sesión de B conserve sus permisos o que una cuenta retirada se rechace en todos los flujos.

**Acción propuesta:** añadir escenario reproducible con dos organizaciones aisladas y datos de prueba descartables: superadmin gestiona rol CAMPO en A, B permanece sin cambios; permisos fuera del rol se rechazan; usuario no global no accede a `/plataforma`; comprobar auditoría e integridad con transacciones reales.

### H-04 — Baja — Contratos de módulos e interfaz React aún en transición

**Archivos:** servicios del módulo Plataforma, `frontend/src/modulos/usuarios/PaginaPlataforma.tsx`, `frontend/src/lib/api.ts`.

Se inyecta ocasionalmente un `Pool` para pruebas, pero no se usan interfaces de repositorio ni punto de composición uniforme. La pantalla de Superadministración sigue concentrando múltiples flujos y operaciones HTTP en el cliente centralizado.

**Acción propuesta:** extraer interfaces/fábricas por caso de uso y, en un cambio separado, una API tipada específica de Plataforma y hooks de datos. No mezclar con correcciones de permisos.

## Pruebas funcionales pendientes para cerrar Superadministración

1. En una organización de prueba **A**, seleccionar una cuenta CAMPO y retirar un permiso de su conjunto permitido; iniciar sesión nuevamente y verificar denegación del endpoint correspondiente.
2. Restaurar el permiso en A; verificar acceso recuperado.
3. Restringir un permiso del rol CAMPO en A; verificar que varias cuentas afectadas de A pierdan permiso.
4. En otra organización de prueba **B**, verificar que el mismo rol conserve sus permisos originales.
5. Confirmar que la matriz impide ampliar permisos por encima de los permisos base y protege ADMINISTRADOR y SUPERADMINISTRADOR.
6. Verificar que las operaciones se auditen y que un error produzca rollback.
7. Tras resolver H-01, probar suspensión del último administrador, esperando HTTP 409 y cero cambios.

## Condiciones de cierre

- Resolver H-01 y cubrirlo con pruebas.
- Completar pruebas funcionales de permisos para dos organizaciones.
- Registrar H-02/H-04 como deuda arquitectónica con plan de migración acotado; cerrar solo si se acepta expresamente una excepción transitoria al ADR.
- Ejecutar CI y validación manual en `develop`.
- **No fusionar a `main` ni modificar esquema/productivo por esta auditoría.**

**Resultado:** Superadministración es modular en su estructura y conserva controles relevantes, pero el criterio completo del ADR-006 permanece **en revisión**, no “cumplido al 100 %”.
