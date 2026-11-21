# ADR 001 — Monolito modular con frontend separado

**Estado:** Aceptada. **Fecha:** 21/11/2026.

## Contexto
El producto incorpora varios procesos relacionados y requiere mantener una entrega continua con recursos de desarrollo limitados.

## Alternativas
- Microservicios independientes por módulo.
- Aplicación única con interfaz y servidor estrechamente acoplados.
- Backend modular y frontend independiente.

## Decisión
Mantener React/TypeScript en Vercel y una API Express/TypeScript en Render, separando rutas, servicios, dominio y middleware. PostgreSQL se administra en Neon.

## Justificación y consecuencias
Se simplifica el despliegue, se reutilizan controles de seguridad y se reduce la coordinación entre servicios. El backend comparte el ciclo de despliegue de sus módulos; será necesario mantener límites claros y pruebas de integración para reducir regresiones. No se introduce mensajería distribuida sin una necesidad demostrada.
