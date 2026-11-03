# Bitácora - Semana 2

## Proyecto

**Semilla - Gestión Comunitaria**  
**Lema:** Recursos que generan desarrollo.

## Objetivo de esta etapa

Durante esta etapa el objetivo principal es evolucionar Semilla desde una estructura administrativa inicial hacia una plataforma capaz de representar territorio, proyectos, donaciones, beneficiarios, evidencias e impacto de forma relacionada y trazable.

La intención ya no es únicamente registrar información, sino construir una solución que permita responder preguntas como:

- ¿Quién donó un recurso?
- ¿Dónde fue asignado?
- ¿Qué proyecto o actividad lo ejecutó?
- ¿Qué familias o comunidades fueron beneficiadas?
- ¿Qué evidencia demuestra el avance o resultado?
- ¿Qué información puede consultar un donante o un ejecutivo?

## Decisiones funcionales tomadas

### 1. Trazabilidad completa del recurso

Se definió como concepto central del proyecto el siguiente flujo:

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

Se decidió separar conceptualmente Donante, Donación, Asignación y Ejecución para evitar relaciones rígidas y permitir que un mismo donante financie varios proyectos o que un proyecto reciba aportes de distintos donantes.

### 2. Módulo de Donantes y Financiamiento

El proyecto incorporará un módulo formal de Donantes con información de donantes, donaciones, asignaciones e historial de impacto.

Las asignaciones podrán relacionar recursos con zonas, comunidades, proyectos, actividades y familias beneficiarias.

Los proyectos podrán manejar un nombre interno descriptivo y, cuando sea necesario, un nombre visible o iniciativa asociada al donante.

### 3. Mapa territorial

Se definió la necesidad de incorporar un módulo Territorio que permita visualizar geográficamente las zonas y comunidades de trabajo.

Cada comunidad deberá poder registrar coordenadas y mostrar información relacionada con población, viviendas, proyectos, necesidades, beneficiarios y donantes vinculados.

Se evaluará MapLibre GL JS como alternativa principal para construir esta experiencia.

### 4. Visualización de impacto con React Flow

Se decidió que React Flow puede utilizarse para representar visualmente relaciones que serían difíciles de comprender mediante tablas tradicionales.

Ejemplo:

```text
Necesidad → Proyecto → Recursos → Actividades → Beneficiarios → Evidencias → Impacto
```

Esta visualización podrá formar parte del Dashboard y de vistas específicas del proyecto.

### 5. Usuarios externos

Se definieron dos perfiles externos importantes:

- **Líder comunitario:** podrá reportar avances y evidencias de proyectos o comunidades asignadas.
- **Donante:** podrá consultar el avance e impacto de las iniciativas que financia, únicamente con información autorizada.

Estos usuarios no tendrán acceso al panel administrativo completo.

### 6. Flujo de aprobación de evidencias

Las evidencias enviadas por líderes comunitarios no se publicarán automáticamente.

Se definió el flujo:

```text
Borrador → Enviada → Pendiente de revisión → Aprobada / Rechazada
```

Una evidencia aprobada internamente podrá requerir una autorización adicional para ser visible a donantes u otros usuarios externos.

### 7. Multi-organización

Se mantiene la decisión de evolucionar Semilla hacia una arquitectura multi-organización. Ministerio Sal y Luz será la primera organización de referencia, pero el modelo deberá permitir que otras organizaciones utilicen la misma plataforma manteniendo sus datos aislados.

## Convención de trabajo acordada

Para mantener el proyecto ordenado se continuará trabajando con el siguiente flujo:

1. Definir una historia de usuario o tarea concreta.
2. Crear un issue en GitHub con alcance y criterios de aceptación.
3. Implementar el cambio en `develop`.
4. Mantener separados componentes, estilos, servicios, tipos y lógica de negocio.
5. Crear commits pequeños y con mensajes en español.
6. Registrar los cambios relevantes en la bitácora.
7. Validar frontend y backend según corresponda.
8. Cerrar el issue únicamente cuando el cambio esté terminado y respaldado por los commits correspondientes.
9. Integrar bloques estables a `main` mediante Pull Request.

## Conceptos que ayudan a defender el proyecto

Se deja registrado para futuras presentaciones el siguiente concepto:

> Semilla permitirá seguir un recurso desde su origen, identificar quién lo donó, dónde fue asignado, qué proyecto o actividad lo ejecutó, qué familias o comunidades fueron beneficiadas y qué evidencia demuestra el resultado obtenido.

Este concepto representa uno de los pilares de la propuesta de valor de Semilla porque conecta gestión, transparencia, rendición de cuentas e impacto comunitario.

## Próximos pasos

- Consolidar el modelo de datos de Comunidades y preparar su persistencia real.
- Incorporar coordenadas y estructura territorial.
- Diseñar el modelo relacional de Donantes, Donaciones y Asignaciones.
- Relacionar proyectos, actividades y familias beneficiarias con las asignaciones.
- Diseñar el flujo de seguimiento y aprobación de evidencias.
- Crear el acceso simplificado para líderes comunitarios.
- Crear posteriormente la experiencia de consulta para donantes.
- Incorporar visualizaciones con mapa y React Flow cuando los datos reales estén disponibles.
