# Expediente comunitario — primer flujo completo de registro y consulta

Fecha: 7 de noviembre de 2026. Historia: #11. Rama: `feature/expediente-comunitario`.

## Comportamiento

Nueva comunidad registra información general, coordenadas opcionales, población y vivienda, visión de desarrollo, organizaciones y productividad en una transacción. El listado permite abrir «Ver expediente» y consultar lo guardado. Los registros básicos existentes continúan disponibles y muestran que todavía no tienen diagnóstico.

El endpoint de registro básico y la edición básica permanecen compatibles. Este avance no habilita edición del diagnóstico ni convierte automáticamente los registros básicos existentes en expedientes completos. El issue #11 permanece abierto hasta verificar el despliegue y resolver sus criterios pendientes.

## Modelo y decisiones

La migración `database/sql/005_expediente_comunitario.sql` añade coordenadas a comunidades y tres tablas:

- `diagnosticos_comunidad`: medición fechada, autor, población, vivienda y observaciones. Valores desconocidos se conservan como NULL; cero representa un conteo conocido.
- `visiones_comunidad`: una fila por área y diagnóstico, con situación, meta y prioridad.
- `elementos_diagnostico`: una fila por vivienda, organización, actividad productiva o producto/servicio. `tipo` está restringido por CHECK y los nombres son únicos por diagnóstico/tipo sin distinguir mayúsculas. No se guardan listas separadas por comas.

Esta implementación es una primera normalización del expediente, más pequeña que los catálogos y directorios independientes previstos en el modelo objetivo. Las selecciones representan observaciones del diagnóstico; los directorios operativos de organizaciones y recursos podrán incorporarse después. Las áreas de visión usan las cuatro categorías actuales del formulario; no se crea todavía el catálogo configurable `areas_desarrollo`.

La sesión determina la organización. FK compuestas impiden cruzar diagnósticos o detalles entre ONG. El servicio comprueba usuario y zona activos dentro de la misma transacción; registra auditoría sin copiar datos personales innecesarios. Un error en cualquier detalle revierte también la comunidad. El formulario conserva los datos si la API devuelve un error.

Se mantuvo `pg` y SQL parametrizado, como los servicios territoriales actuales. Prisma queda alineado como representación del esquema, pero el criterio del issue que exige persistencia mediante Prisma **sigue pendiente**; no se declara cumplido ni se cambia silenciosamente el criterio.

## API

- `POST /api/comunidades/expedientes`: permiso `comunidades.gestionar`, cuerpo validado, respuesta 201 con `comunidad.id`.
- `GET /api/comunidades/:id/expediente`: permiso `comunidades.ver`; 404 cuando la comunidad no pertenece a la organización.
- Errores de validación: 400. Duplicado territorial: 409. Sin autenticación: 401; sin permiso: 403.

## Validación y límites

Compilación de frontend/backend y validación del schema Prisma. Pruebas con PGlite (PostgreSQL embebido) aplican scripts 001–005, conservan una comunidad previa, crean un expediente, vuelven a leer sus secciones, rechazan acceso cruzado, zona ajena/inactiva, duplicados, coordenadas inválidas y revierten un fallo intermedio. Se omite únicamente la instalación de `pgcrypto` en este entorno: PGlite ya incorpora `gen_random_uuid()`.

No se ejecutó contra Neon ni se realizó una prueba visual autenticada en producción. Las pruebas locales no sustituyen la comprobación en development con credenciales reales de prueba.

## Aplicación en desarrollo

1. Respaldar la rama Neon development y comprobar scripts 001–004 aplicados.
2. Aplicar una sola vez `database/sql/005_expediente_comunitario.sql` a development. El archivo usa una transacción; no debe ejecutarse repetidamente ni contra producción por accidente.
3. En backend: `npm ci`, `npm run prisma:generate`, `npm run build`, `npm run test:expedientes`.
4. En frontend: `npm ci`, `npm run build` y `npm run dev`.
5. Con backend conectado a development, registrar una comunidad ficticia, recargar y abrir «Ver expediente». Verificar también con un usuario de otra organización y uno sin permiso de gestión.
6. Integrar a producción solo después de documentar la prueba y aplicar la migración correspondiente antes de activar la nueva interfaz.

Recuperación: si falla la migración, su transacción revierte; si ya fue aplicada con datos, restaurar el respaldo o crear una migración correctiva. No borrar las tablas para reintentar. La versión anterior del backend sigue funcionando con las columnas y tablas nuevas.

## Siguiente paso

Completar edición/historial del diagnóstico y persistencia mediante Prisma, probar el flujo en Neon y revisar los criterios del issue antes de cerrarlo.
