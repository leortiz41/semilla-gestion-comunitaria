# Dashboard Semilla — ECharts + GridStack

## Implementación (noviembre de 2026)

- `/api/dashboard/resumen`: comunidades registradas y activas (permiso `comunidades.ver`).
- `/api/dashboard/estadisticas`: proyectos, presupuesto asignado, avances validados, evidencias y series por estado/área/mes (permiso `proyectos.ver`, sin portal DONANTE).
- Todas las consultas SQL se limitan a `organizacion_id` de la sesión. No se exponen datos cruzados.
- Las estadísticas muestran presupuesto **asignado**, no gasto ejecutado, cobros ni saldo. No inferir gasto a partir de presupuesto o avance físico.
- Frontend: `GraficaECharts.tsx` encapsula Apache ECharts y observa cambios de tamaño.
- `TableroGrid.tsx` usa GridStack; arrastrar desde la cabecera, redimensionar, restablecer.
- Los cambios de distribución se guardan **solo en el almacenamiento local del navegador, por correo del usuario**. Todavía no se sincronizan con Neon ni otros equipos.
- En móvil se presenta una columna y se bloquea el arrastre. No se envían layouts al backend.
- Si un conjunto no tiene datos, se muestra estado vacío; nunca métricas ficticias.

## Dependencias y desarrollo

```bash
cd frontend
npm install
npm run build
cd ../backend
npm run build
```

IMPORTANTE: `frontend/package.json` incluye `echarts` y `gridstack`. Después de instalar localmente, revisar `frontend/package-lock.json` y **versionarlo** para mantener `npm ci` reproducible. Las comprobaciones del despliegue Vercel no sustituyen las pruebas del backend.

## Pruebas sugeridas
1. Abrir Dashboard como administrador y corroborar que los indicadores coinciden con Neon.
2. Comprobar permisos de usuarios de otra organización y que DONANTE no pueda consultar `/estadisticas`.
3. Arrastrar, redimensionar y recargar: la disposición se debe conservar en el navegador.
4. Pulsar «Restablecer distribución». Comprobar una columna y sin arrastre en móvil.
5. Ampliar/reducir widgets y verificar que las gráficas se redimensionan.
6. Comprobar una organización vacía: nunca mostrar porcentajes o presupuestos simulados.
7. Contadores de fotos incluyen solo evidencias con MIME de imagen; no se publican las imágenes privadas.

## Siguientes incrementos
- Persistencia de diseños en backend por usuario, organización y versión.
- Widgets configurables por roles y filtros de fecha/área/comunidad.
- Separar ejecución presupuestaria real de presupuesto asignado tras validar fuentes contables.
- React Flow para trazabilidad visual de proyectos, donantes, avances y evidencias autorizadas.

## Incremento 2: filtros y catálogo de widgets (noviembre de 2026)

- `GET /api/dashboard/filtros` entrega las comunidades, los proyectos con su comunidad y las áreas de la **organización autenticada**.
- `GET /api/dashboard/estadisticas?comunidadId=...&proyectoId=...&area=...&meses=3|6|12` aplica filtros combinados en backend con consultas parametrizadas.
- Un período de 3/6/12 meses se calcula **desde el primer día del mes de inicio** (incluyendo el mes actual):
  - Proyectos y presupuesto asignado: fecha de **registro** del proyecto.
  - Fotografías: fecha en que se **cargaron**.
  - Avances validados: fecha de **avance**, no fecha de aprobación.
  - Serie mensual: siempre muestra los meses vacíos. Cuando el período es «Todo el historial», la serie muestra 12 meses, pero las tarjetas totalizan todo el historial.
- Las tarjetas de **comunidades registradas/activas** son totales institucionales y **no** obedecen a filtros de proyecto, área ni período. La interfaz lo indica explícitamente.
- El catálogo permite mostrar/ocultar siete widgets sin borrar los datos y guarda la elección en `localStorage` por correo; las posiciones siguen guardadas en `semilla:dashboard:layout:v1:`.
- Las métricas siguen aisladas por organización y no hay acceso institucional desde el rol DONANTE.

### Pruebas manuales adicionales

1. Filtrar por comunidad y proyecto de la misma comunidad; verificar la cantidad de evidencias.
2. Cambiar comunidad y comprobar que el proyecto anterior se limpia automáticamente.
3. Usar 3 meses y «Todo el historial»; comprobar que cada tarjeta utiliza las fechas descritas arriba.
4. Ocultar y restaurar widgets; comprobar que se preserva la ubicación al volver a activarlos.
5. Recargar sesión/navegador y comprobar persistencia de la selección local.
6. Confirmar que una organización distinta no puede seleccionar ni consultar proyectos de otra organización.
7. Verificar la visualización en un teléfono; sin arrastre de widgets.
