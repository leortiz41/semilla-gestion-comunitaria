# Bitácora - Semana 1

## Proyecto

**Semilla - Gestión Comunitaria**  
**Lema:** Recursos que generan desarrollo.

## Objetivos de la semana

- Definir la identidad y visión inicial del producto.
- Crear el repositorio oficial del proyecto.
- Establecer las ramas `main` y `develop`.
- Definir el stack tecnológico.
- Preparar la estructura inicial del monorepo.
- Documentar el problema, alcance e hipótesis.
- Preparar la primera versión desplegable por HTTPS.

## Decisiones tomadas

### Nombre
Se adoptó **Semilla** como nombre comercial de la aplicación.

### Arquitectura
Se utilizará un monolito modular con frontend y backend separados dentro de un mismo repositorio.

### Frontend
React + TypeScript + Vite + Tailwind CSS.

### Backend
Node.js + Express + TypeScript.

### Base de datos
PostgreSQL mediante Prisma ORM.

### Seguridad
JWT con access y refresh tokens, Argon2id, roles y permisos, validaciones y auditoría.

### Operación en campo
La aplicación seguirá un enfoque PWA y offline-first mediante IndexedDB/Dexie y sincronización cuando vuelva la conectividad.

## Estructura acordada

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

## Flujo Git

- `main`: rama estable de producción.
- `develop`: integración y pruebas.
- `feature/*`: nuevas funcionalidades.

## Avances realizados

- Repositorio creado en GitHub.
- Rama `develop` creada.
- README inicial documentado.
- Visión y alcance del proyecto documentados.
- `.gitignore` configurado para frontend, backend y credenciales.

## Pendientes de la semana

- Inicializar frontend React.
- Inicializar backend Express.
- Crear endpoint de salud de la API.
- Preparar PostgreSQL/Prisma.
- Desplegar frontend por HTTPS.
- Desplegar backend por HTTPS.
- Configurar ambientes de desarrollo y producción.
- Crear release `semana-1` al cerrar la entrega.

## Aprendizajes

La conectividad limitada de las comunidades rurales es un requisito arquitectónico central, por lo que el soporte offline debe considerarse desde el diseño y no agregarse al final del proyecto.
