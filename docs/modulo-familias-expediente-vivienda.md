# Módulo Familias — expediente de vivienda y beneficiarios

## Referencia y objetivo
Referencia funcional: formulario de construcción de viviendas *House Construction Profile*, proporcionado por Ministerio Sal y Luz, adaptado a español. El módulo permite registrar, evaluar y dar seguimiento a la familia que solicita o recibe apoyo habitacional, y documentar quién es la familia beneficiaria y qué proyecto la atiende.

**Distinguir:** registro de la familia ≠ evaluación de elegibilidad ≠ adjudicación ≠ entrega de vivienda. Nunca considerar beneficiaria aprobada solo porque se creó una ficha.

## Modelo de datos existente (verificado en Neon Development)
- `familias`: familia, comunidad, nombre de referencia, dirección, número de casa, activo.
- `miembros_familia`: persona, parentesco, jefe de hogar, vigencia.
- `perfiles_familia`: evaluación por familia y proyecto, riesgo, integrantes, habitaciones, tipo de vivienda, ingreso mensual, foto, estado y observaciones. Estados: `PENDIENTE`, `EVALUADO`, `SELECCIONADO`, `DESCARTADO`, `FINALIZADO`.
- `proyectos`: la vivienda o programa de apoyo al que se vincula la familia.

No crear otra tabla `familias`. Extender el esquema mediante migraciones aditivas; no aplicar automáticamente a Production.

## Expediente en español
### Identificación
Código de expediente, fecha de levantamiento, comunidad/zona, dirección de referencia, nombre identificador de la familia, número de vivienda, estado de solicitud, proyecto de vivienda asociado, brigada vinculada, responsable y fecha de evaluación.

### Núcleo familiar
Responsables del hogar (madre, padre u otro tutor), identificación protegida, teléfono, ocupación, edad y relación con el hogar. Integrantes: nombre, fecha de nacimiento/edad, parentesco, escolaridad, tallas de pantalón/falda/zapatos **opcionales** para apoyo en especie. No asumir composición tradicional padre/madre; permitir hogares monoparentales y otros cuidadores.

### Situación socioeconómica y vivienda
Ingreso mensual estimado (L), fuente de ingreso, tenencia/condición de terreno, energía eléctrica, agua, pila, fosa o saneamiento, material y tipo de vivienda actual, habitaciones, composición y número de integrantes, vulnerabilidades evaluadas, nivel de riesgo y observaciones de campo. No usar estado civil como criterio automático de exclusión.

### Documentación acreditativa
Adjuntar PDF privados por categoría configurable: identificación del responsable, documento de propiedad/posesión o constancia pertinente, constancia comunitaria, solicitud de apoyo, evaluación socioeconómica, acta de selección, acta de entrega/recepción y otros soportes. **La lista exacta de documentos obligatorios queda pendiente de validación por Ministerio Sal y Luz**: el formulario de referencia no define esos requisitos.

Para cada documento: tipo, descripción, nombre de archivo original, tipo MIME, tamaño, clave privada en R2, fecha, cargado por, estado `PENDIENTE`/`APROBADO`/`RECHAZADO`, revisor, fecha, motivo de rechazo, versión e historial. Nunca guardar enlaces prefirmados permanentes ni documentos PDF como texto/base64 en PostgreSQL; guardar metadatos y la clave del objeto. Descargas con URL de vida corta, autorización y auditoría.

### Evidencias y seguimiento
Fotos del estado inicial, construcción y vivienda entregada; observaciones de visita, equipo/brigada responsable, fechas, hitos de validación y acta de entrega, historial auditable.

## Navegación propuesta
1. **Listado** de familias: búsqueda por nombre/código/comunidad, filtros por proyecto y estado; tarjetas resumidas sin números de identidad.
2. **Registrar familia**: identificación básica y comunidad; ficha guardada inicialmente como borrador/pendiente.
3. **Perfil familiar**: miembros y situación de vivienda, con edición protegida.
4. **Documentos PDF**: carga, revisión y versión; señalización de incompletos sin dar aprobación automática.
5. **Evaluación y selección**: verificación por COORDINADOR/ADMINISTRADOR, motivo y bitácora; evitar autoaprobación si aplica.
6. **Seguimiento de vivienda**: proyecto/brigada, fotografías, acta y fecha de entrega.

## Seguridad y aceptación
- Toda lectura y escritura filtrada por la organización de la sesión **desde SQL**, usando `comunidades.organizacion_id`, no solo controles de UI.
- DONANTE no puede consultar los expedientes familiares, identificaciones ni PDF, aunque patrocine el proyecto. Compartir información agregada y evidencias autorizadas por la ruta de donantes existente.
- Permisos separados para consulta, edición, documentos y validación. Revisar mapeo de permisos existentes antes de introducir códigos nuevos.
- PDF máximo 10 MB inicialmente, validar `application/pdf` y firma `%PDF-`, escaneo antimalware antes de descarga/consumo si se habilita la carga; bucket privado, claves segregadas por organización, URL de descarga con vencimiento corto.
- No registrar números de identidad ni URL firmadas en logs, analítica ni capturas.
- No borrar físicamente familias con historial; desactivar. Registrar creador y cambios significativos.
- Pruebas: CRUD autorizado; acceso de otra organización 404; donante 403; documento rechazado no da por completo el expediente; PDF inválido/tamaño excesivo 400; proyecto de otra organización rechazado; privacidad del portal del donante.

## Plan de implementación por entregas
- **F1:** CRUD de ficha base, listado, filtros por comunidad y permisos, conectado a `familias`.
- **F2:** ampliación de evaluación y miembros aprovechando `perfiles_familia` y `miembros_familia`, nuevas columnas si necesarias.
- **F3:** documentos PDF privados en R2, verificación, revisión, historial; **bloqueado funcionalmente hasta solucionar el fallo PUT 403 de R2**.
- **F4:** asignación de vivienda/brigada, visitas, entrega, resumen/impresión y pruebas multitenant, paso a `main`.

No trasladar datos de Development a Production ni marcar documentos como aprobados por defecto.


## Asignación de brigada y portal del donante (027)
- El vínculo es `perfiles_familia` → `asignaciones_familias_brigadas` → `brigadas_donantes`; no se duplica la familia por cada brigada.
- Solo pueden asignarse brigadas activas que ya patrocinan el proyecto correspondiente mediante `brigadas_donantes_proyectos`, dentro de la misma organización.
- El expediente distingue `PENDIENTE`/`EVALUADO` (lista de espera o evaluación), `SELECCIONADO` (aprobada para apoyo), `FINALIZADO` (apoyo finalizado) y `DESCARTADO` (no seleccionada).
- La aprobación y la entrega no se habilitan hasta cerrar la validación documental; la asignación de brigada, por sí sola, NO modifica el estado de elegibilidad.
- En Evidencias → Mapa de Impacto, el donante recibe un **resumen agregado por brigada** sin nombres, identidades, direcciones, ingresos ni PDF familiares.
- La cuenta DONANTE debe poseer acceso al proyecto en `proyectos_donantes` y su correo debe corresponder al correo de la ficha `donantes` de la brigada; esto es una restricción temporal. Para múltiples cuentas por brigada conviene introducir más adelante una tabla explícita cuenta–brigada y un editor de permisos.
- La lectura es en la consulta (no hay WebSocket ni notificaciones en tiempo real); refrescar el mapa obtiene los datos actualizados de Neon Development.
- **Pruebas pendientes**: 2 cuentas DONANTE con brigadas diferentes que financian el mismo proyecto; una familia asignada a cada una; comprobar que ambas ven solo sus conteos y no acceden a PDF, identidad ni otras brigadas.
- Migración 027 aplicada a Development; Production permanece sin cambios.
