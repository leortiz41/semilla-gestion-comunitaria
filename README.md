# Semilla

**Recursos que generan desarrollo**

Semilla es una plataforma web para la gestión integral de recursos, familias, proyectos, donaciones y actividades en programas de desarrollo comunitario, con soporte para trabajo en línea y sin conexión.

## Objetivo

Centralizar y dar trazabilidad a la información de programas de desarrollo comunitario, permitiendo relacionar comunidades, familias, beneficiarios, proyectos, recursos, donaciones, actividades y evidencias desde una sola plataforma.

## Stack tecnológico

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- React Hook Form
- Zod
- PWA
- IndexedDB / Dexie

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM
- JWT
- Argon2
- Zod
- Swagger / OpenAPI

### Base de datos
- PostgreSQL

## Arquitectura inicial

```text
React PWA
   │
   │ REST / HTTPS
   ▼
Node.js + Express
   │
   │ Prisma
   ▼
PostgreSQL
```

## Estructura del repositorio

```text
semilla-gestion-comunitaria/
├── frontend/
├── backend/
├── database/
├── docs/
│   ├── vision.md
│   ├── mapa-historias.md
│   ├── plan.md
│   ├── seguridad-autenticacion.md
│   └── bitacora/
│       ├── semana-1.md
│       └── semana-2.md
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

## Flujo de ramas

- `main`: producción y entregas estables.
- `develop`: integración y desarrollo.
- `feature/*`: nuevas funcionalidades.

## Estado funcional actual

La aplicación ya cuenta con una base de autenticación y autorización, estructura administrativa, Dashboard con indicadores conectados a PostgreSQL/Neon y una primera capa de experiencia de usuario para el módulo de Comunidades.

El expediente completo de Comunidades todavía requiere completar su persistencia de punta a punta en el backend y la base de datos.

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
