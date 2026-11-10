# Semilla — Mapa de Impacto (React Flow), etapa 1

## Alcance
Módulo **independiente** de solo lectura en el menú administrativo:
Comunidad → Proyecto → Actividades → Avances → Evidencias fotográficas.

- Frontend: `frontend/src/modulos/mapa-impacto/`, CSS en `frontend/src/estilos/modulos/mapa-impacto/`, servicio `frontend/src/servicios/mapa-impacto/`.
- Backend: `GET /api/mapa-impacto/proyectos` y `GET /api/mapa-impacto/proyectos/:proyectoId`.
- Requiere JWT, permiso `proyectos.ver` y no expone ruta institucional al rol DONANTE. Todas las consultas verifican pertenencia a la organización activa.
- Los nodos no editan Neon, no se arrastran ni se pueden reconectar. Los nodos de fotografías abren URLs firmadas R2 temporales.
- Los proyectos se eligen en un selector; por defecto el primero disponible. No se generan datos simulados.
- React Flow visualiza un número acotado de nodos para mantener rendimiento; el detalle de registros completo se gestiona en los módulos originales.
- No se modificaron formularios, datos, migraciones ni los módulos existentes (excepto navegación).
- **No incluye aún donantes, asignaciones monetarias o resultados financieros.** Serán una etapa posterior con permisos y auditoría propios.

## Desarrollo

```bash
git pull --ff-only origin develop
cd frontend
npm install
npm run build
npm run dev
# en otra terminal
cd backend
npm run build
npm run dev
```

Tras instalar, confirmar que `frontend/package-lock.json` incluye `@xyflow/react`, `echarts` y `gridstack`; versionarlo en `develop`.

## Validación manual

1. Iniciar sesión como administrativo con permiso `proyectos.ver` y abrir **Mapa de Impacto**.
2. Seleccionar **Aula para Kinder · El Ocote** y confirmar la comunidad, actividad, avances y tres fotografías.
3. Pulsar cada tipo de nodo: debe mostrar su detalle; las fotografías deben abrirse usando enlaces temporales sin publicar el bucket.
4. Confirmar que la rueda/zoom y MiniMap funcionan y que **no** se pueden editar registros al mover nodos.
5. Cambiar entre proyectos y entre módulos, sin afectar Ejecución, Evidencias ni Dashboard.
6. Intentar entrar sin sesión, con un proyecto ajeno y como DONANTE: no debe devolver datos institucionales.
7. Revisar proyecto sin avances y proyecto con muchos avances: indicar estados vacíos/límites visuales.

## Evolución

- Etapa 2: incorporaciones de donantes y contribuciones de proyectos **solo con vínculos confirmados en la base**.
- Etapa 3: vista de impacto para portal de donantes con autorización por proyecto/registro y visibilidad documental explícita.
- Etapa 4: filtros, agrupación, búsqueda en el grafo y persistencia de preferencias del mapa por usuario.
