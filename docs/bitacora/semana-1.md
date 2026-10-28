# Bitácora - Semana 1

## Proyecto

**Semilla - Gestión Comunitaria**  
**Lema:** Recursos que generan desarrollo.

## Objetivos de la semana

Durante esta primera semana el objetivo principal fue transformar la idea inicial de Semilla en una solución con una base técnica, documental y de despliegue real. No se buscó construir todavía todos los módulos funcionales, sino definir correctamente el problema, seleccionar las tecnologías, organizar el repositorio y comprobar desde el inicio que la aplicación pudiera ejecutarse en internet mediante HTTPS.

Los objetivos trabajados fueron:

- Definir la identidad y visión inicial de Semilla.
- Establecer el problema que la aplicación busca resolver.
- Definir el stack tecnológico del proyecto.
- Crear el repositorio oficial en GitHub.
- Preparar las ramas de desarrollo y producción.
- Organizar frontend y backend dentro de un mismo repositorio.
- Crear una primera versión del frontend y del backend.
- Publicar el frontend y el backend en servicios reales de producción.
- Documentar las decisiones técnicas y los aprendizajes de la semana.

## Qué hice durante la semana

Comencé definiendo el nombre comercial **Semilla** y el lema **“Recursos que generan desarrollo”**, con el propósito de que la aplicación tuviera una identidad más cercana a las comunidades y organizaciones de desarrollo, evitando un nombre excesivamente técnico.

Después definí la estructura inicial de la solución y creé el repositorio público `semilla-gestion-comunitaria`. El proyecto se organizó como un monorepo sencillo, con las carpetas `frontend`, `backend`, `database` y `docs`.

También establecí un flujo de trabajo con ramas separadas:

- `main`: versión estable y de producción.
- `develop`: integración y desarrollo.
- `feature/*`: funcionalidades específicas que se desarrollarán posteriormente.

En el frontend se creó una primera versión de la interfaz de Semilla utilizando React, TypeScript y Vite. Esta primera pantalla todavía no representa la aplicación completa, pero permite comprobar que el proyecto puede compilarse, desplegarse y funcionar correctamente desde internet.

En el backend se preparó una API inicial con Node.js, Express y TypeScript. Se creó un endpoint de verificación de salud en `/api/health` para poder comprobar que el servicio se encuentra funcionando correctamente.

El frontend fue publicado en Vercel y el backend en Render. Con esto se logró que ambas partes de la solución se encuentren disponibles mediante HTTPS desde la primera semana.

### URLs de producción

- Frontend: `https://semilla-gestion-comunitaria.vercel.app`
- Backend: `https://semilla-api.onrender.com`
- Verificación de salud: `https://semilla-api.onrender.com/api/health`

Durante el despliegue también surgieron errores reales de compilación que fue necesario analizar y corregir. En Vercel, TypeScript no reconocía correctamente los tipos relacionados con Vite, por lo que se agregó `vite-env.d.ts`. En Render, el backend no compilaba porque las dependencias de desarrollo de TypeScript no se estaban instalando al tener `NODE_ENV=production`, por lo que se ajustó el comando de compilación para incluirlas durante el proceso de build.

Estos problemas fueron importantes porque permitieron comprobar desde temprano que una aplicación puede funcionar localmente y aun así presentar dificultades cuando se lleva a un entorno real de despliegue.

## Decisiones tomadas y por qué

### Nombre de la aplicación

Se decidió utilizar **Semilla** en lugar de un nombre técnico como SIGERCO. La intención es que el producto sea fácil de recordar y tenga una identidad relacionada con crecimiento, desarrollo y transformación comunitaria.

### Arquitectura

Se decidió utilizar un **monolito modular** en lugar de microservicios. Para un proyecto que debe desarrollarse en aproximadamente diez semanas, esta arquitectura permite avanzar con mayor rapidez y mantener una estructura organizada sin agregar complejidad innecesaria.

### Frontend

Inicialmente se analizaron distintas posibilidades, pero decidí trabajar con:

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- React Hook Form
- Zod

La elección de React también parte de tecnologías y librerías con las que ya he tenido experiencia en otros proyectos, lo cual reduce la curva de aprendizaje y permite concentrar mayor esfuerzo en la lógica de negocio de Semilla.

### Backend

Aunque inicialmente se había considerado ASP.NET Core como una alternativa para el backend, propuse utilizar **Node.js con Express** porque es un stack con el que ya tengo experiencia y permite mantener JavaScript/TypeScript tanto en frontend como en backend.

Finalmente se decidió trabajar con:

- Node.js
- Express
- TypeScript
- Prisma ORM
- Zod
- Swagger / OpenAPI

Esta decisión busca simplificar el desarrollo durante las diez semanas sin cerrar la posibilidad de escalar el proyecto posteriormente.

### Base de datos

Propuse utilizar **PostgreSQL** como sistema gestor de base de datos. Se eligió por su robustez, soporte de relaciones, restricciones, transacciones y capacidad para trabajar adecuadamente con un sistema que tendrá comunidades, familias, beneficiarios, proyectos, recursos, donaciones, compras y otros módulos relacionados.

Se utilizará Prisma como ORM para manejar el esquema, migraciones y acceso a datos desde Node.js.

### Seguridad

Desde el inicio planteé que la aplicación debe considerar seguridad y no agregarla al final. La propuesta incluye:

- JWT para autenticación.
- Access Token y Refresh Token.
- Argon2id para contraseñas.
- Roles y permisos.
- Validaciones tanto en frontend como backend.
- Variables de entorno para credenciales.
- HTTPS.
- Auditoría de operaciones importantes.

### Funcionamiento offline

Un punto que consideré especialmente importante es que Semilla será utilizada en comunidades rurales donde el acceso a internet puede ser limitado o inexistente. Por esa razón se decidió diseñar la aplicación con una visión **offline-first**.

La propuesta es utilizar una PWA, IndexedDB y Dexie para permitir que ciertas operaciones de campo puedan realizarse sin conexión y sincronizarse posteriormente cuando el dispositivo recupere internet.

No todas las operaciones funcionarán offline. Se priorizarán funciones de campo como familias, beneficiarios, visitas, actividades, necesidades y evidencias, mientras que operaciones administrativas o financieras sensibles se realizarán preferiblemente con conexión.

## Qué le pedí a la IA

Durante esta semana utilicé inteligencia artificial como apoyo para analizar alternativas y acelerar tareas técnicas, pero las decisiones finales se tomaron considerando las necesidades reales del proyecto.

Entre las principales solicitudes realizadas a la IA estuvieron:

- Analizar y comparar posibles stacks tecnológicos para el proyecto.
- Proponer una arquitectura que pudiera desarrollarse en diez semanas y al mismo tiempo permitir crecimiento futuro.
- Analizar la conveniencia de utilizar React para frontend y Node.js/Express para backend.
- Proponer mecanismos de seguridad con JWT, refresh tokens, roles y permisos.
- Analizar cómo resolver el trabajo en comunidades con poca conectividad mediante una estrategia online/offline.
- Organizar la estructura del repositorio y el flujo de ramas.
- Preparar la configuración inicial del frontend y backend.
- Orientar el despliegue de React en Vercel y la API de Express en Render.
- Analizar y corregir errores encontrados durante los despliegues.
- Apoyar la documentación de la visión y la bitácora del proyecto.

## Qué acepté de las propuestas de IA

Acepté varias recomendaciones que considero adecuadas para el proyecto:

- Utilizar TypeScript tanto en frontend como en backend.
- Mantener frontend y backend dentro de un único repositorio.
- Trabajar con un monolito modular en lugar de microservicios.
- Utilizar Prisma como ORM para PostgreSQL.
- Separar `main` y `develop` para producción y desarrollo.
- Utilizar Vercel para el frontend y Render para el backend.
- Incluir desde el inicio un endpoint de salud para verificar la API.
- Diseñar la aplicación con una arquitectura preparada para trabajo offline.
- Incorporar seguridad, auditoría y permisos desde las primeras etapas del diseño.

## Qué cambié o adapté

No tomé todas las propuestas iniciales de forma automática. Algunas decisiones fueron modificadas de acuerdo con mi experiencia y las necesidades del proyecto.

Una de las decisiones más importantes fue preferir **Node.js y Express** para el backend en lugar de ASP.NET Core. Aunque ASP.NET Core es una alternativa robusta, considero que Node.js/Express permite avanzar más rápido dentro del plazo disponible y utilizar TypeScript en ambas partes de la aplicación.

También propuse directamente utilizar **PostgreSQL** como base de datos y mantener React como tecnología principal del frontend, aprovechando conocimientos y librerías que ya he utilizado anteriormente.

Además, decidí que el nombre comercial debía ser **Semilla**, descartando nombres demasiado técnicos para una aplicación cuyo principal contexto de uso son organizaciones y comunidades.

## Qué descarté

Se descartó utilizar microservicios durante esta primera versión porque agregarían una complejidad que no aporta suficiente valor dentro del alcance de diez semanas.

También se descartó desarrollar aplicaciones independientes para Android e iOS en esta etapa. En su lugar se plantea una PWA, que permite conservar una sola base de código y cubrir parte de las necesidades móviles y offline.

No se consideró conveniente dejar el despliegue para el final del proyecto. La decisión fue hacer una publicación funcional desde la primera semana, aunque la aplicación todavía no tenga todos sus módulos terminados.

## Mi principal aprendizaje de la semana

Mi principal aprendizaje durante esta semana fue comprender mejor la importancia de preparar correctamente **un entorno de desarrollo y un entorno de producción** desde las primeras etapas de un proyecto.

Antes de esta experiencia podía parecer suficiente desarrollar primero toda la aplicación de forma local y publicarla cuando estuviera prácticamente terminada. Sin embargo, esta semana comprobé que el despliegue también forma parte del proceso de desarrollo y que existen problemas que solamente aparecen cuando la solución se ejecuta en un entorno real.

Los errores encontrados en Vercel y Render fueron una demostración concreta. La aplicación podía estar correctamente estructurada, pero aparecieron diferencias relacionadas con compilación, tipos de TypeScript, dependencias de desarrollo, variables de entorno y configuración del servidor.

Esto me permitió entender que **no importa que una aplicación todavía no tenga todo su cuerpo funcional para comenzar a desplegarla**. Publicarla desde temprano permite validar continuamente que la arquitectura, las dependencias, el proceso de compilación y la infraestructura siguen funcionando a medida que la aplicación crece.

Si se espera hasta el final para publicar una solución grande, existe el riesgo de descubrir demasiados problemas de integración y despliegue al mismo tiempo. En cambio, mantener una versión publicada desde el inicio permite detectar los problemas de manera incremental.

También aprendí que el profesionalismo en el desarrollo de software no consiste solamente en escribir código que funcione. Las **buenas prácticas**, la separación de ambientes, el control de versiones, los Pull Requests, los commits claros, las variables de entorno, la seguridad y la documentación son elementos fundamentales para construir soluciones confiables.

Estas prácticas son todavía más importantes en Semilla porque la aplicación está pensada para apoyar decisiones relacionadas con recursos, familias, proyectos y programas de desarrollo comunitario. Si el sistema será utilizado como apoyo para tomar decisiones, la solución debe construirse desde el inicio con orden, trazabilidad y criterios profesionales.

## Resultado de la semana

Al finalizar la Semana 1, Semilla cuenta con:

- Repositorio público en GitHub.
- Documentación inicial de visión y alcance.
- Rama de producción `main`.
- Rama de desarrollo `develop`.
- Frontend inicial con React, TypeScript y Vite.
- Backend inicial con Node.js, Express y TypeScript.
- Endpoint de verificación de salud.
- Frontend desplegado en Vercel mediante HTTPS.
- Backend desplegado en Render mediante HTTPS.
- Variables de entorno separadas del código.
- Comunicación preparada entre frontend y backend.
- Base arquitectónica para continuar con PostgreSQL, Prisma, autenticación y los módulos funcionales.

## Próximos pasos

- Revisar y convertir el modelo SQL existente a PostgreSQL.
- Diseñar al menos 20 tablas relacionadas con sentido funcional para Semilla.
- Normalizar el modelo de datos donde sea necesario.
- Incorporar UUID, auditoría y campos necesarios para sincronización offline.
- Crear el esquema inicial de Prisma.
- Configurar PostgreSQL para desarrollo y producción.
- Implementar autenticación, roles y permisos.
- Crear el release académico `semana-1`.
