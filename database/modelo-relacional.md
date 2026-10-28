# Modelo relacional inicial de Semilla

## Objetivo

Definir el modelo de datos objetivo para PostgreSQL de **Semilla - Gestión Comunitaria**, asegurando relaciones coherentes, normalización hasta 3FN donde corresponda, trazabilidad de recursos y preparación para trabajo offline.

El modelo se organiza por dominios funcionales. La cantidad de tablas no responde únicamente al requisito académico de superar 20 tablas: cada tabla representa una responsabilidad distinta que evita duplicidad de datos y facilita el crecimiento del sistema.

## Convenciones

- PostgreSQL como motor de base de datos.
- Nombres en `snake_case` y minúsculas.
- Claves primarias UUID mediante `gen_random_uuid()`.
- Fechas con `timestamptz`.
- Entidades sincronizables con `created_at`, `updated_at`, `version` y `deleted_at` cuando aplica.
- Restricciones `CHECK`, `UNIQUE` y claves foráneas para preservar integridad.
- Eliminación lógica en entidades maestras importantes.
- PostgreSQL será la fuente central de verdad; IndexedDB servirá como almacenamiento local para el modo offline.

## Resumen de tablas

### 1. Seguridad y auditoría

1. `roles`
2. `permissions`
3. `users`
4. `user_roles`
5. `role_permissions`
6. `refresh_tokens`
7. `audit_logs`

### 2. Territorio, familias y necesidades

8. `zones`
9. `communities`
10. `families`
11. `persons`
12. `family_members`
13. `need_types`
14. `family_needs`

### 3. Programas, POA, proyectos y actividades

15. `programs`
16. `strategic_objectives`
17. `strategic_goals`
18. `projects`
19. `project_communities`
20. `activities`
21. `activity_beneficiaries`

### 4. Donaciones y recursos

22. `donors`
23. `donations`
24. `resource_categories`
25. `resources`
26. `donation_items`
27. `resource_movements`

### 5. Compras, presupuesto y finanzas

28. `suppliers`
29. `purchases`
30. `purchase_items`
31. `budgets`
32. `budget_items`
33. `expenses`
34. `payments`

### 6. Evidencias y sincronización

35. `evidences`
36. `sync_devices`
37. `idempotency_keys`

## Relaciones principales

```text
zone
  └── community
        └── family
              ├── family_member ── person
              └── family_need ── need_type

program
  └── strategic_objective
        └── strategic_goal
              └── project
                    ├── project_community ── community
                    ├── activity
                    │     └── activity_beneficiary ── family/person
                    ├── budget
                    │     └── budget_item
                    ├── expense
                    │     └── payment
                    └── resource_movement

donor
  └── donation
        └── donation_item ── resource

supplier
  └── purchase
        └── purchase_item ── resource
```

## Decisiones de normalización

### Personas y familias

La información de una persona no se replica dentro de `families`. La tabla `family_members` resuelve la relación entre una familia y sus integrantes y permite registrar parentesco, responsable del hogar y vigencia de la relación.

### Necesidades

Los tipos de necesidad se almacenan en `need_types`; `family_needs` registra la necesidad concreta, prioridad, estado y observaciones. Esto evita repetir descripciones como vivienda, alimentación, educación o salud en cada familia.

### POA y proyectos

Los objetivos estratégicos y sus metas se separan de proyectos y actividades. Esto permite comparar posteriormente lo planificado contra lo ejecutado y conservar el vínculo entre POA, proyecto y resultados.

### Comunidades y proyectos

Un proyecto puede ejecutarse en varias comunidades y una comunidad puede participar en varios proyectos. Esta relación N:M se resuelve mediante `project_communities`.

### Beneficiarios

Una actividad puede beneficiar familias completas o personas individuales. `activity_beneficiaries` permite ambos casos con una restricción que exige registrar exactamente uno de los dos tipos de beneficiario.

### Donaciones

`donations` representa el acto de donación y `donation_items` su detalle. Esto permite que una sola donación contenga dinero, materiales o diferentes recursos sin duplicar los datos del donante.

### Recursos

`resources` representa bienes o tipos de recurso administrables. `resource_movements` conserva entradas, salidas, asignaciones y ajustes, haciendo posible saber de dónde provino un recurso y a qué proyecto se destinó.

### Compras

`purchases` contiene el encabezado de la compra y `purchase_items` sus líneas. Los productos o materiales no se repiten como texto libre, sino que se relacionan con `resources`.

### Presupuesto, gastos y pagos

El presupuesto se separa de la ejecución. `budgets` y `budget_items` representan lo planificado; `expenses` registra obligaciones o egresos reales; `payments` registra cuándo y cómo fueron pagados. Esto permite reportar presupuesto, comprometido, ejecutado y pagado.

### Evidencias

`evidences` utiliza relaciones opcionales hacia proyecto, actividad, familia o persona. Se utiliza una restricción para exigir al menos un contexto asociado. En PostgreSQL se almacenará únicamente metadata y URL; los archivos se guardarán en almacenamiento externo.

## Consideraciones offline

Las entidades que se crearán o modificarán en campo utilizan UUID para evitar colisiones entre dispositivos. Las tablas principales incluyen un campo `version` para control de concurrencia optimista.

El flujo previsto es:

```text
React PWA
   ↕
IndexedDB / Dexie
   ↕
cola de sincronización
   ↕
API Express
   ↕
PostgreSQL
```

`sync_devices` identifica los dispositivos autorizados y su última sincronización. `idempotency_keys` evita aplicar dos veces la misma operación cuando un dispositivo reintenta una petición después de una pérdida de conectividad.

## Índices prioritarios

Se crearán índices sobre:

- todas las claves foráneas de uso frecuente;
- `communities.zone_id`;
- `families.community_id`;
- `family_members.family_id` y `family_members.person_id`;
- `projects.program_id` y `projects.status`;
- `activities.project_id` y fechas;
- `donations.donor_id` y fecha;
- `resource_movements.resource_id`, `project_id` y fecha;
- `purchases.supplier_id` y fecha;
- `expenses.project_id` y fecha;
- `audit_logs.user_id`, `entity_name`, `entity_id` y fecha.

## Próximos pasos

1. Crear el DDL inicial PostgreSQL.
2. Validar el modelo contra el SQL anterior de 14 tablas cuando esté nuevamente disponible.
3. Ajustar nombres y datos heredados que deban conservarse.
4. Crear `schema.prisma` a partir del modelo aprobado.
5. Crear la primera migración.
6. Configurar PostgreSQL de desarrollo y producción.
7. Conectar Prisma con la API Express.
