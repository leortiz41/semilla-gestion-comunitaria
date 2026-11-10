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
