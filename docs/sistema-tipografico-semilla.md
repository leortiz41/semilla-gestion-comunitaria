# Semilla — Sistema tipográfico global

## Objetivo
Dar a todos los módulos una identidad de producto consistente y legible, evitando encabezados sobredimensionados y mezclas arbitrarias de tamaños, pesos y estilos. No se modifican funcionalidades ni permisos.

## Familias
- **Manrope:** encabezados, títulos de sección, jerarquías y pequeñas etiquetas de navegación.
- **Source Sans 3:** párrafos, formularios, tablas, cifras, controles y lectura continua.
- Carga desde Google Fonts en `frontend/index.html` con `display=swap`; fuentes alternativas del sistema cuando no haya conexión.
- No compartir ni añadir archivos de fuentes al repositorio.

## Escala y tokens
Definidos en `frontend/src/estilos/tipografia.css` e importados globalmente desde `main.tsx`.

| Token | Valor | Uso |
|---|---|---|
| `--texto-xs` | .78rem | etiquetas auxiliares, estados |
| `--texto-sm` | .875rem | controles, tarjetas, metadatos |
| `--texto-base` | 1rem | párrafos principales |
| `--texto-lg` | 1.125rem | destacados moderados |
| `--titulo-seccion` | 1.15–1.4rem | secciones internas |
| `--titulo-modulo` | 1.85–2.55rem | encabezado de módulo |
| `--interlineado-texto` | 1.5 | lectura general |
| `--interlineado-titulo` | 1.18 | encabezados |

## Criterios para nuevas pantallas
1. Utilizar variables compartidas y evitar valores únicos salvo necesidad real.
2. Títulos breves con peso 700 y separación entre letras moderada; evitar mayúsculas en todos los niveles.
3. Cuerpo y controles legibles sin depender de zoom; no convertir textos auxiliares en ilegibles.
4. Emplear color, tamaño, espaciado y peso en conjunto para jerarquía; no hacer todos los textos negrita.
5. Respetar descripciones, cifras y evidencias; no alterar contenido de negocio por motivos estéticos.
6. Probar en escritorio y móvil, incluyendo zoom del navegador al 200%.
7. El CSS específico de módulos debe apoyarse en tokens; los ajustes globales están en un único archivo.

## Comprobaciones
- Login, barra lateral, Dashboard, Comunidades, Proyectos, Mapa de Impacto, Evidencias, Pagos, Donantes, Usuarios y Auditoría.
- Confirmar que formularios no se desbordan, controles no pierden foco visible y párrafos siguen siendo legibles en móvil.
- Verificar que el mapa React Flow, GridStack y gráficos ECharts no se alteren por cambio de fuente.
