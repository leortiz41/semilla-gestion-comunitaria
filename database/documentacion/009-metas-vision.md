# Aplicación de 009: metas individuales

Aplicada el 7 de noviembre de 2026 en proyecto `semilla-gestion-comunitaria`, rama Neon `development`, base `neondb`. No volver a ejecutarla allí. No se modificó `production`.

Respaldo previo: `respaldo-development-antes-009-20261107` (`br-cool-snow-akanmf19`), copia de la base sin endpoint de cómputo. La creación de snapshot de una rama derivada fue rechazada por Neon; esta copia conserva el estado previo.

Para otros ambientes: verificar que 007 exista, respaldar y ejecutar `database/sql/009_metas_vision_desarrollo.sql` una vez, como transacción. No volver a ejecutar 005–008 y no usar Prisma db push. Actualizar backend y frontend juntos: los clientes anteriores no envían la revisión y recibirán un aviso de recarga al guardar.

La migración mantiene el párrafo original y crea una meta individual con ese texto. Separarlo en varias metas requiere revisión de la persona: no hay clasificación automática. Las metas retiradas se archivan y las ediciones conservan sus UUID.

Prueba de aceptación: abrir un área, dividir su meta en varias tarjetas, guardar y recargar; editar una descripción y comprobar que mantiene el ID; quitar una tarjeta y comprobar que queda archivada. Confirmar que población/vivienda y organización/productividad permanecen sin cambios. No promover a main hasta validar el flujo autenticado.
