# Migraciones de Neon Production — 026–037

**Fecha:** 21 de noviembre de 2026 (Honduras)  
**Proyecto Neon:** `semilla-gestion-comunitaria` (`empty-fog-11074076`)  
**Rama destino:** `production` (`br-gentle-sky-ak59eo04`)  
**Resultado:** 12 migraciones ejecutadas, 51 sentencias en una transacción exitosa.  
**Relacionado:** #49, PR #50, #19, PR #47.

## Respaldo y validación

- Respaldo anterior a la migración: `respaldo-production-antes-026-037-20261121` (`br-empty-poetry-ak6s2c5k`), verificado en estado ready, sin compute.
- Copia de validación: `validacion-production-026-037-20261121` (`br-spring-dawn-akjb6dud`), estado ready.
- Comprobación previa: tabla proveedores con 0 filas. Migración 030 requiere asignar organización a proveedores existentes; no fue necesario modificar datos.
- Primer intento de validación detectó delimitadores inválidos en bloque DO de SQL 028. Se corrigió en develop mediante commit `f0348f5`. El error ocurrió solo en la copia de validación.
- Repetición de validación: 026–031, 32 sentencias; 032–037, 19 sentencias. Ambas transacciones exitosas.
- Aplicación en producción: los 12 archivos SQL de develop corregidos, en orden numérico, 51 sentencias ejecutadas en una única transacción.

## Historial de migraciones

| Nº | Archivo | Estado |
| --- | --- | --- |
| 026 | expediente_familias_vivienda | Aplicada |
| 027 | asignacion_familias_brigadas | Aplicada |
| 028 | escolaridad_integrantes | Aplicada con corrección de delimitadores |
| 029 | cuentas_brigadas_donantes | Aplicada |
| 030 | proveedores_multitenant | Aplicada |
| 031 | tipos_proveedores_personalizados | Aplicada |
| 032 | flujo_autorizacion_pagos | Aplicada |
| 033 | gestor_contratos | Aplicada |
| 034 | restricciones_permisos_usuarios_tenant | Aplicada |
| 035 | permisos_roles_tenant | Aplicada |
| 036 | configuracion_institucional | Aplicada |
| 037 | perfiles_usuarios | Aplicada |

## Verificación directa posterior

- 12 de 12 tablas nuevas esperadas presentes: documentos_familia, asignaciones_familias_brigadas, grados_estudio, cuentas_brigadas_donantes, tipos_proveedor, plantillas_contrato, contratos_documento, contratos_documento_versiones, usuarios_permisos_restringidos, organizaciones_roles_permisos_restringidos, configuraciones_institucionales y perfiles_usuarios.
- 17 registros globales en grados_estudio.
- Columnas de familias, integrantes, proveedores, solicitudes de pago y pagos verificadas por information_schema.
- proveedores.organizacion_id y proveedores.tipo: NOT NULL.
- Restricciones miembros_familia_grado_si_asiste y proveedores_tipo_no_vacio presentes.
- Conteos posteriores: 1 organización, 3 usuarios, 0 proyectos, 0 familias y 0 proveedores.
- Se conservaron respaldo y rama de validación. Ningún cambio de aplicación se fusionó a main durante esta actividad.

## Condiciones antes del merge de aplicación

- La base de datos ya tiene SQL 026–037. No repetir automáticamente los archivos: 031 añade una restricción que no es completamente idempotente.
- Confirmar el funcionamiento de la versión de producción existente y luego las pruebas de la versión candidata.
- Revisar CI de backend: el historial de PR #50 registró un 503 inesperado frente a 403 esperado en HU-12, 12/13 pruebas aprobadas. No considerar la actualización del esquema como resolución de esa prueba.
- Completar pruebas de aislamiento de tenants (issue #19), seguridad y revisión de los cambios acumulados antes del merge.
- Si se necesita rollback, evaluar restauración a rama nueva desde el respaldo, evitando perder escrituras posteriores. No restaurar production sin revisar el impacto.

**Estado:** migraciones de producción confirmadas; despliegue de código pendiente de revisión y pruebas.
