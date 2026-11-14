# Semilla — Cuentas, roles y primer administrador

## Situación actual

- El catálogo `roles`, `roles_permisos` y `permisos` existe en PostgreSQL; la interfaz antigua de Usuarios únicamente consultaba el catálogo.
- La nueva administración de cuentas se desarrolla en `develop`: desde **Usuarios → Cuentas de la organización** un ADMINISTRADOR con `usuarios.gestionar` crea usuarios, ve cuentas de su organización y asigna perfiles existentes.
- Perfiles disponibles: ADMINISTRADOR, COORDINADOR, CAMPO, FINANZAS y DONANTE. DONANTE es exclusivo.
- La API valida el rol de administrador activo y filtra por el `organizacion_id` de la sesión; se auditan altas y modificaciones.
- Las nuevas credenciales temporales aparecen una sola vez y fuerzan cambio de contraseña al entrar.
- **No existe todavía un módulo visual de administración global de organizaciones ni un editor de roles personalizados o permisos.** Estas funciones deben implementarse aparte con control de SUPERADMINISTRADOR, aislamiento, auditoría y modelo de roles por organización. No conceder a un administrador tenant la facultad de crear organizaciones o alterar permisos globales.

## Primer administrador de producción

**Requisitos previos**: respaldar Neon, verificar que Render use la rama `production`, comprobar que el rol `ADMINISTRADOR` y la organización estén activos. Nunca usar la URL de desarrollo ni compartir claves en tickets.

El script `backend/src/scripts/create-admin.ts` ahora exige:

- `DATABASE_URL`: cadena **de Neon production**, asignada solo en el entorno local o ejecución aislada
- `SEMILLA_ADMIN_EMAIL`: correo de la persona que administrará la organización
- `SEMILLA_ADMIN_PASSWORD`: contraseña temporal fuerte (al menos 12 caracteres, mayúsculas, minúsculas y números)
- `SEMILLA_ADMIN_ORGANIZACION_SLUG`: `ministerio-sal-y-luz` para el primer tenant

Desde la carpeta `backend`, con esas variables definidas de forma privada, ejecutar:

```bash
npm ci
npm run auth:create-admin
```

El script usa scrypt con sal aleatoria, comprueba el rol y la organización, impide un segundo bootstrap cuando ya existe un administrador en ese tenant, crea cuenta y rol en una transacción y obliga a cambiar la contraseña. **No insertar passwords manualmente en Neon**, no guardar credenciales en archivos versionados ni añadir `SEMILLA_ADMIN_PASSWORD` como variable persistente en Render. La contraseña puede suministrarse por consola local, sin historial, mediante un gestor de secretos o env temporal.

Verificar desde Vercel que puede iniciar sesión y que el cambio inicial de contraseña y los permisos funcionan. El script no envía invitaciones por email.

## Acceso de otras organizaciones

Las organizaciones diferentes requieren provisión explícita del tenant y su primer administrador a través de un procedimiento controlado, todavía **no disponible visualmente**. Cada usuario se relaciona con una organización; la pantalla de Usuarios solo lista y administra cuentas de esa organización. La implementación futura de un panel global debe usar autorización independiente de `usuarios.gestionar`, roles propios de plataforma y alcance seguro, no permitir cambiar el tenant del token desde el frontend.

## Flujo de publicación

`develop → CI → PR → main → Render/Vercel → pruebas`. No fusionar cambios sin revisar requisitos de seguridad y entorno de producción.
