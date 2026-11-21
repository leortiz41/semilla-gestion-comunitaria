# Historial de integración — Bloque 1 / PR A

**Fecha:** 21 de noviembre de 2026  
**Repositorio:** `leortiz41/semilla-gestion-comunitaria`  
**Issue de seguimiento:** #49  
**Rama de integración:** `integracion/49-cuentas-perfiles` (creada desde `main`)  
**Estado:** preparación / revisión; **NO integrado en producción**.

## Por qué se separó este trabajo

La comparación original `main...develop` tenía **220 commits** y **87 archivos modificados**, por lo que no era seguro crear un solo PR para todos los módulos. Se preparó una rama temporal que lleva únicamente la primera porción de cuentas de usuario.

## Historial de acciones y commits

| Orden | Commit | Actividad |
| --- | --- | --- |
| 1 | `4e1d8b3` | Adaptación del backend de cuentas: nombres visibles, validaciones y retiro lógico auditado, junto con las funciones de gestión necesarias |
| 2 | `8a4fb16` | Migración SQL 037: tabla `perfiles_usuarios` con organización y nombre visible |
| 3 | `b39e85a` | Ajuste específico de `api.ts`: nombre visible y alta de usuario con nombre y apellido |
| 4 | `8f5d554` | Formulario de cuentas actualizado para capturar nombre y apellido |

**Verificación del tamaño de la rama antes de documentarla:** cuatro commits, cuatro archivos modificados respecto de `main`.

## Dependencias y condiciones previas

- Aplicar/verificar migración `037_perfiles_usuarios.sql` en la base de pruebas **antes** de ejecutar el registro con nombre y apellido.
- No reemplazar archivos enteros de `develop` que arrastren otras funcionalidades; preservar `main` como base de revisión.
- La integración de edición avanzada, matriz de roles y permisos por tenant requiere PR posterior y migraciones 034/035.
- Revisar las rutas afectadas y confirmar que las operaciones de retiro no permitan retirar al último administrador, ni a la cuenta propia o de plataforma.

## Verificaciones pendientes antes de marcar el PR como listo

- [ ] Compilación del backend: `npm run build`.
- [ ] Compilación del frontend: `npm run build`.
- [ ] Confirmar esquema 037 en Neon de desarrollo (sin tocar producción).
- [ ] Pruebas: crear usuario con nombre, apellido, correo y rol; consultar su perfil.
- [ ] Pruebas de errores: datos inválidos, correo duplicado y acceso no autorizado.
- [ ] Pruebas de retiro: cuenta común, último administrador y cuenta protegida.
- [ ] Pruebas de aislamiento: dos organizaciones, cuentas visibles y modificables solo en la propia.
- [ ] Revisar el PR, documentar resultados y definir orden de migración/rollback.
- [ ] Integrar y verificar en producción solamente después de controles aprobados.

## Siguientes entregas del plan general

1. **PR A:** base de cuentas con nombres, perfiles y baja lógica (este borrador).
2. **PR B:** Superadministración SaaS y matriz de permisos por tenant, aislada y auditada.
3. Revisión de la **issue #19**, que no debe cerrarse sin pruebas inter-tenant.
4. Bloques de Familias, Pagos, Proyectos/Evidencias/R2, Donantes/PR #47 y Configuración, siguiendo el orden acordado.

## Nota de seguridad

La creación de la rama, estos commits y el PR borrador no implican despliegue ni modificación de datos de producción. Los resultados funcionales deben verificarse antes de cualquier merge.

## Validación automática del PR #50 — 21 de noviembre de 2026

Se revisaron **los resultados y los logs reales** de las ejecuciones GitHub Actions asociadas al commit `0af3988`:

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| Frontend CI | **Correcto** | Ejecución de GitHub Actions (conclusión success) |
| Vercel | **Correcto** | Estado del commit success |
| Instalación de dependencias backend | **Correcto** | `npm ci` finalizó |
| Compilación TypeScript backend | **Correcto** | `npm run build` (tsc) finalizó |
| Pruebas backend `npm run test:expedientes` | **Falló** | 12 de 13 pruebas superadas |
| Pruebas funcionales del registro y retiro contra Neon desarrollo | **Pendientes** | No se ejecutaron |
| Aplicación de SQL 037 en Neon desarrollo / producción | **No verificada** | No se modificó la base de datos |

### Incidencia concreta detectada

Falló la prueba `HU-12: conserva avances legados y audita estados, permisos, resultados e aislamiento`, en `backend/tests/avances-actividad.test.ts:268`. La aserción esperaba **HTTP 403** y obtuvo **HTTP 503** para una solicitud de creación de avance sin permiso. Las otras **12 pruebas pasaron**. La compilación del backend **sí pasó**.

Este caso involucra HU-12/Proyectos y un middleware compartido. **No se ha demostrado aún si se trata de una falla preexistente de la base `main`, una condición de la prueba o una regresión del PR #50**. Se debe investigar su causa antes de declarar aprobada la CI. No cambiar expectativas de la prueba para ocultar el error.

Los logs también indicaron **3 vulnerabilidades de severidad alta** en dependencias npm del backend. Requieren `npm audit` y revisión de dependencias antes del despliegue; no aplicar `npm audit fix --force` automáticamente.

### Decisión

El PR #50 **permanece en borrador, sin merge**, y la issue #19 continúa abierta.

### Próximas verificaciones

- [ ] Diagnosticar HTTP 503 inesperado en `avances-actividad.test.ts:268`, comparar el resultado contra `main`.
- [ ] Crear/agregar pruebas específicas de cuentas: nombres, aislamiento, retiro, último administrador, credenciales.
- [ ] Revisar `npm audit` del backend y corregir dependencias afectadas con cambios compatibles.
- [ ] Verificar migración SQL 037 en una base de desarrollo antes de cualquier despliegue.
- [ ] Revisar la API de login y usuarios para confirmar que se muestra el nombre y el estado de retiro.

## Consolidación — 21 de noviembre de 2026

El PR #50 se sustituye funcionalmente por el PR #47 (develop → main). Se compararon los archivos directamente: rutas de usuarios y SQL 037 idénticos; API y panel de cuentas de develop contienen la funcionalidad del PR A y mejoras adicionales. Se conserva esta bitácora sin fusionar la rama temporal. CI del commit 8adbb133 de develop: 13/13 pruebas aprobadas, frontend y Vercel exitosos. Las migraciones 026–037 ya se aplicaron en producción; consultar la bitácora migraciones-production-026-037-20261121.md. Queda revisar el reporte npm de tres vulnerabilidades altas y la autorización de donantes antes del merge.
