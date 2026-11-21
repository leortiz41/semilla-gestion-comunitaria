# Semilla

**Recursos que generan desarrollo**

Semilla es una plataforma web para la gestión integral de recursos, familias, proyectos, donaciones y actividades en programas de desarrollo comunitario, con funcionamiento web en línea y un objetivo futuro de trabajo sin conexión.

## Objetivo

Centralizar y dar trazabilidad a la información de programas de desarrollo comunitario, permitiendo relacionar comunidades, familias, beneficiarios, proyectos, recursos, donaciones, actividades y evidencias desde una sola plataforma.

## Stack tecnológico actual

- **Frontend:** React, TypeScript, Vite, CSS, ECharts, Gridstack, React Flow y Tiptap.
- **Backend:** Node.js, Express, TypeScript, pg, JWT y scrypt; dependencias y utilidades de Prisma.
- **Persistencia:** PostgreSQL en Neon y Cloudflare R2 para evidencias.
- **Despliegue:** Vercel (frontend), Render (API) y GitHub Actions (validación).

## Arquitectura

Frontend independiente y backend monolítico modular, comunicados mediante REST sobre HTTPS. PostgreSQL conserva los datos relacionales y R2 las evidencias privadas. El acceso se controla por organización, roles y permisos vigentes.

Consultar [arquitectura de Semilla](docs/arquitectura.md) para los diagramas de contexto, contenedores, capas y segundo flujo.

## Estructura del repositorio

```text
semilla-gestion-comunitaria/
├── frontend/
├── backend/
├── database/
├── docs/
│   ├── vision.md
│   ├── mapa-historias.md
│   ├── modelo-datos.md
│   ├── plan.md
│   ├── seguridad-autenticacion.md
│   ├── arquitectura.md
│   ├── decisiones/
│   │   ├── README.md
│   │   ├── 001-monolito-modular.md
│   │   ├── 002-aislamiento-multitenant.md
│   │   └── 003-evidencias-y-resultados.md
│   └── bitacora/
│       ├── semana-1.md
│       ├── semana-2.md
│       ├── semana-3.md
│       ├── semana-5.md
│       └── semana-6.md
├── .gitignore
└── README.md
```

## Documentación académica

### Base del proyecto

- [Visión del proyecto](docs/vision.md)
- [Seguridad y autenticación](docs/seguridad-autenticacion.md)

### Semana 1

- [Bitácora - Semana 1](docs/bitacora/semana-1.md)
- Release: `semana-1`

### Semana 2 - Del cliente al backlog

- [Mapa de historias de usuario](docs/mapa-historias.md)
- [Plan de trabajo y backlog priorizado](docs/plan.md)
- [Bitácora - Semana 2](docs/bitacora/semana-2.md)
- Release requerido: `semana-2`

### Semana 3 - Datos que sostienen el negocio

- [Modelo de datos del producto completo](docs/modelo-datos.md)
- [Bitácora - Semana 3](docs/bitacora/semana-3.md)
- Etiqueta de entrega: `semana-3`
- El documento refleja la etapa de modelado de la semana 3; el esquema ha evolucionado con las migraciones posteriores.

### Semana 5 - MVP en manos de usuarios

- [Guion de pruebas y observaciones preliminares](docs/pruebas-usuarios.md).
- [Bitácora - Semana 5](docs/bitacora/semana-5.md).
- Organizaciones piloto: **Corazón para Honduras**, **Ministerio Sal y Luz** y **Glow International**.
- Pruebas previstas con **3 a 5 personas reales**; resultados y decisión de hipótesis pendientes de registrar.
- Mejoras planificadas en los issues [#42](https://github.com/leortiz41/semilla-gestion-comunitaria/issues/42), [#43](https://github.com/leortiz41/semilla-gestion-comunitaria/issues/43), [#44](https://github.com/leortiz41/semilla-gestion-comunitaria/issues/44) y [#45](https://github.com/leortiz41/semilla-gestion-comunitaria/issues/45).

### Semana 6 — Segundo flujo y decisiones

- [Arquitectura: contexto, contenedores, capas y carpetas](docs/arquitectura.md).
- [Registro de decisiones de arquitectura (ADR)](docs/decisiones/README.md).
- [Bitácora de la semana 6](docs/bitacora/semana-6.md).
- Segundo flujo: planificación, ejecución, revisión de avances y consulta de resultados por donantes.
- Etiqueta de entrega requerida: `semana-6`.

## Flujo de ramas

- `main`: producción y entregas estables.
- `develop`: integración y desarrollo.
- Las mejoras se integran en `develop` y se promueven a `main` mediante PR.

## Estado funcional actual

La versión de referencia de la semana 6 integra autenticación y permisos multi-tenant, Superadministración, Dashboard, zonas, comunidades, expedientes de familias, proveedores, pagos y contratos, planificación y seguimiento de proyectos, evidencias, donantes y configuración institucional. La integración se documenta en el PR #47; el ajuste visual posterior, en el PR #51. La verificación de cada flujo en producción se distingue de las pruebas efectuadas en desarrollo y CI.

## Enfoque offline-first

Semilla está diseñada para apoyar trabajo en comunidades rurales con conectividad limitada. La aplicación podrá almacenar temporalmente información de campo en el dispositivo y sincronizarla con el servidor cuando vuelva a existir conexión.

## Despliegues

- Frontend: `https://semilla-gestion-comunitaria.vercel.app`
- Backend: `https://semilla-api.onrender.com`
- Health check: `https://semilla-api.onrender.com/api/health`

## Proyecto académico

Repositorio oficial del proyecto **Semilla - Gestión Comunitaria**.

Token de propiedad del proyecto:

`LEARN-CAP-4EC8DB14`
