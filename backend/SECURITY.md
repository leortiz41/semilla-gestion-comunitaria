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

## Primer administrador

Definir localmente, sin subir secretos a Git:

```env
SEMILLA_ADMIN_EMAIL=administrador@dominio.org
SEMILLA_ADMIN_PASSWORD=UnaClaveTemporalSegura123
```

Ejecutar:

```bash
npm run auth:create-admin
```

El administrador queda obligado a cambiar su contraseña en el primer flujo de acceso.

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

En producción las cookies se emiten con `Secure` y `SameSite=None` para permitir frontend y API en dominios HTTPS diferentes (Vercel / Render).
