# Convenciones de nombres y legibilidad del backend

**Proyecto:** Semilla — Gestión Comunitaria  
**Alcance:** `backend/`, TypeScript. **Fecha:** 21 de noviembre de 2026.

## 1. Principios

- Usar nombres que expliquen el propósito de cada variable dentro del contexto de negocio, preferentemente en español y en `camelCase`.
- Preferir `datosExpediente`, `datosNecesidad`, `valorCampo`, `nombreCampo`, `elementosLimpios`, `resultadoConsulta`, `clienteTransaccion` y `organizacionId` en lugar de `d`, `v`, `x`, `k`, `r`, `c` y `org`.
- En colecciones, usar un singular descriptivo: `visiones.map(vision => ...)`, `permisos.filter(permiso => ...)`.
- Los booleanos comienzan con `es`, `tiene`, `puede`, `esta` o `requiere`: `tienePermiso`, `esAdministrador`.
- Las funciones usan verbos: `validarExpediente`, `obtenerCapacidades`, `guardarNecesidad`. Los tipos y clases usan `PascalCase`.
- Evitar mezclar traducciones para el mismo concepto: `organizacionId`, `comunidadId`, `usuarioId`, `proyectoId`, `revision`.
- No renombrar automáticamente claves de JSON, propiedades de interfaces públicas, columnas SQL, parámetros de rutas, variables de entorno ni respuestas de API. Son contratos que requieren coordinación.
- SQL puede emplear alias cortos (por ejemplo `u` para usuarios o `p` para proyectos) cuando el contexto es evidente; un alias SQL no es una variable TypeScript. Preferir alias explicativos en consultas nuevas extensas.
- Las convenciones de bibliotecas externas y tipos (`req`, `res`, `Pool`, `JWT`, `UUID`, `db` como instancia explícita de base de datos en pruebas) se respetan cuando están suficientemente contextualizadas.
- No sacrificar claridad para reducir caracteres. Evitar cambios masivos sin pruebas; renombrar por módulo y verificar el comportamiento.

## 2. Significado de nombres encontrados

| Archivo / zona | Nombre anterior | Significado comprobado | Nombre recomendado |
|---|---|---|---|
| `domain/expediente.ts` | `d` | Propiedades recibidas del expediente | `datosExpediente` |
| `domain/expediente.ts` | `v` | Valor de un campo o visión en validación | `valorCampo` / `vision` |
| `domain/expediente.ts` | `x` | Entrada de lista o estructura de una visión | `elemento` / `datosVision` |
| `domain/metas-vision.ts` | `m`, `v` | Meta individual y sus campos | `meta`, `datosMeta` |
| `domain/necesidades.ts` | `d`, `k`, `v` | Entrada validada, nombre y valor del campo | `datosNecesidad`, `nombreCampo`, `valorCampo` |
| `services/capacidades.service.ts` | `d`, `k`, `v`, `r` en validación | Datos, nombre de campo, lista y lista limpia | `datosCapacidades`, `nombreCampo`, `valoresLista`, `valoresNormalizados` |
| `services/capacidades.service.ts` | `c`, `r` en acceso SQL | Cliente transaccional y resultado | `clienteTransaccion`, `resultadoConsulta` |
| `services/expedientes.service.ts` | `c`, `r` | Cliente SQL y resultado | `clienteTransaccion`, `resultadoConsulta` |
| `services/necesidades.service.ts` | `d`, `c`, `m`, `r` | Necesidad validada, cliente SQL y consultas | `datosNecesidad`, `clienteTransaccion`, nombres por consulta |
| `routes/administracion-accesos.routes.ts` | `r` | Resultado de consulta de roles | `resultadoRoles` |
| `routes/auditoria.routes.ts` | `d`, `r`, `e` | Fecha, fila de auditoría y entrada presentada | `fechaConsulta`, `filaAuditoria`, `eventoAuditoria` |
| `routes/configuracion-institucional.routes.ts` | `d`, `m` | Datos del cuerpo y coincidencia de imagen base64 | `datosConfiguracion`, `coincidenciaImagen` |
| `routes/integrantes-familia.routes.ts` | `f`, `v`, `d` | ID familiar, cuerpo de solicitud y datos de integrante | `familiaId`, `datosSolicitud`, `datosIntegrante` |
| `routes/pagos-operaciones.routes.ts` | `v`, `s` | Cuerpo de solicitud y fila de solicitud de pago | `datosSolicitud`, `solicitudPago` |
| `routes/proveedores.routes.ts` | `v`, `d` | Campos de entrada y proveedor validado | `datosProveedor`, `proveedorValidado` |
| `services/r2-evidencias.service.ts` | `e`, `x`, `c` en diagnóstico | Error inspeccionado, causa anidada, código | `errorActual`, `causa`, `codigoError` |

## 3. Alcance de la auditoría y plan de refactorización

Se identificaron **58 archivos TypeScript** bajo `backend/` mediante el árbol de GitHub. Se hizo un primer recorrido de sus declaraciones simples y callbacks breves, distinguiendo identificadores de variables locales de alias de SQL. Esta detección es una revisión inicial de estilo, no equivale a un análisis sintáctico completo ni a garantizar que no existan nombres confusos de tres caracteres o más.

**Primer lote aplicado:** `src/domain/expediente.ts`, `src/domain/metas-vision.ts`, `src/domain/necesidades.ts`, `src/services/capacidades.service.ts`. Se mantuvieron interfaces, mensajes, validaciones y contratos públicos.

**Segundo lote aplicado:** `src/services/expedientes.service.ts`, `src/services/necesidades.service.ts` y `src/services/comunidades.service.ts`. Se renombraron identificadores locales de transacciones, resultados, comunidad, metas y errores. Se conservaron literalmente las cadenas SQL y las claves de los objetos devueltos.

**Tercer lote aplicado:** `src/routes/administracion-accesos.routes.ts`, `src/routes/integrantes-familia.routes.ts`, `src/routes/proveedores.routes.ts` y `src/routes/pagos-operaciones.routes.ts`. Se sustituyeron nombres de variables locales y callbacks ambiguos por referencias explícitas a roles, permisos, miembros familiares, proveedores, solicitudes y clientes de transacción. Los identificadores de respuesta (por ejemplo `id`) y propiedades públicas conservan su nombre. Se restituyó de inmediato la expresión regular original de fecha de nacimiento tras detectar que un renombre automático podía modificar su contenido.

**Cuarto lote aplicado:** `src/services/r2-evidencias.service.ts`, `src/routes/auditoria.routes.ts`, `src/routes/configuracion-institucional.routes.ts` y `src/routes/plataforma.routes.ts`. Se aclararon las causas de error y códigos R2, filtros y registros de auditoría, parámetros y coincidencia de logo, roles solicitados y permisos base. Las claves de respuestas y la lista de patrones de seguridad se mantienen.

**Control adicional del lote:** tras los renombres en configuración se detectaron referencias accidentales a identificadores nativos (`Buffer`, `Number`, `Router`) y se restauraron antes de la validación final; en plataforma se actualizaron también las referencias de bucles al nuevo identificador `permisoBase`. Evitar futuros reemplazos de subcadenas como `r.` sin análisis de tokens o AST. La revisión final debe comprobar siempre el diff y ejecutar TypeScript/CI.

**Quinto lote aplicado:** `src/routes/perfiles-familia.routes.ts`, `src/routes/gestor-contratos.routes.ts` y `src/routes/pagos.routes.ts`. Se renombraron límites de validación, datos de evaluación familiar, características de vivienda, nodos de Tiptap, atributos del documento, cliente transaccional e identificador de organización. Se conservan las claves JSON externas, los alias SQL y las rutas. En el gestor de contratos se detectó y corrigió durante la revisión una referencia de organización con nombre anterior.

**Pendientes priorizados:** rutas adicionales con nombres ambiguos de más de dos caracteres; revisión funcional específica de administración, contratos, pagos, configuración institucional y aislamiento por organización. Las 13 pruebas existentes no cubren exhaustivamente todos esos flujos. Antes del merge del PR se requiere revisar cambios, ejecutar pruebas y comprobar los flujos sensibles. Los módulos extensos deben refactorizarse por separado con revisión de diferencias, compilación y pruebas. Se excluyen los alias SQL de reemplazos automáticos.

## 4. Criterios de aceptación por lote

1. No modificar tipos de las respuestas, nombres de propiedades externas, rutas ni tablas.
2. Compilar backend con `npm run build`.
3. Ejecutar `npm run test:expedientes` y verificar todos los escenarios.
4. Revisar el diff para detectar sustituciones dentro de cadenas SQL, mensajes y nombres públicos.
5. Integrar mediante PR; no fusionar cambios de legibilidad sin las comprobaciones.
