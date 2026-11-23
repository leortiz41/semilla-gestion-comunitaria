# Registro de decisiones de arquitectura (ADR)

Estas decisiones documentan el contexto, las alternativas, la opción elegida y sus consecuencias. Se revisarán cuando cambien las necesidades del producto.

| ADR | Decisión | Estado |
|---|---|---|
| [001](001-monolito-modular.md) | Monolito modular con frontend separado | Aceptada |
| [002](002-aislamiento-multitenant.md) | Base relacional compartida con aislamiento por organización | Aceptada |
| [003](003-evidencias-y-resultados.md) | Resultados validados y evidencias privadas | Aceptada |
| [004](004-migracion-modular-comunidades.md) | Migrar comunidades con adaptadores y pruebas de compatibilidad | Aceptada |
| [005](005-modularizacion-proyectos.md) | Separación multicapa de Proyectos, con repositorios y preservación de contratos | En desarrollo, aceptación funcional pendiente |
| [006](006-arquitectura-modular-por-capas.md) | Estándar normativo de capas y límites para backend Express y frontend React | Aceptada — adopción progresiva |

Última actualización del registro: 23 de noviembre de 2026.

La aplicación del ADR-006 se realiza gradualmente. Su aceptación **no significa** que todos los módulos existentes ya cumplan la separación exigida.
