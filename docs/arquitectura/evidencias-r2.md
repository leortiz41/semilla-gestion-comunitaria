# HU-15 — Evidencias fotográficas privadas (Cloudflare R2)

## Estado
Diseño técnico aprobado para implementación incremental. **No hay carga de archivos habilitada** hasta que el bucket, los secretos y los endpoints hayan sido configurados y probados en `development`.

## Objetivo
Personal de campo adjunta fotografías a un avance de una actividad. Coordinador o Administrador puede revisarlas desde Proyectos > Centro de revisión. El módulo Evidencias es la biblioteca central. El donante solo accede a archivos explícitamente publicados para su proyecto.

## Base existente
- Tabla `evidencias` de `001_esquema_inicial.sql`, con `proyecto_id`, `avance_proyecto_id`, `archivo_url`, `tipo_mime`, `titulo`, `descripcion`, `subido_por_usuario_id`.
- No usar `archivo_url` para una URL pública o una URL presignada que expire. Guardar una **clave de objeto privada** (prefijo `r2:`) o incorporar una columna explícita `objeto_clave` en migración nueva, con compatibilidad para archivos anteriores.
- Verificar relación entre avance, actividad y proyecto y pertenencia a la organización de la sesión, en todas las operaciones.
- No introducir binarios en Neon.

## Configuración del bucket
1. En Cloudflare > Storage & databases > R2 > Create bucket, crear `semilla-evidencias-development` con clase **Standard**, privado (sin exposición pública).
2. Crear token R2 **Object Read & Write** restringido **únicamente a ese bucket**.
3. Guardar `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` como **variables secretas del backend**. Nunca añadir secretos a Git ni al `VITE_*`.
4. Configurar CORS del bucket para permitir el origen del frontend de desarrollo y `PUT`, `GET`, `HEAD`, con encabezado `Content-Type`. No habilitar `*` como origen en producción.
5. Documentar y probar el origen local y el desplegado de desarrollo. Usar almacenamiento separado para producción.

## Flujo recomendado
1. Usuario autenticado solicita preparar carga para un avance existente (con permiso `evidencias.gestionar`, y permiso de acceso al proyecto). Archivos permitidos: JPEG, PNG, WebP. Límite sugerido: **10 MB** por foto; máximo **10 fotos** por avance por operación.
2. API valida organización, proyecto, avance y estado (se podrá adjuntar antes de enviar; las evidencias de reportes validados no se alterarán silenciosamente). Genera clave privada impredecible bajo `organizaciones/<org>/proyectos/<proyecto>/avances/<avance>/<uuid>`.
3. API emite una **URL PUT firmada**, limitada a una clave, un MIME y 5 minutos. En el navegador se realiza `PUT` directo a R2 con el mismo `Content-Type` firmado.
4. Al terminar, el navegador confirma la carga a la API. El backend hace `HEAD` del objeto real, verifica tamaño y tipo permitido, y solamente entonces registra el metadato en Neon en una transacción que valida alcance y pertenencia. Rechazar confirmaciones sin archivo real. Limpiar objetos huérfanos según política de retención.
5. Para listar evidencias, la API devuelve metadatos autorizados. Para visualizarlas, genera **URL GET firmada corta** y nunca expone credenciales ni claves de terceros. El cliente debe tratar estas URLs como secretos temporales.
6. Cada operación (preparar, confirmar, anular, publicar) registra actor, objeto, fecha y motivo en `bitacora_auditoria`. No eliminar físicamente evidencias ya utilizadas en validación sin una operación administrativa auditada.
7. El Centro de revisión muestra miniaturas y visor, fecha, autor y descripción. Una actividad que exige evidencia bloqueará la **validación** de un avance sin evidencia confirmada; esta regla será configurable y exigida por el backend.
8. La publicación al donante será una decisión explícita distinta de aprobar un avance, con permisos y metadatos propios.

## Endpoints propuestos
- `POST /proyectos/:proyectoId/actividades/:actividadId/avances/:avanceId/evidencias/preparar`
- `POST /proyectos/:proyectoId/actividades/:actividadId/avances/:avanceId/evidencias/confirmar`
- `GET /proyectos/:proyectoId/actividades/:actividadId/avances/:avanceId/evidencias`
- `GET /evidencias/:evidenciaId/acceso`

No crear endpoints sin implementar autorización real, firma R2, comprobación HEAD y pruebas.

## Seguridad y pruebas
- Aislamiento estricto por organización, proyecto y actividad, incluyendo IDs ajenos conocidos.
- No permitir carga en otro avance a través de manipulación de IDs. MIME permitido, tamaño real validado y firma de cinco minutos.
- Sanitización de metadatos y límites de archivos; comprobar firma, expiración y CORS. Las imágenes podrían contener EXIF/GPS: decidir política de eliminación antes de publicación a donantes.
- Pruebas con bucket de desarrollo y usuarios CAMPO, COORDINADOR, ADMINISTRADOR y DONANTE; comprobar bloqueo de archivos no confirmados y de accesos cruzados.
- La carga offline pertenece a HU-18/HU-19 y no se presenta como disponible en este incremento.

## Referencias oficiales
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
- https://developers.cloudflare.com/r2/objects/upload-objects/
- https://developers.cloudflare.com/r2/pricing/

## Incremento técnico HU-15 (noviembre 2026)

Se añadieron el servicio `backend/src/services/r2-evidencias.service.ts`, rutas protegidas en `proyectos.routes.ts`, el cliente `frontend/src/lib/api.ts`, y un componente visual reutilizable en Ejecución y Centro de revisión.

**Variables privadas que requiere el backend** (en `backend/.env` local, no en Git):
```dotenv
R2_ACCOUNT_ID=<ID_DE_CUENTA>
R2_ACCESS_KEY_ID=<ACCESS_KEY>
R2_SECRET_ACCESS_KEY=<SECRET_KEY>
R2_BUCKET=semilla-evidencias-development
```

**Prueba manual requerida:** reiniciar backend y frontend; crear un avance borrador; adjuntar foto JPEG, PNG o WebP inferior a 10 MB; comprobar objeto en R2; confirmar metadatos en Neon (`evidencias.archivo_url` almacena `r2:<clave_privada>`); enviar a revisión; abrir Centro de revisión y comprobar miniatura. Verificar errores con CORS y falta de permisos. Los enlaces GET caducan a los cinco minutos; si vence, recargar evidencias.

**Alcance de esta entrega:** cargar y consultar fotografías asociadas a un avance existente y visible en revisión. No hay publicación automática a donantes, eliminación de imágenes, compresión EXIF, modo offline ni biblioteca central operativa. La validación no exige todavía un número mínimo de fotos. No se ha ejecutado una prueba E2E con credenciales R2 reales en este entorno.

**Seguridad:** subir solo desde avances BORRADOR/DEVUELTO propios con `evidencias.gestionar`. Las consultas quedan bajo `proyectos.ver` y deben limitarse al proyecto y organización. El backend confirma el objeto mediante HEAD y registra auditoría. Mantener el bucket privado. El acceso al navegador utiliza firma temporal, nunca credenciales R2.

**Operación:** firmamos con AWS Signature V4 usando `node:crypto` y el endpoint S3 de R2, sin dependencias adicionales. Verificar las firmas mediante carga real. Los objetos huérfanos de cargas no confirmadas requerirán política de limpieza antes del despliegue productivo.
