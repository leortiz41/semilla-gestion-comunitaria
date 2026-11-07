# Bitácora — Semana 3

**Proyecto:** Semilla — Gestión Comunitaria.  
**Lema:** Recursos que generan desarrollo.  
**Periodo documentado:** 2 al 7 de noviembre de 2026.  
**Enfoque:** datos que sostienen el negocio.  
**Responsable del proyecto:** Milton Leonel Ortiz Baca.

## Objetivo

Pasar de la interfaz territorial preparada en la semana 2 a operaciones respaldadas por PostgreSQL, reforzar el aislamiento entre organizaciones y documentar el modelo completo del producto. Esta bitácora se basa en archivos y commits del repositorio; diferencia desarrollo, integración y funcionalidades todavía pendientes.

## Trabajo realizado y evidencia

Los días de la siguiente tabla corresponden a las fechas registradas por Git. Los hashes permiten consultar cada cambio sin depender de una descripción general.

| Fecha | Avance | Evidencia | Resultado |
|---|---|---|---|
| 02/11 | Base multi-organización | `8e0deb8`, `87e425a`, `05be170`, `515da9c` | Organización inicial, asociación de usuarios y contexto de organización en autenticación y frontend. |
| 02/11 | Aislamiento territorial | `df40c44`, `2fd0fc3`, `e0b41c3` | Zonas y comunidades por organización; Dashboard filtrado por sesión. |
| 02/11 | Validación y documentación | `36d5c07`, `b6bd23c`, `7df34e8` | Alcance por tabla y script SQL de validación de aislamiento. Su presencia no demuestra que se haya ejecutado en esta revisión. |
| 02/11 | Alineación de Prisma | `be7b40f`, `1284002`, `b40f38d` | Usuarios, zonas y comunidades alineados con el contexto organizacional. |
| 02/11 | Lectura de comunidades | `0aca16c`, `1f155f2`, `78ceb52` | Servicio y ruta protegida para consultar comunidades de la organización autenticada. |
| 03/11 | Gestión de zonas | `b298f81`, `6f92926`, `db0bc2e`, `aa08c03` | Servicios, rutas y vista para listar y crear zonas. |
| 03/11 | Estado y edición de zonas | `74d601f`, `73dc81a`, `d326b3d`, `1e22a6f`, `f1ebf81` | Activar, desactivar y editar zonas desde backend y frontend. |
| 03/11 | Registro básico de comunidades | `22b443b`, `e7f6900`, `405b51e`, `80c8a48` | Persistencia de nombre, zona, municipio y departamento. |
| 03/11 | Listado con datos reales | `e7a3dcf`, `c67c325`, `fb0afd2` | Consulta real de comunidades y zonas; actualización del listado después de registrar. |
| 03/11 | Estado efectivo territorial | `14519e2`, `6a6bd36`, `96550ef`, `9d77420` | La interfaz incorpora el estado de la zona al mostrar las comunidades. |
| 05/11 | Validación del identificador de zona | `217ea4d` | Validación de entrada para la relación territorial. |
| 05/11 | Edición de comunidades | `6346ab9`, `d8bc711` | Backend y frontend implementados en develop; pendientes de integración a main al inicio de esta entrega documental. |
| 07/11 | Modelo completo y entrega documental | [Modelo de datos](../modelo-datos.md), esta bitácora y README | Diccionario de 29 modelos, relaciones, reglas existentes, diseño objetivo y pendientes explícitos. |

La integración territorial disponible en `main` al comenzar esta revisión corresponde al PR #21, commit `fbb7c51`. Los dos commits de edición de comunidades permanecen en `develop`; esta entrega documental no los promociona a producción.

## Qué cambió respecto de la semana 2

La bitácora anterior señalaba que el módulo de Comunidades era principalmente una experiencia de interfaz. Ahora existe código para crear y consultar información básica usando PostgreSQL, y las zonas tienen gestión real. El expediente completo —población, vivienda, visión de desarrollo, organizaciones comunitarias y productividad— todavía requiere persistencia adicional.

Otro avance es que una comunidad no puede vincularse con una zona de otra organización: el script 004 establece una FK compuesta y los servicios usan la organización autenticada. Este aislamiento todavía no está completo en todos los módulos del producto.

## Decisiones de diseño

- Mantener nombres de tablas y campos en español, coherentes con el esquema actual.
- Preservar las 28 tablas iniciales y la tabla adicional de organizaciones como base documentada.
- Separar donante, donación, asignación y ejecución en el diseño futuro; evitar un único donante fijo por proyecto o familia.
- Mantener solicitudes y pagos separados: una solicitud puede liquidarse mediante varios pagos.
- Diferenciar aprobación interna de evidencia y autorización para consulta externa.
- Documentar el modelo completo sin presentar módulos planeados como funcionalidades terminadas.
- Conservar el flujo `feature/*` → PR → `main` para la documentación estable; sincronizar después con `develop` sin perder trabajo.

## Uso de IA en esta entrega

Se solicitó apoyo para construir `docs/modelo-datos.md`, crear esta bitácora y completar los requisitos que el validador señaló como faltantes. La revisión se apoyó en Prisma, SQL, servicios, documentación e historial Git.

Se incorporó una propuesta de ampliación del modelo para expediente comunitario, planificación, donaciones, recursos, compras, impacto y accesos externos. Se adaptó a los nombres y relaciones existentes, en lugar de sustituirlos por el modelo conceptual antiguo en inglés. Estas ampliaciones quedan identificadas como diseño pendiente de migración y validación funcional.

No se atribuyen entrevistas, pruebas en campo ni resultados productivos que no estén respaldados por evidencia disponible.

## Requisitos académicos y verificación

| Requisito | Evidencia / estado |
|---|---|
| `docs/modelo-datos.md` | Incluido con diccionario, diagramas y diseño completo por dominios. |
| `docs/bitacora/semana-3.md` | Este archivo. |
| Token en README | `LEARN-CAP-4EC8DB14`, ya existente; token público de propiedad académica. |
| Al menos 15 commits y 3 recientes | Antes de esta entrega, main tenía 231 commits; 202 desde el 28/10/2026. No se fabrican commits para alcanzar la cuota. |
| Etiqueta o release `semana-3` | Publicar sobre el commit integrado de esta entrega; verificar en GitHub. |
| Dominio público HTTPS | URL declarada: https://semilla-gestion-comunitaria.vercel.app/ . Comprobado el 07/11/2026: HTTP 200 sobre HTTPS; no implica prueba autenticada del flujo. |
| Migraciones versionadas | Scripts SQL 001–004; no confundirlos con un historial Prisma Migrate inexistente. |
| Datos semilla | Catálogos y organización inicial presentes; dataset demostrativo completo pendiente. |
| Flujo central con datos | Territorio tiene integración SQL; la trazabilidad integral de donaciones todavía está pendiente. |

Los requisitos de archivos y etiqueta permiten identificar una versión de entrega, pero no sustituyen la evaluación funcional del proyecto.

## Validaciones de esta entrega

Revisión documental del esquema y de los commits, coherencia de nombres, enlaces relativos y diferencias de Git. No se cambiaron tablas, API ni interfaz. No se ejecutaron migraciones sobre Neon ni se confirmó la configuración de producción. La publicación documental no permite afirmar que todos los módulos del modelo objetivo ya funcionan.

## Dificultades y aprendizajes

Había documentación conceptual antigua con nombres en inglés que ya no coincidía con el esquema en español. La solución fue crear una referencia actual con diccionario y separar antecedentes de implementación.

También fue necesario diferenciar un script de validación existente de una prueba ejecutada, y distinguir un avance en develop de una funcionalidad integrada en main. El aprendizaje central es que la calidad de los datos depende tanto de sus relaciones y restricciones como de una documentación que permita comprobar el estado real del sistema.

## Próximos pasos

1. Integrar y validar la edición de comunidades mediante el flujo habitual de PR.
2. Completar el expediente comunitario y coordenadas, siguiendo el issue #11.
3. Extender aislamiento a personas, proveedores, proyectos y auditoría, siguiendo el issue #19.
4. Implementar donantes, donaciones y asignaciones conforme a #13 y #14.
5. Implementar revisión y publicación de evidencias, conforme a #15–#17.
6. Preparar datos ficticios reproducibles y demostrar el flujo de trazabilidad con persistencia, permisos y pruebas entre dos organizaciones.
7. Mantener los issues abiertos hasta cumplir sus criterios de aceptación; documentar pruebas y resultados en los siguientes avances.
