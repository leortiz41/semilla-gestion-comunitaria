# Seguridad y autenticación de Semilla

## Estrategia

Semilla utiliza dos mecanismos complementarios:

1. **JWT de acceso** de corta duración (15 minutos por defecto).
2. **Refresh token opaco** de larga duración, aleatorio, almacenado en PostgreSQL únicamente como hash SHA-256 y enviado al navegador mediante cookie `HttpOnly`.

El refresh token se rota cada vez que se utiliza. El token anterior queda revocado.

## Contraseñas

Las contraseñas se almacenan con `scrypt` utilizando salt aleatoria. Nunca se guardan contraseñas en texto plano.

Para usuarios nuevos se recomienda una contraseña temporal y `debe_cambiar_contrasena = TRUE`.

## Endpoints

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/cambiar-contrasena`

## Autorización

El JWT incorpora los roles y permisos vigentes al momento de generarse. Los access tokens son cortos para limitar el tiempo durante el cual un cambio de permisos tarda en reflejarse.

Los middlewares disponibles son:

- `authenticateAccessToken`
- `requireRole(...)`
- `requirePermission(...)`

## Cuenta inicial de plataforma

La única cuenta global se inicializa desde la pantalla **Configurar la cuenta inicial de plataforma**; no existe un comando de inicialización para usuarios. La cuenta está fijada a `leortiz41@gmail.com` y el backend solo acepta el flujo cuando se cumplen estos requisitos:

- Se aplicaron las migraciones `024_superadministracion_plataforma.sql` y `025_inicializacion_superadministrador_unico.sql` en el entorno validado.
- El servicio backend tiene `SEMILLA_SECRETO_INICIALIZACION` (mínimo 32 caracteres) configurado como secreto de despliegue, fuera de Git y del frontend.
- `SEMILLA_IDENTIFICADOR_ORGANIZACION_INICIALIZACION` identifica una organización activa para la relación técnica de la cuenta; no le concede permisos operativos tenant.

La creación usa una fila bloqueada en PostgreSQL, por lo que solo una solicitud puede completarse. Cinco secretos incorrectos bloquean el asistente durante 15 minutos; una vez creada la cuenta, el estado queda consumido y las repeticiones devuelven un rechazo. El secreto no se registra ni se devuelve. Tras completar el flujo, eliminar `SEMILLA_SECRETO_INICIALIZACION` del servicio backend como defensa adicional.

## Roles y permisos

Aplicar en Neon `development` y, tras validar, en `production`:

```bash
neon psql development < database/sql/002_configurar_roles_permisos.sql
```

La migración es idempotente y puede ejecutarse nuevamente sin duplicar relaciones.

## Variables de entorno

- `JWT_SECRET`: secreto de al menos 32 caracteres.
- `JWT_EXPIRES_IN_MINUTES`: duración del JWT de acceso.
- `REFRESH_TOKEN_EXPIRES_IN_DAYS`: duración máxima del refresh token.
- `REFRESH_COOKIE_NAME`: nombre de la cookie HttpOnly.
- `FRONTEND_URL`: uno o más orígenes permitidos por CORS, separados por coma.
- `SEMILLA_SECRETO_INICIALIZACION`: secreto temporal, exclusivo del backend, para habilitar el asistente inicial.
- `SEMILLA_IDENTIFICADOR_ORGANIZACION_INICIALIZACION`: organización de identidad para el superadministrador inicial.

En producción las cookies se emiten con `Secure` y `SameSite=None` para permitir frontend y API en dominios HTTPS diferentes (Vercel / Render).
