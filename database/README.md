# Base de datos de Semilla

Este directorio contiene la documentación y los artefactos de PostgreSQL para **Semilla - Gestión Comunitaria**.

## Fuente del modelo

El esquema parte del modelo original diseñado en DrawDB con **14 tablas y 26 relaciones**, que se toma como núcleo funcional de Semilla. Ese diseño fue convertido a PostgreSQL y corregido para resolver dependencias redundantes, relaciones inválidas y campos multivaluados.

## Estado actual

- PostgreSQL desplegado en Neon.
- Rama `production` reservada para producción.
- Rama `development` utilizada para desarrollo.
- Modelo PostgreSQL definitivo en `database/sql/001_esquema_inicial.sql`.
- 28 tablas relacionadas en el esquema propuesto.
- Las 14 entidades funcionales originales se conservan como núcleo del diseño.
- UUID utilizados como claves primarias para facilitar sincronización offline.
- Prisma 7 integrado en el backend.
- Seguridad JWT/RBAC, auditoría y sincronización offline contempladas desde el diseño.

## Principales correcciones al modelo original

1. `Pagos.IdProyecto` ya no referencia `ServiciosBasicos.IdProyecto`. El flujo financiero se normaliza como `solicitudes_pago -> pagos`.
2. `solicitudes_pago` identifica a un único beneficiario: proveedor, personal contratado o empleado.
3. `avances_proyecto` deja de depender de un pago. Una solicitud de pago puede referenciar un avance cuando corresponda.
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

## Scripts SQL

```text
database/sql/
└── 001_esquema_inicial.sql
```

### 001_esquema_inicial.sql

Crea la versión PostgreSQL del modelo de Semilla a partir de las 14 tablas originales de DrawDB, con las correcciones de normalización y las extensiones necesarias para seguridad, auditoría y trabajo offline.

## Flujo de validación

1. Trabajar sobre Git `develop` y Neon `development`.
2. Crear el esquema en una base de desarrollo limpia.
3. Verificar el número de tablas y las claves foráneas.
4. Ejecutar `prisma db pull` para sincronizar Prisma con PostgreSQL.
5. Ejecutar `prisma generate`.
6. Validar el backend con `npm run db:test` y `npm run build`.
7. Llevar a `main` y Neon `production` únicamente cambios ya validados mediante Pull Request.

## Estructura

```text
database/
├── sql/
├── diagrams/
└── seed/
```
