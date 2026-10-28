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
│   └── bitacora/
│       └── semana-1.md
├── .gitignore
└── README.md
```

## Flujo de ramas

- `main`: producción y entregas estables.
- `develop`: integración y desarrollo.
- `feature/*`: nuevas funcionalidades.

## Enfoque offline-first

Semilla está diseñada para apoyar trabajo en comunidades rurales con conectividad limitada. La aplicación podrá almacenar temporalmente información de campo en el dispositivo y sincronizarla con el servidor cuando vuelva a existir conexión.

## Proyecto académico

Repositorio oficial del proyecto **Semilla - Gestión Comunitaria**.

Token de propiedad del proyecto:

`LEARN-CAP-4EC8DB14`
