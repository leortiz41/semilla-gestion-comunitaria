# Reconciliación del expediente comunitario

## Flujo acordado

Trabajar y confirmar cambios en `develop`. Usar un PR de `develop` a `main` únicamente para una entrega de producción validada. No crear ramas de funcionalidad adicionales. `respaldo/diagnostico-local` conserva el trabajo recuperado y no es una línea de desarrollo.

## Qué se confirmó

El respaldo `c7075a7` contiene el expediente por secciones, población/vivienda, visión por área y activación/desactivación de comunidades. Es el flujo que se conserva en la navegación. El remoto tenía otro formulario integral y tablas diferentes, construidos sin conocer ese trabajo local.

La coincidencia de nombres de archivo 005 no significa coincidencia de contenido. No se debe volver a ejecutar 005 para solucionar la divergencia.

| Artefacto | Tratamiento |
|---|---|
| 005 publicada en develop | Conservada sin cambiar su contenido. |
| 005 local del respaldo | Copia exacta de referencia en `docs/migraciones-aplicadas/005_expediente_comunitario_local.sql`; no ejecutar como una migración adicional. |
| 006 local | Incorporada con el contenido original. |
| 007 compatibilidad | Nueva migración incremental para admitir ambas bases de partida. |

007 crea las tablas por secciones si no existen. Si detecta el modelo alternativo, copia población/vivienda y visión del último diagnóstico solo donde no existe un registro local. Nunca sustituye registros ya capturados por secciones ni elimina los diagnósticos históricos, organizaciones, productividad o auditoría del modelo alternativo. Cuando ambos modelos tienen información, la sección local conserva precedencia y el dato alternativo permanece disponible en su tabla; requiere revisión humana si difieren.

La sección de organización y productividad se incorpora con 008. Recupera las capacidades del último diagnóstico alternativo, conserva sus originales y registra nuevas revisiones independientes. La historia #27 sigue pendiente.

## Pruebas realizadas

- Compilación de backend y frontend.
- Validación del schema Prisma con ambos modelos representados.
- Pruebas en PostgreSQL embebido desde 005 local y desde 005 publicada, aplicación de 006/007, copia sin pérdida del origen y repetición de 007 sin sobrescribir datos locales.
- Suite de transacciones, validación, aislamiento y versiones del modelo alternativo conservada.
- 005 publicada y 006 local comprobadas contra sus versiones fuente.

No se consultó ni modificó Neon. Las pruebas no confirman todavía qué tablas o datos existen en la base real. No promover a main antes de la comprobación de desarrollo.

## Actualización local y de Neon development

Con el respaldo ya publicado y el árbol local limpio:

```bash
git switch develop
git pull --no-rebase origin develop
```

Si Git informa cambios locales, conservarlos antes de cambiar de rama; no usar reset destructivo ni clean.

Respaldar Neon development y ejecutar únicamente `database/sql/007_compatibilidad_diagnostico_secciones.sql` para reconciliar una base que ya tiene 001–004 y alguna variante de 005. La migración incluye creación idempotente de las tablas de 006; si 006 ya se aplicó no se vuelve a ejecutar por separado. No ejecutar esta secuencia directamente en producción.

Reiniciar backend/frontend. Comprobar que el listado abre el expediente por secciones y que conserva población/vivienda y visión registradas. Guardar un cambio de prueba y recargar. Los scripts anteriores y la rama de respaldo permanecen disponibles para comparación.

Los endpoints y servicios del formulario integral anterior se conservan temporalmente para compatibilidad, pero la navegación principal usa las secciones del respaldo. No mezclar ambos flujos de escritura: no hay sincronización bidireccional entre modelos. 008 consolida organizaciones/productividad al aplicarse. El retiro del flujo alternativo y la comprobación funcional real siguen pendientes antes de promover a producción.

## Organización y productividad

Después de 007, aplicar una sola vez `database/sql/008_organizacion_productividad.sql` siguiendo [la guía de desarrollo](../migraciones-aplicadas/neon-organizacion-productividad.md). Las pruebas de compatibilidad cubren ambas variantes de 005, migración de capacidades, guardado, aislamiento, conflicto de revisión y rollback. Esto no acredita una ejecución en Neon.
