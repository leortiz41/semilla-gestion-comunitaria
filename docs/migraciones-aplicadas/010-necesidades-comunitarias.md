# Migración 010 — registro de necesidades

Aplicada el 7 de noviembre de 2026 en Neon `development`, proyecto `semilla-gestion-comunitaria`, base `neondb`. No volver a ejecutar en este ambiente. Producción no modificada.

Respaldo previo sin cómputo: `respaldo-development-antes-010-20261107` (`br-square-thunder-akr3hqi6`). Requiere 008 y 009. En otros ambientes debe aplicarse una sola vez como transacción tras revisar y respaldar su estado; no reejecutar migraciones anteriores ni usar prisma db push.

Actualizar develop y reiniciar backend/frontend. En Visión de desarrollo, abrir «Agregar necesidad» bajo un área, seleccionar una meta opcional y registrar un problema. Recargar y comprobar prioridad propia, estado identificada y referencia a la meta. Cantidades desconocidas deben seguir vacías. No se registraron necesidades ficticias en la base real.

Prueba autenticada pendiente de validación por el usuario. Evaluaciones y vínculos con proyectos se implementarán en migraciones posteriores.
