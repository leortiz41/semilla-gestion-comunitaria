# Configuración institucional de Semilla — incremento 036

## Propósito
Permitir a cada administrador personalizar **solo su organización** (tenant), sin modificar la identidad de la plataforma Semilla ni la configuración de otros tenants.

## Funcionalidad en develop
**Menú:** Configuración, visible para cuentas `ADMINISTRADOR` que disponen de `usuarios.gestionar`.

Secciones:
1. **Identidad institucional:** nombre público, lema y logotipo (PNG/JPG/WEBP, máximo 200 KB). Se refleja en la barra lateral y en el pie de página de la sesión. El nombre legal de la organización no se modifica.
2. **Apariencia y colores:** color primario, secundario y fondo. Vista previa y opción para recuperar la paleta por defecto. Los componentes y áreas principales que utilizan variables institucionales se adaptan; otros componentes históricos conservan colores fijos hasta su migración.
3. **Pantalla de bienvenida:** título y texto configurables para el banner inicial del Dashboard tras iniciar sesión. No cambia la página pública de acceso, porque todavía no se identifica el tenant antes de autenticar.
4. **Documentos/PDF:** papel A4/Carta/Legal, orientación, márgenes de 8 a 35 mm y preferencias para mostrar logo/lema en documentos compatibles. Los ajustes de papel/orientación/márgenes se aplican a las impresiones del navegador durante la sesión. Los motores externos de generación PDF requieren adaptación de cada plantilla.

## Arquitectura y seguridad
- Migración `database/sql/036_configuracion_institucional.sql` aplicada únicamente en Neon Development.
- Tabla `configuraciones_institucionales` con `organizacion_id` como clave principal, referencia a `organizaciones`, marcas de edición y validaciones SQL.
- API autenticada: `GET /api/configuracion-institucional` para los miembros de la organización y `PUT /api/configuracion-institucional` únicamente para ADMINISTRADOR con permiso `usuarios.gestionar`.
- `organizacion_id` se extrae de la sesión validada, nunca se acepta desde el cliente como parámetro de asignación.
- Colores validados como hexadecimal; textos limitados y sin HTML; logos con tipos controlados, tamaño máximo y comprobación de firma básica del contenido. El logotipo está guardado como base64 compacto en la base de datos, no en R2, para evitar el problema previo de carga PUT 403. Para escalar a organizaciones con imágenes grandes, migrar a un proveedor privado con cargas firmadas.
- Se audita el cambio institucional en `bitacora_auditoria` sin registrar la imagen completa ni secretos.
- El logo y el mensaje de bienvenida se muestran solo en el área autenticada del tenant. Superadministración y página pública conservan la identidad Semilla.

## Limitaciones y verificaciones pendientes
- Comprobar visualmente varias combinaciones de colores, accesibilidad de contraste y responsive.
- Confirmar que un administrador de tenant A no modifica configuración de tenant B.
- Probar cargas PNG, JPG, WEBP válidas e inválidas; rechazo de datos excesivos y de archivos falsos.
- Verificar que el Dashboard y la barra lateral actualizan el nombre, lema y logotipo al guardar.
- La preferencia `pdf_mostrar_logo` / `pdf_mostrar_lema` está almacenada, pero todavía debe conectarse a los encabezados específicos de cada generador PDF del sistema.
- No alterar documento firmado previo ni configuraciones históricas de otra organización.
- No se modificó `main` ni Neon Production.
