# Validación integral — Refactorización del backend (PR #53)

**Proyecto:** Semilla — Gestión Comunitaria  
**Alcance:** cambios de nombres de variables en backend, sin modificación deliberada de reglas de negocio ni contratos HTTP.  
**Ramas:** desarrollo en `develop`; `main` sin fusionar hasta terminar la validación funcional.

## Objetivo y criterios

Comprobar que la legibilidad mejorada no altera el control de acceso, la separación entre organizaciones, el guardado de registros, las respuestas de la API y el diagnóstico de evidencias.

### Cobertura automatizada

Las pruebas del backend se ejecutan con `cd backend && npm run build && npm run test:expedientes`. La nueva prueba `tests/autorizacion-regresion.test.ts` utiliza PostgreSQL embebido (PGlite) y una aplicación Express temporal en un puerto local para validar:
- Rechazo de peticiones sin JWT o con credenciales inválidas.
- Rol efectivo calculado desde PostgreSQL, sin confiar en roles afirmados en el JWT.
- Imposibilidad de usar la identidad de una organización en otra.
- Revocación individual de permisos en sesión previamente autenticada.
- Restricción de permisos por rol dentro de una organización, sin afectar otra organización.
- Desactivación de cuenta y organización con rechazo inmediato.

El archivo `tests/r2-evidencias.test.ts` incorpora:
- Clasificación de errores S3/R2 por código, causa anidada y estado HTTP.
- No exposición de mensajes privados, firmas o contenido no permitido en diagnósticos.
- Límite de profundidad y manejo de objetos inesperados.

La suite previa conserva las pruebas de expedientes, avances y migraciones, incluyendo aislamiento por organización y rollback.

## Matriz de comprobación funcional pendiente

Estas comprobaciones requieren un entorno de pruebas con datos ficticios, cuentas diferenciadas y acceso visual. **No deben marcarse como realizadas sin evidencia.** No usar datos sensibles ni pruebas de escritura en producción.

| Flujo | Preparación | Acción y resultado esperado | Estado |
|---|---|---|---|
| Administración de permisos | Administrador y dos cuentas de roles diferentes | Restringir `comunidades.ver`; la cuenta afectada pierde acceso, las demás conservan el suyo | Pendiente |
| Superadministración | Superadministrador, administrador tenant y tenant separado | Administrar perfiles y suspender organización sin afectar otra; usuario ajeno recibe 403 | Pendiente |
| Recuperación/credencial temporal | Cuenta de prueba habilitada | Reemitir credencial y exigir cambio antes de utilizar opciones administrativas | Pendiente |
| Configuración institucional | Administrador de organización de prueba | Guardar nombre, colores, logo válido; volver a cargar y comprobar persistencia sin mezclar organizaciones | Pendiente |
| Logo inválido | Administrador de prueba | Rechazar datos MIME o base64 malformados; conservar configuración anterior | Pendiente |
| Evaluación familiar | Familia y proyecto de la misma comunidad | Crear/editar evaluación y comprobar valores de habitaciones, ingreso y servicios básicos | Pendiente |
| Evaluación fuera de organización | Familia/proyecto de otro tenant | Rechazar modificación y consulta no autorizada | Pendiente |
| Revisión familiar | Perfil en estado PENDIENTE | Permitir EVALUADO o DESCARTADO según reglas; bloquear SELECCIONADO/FINALIZADO mientras no exista verificación documental | Pendiente |
| Plantillas de contrato | Coordinador con permisos de pagos | Crear y editar plantilla Tiptap válida; comprobar control de versión y rechazo de nodo no permitido | Pendiente |
| Contrato fuera de organización | Proveedor, trabajador o proyecto de otro tenant | Rechazar creación y conservar registros sin cambios | Pendiente |
| Pago | Proyecto con presupuesto y solicitud autorizada | Registrar solicitud, aprobar con revisor distinto y comprobar límite presupuestario | Pendiente |
| Autoaprobación de pago | Misma cuenta que registró solicitud | Rechazar aprobación propia con respuesta esperada y sin persistir cambio | Pendiente |
| Abonos | Solicitud aprobada | Registrar abono, impedir exceso del saldo y evitar autoconfirmación | Pendiente |
| Auditoría y exportación | Administrador/coordinador autorizado | Comprobar eventos, filtros y CSV sin campos sensibles en detalles | Pendiente |
| Evidencia R2 | Evidencia privada y roles distintos | Acceso permitido solo al destinatario autorizado, sin exponer credenciales o URL permanente | Pendiente |

## Secuencia recomendada

1. Confirmar GitHub Actions verde en el HEAD final del PR: compilación TypeScript, todas las pruebas, cero vulnerabilidades.
2. Revisar el diff de las rutas críticas y comprobar que los alias SQL, payloads, expresiones regulares y nombres de endpoints no cambiaron.
3. Ejecutar la matriz manual con dos organizaciones de prueba, varias cuentas y registros ficticios. Anotar fecha, respuesta HTTP, evidencia y observaciones.
4. Corregir defectos encontrados y repetir la batería de CI.
5. Marcar PR #53 como listo solamente cuando los bloqueantes tengan resolución. Fusionar con autorización y comprobar despliegue y smoke de producción sin efectuar operaciones financieras reales.

**Nota:** una compilación correcta no confirma por sí sola la semántica de rutas de pagos, contratos, configuración o plataforma. Esta matriz distingue las verificaciones automáticas realizadas de las pruebas funcionales aún pendientes.
