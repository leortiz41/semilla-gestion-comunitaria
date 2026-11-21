# Perfil personal y seguridad — Semilla, incremento 037

## Objetivo
Presentar un perfil profesional de cada usuario autenticado con foto opcional, nombre visible, organización, roles asignados y controles de seguridad. No se modifican el correo de inicio de sesión ni los permisos de otros usuarios desde esta pantalla.

## Interfaz
- Encabezado con foto circular o iniciales y nombre de presentación.
- Datos personales: nombre visible editable; correo y organización de solo lectura.
- Seguridad: estado de sesión, contraseña temporal, último acceso, renovar sesión y cambio de contraseña usando los flujos existentes.
- Permisos efectivos: listado técnico consultable bajo panel desplegable para no sobrecargar la página.
- Adaptación a móvil y escritorio.

## Persistencia y controles
- Tabla `perfiles_usuarios` creada por la migración `database/sql/037_perfiles_usuarios.sql` en **Neon Development** exclusivamente.
- El perfil está asociado a `usuario_id` y `organizacion_id`. Las rutas `GET/PUT /api/perfil` requieren autenticación y operan sobre el usuario de sesión; no aceptan IDs del cliente.
- El nombre visible tiene máximo 140 caracteres. No reemplaza los datos legales de personas o empleados.
- Fotos opcionales JPG, PNG o WEBP, reducidas por el navegador a un máximo de 420 píxeles y JPEG comprimido. El servidor limita la foto a 200 KB y verifica firma básica del formato. Base64 guardado en PostgreSQL de Development; no depende de R2.
- Se registra acción `ACTUALIZAR_PERFIL_PROPIO` en `bitacora_auditoria`, sin guardar los bytes de la imagen en la auditoría.
- El cambio de contraseña sigue usando el servicio de autenticación existente; revoca sesiones y requiere volver a autenticarse.

## Próximas verificaciones
- Probar foto grande, imagen inválida y eliminación; revisar cómo se ve en móvil.
- Verificar que un usuario no acceda al perfil de otro tenant ni altere sus datos.
- Confirmar que los permisos restringidos y el inicio de sesión sigan funcionando.
- El nombre visible se muestra en la pantalla de perfil; para incluir foto/nombre en el encabezado de todas las vistas, reutilizar el endpoint o incluirlo en el estado compartido de la sesión.
- No se ha publicado esta migración en Production ni fusionado `develop` a `main`.
