# ADR 003 — Resultados validados y evidencias privadas

**Estado:** Aceptada. **Fecha:** 21/11/2026.

## Contexto
Los donantes necesitan seguimiento verificable sin acceder a borradores, información de otras organizaciones ni documentos financieros privados.

## Alternativas
- Publicar todos los avances y archivos.
- Guardar imágenes directamente en PostgreSQL.
- Separar metadatos y archivos, con revisión y permisos de publicación.

## Decisión
Mantener metadatos en PostgreSQL y fotografías en Cloudflare R2 privado. El resultado usa avances validados; el portal de donantes verifica proyecto asignado y permiso de evidencias, además del indicador de publicación. El servidor genera acceso temporal cuando corresponde.

## Consecuencias
Se mejora la trazabilidad y se limita la exposición de datos. R2 introduce una dependencia externa y exige validar firmas, disponibilidad, tipos de archivo y configuración. Los enlaces temporales tienen una vigencia limitada; su revocación no necesariamente invalida enlaces ya emitidos de inmediato.

## Evidencia
Pruebas SDK R2, HU-12, PR #47 y commit 7dfb5ae8 de restricción de evidencias en el mapa.
