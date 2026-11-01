# Plan de trabajo - Semilla

## Objetivo general

Construir en diez semanas un MVP funcional de **Semilla - Gestión Comunitaria** que permita centralizar información de comunidades, familias, proyectos, recursos, actividades y evidencias, manteniendo seguridad, trazabilidad y una base preparada para trabajo de campo con conectividad limitada.

## Principios de ejecución

- Entregar valor de forma incremental.
- Mantener `main` como rama estable y `develop` como rama de integración.
- Trabajar funcionalidades mediante cambios pequeños y verificables.
- Mantener el sistema desplegado públicamente mediante HTTPS.
- Priorizar historias que demuestren el flujo principal del cliente.
- Validar seguridad y permisos desde el inicio.
- Documentar decisiones, aprendizajes y cambios de alcance.

## Definición de terminado

Una historia se considera terminada cuando:

1. Cumple sus criterios de aceptación.
2. El código compila correctamente.
3. La funcionalidad fue validada de forma manual o automatizada según corresponda.
4. No contiene secretos o credenciales en el repositorio.
5. Respeta autenticación y permisos cuando aplica.
6. El cambio está integrado en la rama estable cuando corresponde a una entrega.
7. La documentación asociada fue actualizada.
8. La versión desplegada continúa accesible por HTTPS.

## Plan de 10 semanas

| Semana | Objetivo principal | Entregables esperados | Estado |
|---|---|---|---|
| 1 | Base del proyecto | Visión, repositorio, frontend, backend, despliegues HTTPS, estructura de ramas | Completada |
| 2 | Del cliente al backlog | Mapa de historias, backlog priorizado, autenticación base, dashboard inicial, navegación y diseño de Comunidades | En entrega |
| 3 | Comunidades y zonas | Persistencia CRUD de zonas/comunidades, validaciones y permisos | Planificada |
| 4 | Familias y beneficiarios | Registro de familias, personas y relación con comunidades | Planificada |
| 5 | Programas, proyectos y actividades | CRUD y relaciones principales del trabajo comunitario | Planificada |
| 6 | Recursos y donaciones | Donantes, recursos recibidos y asignación a programas/proyectos | Planificada |
| 7 | Compras, gastos y pagos | Trazabilidad financiera básica y proveedores | Planificada |
| 8 | Evidencias y reportes | Evidencias, documentos y primeros reportes de trazabilidad | Planificada |
| 9 | Offline y sincronización | PWA, almacenamiento local y sincronización de operaciones seleccionadas | Planificada |
| 10 | Cierre del MVP | Pruebas, ajustes, auditoría, documentación final, despliegue y demostración | Planificada |

## Objetivos específicos de la Semana 2

La Semana 2 busca pasar de una idea general del producto a un backlog organizado y verificable.

### Entregables obligatorios

- `docs/mapa-historias.md`
- `docs/plan.md`
- `docs/bitacora/semana-2.md`
- Release o etiqueta `semana-2`
- Token de propiedad visible en `README.md`
- Al menos 10 commits totales y 3 commits recientes.
- Aplicación pública mediante HTTPS.

## Backlog priorizado inmediato

### Prioridad 1 - Completar Comunidades de punta a punta

**Historias relacionadas:** HU-05, HU-06, HU-07 y HU-08.

Tareas:

- Crear endpoints de comunidades.
- Implementar alta, consulta, edición y cambio de estado.
- Validar campos del expediente comunitario.
- Conectar listado y filtros a datos reales.
- Reemplazar datos temporales del frontend.
- Aplicar permisos `comunidades.ver`, `comunidades.crear` y equivalentes.
- Registrar operaciones importantes en auditoría.

### Prioridad 2 - Zonas, familias y beneficiarios

**Historias relacionadas:** HU-09 y HU-10.

Tareas:

- Gestionar zonas.
- Relacionar cada comunidad con su zona.
- Crear expediente familiar.
- Registrar integrantes/beneficiarios.
- Evitar registros duplicados mediante reglas de validación.

### Prioridad 3 - Programas, proyectos y actividades

**Historias relacionadas:** HU-11 y HU-12.

Tareas:

- Crear programas y proyectos.
- Asociar proyectos a comunidades y necesidades.
- Registrar actividades.
- Definir estados y fechas de seguimiento.

### Prioridad 4 - Recursos y trazabilidad

**Historias relacionadas:** HU-13, HU-14 y HU-16.

Tareas:

- Registrar donantes y donaciones.
- Registrar proveedores, compras, gastos y pagos.
- Relacionar recursos con proyectos y beneficiarios.
- Construir una consulta de trazabilidad de recursos.

### Prioridad 5 - Evidencias, auditoría y offline

**Historias relacionadas:** HU-15, HU-17, HU-18 y HU-19.

Tareas:

- Adjuntar evidencias a actividades.
- Ampliar bitácora de auditoría.
- Definir qué formularios podrán operar offline.
- Implementar cola local de sincronización.
- Resolver conflictos básicos de sincronización.

## Dependencias principales

- PostgreSQL/Neon debe permanecer disponible para desarrollo y producción.
- La autenticación debe estar estable antes de exponer módulos administrativos.
- Comunidades debe completarse antes de familias y beneficiarios.
- Proyectos y actividades deben existir antes de construir trazabilidad completa de recursos.
- El modelo de datos debe mantenerse normalizado y coherente con las relaciones funcionales.

## Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Alcance demasiado amplio para 10 semanas | Alto | Priorizar el flujo principal y aplazar mejoras no esenciales. |
| Conectividad limitada en campo | Alto | Mantener enfoque PWA/offline para operaciones seleccionadas. |
| Cambios tardíos en el modelo de datos | Alto | Validar primero comunidades, familias y proyectos antes de extender módulos financieros. |
| Problemas de permisos o seguridad | Alto | Proteger rutas desde backend y validar RBAC en cada módulo. |
| Diferencias entre local y producción | Medio/Alto | Mantener despliegue continuo en Vercel/Render y validar después de cada integración. |
| Componentes frontend demasiado grandes | Medio | Separar páginas, formularios, servicios y tipos compartidos. |

## Estrategia de control de versiones

- `main`: versión estable y entregas académicas.
- `develop`: integración de funcionalidades en desarrollo.
- `feature/*`: cambios funcionales específicos cuando sea necesario.
- Pull Requests hacia `main` para entregas significativas.
- Commits pequeños, descriptivos y relacionados con una sola intención.

## Evidencia esperada por entrega

Cada semana deberá dejar evidencia verificable en GitHub mediante:

- commits,
- Pull Requests cuando aplique,
- documentación en `docs/`,
- aplicación desplegada,
- bitácora semanal,
- etiqueta/release de la semana.

## Criterio de éxito del MVP

El MVP será exitoso cuando un usuario autorizado pueda iniciar sesión, registrar una comunidad y una familia, asociarlas a un proyecto o actividad, vincular recursos/evidencias y posteriormente consultar la trazabilidad básica de esa intervención desde una aplicación web desplegada públicamente.