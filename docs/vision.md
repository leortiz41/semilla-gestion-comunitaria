# Visión del proyecto Semilla

## 1. Nombre

**Semilla**  
**Lema:** Recursos que generan desarrollo.

## 2. Problema

Las organizaciones que ejecutan programas de desarrollo comunitario suelen manejar información de comunidades, familias, beneficiarios, donaciones, proyectos, compras, actividades y evidencias en archivos separados, hojas de cálculo, documentos y registros manuales. Esta fragmentación dificulta conocer con precisión qué recursos ingresaron, cómo fueron utilizados, quiénes fueron beneficiados y cuál es el avance real de cada intervención.

El problema se agrava en comunidades rurales y remotas donde la conectividad a internet puede ser inestable o inexistente, lo que limita el uso de aplicaciones que dependen completamente de una conexión permanente.

## 3. Cliente principal inicial

El cliente de referencia para el proyecto es la ONG **Ministerio Sal y Luz**, organización que desarrolla programas y proyectos de apoyo comunitario.

La arquitectura se plantea de forma que Semilla pueda ser utilizada posteriormente por otras organizaciones con necesidades similares mediante un modelo multi-organización.

## 4. Propuesta de valor

Semilla centraliza la gestión comunitaria y permite dar trazabilidad a los recursos desde su origen hasta su impacto.

### Concepto central de trazabilidad

Semilla debe permitir seguir un recurso desde su origen, identificar quién lo donó, dónde fue asignado, qué proyecto o actividad lo ejecutó, qué familias o comunidades fueron beneficiadas y qué evidencia demuestra el resultado obtenido.

Flujo conceptual:

```text
Donante
   ↓
Donación
   ↓
Asignación
   ↓
Proyecto / Actividad
   ↓
Familia / Comunidad / Zona
   ↓
Ejecución
   ↓
Evidencia aprobada
   ↓
Resultado / Impacto
```

Para conservar trazabilidad se separan cuatro conceptos principales:

- **Donante:** quién aporta.
- **Donación:** qué recurso o aporte ingresó.
- **Asignación:** dónde y para qué se utilizará.
- **Ejecución:** cómo se utilizó realmente el recurso.

## 5. Usuarios principales

### Usuarios internos

- Administrador
- Coordinador de programa
- Finanzas / Contabilidad
- Personal de campo
- Voluntarios
- Usuarios de consulta
- Ejecutivos de la organización

### Usuarios externos

- Líder comunitario: reporta avances y evidencias únicamente de los proyectos o comunidades que tiene asignados.
- Donante: consulta el avance, impacto y evidencias previamente autorizadas de las iniciativas que financia.

## 6. Módulos funcionales

- Autenticación y seguridad
- Usuarios, roles y permisos
- Dashboard
- Territorio
  - Mapa general
  - Zonas
  - Comunidades
- Familias
- Personas y beneficiarios
- Programas
- Proyectos
- Actividades
- Necesidades comunitarias
- Donantes
  - Donantes
  - Donaciones
  - Asignaciones
  - Historial de impacto
- Proveedores
- Compras
- Gastos
- Presupuestos
- Recursos / materiales
- Evidencias y documentos
  - Pendientes de revisión
  - Aprobadas
  - Rechazadas
  - Autorizadas para visualización externa
- Reportes
- Auditoría
- Sincronización offline

## 7. Visualización del impacto

Semilla no se limitará a mostrar información mediante tablas y formularios tradicionales. Se plantea incorporar visualizaciones que permitan comprender relaciones territoriales y de impacto.

### Vista de impacto

React Flow podrá utilizarse en el Dashboard y otras vistas para representar relaciones como:

```text
Necesidad
   ↓
Proyecto
   ↓
Donación / Recursos
   ↓
Actividades
   ↓
Beneficiarios
   ↓
Evidencias
   ↓
Impacto
```

### Mapa territorial

El módulo Territorio permitirá ubicar zonas y comunidades geográficamente mediante coordenadas, mostrar proyectos activos, necesidades, beneficiarios, donantes relacionados e indicadores de intervención.

La implementación se evaluará con MapLibre GL JS por su capacidad para trabajar con mapas interactivos, capas y visualizaciones geográficas.

## 8. Seguimiento y aprobación de evidencias

Los líderes comunitarios podrán registrar avances de los proyectos que tengan asignados y adjuntar fotografías u otras evidencias.

Las evidencias no serán publicadas automáticamente. Tendrán un flujo de validación:

```text
Borrador
   ↓
Enviada
   ↓
Pendiente de revisión
   ├── Aprobada
   │      └── Autorizada para visualización externa
   └── Rechazada
          └── Requiere corrección
```

Una evidencia aprobada internamente no necesariamente será visible para usuarios externos. La autorización de publicación deberá ser una decisión explícita del administrador o coordinador responsable.

## 9. Relación entre donantes, proyectos y beneficiarios

Un proyecto puede ser financiado por uno o varios donantes y un mismo donante puede participar en varios proyectos. La relación se manejará mediante donaciones y asignaciones, evitando depender de un único `donanteId` en el proyecto o en la familia.

Las asignaciones podrán vincular recursos con:

- Zona
- Comunidad
- Proyecto
- Actividad
- Familia beneficiaria

Los proyectos podrán manejar:

- Código interno.
- Nombre descriptivo del proyecto.
- Nombre visible o iniciativa asociada al donante cuando sea necesario.
- Donaciones y asignaciones relacionadas.
- Beneficiarios.
- Avance físico.
- Ejecución financiera.
- Evidencias.

## 10. Diferenciadores

### Offline-first

Semilla será diseñada con enfoque **offline-first** para que el personal de campo pueda consultar y registrar información aun cuando no exista conexión a internet. Los cambios pendientes se sincronizarán con la base central cuando vuelva la conectividad.

### Multi-organización

Semilla se diseñará para que diferentes organizaciones puedan utilizar la misma plataforma manteniendo sus datos aislados. Ministerio Sal y Luz será la primera organización de referencia.

### Trazabilidad de recursos e impacto

La plataforma relacionará recursos, donantes, proyectos, actividades, beneficiarios, territorio y evidencias para demostrar el recorrido completo de una intervención.

## 11. Stack tecnológico

### Frontend
React + TypeScript + Vite.

### Visualización
React Flow para relaciones e impacto.  
MapLibre GL JS como opción principal para visualización territorial.

### Backend
Node.js + Express + TypeScript.

### Base de datos
PostgreSQL con Prisma ORM.

### Seguridad
JWT, refresh tokens HttpOnly, RBAC, validación de entrada, auditoría y HTTPS.

### Offline
PWA + Service Worker + IndexedDB/Dexie + cola de sincronización.

### Despliegue
Vercel para frontend y Render para backend. PostgreSQL administrado mediante Neon.

## 12. Alcance del MVP

El MVP deberá demostrar de punta a punta:

1. Inicio de sesión y autorización por roles.
2. Gestión de zonas y comunidades.
3. Gestión de familias y beneficiarios.
4. Gestión básica de programas y proyectos.
5. Registro de donantes, donaciones y asignaciones.
6. Registro de actividades y evidencias con flujo de revisión.
7. Dashboard y reportes iniciales.
8. Visualización territorial básica.
9. Auditoría básica.
10. Aplicación desplegada públicamente mediante HTTPS.

Las funcionalidades más avanzadas de portal de donantes, portal de líderes, visualización React Flow completa y offline se incorporarán de forma incremental según el avance del proyecto.

## 13. Hipótesis principales

- Centralizar la información reducirá la dispersión y duplicidad de registros.
- La trazabilidad de recursos facilitará la rendición de cuentas.
- Relacionar donaciones con proyectos, actividades y beneficiarios permitirá demostrar mejor el impacto de los recursos.
- La revisión de evidencias mejorará la calidad y confiabilidad de la información presentada a donantes y ejecutivos.
- Un mapa territorial facilitará comprender dónde trabaja la organización y cómo se distribuyen las intervenciones.
- Un modo offline permitirá utilizar la plataforma en comunidades con conectividad limitada.
- Roles y permisos permitirán separar responsabilidades administrativas, financieras, de campo y externas.

## 14. Criterio de éxito inicial

Al finalizar el MVP, un usuario autorizado deberá poder registrar una comunidad, una familia, un proyecto o actividad asociada, vincular donantes, donaciones, recursos y beneficiarios, registrar evidencias y consultar posteriormente la trazabilidad de esa intervención desde Semilla.
