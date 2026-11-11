# Base de datos de Semilla

Este directorio contiene la documentación y los artefactos de PostgreSQL para **Semilla - Gestión Comunitaria**.

## Fuente del modelo

El esquema parte del modelo original diseñado en DrawDB con **14 tablas y 26 relaciones**, que se toma como núcleo funcional de Semilla. Ese diseño fue convertido a PostgreSQL y corregido para resolver dependencias redundantes, relaciones inválidas y campos multivaluados.

## Estado actual

- PostgreSQL desplegado en Neon.
- Rama `production` reservada para producción.
- Rama `development` utilizada para desarrollo.
- Esquema inicial en `database/sql/001_esquema_inicial.sql`, ampliado mediante migraciones incrementales 002–019.
- El esquema inicial contiene 28 tablas; las migraciones posteriores amplían el modelo.
- Las 14 entidades funcionales originales se conservan como núcleo del diseño.
- UUID utilizados como claves primarias para facilitar sincronización offline.
- Prisma 7 integrado en el backend.
- Seguridad JWT/RBAC, auditoría y sincronización offline contempladas desde el diseño.

## Principales correcciones al modelo original

1. `Pagos.IdProyecto` ya no referencia `ServiciosBasicos.IdProyecto`. El flujo financiero se normaliza como `solicitudes_pago -> pagos`.
2. `solicitudes_pago` identifica a un único beneficiario: proveedor, personal contratado o empleado.
3. `avances_proyecto` deja de depender de un pago. Una solicitud de pago puede referenciar un avance cuando corresponda.
   La migración 019 reutiliza esta tabla para el historial de ejecución por actividad, con fecha, responsable autenticado y descripción.
4. Se separa `familias` de `perfiles_familia`, permitiendo que una familia tenga perfiles distintos en diferentes proyectos.
5. `personas` deja de depender directamente de una familia. La relación familiar y el parentesco se manejan mediante `miembros_familia`.
6. `empleados` y `personal_contratado` reutilizan la identidad almacenada en `personas`, evitando duplicidad.
7. `ZonaAsignada` se normaliza mediante la tabla `zonas`.
8. `ActividadesProgramadas` deja de ser texto multivaluado y se normaliza en `actividades_programadas`.
9. Se agregan índices sobre claves foráneas para mejorar consultas en PostgreSQL.

## Convención de nombres

El modelo de negocio se maneja en **español** para mantener consistencia con el dominio, la documentación y el equipo del proyecto.

Reglas principales:

- Tablas: plural y `snake_case`, por ejemplo `equipos_misioneros`, `perfiles_familia` y `solicitudes_pago`.
- Campos: español y `snake_case`, por ejemplo `fecha_inicio`, `presupuesto_asignado` y `personal_contratado_id`.
- Sin tildes, espacios ni caracteres especiales en identificadores SQL.
- Claves foráneas terminan en `_id`.
- Se conservan términos técnicos universales como `id`, `UUID`, `email`, `URL`, `JSON` y `JWT` cuando mejoran la claridad.

## Estructura del modelo

### Núcleo funcional derivado de las 14 tablas originales

- `equipos_misioneros`
- `comunidades`
- `proyectos`
- `servicios_basicos`
- `pagos`
- `perfiles_familia`
- `personas`
- `proveedores`
- `parentescos`
- `contactos`
- `personal_contratado`
- `avances_proyecto`
- `solicitudes_pago`
- `empleados`

### Tablas agregadas por normalización o requerimientos de Semilla

- `zonas`
- `actividades_programadas`
- `familias`
- `miembros_familia`
- `roles`
- `permisos`
- `usuarios`
- `usuarios_roles`
- `roles_permisos`
- `tokens_refresco`
- `evidencias`
- `bitacora_auditoria`
- `dispositivos_sincronizacion`
- `claves_idempotencia`

## Organización de archivos

| Carpeta | Contenido |
|---|---|
| `database/sql/` | Migraciones ejecutables numeradas 001–019. Las nuevas continúan la secuencia. |
| `database/sql/validaciones/` | Consultas de validación; no son migraciones. |
| `database/documentacion/` | Guías y registros de aplicación en Neon. |
| `database/referencias/` | Copias históricas para comparación y pruebas; no ejecutar como migraciones. |
| `docs/bitacora/` | Relato del trabajo y enlaces a sus artefactos; no almacena scripts de migración. |

Las migraciones ya aplicadas conservan su contenido. Mover documentación o referencias no requiere ejecutar SQL ni modifica el estado de Neon.

La copia local histórica de 005 está en [referencias](referencias/README.md). No se aplica además de la 005 publicada. Consultar [la reconciliación](../docs/arquitectura/reconciliacion-diagnostico.md) antes de intervenir bases con esas variantes.

Guías disponibles:

- [Organización y productividad (008)](documentacion/neon-organizacion-productividad.md).
- [Metas individuales (009)](documentacion/009-metas-vision.md).
- [Necesidades comunitarias (010)](documentacion/010-necesidades-comunitarias.md).

## Flujo de validación

1. Trabajar sobre Git `develop` y Neon `development`.
2. Crear el esquema en una base de desarrollo limpia.
3. Verificar el número de tablas y las claves foráneas.
4. Ejecutar `prisma db pull` para sincronizar Prisma con PostgreSQL.
5. Ejecutar `prisma generate`.
6. Validar el backend con `npm run db:test` y `npm run build`.
7. Llevar a `main` y Neon `production` únicamente cambios ya validados mediante Pull Request.
