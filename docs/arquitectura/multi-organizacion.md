# Arquitectura multi-organización - Semilla

## Objetivo

Definir qué información pertenece a una organización y qué información puede considerarse global dentro de Semilla, evitando que el aislamiento de datos se implemente de forma improvisada módulo por módulo.

## Regla principal

Toda entidad cuyo contenido represente operación, territorio, personas, recursos, proyectos, evidencias o configuración propia de una ONG debe quedar asociada a una `organizacion_id` o depender de una entidad que ya esté aislada por organización.

El `organizacion_id` válido siempre se obtiene desde la sesión autenticada. El backend no debe confiar en un identificador de organización enviado arbitrariamente por el cliente para decidir qué datos puede consultar o modificar.

## Entidades globales

Estas entidades pueden ser compartidas por toda la plataforma cuando representan catálogos o capacidades del sistema y no datos propios de una ONG:

| Entidad | Alcance | Motivo |
|---|---|---|
| `permisos` | Global | Define capacidades técnicas del sistema. |
| `parentescos` | Global | Catálogo común para relaciones familiares. |
| `organizaciones` | Global de plataforma | Es el registro raíz que separa a cada ONG. |

### Roles

`roles` se mantiene inicialmente como catálogo global para no ampliar innecesariamente el alcance de la primera migración. Antes de incorporar configuración avanzada por ONG se evaluará si Semilla necesita roles personalizados por organización además de roles base del sistema.

## Entidades directamente organizacionales

Estas tablas deben poseer `organizacion_id` porque constituyen raíces o registros que podrían existir independientemente en distintas ONG:

| Entidad | Estado | Observación |
|---|---|---|
| `usuarios` | Fase 1 | Cada usuario pertenece a una organización activa. |
| `zonas` | Fase 2 | Cada ONG define sus propias zonas de trabajo. |
| `comunidades` | Fase 2 | Cada comunidad pertenece a una organización. |
| `personas` | Pendiente | Evita compartir beneficiarios o empleados entre ONG sin autorización. |
| `proveedores` | Pendiente | Cada ONG administra su directorio de proveedores. |
| `equipos_misioneros` | Pendiente | Operación específica de cada organización. |
| `proyectos` | Pendiente | Núcleo de la intervención de cada ONG. |
| `bitacora_auditoria` | Pendiente | Debe permitir auditoría y consultas limitadas por organización. |

## Entidades aisladas por relación

Estas entidades están subordinadas a una raíz organizacional y pueden obtener su organización mediante esa relación. Se evaluará caso por caso si también conviene almacenar `organizacion_id` directamente para consultas, integridad y auditoría.

- `familias` → comunidad.
- `contactos` → familia.
- `miembros_familia` → familia/persona.
- `perfiles_familia` → familia/proyecto.
- `actividades_programadas` → proyecto/equipo misionero.
- `avances_proyecto` → proyecto.
- `personal_contratado` → proyecto/persona.
- `servicios_basicos` → proyecto.
- `solicitudes_pago` → proyecto.
- `pagos` → solicitud de pago.
- `evidencias` → proyecto/avance/solicitud.
- `dispositivos_sincronizacion` → usuario.
- `claves_idempotencia` → usuario/dispositivo.
- `tokens_refresco` → usuario.

## Decisión para territorio

`zonas` y `comunidades` tendrán `organizacion_id` directo.

Además, PostgreSQL debe impedir relaciones cruzadas. Una comunidad solo puede apuntar a una zona cuya `organizacion_id` sea la misma.

Esto permite que dos organizaciones tengan, por ejemplo, una `Zona 1` o una comunidad con el mismo nombre sin conflicto global.

## Regla de consultas

Patrón correcto:

```sql
SELECT ...
FROM comunidades
WHERE organizacion_id = $1;
```

Donde `$1` procede de:

```text
JWT validado
   ↓
req.auth.organizacionId
   ↓
servicio backend
   ↓
consulta SQL
```

Patrón que debe evitarse:

```text
frontend envía organizacionId
        ↓
backend confía en ese valor
        ↓
consulta información
```

El cliente puede enviar identificadores de entidades de negocio, pero la organización autorizada siempre se determina desde la sesión.

## Fases

### Fase 1 - Contexto autenticado

- Tabla `organizaciones`.
- Ministerio Sal y Luz como organización inicial.
- `usuarios.organizacion_id`.
- Organización incluida en login, refresh, `/me` y JWT.

### Fase 2 - Territorio

- `zonas.organizacion_id`.
- `comunidades.organizacion_id`.
- Unicidad territorial por organización.
- Integridad para impedir comunidad → zona de otra ONG.
- Dashboard filtrado por organización.

### Fase 3 - Núcleo operativo

- Personas.
- Proveedores.
- Equipos misioneros.
- Proyectos.
- Auditoría.
- Revisión de relaciones derivadas.

### Fase 4 - Verificación de aislamiento

Crear una segunda organización de prueba y validar que un usuario de una ONG no pueda consultar, modificar ni relacionar datos de la otra organización.

## Criterio de diseño para nuevos módulos

Los próximos módulos —Donantes, Donaciones, Asignaciones, Territorio, Evidencias y portales externos— deben crearse desde el inicio respetando el contexto multi-organización. No se deberán construir primero como tablas globales para luego corregirlas.
