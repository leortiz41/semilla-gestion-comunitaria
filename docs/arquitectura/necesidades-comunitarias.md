# Necesidades comunitarias y seguimiento
Estado: diseño acordado, pendiente de implementación. Fecha: 7 de noviembre de 2026.

## Propósito
Convertir la información narrativa del expediente en necesidades gestionables, conservando el diagnóstico original. Cada necesidad debe permitir justificar una intervención y comprobar sus resultados.

## Experiencia en el expediente
Bajo cada área de visión se muestra «Necesidades identificadas» y la acción «Agregar necesidad». «Desglosar en necesidades» presenta el texto original como referencia y permite registrar problemas uno por uno; requiere revisión humana. No crea registros automáticamente ni sustituye la narración.

Cada tarjeta muestra problema, prioridad, estado de atención, responsable, proyectos vinculados y próxima revisión. Las necesidades sin proyecto deben seguir visibles. Los indicadores distinguen necesidades pendientes, atendidas parcialmente y resueltas.

## Información mínima
| Campo | Regla |
|---|---|
| Comunidad y área | Obligatorias; organización obtenida de la sesión. |
| Problema concreto | Título y descripción, sin combinar problemas independientes. |
| Origen | Visión/diagnóstico opcional de la misma comunidad; conservar su referencia. |
| Situación inicial | Describir qué ocurre y cómo se comprobó. |
| Población afectada | Descripción y cantidad opcional; desconocido no equivale a cero. |
| Resultado esperado | Cambio observable, unidad y meta cuando se puedan medir. |
| Prioridad | Alta, media, baja o por evaluar; motivo obligatorio al asignar o cambiar. |
| Estado | Identificada, evaluada, aprobada, en ejecución, en verificación o resuelta. |
| Responsable y revisión | Usuario de la organización y fecha de seguimiento cuando corresponda. |

La prioridad del área existente es una observación histórica del diagnóstico; no se copia automáticamente a todas las necesidades ni se recalcula sobrescribiendo ese diagnóstico.

## Evaluación y transiciones
La prioridad mide urgencia; el estado describe atención. Aprobar inversión cambia el estado cuando corresponde, pero no reduce automáticamente la urgencia. Finalizar un proyecto tampoco cierra la necesidad.

Cada evaluación registra situación observada, prioridad/estado anterior y nuevo, motivo, autor, fecha, evidencias y próxima revisión. Resolver exige resultado verificado y evidencia. Reabrir exige motivo y nueva evaluación. Si faltan indicadores iniciales, se registran como pendientes de medir; nunca se inventan resultados.

El historial es inmutable para usuarios operativos; las correcciones se agregan como nuevas evaluaciones. Control de versión impide que dos evaluadores sobrescriban cambios. Cambiar estado/prioridad y guardar la evaluación debe ser una única transacción.

## Diseño de datos propuesto
| Entidad | Responsabilidad |
|---|---|
| necesidades | Comunidad, área, origen, problema, línea base, resultado esperado y situación actual. |
| evaluaciones_necesidad | Historial de seguimiento y cambios, actor, fecha y versión. |
| proyectos_necesidades | Relación N:M; contribución comprometida, resultado esperado y alcance de la intervención. |
| evaluaciones_necesidad_evidencias | Evidencias que respaldan una evaluación, con relaciones explícitas. |

Antes de crear la migración, contrastar con el modelo vigente para ampliar las entidades previstas sin duplicarlas. Todas las relaciones operativas deben respetar organización y comunidad. Un proyecto se vincula únicamente con necesidades de comunidades de su ámbito; la expansión multicomunidad requiere la relación territorial correspondiente.

Las evaluaciones pueden existir antes de un proyecto. El modelo de evidencias actual exige proyecto: habrá que ampliarlo de manera explícita para soportar evidencia inicial de necesidades, sin crear proyectos ficticios ni quitar la protección de los archivos.

## Permisos y consultas
Personal autorizado registra necesidades; coordinadores autorizados evalúan prioridad y cierre. El backend valida cada operación; los usuarios externos solo ven información expresamente autorizada.

Consultas previstas: necesidades sin proyecto, altas sin atención, revisiones vencidas, proyectos finalizados con necesidades pendientes y evolución de resultados. No deducir impacto sumando únicamente gasto o porcentaje de obra.

## Secuencia de implementación
1. Registro y consulta de necesidades dentro del expediente, migración incremental y pruebas de aislamiento.
2. Evaluaciones, evidencia inicial, historial y control de concurrencia.
3. Vínculo con proyectos, evaluación de resultados y reportes.

No se considera terminada una fase sin persistencia comprobada, validación de permisos y actualización de bitácora. Este documento registra una decisión de producto; no afirma que las pantallas o tablas propuestas ya existan.

Historia de implementación: [#27](https://github.com/leortiz41/semilla-gestion-comunitaria/issues/27).
