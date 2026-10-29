# PR #8 - Autenticación y seguridad

## Qué se implementó

- Inicio de sesión con correo y contraseña.
- JWT de acceso de corta duración.
- Refresh token rotativo y revocable.
- Cookie HttpOnly para el refresh token.
- Consulta de usuario autenticado.
- Cambio obligatorio de contraseña.
- Middleware de roles y permisos.
- Script para crear el primer administrador.
- Asignación inicial de permisos por rol.
- Auditoría de inicio/cierre de sesión y cambio de contraseña.

## Decisiones

Se mantiene JWT únicamente para el access token. El refresh token se diseñó como token opaco aleatorio y se almacena en la base de datos únicamente como hash SHA-256, lo que facilita su revocación y rotación.

Para las contraseñas se usa `scrypt` de Node.js con salt aleatoria, evitando dependencias nativas adicionales y manteniendo un algoritmo diseñado para hashing de contraseñas.

## Validaciones pendientes antes de integrar a main

- Aplicar `database/sql/002_configurar_roles_permisos.sql` en Neon development.
- Crear un administrador de prueba mediante variables de entorno locales.
- Ejecutar `npm run build`.
- Probar login, `/me`, refresh, logout y cambio de contraseña.
- Validar CORS/cookie entre frontend local y backend local.
