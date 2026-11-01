# Mapa de historias de usuario - Semilla

## Propósito

Este documento transforma las necesidades identificadas para **Semilla - Gestión Comunitaria** en un mapa de historias de usuario priorizado. El objetivo es mantener una relación clara entre el problema del cliente, las actividades principales del sistema, las historias del backlog y las entregas incrementales del MVP.

## Cliente de referencia

El cliente inicial de referencia es **Ministerio Sal y Luz**, organización que desarrolla programas y proyectos de desarrollo comunitario. Semilla busca centralizar información que actualmente puede encontrarse dispersa entre hojas de cálculo, documentos, registros manuales y archivos separados.

## Usuarios principales

- **Administrador:** configura usuarios, roles, permisos y parámetros generales.
- **Coordinador de programa:** consulta comunidades, familias, proyectos, necesidades, actividades y avances.
- **Finanzas / Contabilidad:** registra y consulta recursos, compras, gastos y pagos.
- **Personal de campo:** registra información de comunidades, familias, beneficiarios, actividades y evidencias.
- **Voluntario / Consulta:** accede únicamente a la información autorizada para su función.

## Backbone del producto

El recorrido principal del usuario se organiza en las siguientes actividades:

1. Acceder de forma segura.
2. Consultar el estado general del programa.
3. Gestionar zonas y comunidades.
4. Gestionar familias y beneficiarios.
5. Gestionar programas, proyectos y actividades.
6. Dar trazabilidad a recursos y pagos.
7. Registrar evidencias y resultados.
8. Consultar reportes y auditoría.
9. Trabajar en campo con conectividad limitada.

## Historias de usuario priorizadas

| ID | Actividad | Historia de usuario | Prioridad | Estado actual |
|---|---|---|---|---|
| HU-01 | Acceso | Como usuario quiero iniciar sesión con correo y contraseña para acceder únicamente a la información autorizada. | Must | Hecho |
| HU-02 | Acceso | Como administrador quiero gestionar roles y permisos para separar responsabilidades dentro de la organización. | Must | Hecho base |
| HU-03 | Acceso | Como usuario con contraseña temporal quiero cambiarla al primer ingreso para proteger mi cuenta. | Must | Hecho |
| HU-04 | Dashboard | Como coordinador quiero ver indicadores reales para conocer rápidamente el estado de la operación. | Must | En progreso |
| HU-05 | Comunidades | Como coordinador quiero consultar un listado de comunidades para localizar rápidamente la comunidad que necesito gestionar. | Must | Hecho UX |
| HU-06 | Comunidades | Como usuario quiero buscar y filtrar comunidades por zona y estado para reducir el tiempo de consulta. | Must | Hecho UX |
| HU-07 | Comunidades | Como personal de campo quiero registrar una comunidad con información general, población, vivienda, visión de desarrollo, organizaciones y productividad local. | Must | UX lista / persistencia pendiente |
| HU-08 | Comunidades | Como coordinador quiero conocer cuántas comunidades están registradas y activas para dar seguimiento a la cobertura. | Must | Hecho |
| HU-09 | Familias | Como personal de campo quiero registrar familias vinculadas a una comunidad para mantener un expediente familiar ordenado. | Must | Pendiente |
| HU-10 | Beneficiarios | Como coordinador quiero asociar personas y beneficiarios a una familia para evitar duplicidad y mejorar la trazabilidad. | Must | Pendiente |
| HU-11 | Proyectos | Como coordinador quiero registrar programas y proyectos vinculados a comunidades para controlar las intervenciones realizadas. | Must | Página base |
| HU-12 | Actividades | Como personal de campo quiero registrar actividades de un proyecto para documentar su ejecución. | Must | Pendiente |
| HU-13 | Recursos | Como finanzas quiero registrar donaciones y recursos recibidos para conocer su origen y disponibilidad. | Must | Pendiente |
| HU-14 | Recursos | Como finanzas quiero relacionar compras, gastos o pagos con un proyecto para conocer cómo se utilizaron los recursos. | Must | Página base de pagos |
| HU-15 | Evidencias | Como personal de campo quiero adjuntar evidencias de una actividad para demostrar el trabajo realizado. | Should | Página base |
| HU-16 | Reportes | Como coordinador quiero consultar la trazabilidad de una intervención desde el recurso hasta la familia o comunidad beneficiada. | Must | Pendiente |
| HU-17 | Auditoría | Como administrador quiero consultar operaciones relevantes para saber quién realizó un cambio y cuándo ocurrió. | Should | Auditoría de autenticación disponible / página base |
| HU-18 | Offline | Como personal de campo quiero registrar información seleccionada sin internet para poder trabajar en comunidades con conectividad limitada. | Should | Diseñado / pendiente implementación |
| HU-19 | Sincronización | Como personal de campo quiero sincronizar los cambios pendientes cuando vuelva la conexión para no perder información. | Should | Pendiente |
| HU-20 | Seguridad | Como organización quiero que las rutas sensibles exijan autenticación y permisos para proteger la información del programa. | Must | Hecho base |

## Criterios de aceptación clave

### HU-01 - Inicio de sesión

- El usuario puede autenticarse con correo y contraseña válidos.
- Las credenciales inválidas no permiten el acceso.
- La API entrega una sesión protegida mediante token de acceso.
- El refresh token se maneja de forma segura y puede revocarse.

### HU-05 y HU-06 - Consulta de comunidades

- Se muestra un listado entendible de comunidades.
- El usuario puede buscar por nombre.
- El usuario puede filtrar por zona y estado.
- Cuando no existen coincidencias se muestra un estado vacío claro.
- La interfaz funciona correctamente en diferentes tamaños de pantalla.

### HU-07 - Registro de comunidad

El expediente debe permitir capturar, como mínimo:

- Información general.
- Población y vivienda.
- Visión de desarrollo comunitario.
- Organizaciones comunitarias activas.
- Productividad local.

La historia se considerará terminada cuando estos datos puedan validarse, enviarse al backend, persistirse en PostgreSQL y recuperarse nuevamente desde la aplicación.

## Cortes de entrega

### Corte 1 - Base técnica y seguridad

Incluye despliegue público, PostgreSQL/Neon, autenticación, sesión, roles, permisos y auditoría básica de seguridad.

### Corte 2 - Del cliente al backlog / Semana 2

Incluye:

- Mapa de historias y backlog priorizado.
- Navegación administrativa.
- Dashboard con indicadores reales iniciales.
- Listado, búsqueda y filtros de comunidades.
- Diseño del expediente comunitario.

### Corte 3 - Núcleo funcional del MVP

Incluye persistencia real de comunidades, familias, beneficiarios, proyectos, actividades y evidencias.

### Corte 4 - Trazabilidad y operación de campo

Incluye recursos, pagos/gastos, reportes, auditoría ampliada y funciones offline seleccionadas.

## Regla de priorización

Se utilizará una priorización tipo **MoSCoW**:

- **Must:** indispensable para demostrar el flujo principal del MVP.
- **Should:** importante, pero puede entregarse después del núcleo funcional.
- **Could:** mejora deseable si existe capacidad disponible.
- **Won't now:** fuera del alcance de la primera versión.

La prioridad se revisará conforme se valide el producto con el cliente y se obtenga nueva información durante el desarrollo.