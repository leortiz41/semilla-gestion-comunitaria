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

## Dependencias bloqueadas

El archivo `frontend/package-lock.json` ya se regeneró y se versionó en `develop`, incluyendo `@xyflow/react`, ECharts y GridStack. La automatización temporal usada para generarlo fue retirada. En nuevos equipos es recomendable usar `npm ci`.

## Incremento 1B: exploración interactiva y legibilidad

- **Explorar por niveles:** el mapa inicia con comunidad, proyecto y actividades para evitar una vista demasiado reducida. Pulsar una actividad alterna sus avances; pulsar un avance alterna sus fotografías.
- **Ver mapa completo:** expande toda la trazabilidad para análisis general. «Explorar por niveles» restaura la vista jerárquica.
- **Buscar nodo:** resalta coincidencias textuales entre los nodos visibles y atenúa el resto. Para buscar en avances/fotos primero hay que expandir el nivel o usar «Ver mapa completo».
- **Centrar mapa:** reajusta zoom y posición con React Flow. Controles nativos y minimapa disponibles en escritorio.
- **Panel contextual:** al cargar se selecciona el proyecto, y al elegir actividad se enumeran sus avances; en avances aparece una galería de las fotografías de R2.
- Las fotografías y sus vínculos son **solo de lectura**; no se habilitan cambios en datos relacionales al interactuar con el grafo.
- Los estilos se mantienen en `frontend/src/estilos/modulos/mapa-impacto/mapaImpacto.css`, sin CSS dentro de `modulos`.

### Pruebas complementarias

1. Abrir Aula para Kinder: comprobar que los nodos principales son legibles sin reducir el mapa hasta mostrar cada fotografía.
2. Pulsar una actividad y un avance, comprobar despliegue; volver a pulsar para contraer.
3. Pulsar «Ver mapa completo», seleccionar una fotografía y abrirla desde el panel lateral.
4. Buscar texto de un nodo y comprobar atenuación de los restantes; limpiar búsqueda.
5. Usar «Centrar mapa», zoom y minimapa. Probar anchos menores a 630 px.
6. Comprobar en Proyectos y Evidencias que no se alteraron registros ni permisos.

## Incremento 1C — editor visual de distribución (sin edición de relaciones)

- Los nodos de React Flow **se pueden arrastrar** para diagramar el proyecto; las conexiones continúan recalculándose al moverlos, pero su relación en PostgreSQL no se altera.
- «Mover nodos: activo/inactivo» permite alternar entre reorganización y simple exploración.
- Las posiciones se guardan en `localStorage` bajo `semilla:mapa-impacto:posiciones:v1:<usuarioId>:<proyectoId>`. Por ahora permanecen **en el mismo navegador**, no se sincronizan todavía con Neon ni entre dispositivos.
- «Restablecer posiciones» elimina el diseño personal y recupera la distribución jerárquica automática. «Centrar» solo cambia el zoom y encuadre.
- La barra de herramientas está fuera de la superficie del grafo. El lienzo ocupa menos alto, tiene fondo gris azulado neutro y cuadrícula discreta, nodos blancos con bordes acentuados y leyenda separada.
- Se mantiene la exploración por niveles, la búsqueda, el detalle lateral y el acceso a R2.

### Pruebas de este incremento

1. En Aula para Kinder, mover proyecto, actividad y avance; las conexiones deben seguir unidos a cada nodo.
2. Cambiar a Dashboard y regresar a Mapa de Impacto: el orden visual debe permanecer.
3. Recargar la página con el mismo usuario: el diseño se restaura por proyecto.
4. Cambiar de proyecto y volver: cada proyecto conserva su propia distribución.
5. Desactivar «Mover nodos» y comprobar que los elementos siguen siendo seleccionables, pero no arrastrables.
6. Usar «Restablecer posiciones» y comprobar que se recupera el diseño automático.
7. Comprobar que el formulario de proyectos, el estado de avances y el registro de evidencias no cambian por mover un nodo.

## Incremento 1D — GridStack y fotografías privadas renovables

### Fotografías R2
- El navegador recibió `ExpiredRequest` al abrir enlaces firmados antiguos: la carga en R2 y su registro en Neon ya estaban confirmados; el error era la **caducidad del enlace GET**.
- Backend: `GET /api/mapa-impacto/proyectos/:proyectoId/evidencias/:evidenciaId/enlace` genera un enlace GET de una hora bajo autenticación, permiso `proyectos.ver`, rol permitido y comprobación de organización; responde `Cache-Control: no-store`.
- El componente `FotografiaPrivadaMapa.tsx` pide un enlace fresco cuando monta una miniatura. Si la imagen falla, solicita otro enlace una sola vez; si vuelve a fallar, muestra el error sin bucle. Al pulsar «Abrir fotografía» **siempre solicita un enlace nuevo**, por lo que el botón no reutiliza una URL caducada.
- Las claves de R2 siguen siendo privadas: las URLs firmadas solo tienen duración limitada. No publicar ni copiar URLs firmadas en tickets.

### Distribución de paneles
- `EspacioMapaGrid.tsx` usa **GridStack** con dos widgets: Diagrama (React Flow) e Información seleccionada.
- Se mueve un panel arrastrando solo su cabecera; las acciones internas del mapa no disparan movimiento del panel.
- El usuario puede ajustar tamaños y posiciones. El diseño se guarda en `localStorage` por usuario y proyecto con clave `semilla:mapa-impacto:grid:v1:<usuarioId>:<proyectoId>`, y puede restablecerlo.
- React Flow gestiona por separado las posiciones de **nodos** y su clave de almacenamiento. Mover un panel nunca modifica la relación comunitaria, ni altera las evidencias o actividades.
- En pantallas estrechas GridStack cambia a una columna y deshabilita el arrastre de los paneles, conservando el uso de React Flow.
- **No** se sincroniza aún este diseño con Neon; la distribución queda solo en el navegador.

### Validaciones
1. Abrir Aula para Kinder, seleccionar el avance con tres fotos, verificar las miniaturas y abrirlas.
2. Dejar el mapa abierto más de cinco minutos y pulsar «Abrir fotografía»: debe generarse un enlace fresco, sin error `ExpiredRequest`.
3. Simular imagen inaccesible: mostrar un error y permitir navegar sin bloqueo.
4. Redimensionar el panel Diagrama y mover el panel Detalles por la cabecera; comprobar que React Flow se adapta.
5. Arrastrar un nodo dentro del grafo; confirmar que no se desplaza el widget GridStack.
6. Cambiar de módulo y regresar: las posiciones de nodos y paneles deben permanecer.
7. Restablecer paneles y restablecer nodos por separado; comprobar que ninguna acción cambia registros de Neon.
8. Verificar permisos de otro usuario y otra organización.
