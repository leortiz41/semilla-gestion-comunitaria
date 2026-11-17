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
