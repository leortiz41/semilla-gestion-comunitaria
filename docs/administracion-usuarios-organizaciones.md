# Semilla — Cuentas, roles y primer administrador

## Situación actual

- El catálogo `roles`, `roles_permisos` y `permisos` existe en PostgreSQL; la interfaz antigua de Usuarios únicamente consultaba el catálogo.
- La nueva administración de cuentas se desarrolla en `develop`: desde **Usuarios → Cuentas de la organización** un ADMINISTRADOR con `usuarios.gestionar` crea usuarios, ve cuentas de su organización y asigna perfiles existentes.
- Perfiles disponibles: ADMINISTRADOR, COORDINADOR, CAMPO, FINANZAS y DONANTE. DONANTE es exclusivo.
- La API valida el rol de administrador activo y filtra por el `organizacion_id` de la sesión; se auditan altas y modificaciones.
- Las nuevas credenciales temporales aparecen una sola vez y fuerzan cambio de contraseña al entrar.
- **La consola global de Superadministración ya está implementada en develop**, pero requiere aplicar la migración 024 y crear la primera cuenta de plataforma antes de utilizarla. Los perfiles disponibles son los cinco roles operativos existentes; todavía no hay edición de permisos o roles personalizados. Un administrador tenant no puede crear organizaciones ni adquirir el rol SUPERADMINISTRADOR.

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

El SUPERADMINISTRADOR utiliza **Superadministración** para registrar organizaciones y crear cuentas en el tenant seleccionado, incluidas cuentas ADMINISTRADOR, COORDINADOR, CAMPO, FINANZAS y DONANTE. También puede cambiar los perfiles de cuentas tenant, con la restricción de conservar al menos un administrador por organización. Cada administrador operativo conserva la gestión restringida a su organización en **Usuarios**. El rol global no obtiene automáticamente permisos sobre los datos de comunidades, proyectos o evidencias. No es posible crear roles personalizados desde la interfaz.

## Flujo de publicación

`develop → CI → PR → main → Render/Vercel → pruebas`. No fusionar cambios sin revisar requisitos de seguridad y entorno de producción.

## Activación del rol SUPERADMINISTRADOR

**No ejecutar directamente en producción antes de validar la migración y autorizar el bootstrap.**

1. Revisar y aplicar `database/sql/024_superadministracion_plataforma.sql` en Neon development, y comprobar existencia de rol y dos permisos de plataforma.
2. Ejecutar las pruebas CI de backend y frontend; validar autenticación y bloqueo de rutas globales para ADMINISTRADOR, COORDINADOR y usuarios sin sesión.
3. Configurar, únicamente en la ejecución privada del bootstrap:
   - `DATABASE_URL`: conexión de Neon development para las pruebas; luego Neon production al activar oficialmente.
   - `SEMILLA_SUPERADMIN_EMAIL`: correo exclusivo de la cuenta global.
   - `SEMILLA_SUPERADMIN_PASSWORD`: contraseña provisional segura, con requisitos scrypt.
   - `SEMILLA_SUPERADMIN_ORGANIZACION_SLUG`: organización de identidad existente; por ejemplo, `ministerio-sal-y-luz`.
4. Ejecutar `npm run auth:create-superadmin` desde backend. Solo admite crear el primer superadministrador y rechaza un segundo bootstrap.
5. Iniciar sesión, cambiar obligatoriamente la contraseña y abrir el menú **Superadministración**.
6. Registrar nuevas organizaciones y crear sus primeras cuentas con rol ADMINISTRADOR. Compartir credenciales temporales por canal seguro.
7. Una vez que la migración se haya probado, aplicarla en Neon production antes de publicar la versión de backend que usa las rutas de plataforma.

**Control de seguridad**:
- El usuario global sigue vinculado a una organización de identidad debido al esquema actual de `usuarios`; esa relación no concede acceso automático a datos tenant.
- API `/api/plataforma` comprueba en PostgreSQL, en cada petición, que la cuenta siga activa y posea el rol global activo.
- Las cuentas SUPERADMINISTRADOR no aparecen ni pueden modificarse desde el panel de usuarios tenant.
- `/api/plataforma/organizaciones` permite consultar y crear organizaciones; `/api/plataforma/organizaciones/:id/cuentas` permite consultar, crear y gestionar roles de cuentas tenant.
- La contraseña temporal se muestra una sola vez. No guardar `SEMILLA_SUPERADMIN_PASSWORD` en repositorio o variables persistentes de Render.
- Aplicar cambios con PR: `develop → CI → main → despliegue`; al activar producción, verificar autenticación y aislamiento de organizaciones.
