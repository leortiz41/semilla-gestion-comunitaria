# Semilla — cuentas, organizaciones y acceso inicial de plataforma

## Alcance

- Un ADMINISTRADOR gestiona exclusivamente las cuentas de su propia organización desde **Usuarios → Cuentas de la organización**.
- Un SUPERADMINISTRADOR gestiona organizaciones y sus primeras cuentas desde **Superadministración**. No obtiene permisos automáticos sobre comunidades, proyectos ni evidencias de los tenants.
- Los perfiles asignables son ADMINISTRADOR, COORDINADOR, CAMPO, FINANZAS y DONANTE; DONANTE es exclusivo. Los roles personalizados no forman parte de este alcance.
- Las cuentas tenant nuevas reciben una contraseña temporal que se muestra una sola vez y exige cambio en el primer acceso.

## Asistente visual del único SUPERADMINISTRADOR

La cuenta inicial está fijada a **leortiz41@gmail.com**. No hay un comando para crearla ni un campo para cambiar ese correo en la aplicación.

### Preparación en el entorno de validación

Antes de abrir el asistente, un responsable técnico debe usar los paneles de Neon y del servicio backend para:

1. Aplicar y verificar las migraciones `024_superadministracion_plataforma.sql` y `025_bootstrap_superadministrador_unico.sql` en **Neon development**. La migración 025 solo crea el estado del asistente; no crea usuarios.
2. Configurar en el servicio **backend** un secreto temporal `SEMILLA_BOOTSTRAP_SECRET`, aleatorio y de al menos 32 caracteres. Debe guardarse en el gestor de secretos del despliegue, nunca en Git, archivos `.env` compartidos, Vercel ni el frontend.
3. Confirmar `SEMILLA_BOOTSTRAP_ORGANIZACION_SLUG=ministerio-sal-y-luz` (o una organización de identidad activa ya existente).
4. Publicar el backend y frontend de validación. En el inicio de sesión aparecerá **Configurar la cuenta inicial de plataforma** solamente mientras el asistente esté disponible.

Desde la interfaz se ingresa el secreto de instalación y una contraseña nueva. La contraseña debe tener al menos 12 caracteres, mayúsculas, minúsculas y números. Después de una confirmación exitosa, se vuelve al inicio de sesión con el correo ya preparado.

### Controles de seguridad

- El secreto se compara mediante un digest de longitud fija y no se persiste ni se registra.
- El estado se bloquea dentro de una transacción de PostgreSQL: impide carreras entre instancias y hace que un replay posterior al éxito sea rechazado.
- Cinco intentos erróneos bloquean el asistente durante 15 minutos; el contador persiste ante reinicios del backend.
- Si ya existe un SUPERADMINISTRADOR, el bootstrap se consume sin crear ni elevar otra cuenta.
- La creación, asignación de rol y consumo del bootstrap se confirman en una sola transacción y se auditan como `BOOTSTRAP_SUPERADMIN_GRAFICO`.
- En producción el endpoint solo acepta HTTPS. Al terminar, retirar `SEMILLA_BOOTSTRAP_SECRET` del servicio backend y volver a publicar como defensa adicional.

## Verificación antes de producción

1. Ejecutar CI de backend y frontend en la PR; las pruebas incluyen creación única, replay y límite de intentos.
2. En development, comprobar el inicio de sesión de `leortiz41@gmail.com`, el acceso a **Superadministración** y el aislamiento de rutas de plataforma para un ADMINISTRADOR tenant.
3. Crear una organización de prueba y una cuenta ADMINISTRADOR desde la interfaz; verificar que esa cuenta no puede consultar `/api/plataforma` ni gestionar otra organización.
4. No aplicar las migraciones, configurar el secreto ni usar el asistente en Neon production hasta que esas verificaciones se aprueben explícitamente.

La publicación sigue el flujo `develop → CI → PR → main → despliegue`. Esta PR no fusiona cambios, no modifica Neon production y no crea ninguna cuenta por sí misma.
