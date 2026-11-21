# Gestor de Contratos — Semilla (incremento 033)

## Objetivo
Preparar borradores de contratos desde una plantilla reusable sin editar un archivo Word manualmente, manteniendo las organizaciones separadas y relacionando el documento con el proyecto y el proveedor o trabajador contratado.

## Implementación en develop
- Pestaña **Pagos → Gestor de contratos**.
- Editor enriquecido **Tiptap 3** con negrita, cursiva, subrayado, encabezados, listas y deshacer/rehacer.
- **Plantilla inicial de prestación de servicios**, basada en el ejemplo facilitado por la organización. Contiene diez cláusulas y espacios para las firmas. Se sustituyeron los nombres, identidades y cantidades del ejemplo por variables. **La plantilla no está aprobada jurídicamente.**
- Variables: organización, domicilio, representante, contratista, domicilio, proyecto, objeto, duración, fecha inicial, monto, forma de pago, lugar y fecha de firma.
- Plantillas editables propias por organización y versionadas; registro de cambios en auditoría.
- Borradores por proyecto y proveedor o personal contratado, con control de versiones, auditoría y detección de conflictos por versión. Los borradores se guardan en JSON Tiptap; la API rechaza nodos, atributos y marcas no admitidos para impedir HTML arbitrario.
- Vista de hoja A4; la opción de impresión permite utilizar «Guardar como PDF» desde el navegador. No equivale a PDF firmado ni a un flujo de firma electrónica.
- La migración `database/sql/033_gestor_contratos.sql` crea `plantillas_contrato`, `contratos_documento` y `contratos_documento_versiones`. Sólo se aplicó a Neon Development.
- Permisos `pagos.ver` de consulta y `pagos.gestionar` de edición (ADMINISTRADOR/COORDINADOR); sin acceso para DONANTE. Aislamiento por `organizacion_id` y proyecto/comunidad.

## Uso esperado
1. Registrar el proveedor o personal contratado y vincularlo con el proyecto en Pagos.
2. Abrir Gestor de contratos, seleccionar proyecto, contratista y plantilla.
3. Completar las variables, generar el borrador y ajustar las cláusulas en el editor.
4. Guardar; cada edición del borrador crea una nueva versión.
5. Imprimir o guardar PDF desde el navegador para revisión.
6. La formalización, firma y aprobación definitiva requerirán una etapa posterior.

## Límites y siguientes incrementos
- **No ejecutar pagos ni aprobar solicitudes sólo por existir un borrador de contrato.**
- Pendientes: firma o carga del PDF firmado, resguardo privado en R2 (subidas con PUT 403 pendientes), validación jurídica, aprobación de contrato y asociación exigible de factura/contrato a solicitudes de pago.
- La interfaz visual de consulta/restauración de versiones históricas está pendiente; las versiones ya se preservan en la base.
- La organización debe definir qué representante y domicilio legal corresponden a cada contrato. No se incrustan documentos de identidad personales en el machote.
- El machote debe ser revisado por asesoría legal local, especialmente relación laboral vs. servicios, plazo, causales de terminación, forma de pago, derechos/obligaciones y testigos.
- No se modificó `main` ni Neon Production. No se insertaron contratos de prueba ni datos personales de ejemplo.
- Para instalar dependencias nuevas al actualizar el equipo local: en `frontend`, ejecutar `npm install` antes de iniciar Vite.
