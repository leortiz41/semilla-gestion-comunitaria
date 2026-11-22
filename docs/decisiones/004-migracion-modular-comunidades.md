# ADR 004 — Migración incremental hacia módulos funcionales: comunidades

**Estado:** Aceptada. **Fecha:** 22/11/2026.

## Contexto
La API de Semilla funciona como un monolito Express con separación técnica (`routes/`, `services/`, `domain/`). Esta distribución dispersa las piezas de una misma funcionalidad y dificulta ubicar sus dependencias. Los módulos de proyectos, donantes y familias comparten actualmente partes del dominio y los servicios.

## Alternativas consideradas
1. Reescribir el backend o dividirlo en microservicios.
2. Mover todo el código de una vez, cambiando importaciones y puntos de entrada.
3. Agrupar una funcionalidad a la vez, con adaptadores de compatibilidad y pruebas.

## Decisión
Se elige la tercera alternativa. **Comunidades** es el primer módulo:
- Rutas de comunidades y sus subrutas de capacidades y necesidades en `src/modules/comunidades/`.
- Servicio de comunidades dentro del módulo, con su interfaz y comportamiento públicos sin cambios.
- Repositorio dedicado inicialmente a consultar el listado por organización (consulta SQL y parámetro tenant conservados).
- Adaptadores mínimos mediante `export *` en las ubicaciones anteriores de rutas y servicio, mientras otras dependencias se migran.
- `server.ts` importa directamente el nuevo router pero sigue montándolo en **`/api/comunidades`**.
- La autenticación, el middleware de permisos, el pool PostgreSQL y los dominios compartidos continúan en sus ubicaciones actuales.

## Consecuencias
Se obtiene un límite funcional visible, sin multiplicar servicios de despliegue ni cambiar API, esquemas o credenciales. Durante la transición existirán archivos adaptadores y algunas consultas SQL en servicios; no se declara completa una separación por repositorios que aún no existe.

## Comprobación
Compilación TypeScript, suite completa de backend, igualdad referencial entre exports antiguos y nuevos, y prueba de que el repositorio filtra por `organizacion_id`. Antes de integrar se revisa el diff y se valida la interacción por roles en `develop`.

## Siguientes pasos
1. Aislar progresivamente persistencia de escrituras comunitarias con transacciones existentes, sin duplicar lógica.
2. Consolidar servicios y dominio de capacidades, necesidades y expediente donde no se afecten otros módulos.
3. Migrar proyectos y donantes en PR independientes, después de cubrir sus contratos y permisos.
4. Una vez que no existan consumidores de las rutas antiguas, eliminar adaptadores en un cambio separado.
