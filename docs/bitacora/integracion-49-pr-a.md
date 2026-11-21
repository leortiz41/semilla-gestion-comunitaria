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
