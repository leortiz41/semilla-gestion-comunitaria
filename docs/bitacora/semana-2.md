# Bitácora - Semana 2

## Proyecto

**Semilla - Gestión Comunitaria**  
**Lema:** Recursos que generan desarrollo.

## Enfoque de la semana

Durante la Semana 2 el objetivo fue pasar de la visión general definida en la primera entrega a una estructura de producto más concreta: identificar qué necesita hacer el usuario, transformar esas necesidades en historias de usuario, priorizar el backlog y comenzar a implementar las bases funcionales que permitirán desarrollar el MVP de forma ordenada.

La idea principal de esta semana fue trabajar **del cliente al backlog**, evitando construir módulos aislados sin una relación clara con el problema que Semilla busca resolver.

## Objetivos de la semana

- Organizar las necesidades del cliente en un mapa de historias de usuario.
- Priorizar las historias principales del MVP.
- Definir un plan de desarrollo para las diez semanas.
- Fortalecer autenticación, sesión, roles y permisos.
- Conectar el Dashboard con datos reales almacenados en PostgreSQL/Neon.
- Construir la estructura administrativa de la aplicación.
- Iniciar el módulo de Comunidades con una experiencia de usuario coherente.
- Mantener la aplicación desplegada públicamente mediante HTTPS.
- Documentar avances, decisiones y aprendizajes.

## Del problema del cliente al backlog

El punto de partida continúa siendo el problema de información fragmentada. Una organización de desarrollo comunitario necesita relacionar comunidades, familias, personas, proyectos, actividades, recursos, pagos y evidencias sin depender de múltiples archivos desconectados.

A partir de esa necesidad organicé el producto alrededor de actividades principales:

1. Acceso seguro.
2. Consulta de indicadores.
3. Gestión de comunidades.
4. Gestión de familias y beneficiarios.
5. Gestión de programas, proyectos y actividades.
6. Trazabilidad de recursos.
7. Evidencias.
8. Reportes y auditoría.
9. Trabajo de campo con conectividad limitada.

Estas actividades se transformaron en historias de usuario priorizadas dentro de `docs/mapa-historias.md`.

## Trabajo realizado

### 1. Autenticación y control de acceso

Se integró el núcleo de autenticación y autorización del backend.

Entre los avances se encuentran:

- Inicio de sesión con correo y contraseña.
- Hash seguro de contraseñas.
- JWT de acceso de corta duración.
- Refresh token rotativo y revocable.
- Cookie `HttpOnly` para el refresh token.
- Consulta de sesión mediante `/api/auth/me`.
- Cambio obligatorio de contraseña para usuarios con contraseña temporal.
- Middleware de autenticación, roles y permisos.
- Registro de eventos de autenticación en la bitácora de auditoría.
- Flujo React para validar inicio de sesión, sesión, permisos, cambio de contraseña y cierre de sesión.

Este bloque fue integrado mediante el **Pull Request #8**.

### 2. Base administrativa y Dashboard

Después de la autenticación construí una estructura administrativa reutilizable para evitar que la aplicación creciera como una sola pantalla.

Se agregaron:

- Barra lateral administrativa.
- Encabezado de sesión.
- Página de Dashboard.
- Componente reutilizable para tarjetas de resumen.
- Servicio frontend para consultar el resumen.
- Ruta protegida `GET /api/dashboard/resumen`.
- Consulta real a PostgreSQL/Neon.
- Indicador de comunidades registradas.
- Indicador de comunidades activas.

La conexión entre frontend, backend y base de datos permite comprobar que Semilla ya no muestra únicamente contenido estático, sino información real protegida por autenticación y permisos.

La primera integración de este bloque se realizó mediante el **Pull Request #9**.

### 3. Navegación e identidad visual

También se trabajó en la experiencia general de la aplicación:

- Navegación real desde la barra lateral.
- Estado visual del módulo activo.
- Acceso al perfil y seguridad desde el encabezado.
- Páginas base para Comunidades, Familias, Proyectos, Evidencias, Pagos, Usuarios y Auditoría.
- Incorporación del logo oficial de Semilla.
- Ajustes de pantalla de bienvenida.
- Diseño responsivo del Dashboard.

La intención fue establecer un patrón visual y de navegación antes de comenzar a desarrollar todos los módulos de forma independiente.

### 4. Primera capa del módulo de Comunidades

El módulo de Comunidades fue seleccionado como el primer módulo funcional porque muchas entidades del sistema dependen de él.

Se desarrolló una primera capa de interfaz con:

- Resumen visual de comunidades.
- Buscador con normalización de tildes.
- Filtros por zona y estado.
- Listado visual y responsivo.
- Estado vacío cuando no existen coincidencias.
- Navegación separada entre `Listado` y `Nueva comunidad`.

También se diseñó el expediente comunitario mediante acordeones para evitar un formulario excesivamente largo.

Las secciones definidas son:

1. Información general.
2. Población y vivienda.
3. Visión de desarrollo.
4. Organizaciones comunitarias activas.
5. Productividad local.

Dentro de visión de desarrollo se consideran áreas como evangelismo, educación formal, educación comunitaria e infraestructura. Para cada área se contempla situación actual, prioridad y visión/meta.

Este bloque fue integrado mediante el **Pull Request #10**.

## Estado real del módulo de Comunidades

Es importante diferenciar lo que ya funciona de lo que todavía está pendiente.

Actualmente:

- La navegación funciona.
- El listado, búsqueda y filtros funcionan en la capa frontend.
- El formulario/expediente ya tiene estructura UX.
- El Dashboard consulta datos reales de comunidades.

Sin embargo, el expediente completo de una nueva comunidad **todavía no persiste sus datos en la base de datos**. Esa será una de las prioridades inmediatas del siguiente ciclo.

## Decisiones tomadas

### Priorizar Comunidades antes que Familias

Se decidió completar primero Comunidades porque las familias y beneficiarios necesitan estar vinculados a un territorio o comunidad. Esto reduce el riesgo de construir módulos que luego requieran cambios importantes en sus relaciones.

### Separar listado y registro

El registro de una comunidad se convirtió en una vista independiente del listado. Esto mejora la navegación y evita una página excesivamente larga.

### Diseñar la experiencia antes de conectar toda la persistencia

Se validó primero la estructura del expediente y del listado para identificar qué información necesita realmente el usuario antes de construir endpoints y consultas definitivas.

### Mantener seguridad en backend

Los permisos no deben depender únicamente de ocultar opciones en el frontend. Las rutas sensibles continuarán siendo protegidas en el backend mediante autenticación y permisos.

## Qué le pedí a la IA

Durante esta semana utilicé inteligencia artificial como apoyo para:

- Convertir las necesidades generales del proyecto en historias de usuario.
- Organizar el backlog por prioridad.
- Analizar el orden más conveniente de implementación de módulos.
- Revisar la arquitectura de autenticación y autorización.
- Separar responsabilidades entre frontend, servicios y backend.
- Diseñar la estructura administrativa y el módulo de Comunidades.
- Analizar cómo dividir un expediente comunitario extenso sin afectar la usabilidad.
- Proponer criterios de aceptación y una definición de terminado.
- Documentar las decisiones y avances de la semana.

## Qué acepté de las propuestas de IA

Acepté principalmente:

- Mantener una estrategia incremental.
- Construir Comunidades antes de Familias.
- Separar listado y registro de comunidad.
- Utilizar acordeones para dividir el expediente comunitario.
- Mantener permisos en backend además del control visual del frontend.
- Usar historias de usuario y criterios de aceptación para evitar un backlog ambiguo.
- Mantener un plan semanal que pueda ajustarse según lo aprendido durante el proyecto.

## Qué adapté

El expediente de comunidad fue adaptado al contexto real de desarrollo comunitario. No se limitó a datos administrativos como nombre y ubicación, sino que se agregaron elementos que son importantes para conocer una comunidad:

- población y vivienda,
- visión de desarrollo,
- educación,
- infraestructura,
- organizaciones comunitarias,
- productividad local.

También se decidió mantener **Semilla** como nombre comercial y evitar que la interfaz se vea como un sistema técnico o contable aislado.

## Qué dejé pendiente de forma intencional

No se intentó completar todos los módulos durante esta semana. Se dejó pendiente:

- Persistencia completa del expediente comunitario.
- CRUD real de zonas.
- Familias y beneficiarios.
- Programas, proyectos y actividades completos.
- Donaciones, compras, gastos y pagos.
- Evidencias funcionales.
- Reportes completos de trazabilidad.
- Implementación offline.

La razón fue evitar ampliar demasiado el alcance antes de terminar correctamente el primer flujo funcional.

## Aprendizaje principal

Mi principal aprendizaje de esta semana fue que un backlog no debe ser solamente una lista de funciones que quiero construir. Debe existir una relación clara entre el problema del cliente, la actividad que realiza el usuario, la historia de usuario, su prioridad y el criterio que permitirá saber si realmente está terminada.

También comprobé que construir primero una base de seguridad y navegación facilita el crecimiento del sistema. Una vez existe autenticación, permisos, estructura administrativa y un patrón de módulos, las siguientes funcionalidades pueden incorporarse de forma más consistente.

Otro aprendizaje importante fue diferenciar entre una funcionalidad visualmente avanzada y una funcionalidad realmente terminada. Por ejemplo, el módulo de Comunidades ya tiene una experiencia de usuario bastante definida, pero todavía no puede considerarse completo porque el expediente no se guarda en PostgreSQL. Documentar esta diferencia permite que el avance sea más transparente y evita considerar como finalizado algo que todavía necesita integración de backend.

## Resultado de la Semana 2

Al finalizar esta etapa, Semilla cuenta con:

- Mapa de historias de usuario.
- Backlog priorizado.
- Plan de desarrollo de diez semanas.
- Autenticación y autorización base.
- Roles y permisos.
- Flujo de cambio de contraseña.
- Auditoría inicial de autenticación.
- Dashboard administrativo.
- Indicadores conectados a PostgreSQL/Neon.
- Navegación administrativa.
- Identidad visual de Semilla integrada.
- Página de perfil y seguridad.
- Páginas base de módulos principales.
- Primera experiencia completa de navegación del módulo de Comunidades.
- Listado, búsqueda y filtros de comunidades en frontend.
- Expediente comunitario estructurado.
- Aplicación pública mediante HTTPS.

## Próximos pasos

1. Conectar el listado de Comunidades con datos reales del backend.
2. Implementar creación y edición de comunidades.
3. Persistir todas las secciones del expediente comunitario.
4. Implementar gestión de zonas.
5. Aplicar permisos específicos al módulo.
6. Registrar auditoría de altas y modificaciones.
7. Continuar con Familias y Beneficiarios.
8. Crear y publicar el release académico `semana-2`.