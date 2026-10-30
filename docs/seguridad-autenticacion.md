# Arquitectura de autenticación de Semilla

## Objetivo

Implementar una base segura y escalable para autenticación y autorización sin complicar innecesariamente el proyecto de 10 semanas.

## Flujo

1. El usuario inicia sesión con correo y contraseña.
2. El backend valida la contraseña contra su hash `scrypt`.
3. Se consultan los roles y permisos asociados al usuario.
4. Se emite un JWT de acceso de corta duración.
5. Se genera un refresh token aleatorio que se almacena únicamente como hash en PostgreSQL.
6. El refresh token viaja al navegador en una cookie `HttpOnly`.
7. Al renovar la sesión se revoca el token anterior y se emite uno nuevo.
8. Al cambiar contraseña se revocan todos los refresh tokens activos del usuario.

## Decisiones de seguridad

- El access token es JWT y tiene duración corta.
- El refresh token no es JWT: es opaco y rotativo para facilitar revocación.
- Las contraseñas nunca se guardan en texto plano.
- Los permisos se obtienen por RBAC desde `usuarios_roles`, `roles`, `roles_permisos` y `permisos`.
- Los eventos de inicio de sesión, cierre de sesión y cambio de contraseña se registran en `bitacora_auditoria`.
- El backend confía en un único proxy en producción para obtener correctamente la IP en Render.
- CORS mantiene `credentials: true` para soportar la cookie HttpOnly entre Vercel y Render.

## Próximas ampliaciones

- Administración de usuarios desde interfaz.
- Recuperación de contraseña.
- Bloqueo temporal por intentos fallidos.
- Segundo factor opcional para perfiles administrativos.
- Políticas de sesión por dispositivo.
