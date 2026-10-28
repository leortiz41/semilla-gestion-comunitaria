# Visión del proyecto Semilla

## 1. Nombre

**Semilla**  
**Lema:** Recursos que generan desarrollo.

## 2. Problema

Las organizaciones que ejecutan programas de desarrollo comunitario suelen manejar información de comunidades, familias, beneficiarios, donaciones, proyectos, compras, actividades y evidencias en archivos separados, hojas de cálculo, documentos y registros manuales. Esta fragmentación dificulta conocer con precisión qué recursos ingresaron, cómo fueron utilizados, quiénes fueron beneficiados y cuál es el avance real de cada intervención.

El problema se agrava en comunidades rurales y remotas donde la conectividad a internet puede ser inestable o inexistente, lo que limita el uso de aplicaciones que dependen completamente de una conexión permanente.

## 3. Cliente principal inicial

El cliente de referencia para el proyecto es la ONG **Ministerio Sal y Luz**, organización que desarrolla programas y proyectos de apoyo comunitario.

La arquitectura se plantea de forma que Semilla pueda ser utilizada posteriormente por otras organizaciones con necesidades similares.

## 4. Propuesta de valor

Semilla centraliza la gestión comunitaria y permite dar trazabilidad a los recursos desde su origen hasta su impacto.

Flujo conceptual:

```text
Donante / Fuente de recursos
          ↓
       Recurso
          ↓
Programa / Proyecto
          ↓
Actividad / Inversión
          ↓
Familia / Comunidad
          ↓
Evidencia / Resultado
```

## 5. Usuarios principales

- Administrador
- Coordinador de programa
- Finanzas / Contabilidad
- Personal de campo
- Voluntarios
- Usuarios de consulta

## 6. Módulos iniciales

- Autenticación y seguridad
- Usuarios, roles y permisos
- Zonas y comunidades
- Familias
- Personas y beneficiarios
- Programas
- Proyectos
- Actividades
- Necesidades comunitarias
- Donantes
- Donaciones
- Proveedores
- Compras
- Gastos
- Presupuestos
- Recursos / materiales
- Evidencias y documentos
- Reportes
- Auditoría
- Sincronización offline

## 7. Diferenciador

Semilla será diseñada con enfoque **offline-first** para que el personal de campo pueda consultar y registrar información aun cuando no exista conexión a internet. Los cambios pendientes se sincronizarán con la base central cuando vuelva la conectividad.

## 8. Stack tecnológico

### Frontend
React + TypeScript + Vite + Tailwind CSS.

### Backend
Node.js + Express + TypeScript.

### Base de datos
PostgreSQL con Prisma ORM.

### Seguridad
JWT, refresh tokens, Argon2id, RBAC, validación de entrada, auditoría y HTTPS.

### Offline
PWA + Service Worker + IndexedDB/Dexie + cola de sincronización.

## 9. Alcance del MVP de 10 semanas

El MVP deberá demostrar de punta a punta:

1. Inicio de sesión y autorización por roles.
2. Gestión de zonas y comunidades.
3. Gestión de familias y beneficiarios.
4. Gestión básica de programas y proyectos.
5. Registro de donaciones y recursos.
6. Registro de actividades y evidencias.
7. Dashboard y reportes iniciales.
8. Flujo de trabajo offline para operaciones de campo seleccionadas.
9. Auditoría básica.
10. Aplicación desplegada públicamente mediante HTTPS.

## 10. Hipótesis principales

- Centralizar la información reducirá la dispersión y duplicidad de registros.
- La trazabilidad de recursos facilitará la rendición de cuentas.
- Un modo offline permitirá utilizar la plataforma en comunidades con conectividad limitada.
- Roles y permisos permitirán separar responsabilidades administrativas, financieras y de campo.

## 11. Criterio de éxito inicial

Al finalizar el MVP, un usuario autorizado deberá poder registrar una comunidad, una familia, un proyecto o actividad asociada, vincular recursos y evidencias, y consultar posteriormente la trazabilidad de esa intervención desde Semilla.
