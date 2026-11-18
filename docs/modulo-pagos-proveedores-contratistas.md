# Módulo Pagos, Proveedores y Contratistas — Semilla

## Diagnóstico
El frontend anterior de Pagos era una pantalla informativa. En Neon Development ya existen tablas `proveedores`, `personal_contratado`, `solicitudes_pago` y `pagos` (sin registros a la fecha de revisión). Se reutilizan; no crear un segundo libro mayor.

## Primer incremento implementado en develop
- Migración 030: `proveedores.organizacion_id` obligatorio; categoría y clasificación; RTN único por organización; migración rechaza explícitamente proveedores existentes sin asignación institucional.
- CRUD básico de proveedores y contratistas (alta, listado, edición, desactivación) mediante `/api/proveedores`.
- Consultas de solo lectura de solicitudes, personal contratado y pagos mediante `/api/pagos/resumen`.
- Interfaz de Pagos con pestañas «Pagos y solicitudes» y «Proveedores y contratistas».
- Permisos actuales reutilizados: `pagos.ver` y `pagos.gestionar`; el backend excluye explícitamente DONANTE, delimita por organización de la sesión y limita las escrituras a ADMINISTRADOR/COORDINADOR.
- Ninguna operación financiera real se ejecuta ni se confirma desde estas pantallas. Los datos de cuenta bancaria existentes no se exponen por la API.

## Diseño funcional para el incremento siguiente
1. **Catálogo**. Persona natural o empresa, especialidad, contacto, RTN opcional, estado, organización; impedir duplicidades; no eliminar proveedores con contrataciones o pagos asociados.
2. **Contratación**. Proyecto o actividad, contratista/proveedor, objeto y alcance, monto pactado, anticipo autorizado, fechas, responsable, forma de pago, contrato o cotización privada. Diferenciar relación contractual de simple registro de proveedor.
3. **Solicitud de pago**. Beneficiario único: proveedor o personal contratado o empleado según `solicitudes_pago`. Concepto, proyecto, referencia contractual, valor solicitado, antigüedad y soporte documental. Estados: SOLICITADA, APROBADA, RECHAZADA, PAGADA, CANCELADA.
4. **Autorización**. ADMINISTRADOR/COORDINADOR, evitar autoaprobación, revisar soporte, presupuesto disponible, gasto comprometido y monto restante. Registrar auditoría y motivo.
5. **Desembolso**. Registrar uno o varios abonos para una solicitud aprobada, con método, fecha, referencia, soporte y estado REGISTRADO/CONFIRMADO/ANULADO. No permitir sumar pagos CONFIRMADOS que superen lo aprobado. Solo CONFIRMADO afecta el monto desembolsado.
6. **Cierre y reportes**. Por proyecto, brigada, proveedor, periodo y responsable; conciliación, compromisos, pagado, por pagar, presupuestado y disponible.

## Reglas de control y privacidad
- Toda consulta debe unir proyectos→comunidades→organización de la sesión. No basta con pasar un identificador válido de proveedor.
- No permitir relaciones cruzadas entre proveedor y proyecto de organizaciones diferentes.
- Evitar modificar importes de solicitudes aprobadas o pagadas sin procedimiento auditable de reversión.
- Nunca marcar como pagado solo por registrar un recibo o seleccionar un botón.
- Documento comprobante y contratos en bucket privado, firma temporal y verificación de tipo; la carga debe permanecer bloqueada hasta resolver el PUT 403 observado en R2.
- Registrar autor, revisor, confirmador y fechas de cada transición. No compartir cuentas bancarias, RTN ni contratos al rol DONANTE.
- Una brigada patrocinadora puede financiar proyectos; eso no autoriza automáticamente a la brigada a ver obligaciones o pagos internos de la ONG.

## Criterios de aceptación antes de main
- Builds frontend/backend exitosos; pruebas CRUD aisladas por organización; 403 DONANTE; proveedores inactivos no elegibles para nuevas solicitudes; suma de pagos confirmados ≤ monto aprobado; doble confirmación concurrente protegida con transacción y bloqueos de fila; rechazo con motivo; auditoría; permisos de rol.
- Solucionar fallo preexistente HU12 en pruebas backend si persiste.
- No crear datos de prueba en Production. No modificar `main` ni migrar Neon Production sin revisión.


## Incremento 032 — flujo integrado de pagos (Development)
- Desde **Pagos y solicitudes** se permite dar de alta personal contratado en un proyecto, solicitar pago a un proveedor existente o al personal contratado del mismo proyecto, revisar una solicitud, registrar un abono y confirmar un abono registrado.
- `solicitudes_pago` sigue siendo la única referencia de autorización y `pagos.solicitud_pago_id` la referencia de desembolso. La interfaz presenta ambos con el proyecto asociado.
- La creación de contrato registra la persona y su contrato en una transacción. La solicitud valida proyecto y beneficiario dentro de la organización de la sesión. No se crean movimientos sin usuario autenticado y permisos.
- No se permite aprobar la solicitud propia; `solicitado_por_usuario_id` es obligatorio para las nuevas aprobaciones. La aprobación exige presupuesto asignado positivo y capacidad disponible, sumando solicitudes `APROBADA`/`PAGADA` del proyecto con bloqueo de la fila proyecto.
- Un abono inicia `REGISTRADO`; no representa transferencia real de fondos. Otro usuario autorizado debe confirmarlo; se impide confirmar abonos propios. Solo `CONFIRMADO` suma al desembolsado.
- Los abonos no anulados reservan saldo autorizado para impedir sobrepagos. Los bloqueos de fila de `solicitudes_pago` serializan confirmaciones concurrentes.
- Cada escritura crítica registra `bitacora_auditoria`, sin incluir cuentas bancarias.
- Migración `032_flujo_autorizacion_pagos.sql` aplicada únicamente en Neon Development. `main` y Neon Production no se modificaron.

### Restricciones que deben completarse antes de producción
1. La carga privada de contrato, factura y comprobante y su revisión siguen pendientes por el error de R2 (PUT 403). **No considerar un abono confirmado equivalente a una conciliación bancaria.**
2. Falta política formal sobre quiénes pueden solicitar, aprobar y confirmar, y sobre revocación/cancelación auditada de solicitudes y abonos; actualmente ADMINISTRADOR y COORDINADOR tienen las operaciones y se impide autoaprobación.
3. El registro de personal contratado aún no incorpora documentos, reutilización de persona existente, fechas, historial de cambios o verificación de duplicados entre personas.
4. Falta cobertura automatizada específica de pagos para importe válido, aprobación presupuestaria, acceso cruzado entre organizaciones, concurrencia y doble confirmación. Las pruebas generales de HU12 continúan fallando con 503 donde se esperaba 403.
5. No hay pagos bancarios integrados, transferencia de dinero ni conciliación externa; únicamente registros administrativos internos. No mezclar información de Development con Production.

## Bandeja de aprobaciones (incremento siguiente)
- **Pagos → Bandeja de aprobaciones** separa las solicitudes del formulario de creación.
- Vistas: Pendientes (`SOLICITADA`), Aprobadas (`APROBADA`), Rechazadas (`RECHAZADA`) e Historial (incluye `PAGADA`/`CANCELADA`).
- Cada solicitud muestra proyecto, concepto, beneficiario, monto, solicitante, fecha, revisor y motivo cuando aplica.
- La revisión usa el endpoint existente `POST /api/pagos/solicitudes/:id/revisar`; exige permisos `pagos.gestionar`, otro usuario distinto del solicitante, estado pendiente y presupuesto suficiente.
- El rechazo requiere motivo, la respuesta se muestra al usuario, la bandeja se refresca tras la operación y la auditoría se conserva en el backend.
- La bandeja no ejecuta transferencias ni confirma abonos. Los formularios de contratos y solicitudes siguen en la pestaña Pagos y solicitudes.
- Pendiente antes de main: probar solicitudes reales de dos cuentas administrativas en Development, caso de presupuesto insuficiente, acceso entre organizaciones, auditoría y fallo histórico de HU12; revisar paginación si hay más de 250 solicitudes por organización.
