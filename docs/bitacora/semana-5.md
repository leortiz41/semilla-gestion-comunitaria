# Bitácora — Semana 5

**Proyecto:** Semilla — Recursos que generan desarrollo.  
**Fecha de registro:** 15 de noviembre de 2026.  
**Tema:** MVP con usuarios reales: preparar la evaluación y convertir observaciones en mejoras.

## Objetivo

Preparar una prueba sencilla del MVP web para comprobar si personas vinculadas con el trabajo comunitario pueden consultar comunidades, proyectos, actividades y evidencias con poca orientación.

## Organizaciones consideradas

Se seleccionaron tres organizaciones del segmento de uso de Semilla para el piloto: **Corazón para Honduras**, **Ministerio Sal y Luz** y **Glow International**. La muestra prevista es de **3 a 5 personas reales en total**, distribuidas entre las organizaciones según disponibilidad.

El despliegue de referencia está publicado en [Semilla web](https://semilla-gestion-comunitaria.vercel.app/). **Esta bitácora no afirma que las 3 a 5 sesiones ya ocurrieron ni que el MVP en producción fue utilizado por todas ellas**; esa evidencia se registrará después de las sesiones.

## Trabajo documentado

| Actividad | Resultado y evidencia |
|---|---|
| Diseñar la prueba breve | Se preparó un guion de 10–15 minutos con tareas de consulta y seguimiento, en [docs/pruebas-usuarios.md](../pruebas-usuarios.md). |
| Definir la muestra | Se identificaron tres organizaciones piloto y una meta de 3–5 participantes reales, sin inventar nombres ni respuestas. |
| Formular hipótesis | Se definió un criterio de éxito observable para tareas principales y una decisión pendiente de resultados reales. |
| Revisar fricciones del producto | Se registraron cuatro observaciones preliminares de experiencia de uso, distinguiéndolas de hallazgos confirmados por participantes. |
| Convertir observaciones en backlog | Se crearon los issues [#42](https://github.com/leortiz41/semilla-gestion-comunitaria/issues/42), [#43](https://github.com/leortiz41/semilla-gestion-comunitaria/issues/43), [#44](https://github.com/leortiz41/semilla-gestion-comunitaria/issues/44) y [#45](https://github.com/leortiz41/semilla-gestion-comunitaria/issues/45), previstos para las semanas 6–9. |

## Hallazgos preliminares y prioridades

- **Alta, Semana 8:** revisar la visualización de las evidencias desde el avance del proyecto (issue #44).
- **Media, Semana 6:** mejorar los mensajes al guardar la planificación (issue #42).
- **Media, Semana 7:** simplificar tarjetas y navegación para encontrar proyectos y actividades (issue #43).
- **Baja/Media, Semana 9:** conservar la disposición personalizada del Dashboard (issue #45).

Son puntos detectados en revisiones internas y **pendientes de corroboración con la muestra piloto**. La severidad podrá ajustarse según el número de personas afectadas y si una tarea se bloquea.

## Decisión sobre la hipótesis

**Pendiente.** Todavía no se dispone de una tabla completada con resultados de 3 a 5 personas reales. Se mantendrá esa condición explícita para evitar presentar como realizadas entrevistas o pruebas que aún requieren constancia.

## Próximos pasos

1. Ejecutar el guion con 3–5 personas de las organizaciones seleccionadas, registrando fecha, tareas realizadas y ayudas necesarias.
2. Actualizar el documento de pruebas con resultados reales, severidades finales y decisión de la hipótesis.
3. Atender los issues de las semanas 6–9 según impacto y frecuencia observada.
4. Revisar la documentación en `develop` y después incorporarla a `main` mediante el PR de entrega, sin confundir una preparación documental con validación de uso en producción.

## Uso de IA

Se utilizó asistencia de IA para estructurar el guion de evaluación, ordenar las observaciones internas y redactar los issues. **No se generaron participantes, testimonios, métricas de uso ni resultados ficticios**.
