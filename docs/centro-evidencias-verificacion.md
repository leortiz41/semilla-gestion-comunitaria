# Centro de Evidencias y Verificación — incremento 1

## Objetivo
Transformar el módulo de Evidencias de Semilla en una vista institucional de control documental de avances. No sustituye la ejecución de Proyectos ni el Mapa de Impacto; relaciona cada foto con el trabajo reportado, su responsable, la decisión de revisión y la meta de actividad.

## Funcionalidades de este incremento
- Resumen de avances, fotografías, avances validados, avances sin fotos y avances enviados a revisión.
- Índice institucional por organización, **incluyendo avances con cero fotografías**, con filtros por comunidad, proyecto, estado, respaldo y búsqueda por texto.
- Expediente de avance: proyecto/comunidad/actividad, descripción, observaciones, fecha, cantidad y porcentaje reportados; responsable, revisor, revisión, devolución; meta, cantidad validada e historial de revisión cuando existe.
- Galería y carga de fotografías reutilizando `FotografiasAvance` para preservar sus permisos: solo el responsable con permiso `evidencias.gestionar` puede adjuntar en `BORRADOR` o `DEVUELTO`.
- Visor flotante dentro de la app; renovar enlace R2 al abrir cada foto, con firma GET de una hora.
- Sin migraciones nuevas ni cambios sobre fotos y avances existentes.

## Interpretación de indicadores
- *Sin fotografías* significa que no hay respaldo fotográfico registrado para ese avance; no implica necesariamente que falten actas, informes u otros documentos fuera de este sistema.
- *Validado* se refiere al estado de revisión del avance, no a una auditoría documental independiente.
- La consulta devuelve hasta 500 avances recientes por organización; las cifras se calculan sobre ese conjunto y no constituyen totales históricos si el límite se supera.
- La cantidad reportada puede no tener unidad; no atribuirle una automáticamente.

## Comprobaciones de aceptación
1. En desarrollo, consultar Aula para Kinder (El Ocote): avance del 9 de noviembre con 3 fotografías, observaciones y estado validado.
2. Consultar Vivienda (El Bambú): avances registrados sin foto, visibles como pendientes de respaldo fotográfico.
3. Probar filtros y búsqueda; abrir avance desde diferentes comunidades y comprobar metadatos.
4. Abrir foto con visor flotante; después de 5 minutos, volver a abrir para renovar firma de R2.
5. Comprobar que un usuario no responsable no puede subir fotos; mantener comportamiento en borrador y devuelto.
6. Confirmar que el historial y las métricas no alteran datos en Neon y que no se exponen registros de otra organización.

## Próximos incrementos propuestos
- Expediente documental multimodal: actas, informes, PDF, comprobantes, clasificación documental y permisos por tipo, requiere nuevos tipos de evidencia, validaciones de archivo y diseño de almacenamiento.
- Control específico de suficiencia documental y revisión de evidencias, distinto de validar el avance.
- Exportación de informe verificable y vinculación de documentos a resultados medibles y a donantes autorizados.

No marcar estas funciones futuras como implementadas.
