# Integración de organización y productividad en Neon development

Estado: preparada y probada en PostgreSQL embebido; ejecución en Neon pendiente de conexión. No aplicar a producción como parte de esta entrega.

1. Confirmar proyecto y rama de desarrollo en Neon y crear un respaldo o rama de recuperación antes de ejecutar SQL.
2. Conservar 005 y 006 ya aplicadas. No volver a ejecutarlas ni sustituir sus contenidos.
3. Si todavía no se aplicó 007, ejecutar `database/sql/007_compatibilidad_diagnostico_secciones.sql`. Admite las dos variantes conocidas de 005 y crea las tablas por secciones que falten.
4. Ejecutar `database/sql/008_organizacion_productividad.sql` una sola vez. Incluye BEGIN/COMMIT: ante error, revertir la transacción y revisar la causa; no continuar con sentencias sueltas. No usar `prisma db push` para reemplazar estas migraciones.
5. Verificar las tablas y revisar las restricciones antes de levantar la nueva versión del backend:

```sql
SELECT to_regclass('public.capacidades_comunitarias') AS capacidades,
       to_regclass('public.elementos_capacidad') AS elementos;
SELECT origen, count(*) AS revisiones
FROM capacidades_comunitarias GROUP BY origen;
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN ('capacidades_comunitarias'::regclass, 'elementos_capacidad'::regclass);
```

008 copia las capacidades del último diagnóstico alternativo cuando esa tabla existe. No elimina ni reescribe el historial anterior. Si alguna fila heredada incumple las restricciones nuevas, la transacción falla íntegramente y debe revisarse antes de reintentar. Una sección sin datos empieza con revisión 0; el primer guardado crea la revisión 1.

## Comprobación funcional

Actualizar develop y reiniciar backend y frontend. En Comunidades, abrir un expediente y su sección Organización y productividad. Agregar una organización, una actividad y un producto, guardar y recargar. Editar y quitar un elemento, comprobar persistencia y que las revisiones anteriores permanezcan en la base. Un usuario con solo permiso de consulta no debe ver acciones de edición. Una edición desde una versión antigua debe devolver conflicto sin sobrescribir la más reciente.

Conservar población/vivienda y visión del desarrollo. No mezclar escrituras con los endpoints del formulario integral anterior: no existe sincronización bidireccional. La prueba autenticada en Neon y el retiro del flujo alternativo siguen siendo requisitos previos a la promoción a main.
