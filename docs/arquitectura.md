# Arquitectura de Semilla

**Proyecto:** Semilla — Recursos que generan desarrollo  
**Versión de referencia:** Semana 6, 21 de noviembre de 2026.

## 1. Contexto y alcance

Semilla centraliza la gestión de programas de desarrollo comunitario. La solución relaciona organizaciones, comunidades, familias, proyectos, recursos, donantes y evidencias. El sistema permite que cada organización gestione su propia información y que los donantes consulten únicamente los proyectos autorizados.

Los actores principales son el administrador de plataforma, administrador institucional, coordinador, personal de campo, finanzas y donantes. Los permisos efectivos determinan qué operaciones puede realizar cada cuenta.

```mermaid
flowchart LR
    A[Administrador de plataforma] --> S[Semilla]
    B[Administrador y coordinador] --> S
    C[Campo y finanzas] --> S
    D[Donante] --> S
    S --> N[(PostgreSQL - Neon)]
    S --> R[Cloudflare R2]
```

## 2. Contenedores y despliegue

Se utiliza un monolito modular en el backend, con frontend independiente y servicios administrados de persistencia. No se requiere desplegar un microservicio por módulo.

```mermaid
flowchart LR
    U[Usuario / navegador] -- HTTPS --> F[React + Vite / Vercel]
    F -- REST JSON / HTTPS --> B[Node.js + Express / Render]
    B -- SQL / TLS --> P[(PostgreSQL / Neon)]
    B -- S3 API / HTTPS --> O[Cloudflare R2 privado]
    G[GitHub] --> F
    G --> B
```

| Contenedor | Responsabilidad |
|---|---|
| Frontend | Interfaz React y TypeScript, estilos CSS, navegación por roles, formularios y consumo de API. |
| Backend | Express y TypeScript; autenticación, autorización, reglas de negocio, validaciones y acceso a datos. |
| PostgreSQL | Modelo relacional, restricciones, transacciones y auditoría. Neon separa desarrollo y producción. |
| Cloudflare R2 | Conservación privada de evidencias y acceso controlado desde el backend. |

La configuración de conexiones y credenciales se mantiene en variables de entorno. No se incluyen secretos en el repositorio ni en los diagramas.

## 3. Componentes y capas

```mermaid
flowchart TD
    UI[Componentes y módulos React] --> API[Cliente HTTP frontend]
    API --> M[Middleware de autenticación y permisos]
    M --> R[Rutas Express]
    R --> D[Validación de dominio]
    R --> S[Servicios de negocio]
    D --> S
    R --> P[Pool PostgreSQL]
    S --> P
    S --> O[Servicio R2]
    P --> DB[(Base de datos)]
```

La organización actual separa presentación, comunicación HTTP, autorización, dominio y servicios. La modularización es incremental: comunidades agrupa sus rutas y servicio, y extrae su consulta de listado a un repositorio. Otras operaciones de comunidades y otras rutas todavía contienen SQL en servicios o controladores; por tanto, aún no existe una capa de repositorios uniforme. Se utiliza el controlador pg para las consultas de negocio y se mantienen dependencias y utilidades de Prisma. Los cambios del esquema se versionan en scripts SQL.

## 4. Organización del repositorio

```text
semilla-gestion-comunitaria/
├── frontend/
│   └── src/
│       ├── componentes/
│       ├── estilos/
│       ├── modulos/
│       ├── lib/api.ts
│       ├── App.tsx
│       └── main.tsx
├── backend/
│   ├── src/
│   │   ├── config/                    # Configuración común vigente
│   │   ├── domain/                    # Dominio compartido / en transición
│   │   ├── middleware/                # Autenticación y permisos
│   │   ├── modules/
│   │   │   └── comunidades/
│   │   │       ├── comunidades.routes.ts
│   │   │       ├── comunidades.service.ts
│   │   │       ├── comunidades.repository.ts
│   │   │       ├── capacidades.routes.ts
│   │   │       └── necesidades.routes.ts
│   │   ├── routes/                    # Rutas restantes y adaptadores
│   │   ├── security/
│   │   ├── services/                  # Servicios restantes y adaptadores
│   │   └── server.ts
│   └── tests/
├── database/sql/
└── docs/
    ├── arquitectura.md
    ├── decisiones/
    └── bitacora/
```

React Flow se utiliza para visualizar relaciones y avances; Gridstack permite organizar indicadores; ECharts apoya las visualizaciones. El editor Tiptap forma parte de las dependencias del módulo de contratos.

### Primera migración funcional: comunidades

Se conserva una única aplicación Express (`server.ts`), el punto de entrada `/api/comunidades`, las rutas anidadas de capacidades y necesidades, el middleware de permisos y las respuestas JSON. Los archivos anteriores de `routes/comunidades.routes.ts`, `routes/capacidades.routes.ts`, `routes/necesidades.routes.ts` y `services/comunidades.service.ts` son adaptadores de reexportación para no romper consumidores existentes.

```mermaid
flowchart TD
    S[server.ts / una API] --> R[modules/comunidades/comunidades.routes.ts]
    R --> A[Permisos existentes]
    R --> V[Servicio del módulo]
    V --> Q[Repositorio: listado por organización]
    Q --> P[(PostgreSQL / Neon)]
    V --> L[Consultas transaccionales aún en el servicio]
    L --> P
    R --> E[Servicios de expediente y dominio compartido]
```

La extracción de operaciones de escritura al repositorio, y la migración de `proyectos` y `donantes`, son pasos futuros condicionados por pruebas de integración. No se crea una nueva conexión ni se cambia la estructura de las tablas. Véase [ADR 004](decisiones/004-migracion-modular-comunidades.md).

## 5. Segundo flujo de negocio: seguimiento y validación de proyectos

El flujo complementa el registro territorial y comunitario con el seguimiento de actividades y resultados. Un usuario autorizado registra avances, estos se envían a revisión y el resultado del proyecto se calcula con avances validados. El donante consulta el proyecto asignado y las evidencias expresamente compartidas.

```mermaid
sequenceDiagram
    actor C as Campo
    participant A as API
    participant DB as PostgreSQL
    actor R as Revisor autorizado
    actor D as Donante
    C->>A: Registrar avance y enviar a revisión
    A->>DB: Validar tenant, permisos y guardar avance
    R->>A: Validar o devolver avance
    A->>DB: Registrar estado y auditoría
    D->>A: Consultar mapa de proyecto asignado
    A->>DB: Comprobar asignación y permisos vigentes
    DB-->>A: Avances validados y evidencias permitidas
    A-->>D: Vista de solo lectura
```

Las cantidades validadas se acumulan hasta la meta. Las estimaciones porcentuales utilizan la última validada. El resultado global utiliza las ponderaciones configuradas. La revisión propia se restringe según el rol y se audita cuando está autorizada.

## 6. Seguridad y calidad

- JWT de acceso y sesiones de renovación; contraseñas almacenadas mediante scrypt.
- El middleware consulta el estado de la cuenta, organización, roles y restricciones vigentes en PostgreSQL.
- Las consultas sensibles verifican la pertenencia a la organización y, para donantes, la asignación específica del proyecto.
- Las fotografías privadas requieren controles de autorización y acceso temporal o transferencia desde el servidor.
- Las migraciones SQL se verifican antes de aplicarse en producción; se conserva respaldo.
- GitHub Actions compila y ejecuta las pruebas de integración; Vercel valida la compilación del frontend.

## 7. Estado y evolución

La consolidación de la semana 6 incluye cuentas y perfiles, restricciones por organización, expedientes familiares, proveedores, contratos, pagos, proyectos y portal de donantes. La sincronización offline completa y la autenticación mediante Google quedan como evolución posterior, no como funciones verificadas en esta entrega.

## 8. Referencias

- [Modelo de datos](modelo-datos.md)
- [Decisiones de arquitectura](decisiones/README.md)
- [Bitácora semana 6](bitacora/semana-6.md)
- [PR de consolidación #47](https://github.com/leortiz41/semilla-gestion-comunitaria/pull/47)
