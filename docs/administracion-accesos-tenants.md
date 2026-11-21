# Administración de accesos por tenant — Semilla (034–035)

## Objetivo y alcance
Cada ADMINISTRADOR gestiona únicamente cuentas de su organización (`organizacion_id` tomado del token validado). La superadministración permanece separada. Se reutilizan los perfiles globales preexistentes ADMINISTRADOR, COORDINADOR, FINANZAS, CAMPO y DONANTE.

## Flujo visual
En **Usuarios → Configuración de accesos**:
1. Consultar indicadores, buscar cuentas y filtrar por estado.
2. Seleccionar un usuario para consultar roles y permisos disponibles por módulo.
3. Activar o desactivar permisos individuales que ya estén incluidos en sus roles, y guardar.
4. Activar/desactivar cuentas diferentes de la cuenta del administrador (la desactivación revoca tokens de renovación).
5. En **Permisos de los roles de tu organización**, elegir un perfil y modificar su política en ese tenant. Esto afecta los permisos efectivos de todos los usuarios que heredan ese rol; no modifica otras organizaciones.
6. En **Crear usuarios, asignar roles y administrar credenciales**, utilizar los flujos ya existentes para alta de cuentas, asignación de perfiles, actualización de correo y credencial temporal.

## Seguridad implementada
- `usuarios_permisos_restringidos` y `organizaciones_roles_permisos_restringidos` son **listas de denegación**, nunca otorgan permisos fuera de `roles_permisos`.
- Los roles base son globales por compatibilidad; un administrador institucional no puede alterar directamente la tabla global `roles_permisos`.
- `authenticateAccessToken` vuelve a consultar roles y permisos efectivos en PostgreSQL en **cada petición**, de modo que una revocación impide nuevas acciones protegidas aunque el JWT haya sido emitido antes. `auth.service` aplica la misma política al iniciar/renovar sesión.
- Administración restringida por rol `ADMINISTRADOR`, permiso `usuarios.gestionar` y organización; se comprueba nuevamente el administrador activo en las transacciones.
- Se bloquea editar la cuenta global SUPERADMINISTRADOR, restringir administradores, desactivar la propia cuenta y desactivar el último administrador activo.
- Los cambios de roles del usuario siguen usando el endpoint existente con controles de último administrador, organización y auditoría.
- Auditoría en `bitacora_auditoria` para cambios de permiso individual, política de rol y estado de cuenta.
- El frontend es una ayuda visual; el servidor es el punto que aplica todos los controles. El menú lateral filtra secciones con los permisos entregados al frontend.
- Tras cambios administrativos en otra cuenta, la autorización del servidor se actualiza al instante. La interfaz del usuario afectado podría requerir actualizar la sesión para reflejar la visibilidad de módulos.

## Limitaciones
- Esta versión **no crea nuevos nombres de roles** por tenant. Permite asignar los perfiles existentes y configurar/restringir sus permisos institucionales. La creación de roles personalizados, dependencias entre permisos y delegación avanzada requieren diseño posterior.
- No se permite agregar permisos que no estén originalmente en el perfil. Esa función requeriría controles de escalamiento y aprobación.
- La lista usa un límite inicial de 500 usuarios por tenant; para escala mayor implementar paginación en servidor.
- La pantalla del catálogo tradicional de roles muestra la definición base; el panel nuevo muestra los ajustes institucionales efectivos.

## Verificaciones necesarias antes de producción
- Iniciar sesión como ADMINISTRADOR del tenant A y verificar que jamás ve ni modifica usuarios del tenant B.
- Activar/desactivar usuarios; confirmar protección de cuenta propia, último administrador y SUPERADMINISTRADOR.
- Cambiar permiso de un usuario y probar inmediatamente un endpoint protegido utilizando el JWT antiguo.
- Cambiar permiso de rol en tenant A y verificar que el mismo perfil en tenant B no se modifica.
- Revocar y restaurar acceso de campo, coordinación, finanzas y donantes y comprobar las vistas correspondientes.
- Comprobar que no se puedan enviar permisos ajenos a un perfil por manipulación de la API y verificar los registros de auditoría.
- Resolver prueba general HU12 del backend (actualmente `503` frente al `403` esperado) y ejecutar batería de integración antes de fusionar en main.

Migraciones `034` y `035` aplicadas únicamente en **Neon Development**. `main` y Neon Production permanecen sin cambios.
