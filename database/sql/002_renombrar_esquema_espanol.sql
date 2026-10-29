-- ============================================================
-- Semilla - Gestión Comunitaria
-- Migración no destructiva: nombres de tablas y campos al español
-- ============================================================

BEGIN;

-- 1. Seguridad y auditoría
ALTER TABLE permissions RENAME TO permisos;
ALTER TABLE users RENAME TO usuarios;
ALTER TABLE user_roles RENAME TO usuarios_roles;
ALTER TABLE role_permissions RENAME TO roles_permisos;
ALTER TABLE refresh_tokens RENAME TO tokens_refresco;
ALTER TABLE audit_logs RENAME TO bitacora_auditoria;

ALTER TABLE roles RENAME COLUMN name TO nombre;
ALTER TABLE roles RENAME COLUMN description TO descripcion;
ALTER TABLE roles RENAME COLUMN is_active TO activo;
ALTER TABLE roles RENAME COLUMN created_at TO creado_en;
ALTER TABLE roles RENAME COLUMN updated_at TO actualizado_en;

ALTER TABLE permisos RENAME COLUMN code TO codigo;
ALTER TABLE permisos RENAME COLUMN module TO modulo;
ALTER TABLE permisos RENAME COLUMN description TO descripcion;
ALTER TABLE permisos RENAME COLUMN created_at TO creado_en;

ALTER TABLE usuarios RENAME COLUMN password_hash TO hash_contrasena;
ALTER TABLE usuarios RENAME COLUMN first_name TO nombres;
ALTER TABLE usuarios RENAME COLUMN last_name TO apellidos;
ALTER TABLE usuarios RENAME COLUMN phone TO telefono;
ALTER TABLE usuarios RENAME COLUMN is_active TO activo;
ALTER TABLE usuarios RENAME COLUMN must_change_password TO debe_cambiar_contrasena;
ALTER TABLE usuarios RENAME COLUMN last_login_at TO ultimo_acceso_en;
ALTER TABLE usuarios RENAME COLUMN created_at TO creado_en;
ALTER TABLE usuarios RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE usuarios RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE usuarios_roles RENAME COLUMN user_id TO usuario_id;
ALTER TABLE usuarios_roles RENAME COLUMN role_id TO rol_id;
ALTER TABLE usuarios_roles RENAME COLUMN assigned_at TO asignado_en;

ALTER TABLE roles_permisos RENAME COLUMN role_id TO rol_id;
ALTER TABLE roles_permisos RENAME COLUMN permission_id TO permiso_id;
ALTER TABLE roles_permisos RENAME COLUMN granted_at TO otorgado_en;

ALTER TABLE tokens_refresco RENAME COLUMN user_id TO usuario_id;
ALTER TABLE tokens_refresco RENAME COLUMN token_hash TO hash_token;
ALTER TABLE tokens_refresco RENAME COLUMN expires_at TO expira_en;
ALTER TABLE tokens_refresco RENAME COLUMN revoked_at TO revocado_en;
ALTER TABLE tokens_refresco RENAME COLUMN ip_address TO direccion_ip;
ALTER TABLE tokens_refresco RENAME COLUMN user_agent TO agente_usuario;
ALTER TABLE tokens_refresco RENAME COLUMN created_at TO creado_en;

ALTER TABLE bitacora_auditoria RENAME COLUMN user_id TO usuario_id;
ALTER TABLE bitacora_auditoria RENAME COLUMN action TO accion;
ALTER TABLE bitacora_auditoria RENAME COLUMN entity_name TO nombre_entidad;
ALTER TABLE bitacora_auditoria RENAME COLUMN entity_id TO entidad_id;
ALTER TABLE bitacora_auditoria RENAME COLUMN old_values TO valores_anteriores;
ALTER TABLE bitacora_auditoria RENAME COLUMN new_values TO valores_nuevos;
ALTER TABLE bitacora_auditoria RENAME COLUMN ip_address TO direccion_ip;
ALTER TABLE bitacora_auditoria RENAME COLUMN user_agent TO agente_usuario;
ALTER TABLE bitacora_auditoria RENAME COLUMN created_at TO creado_en;

-- 2. Territorio, familias y necesidades
ALTER TABLE zones RENAME TO zonas;
ALTER TABLE communities RENAME TO comunidades;
ALTER TABLE families RENAME TO familias;
ALTER TABLE persons RENAME TO personas;
ALTER TABLE family_members RENAME TO miembros_familia;
ALTER TABLE need_types RENAME TO tipos_necesidad;
ALTER TABLE family_needs RENAME TO necesidades_familia;

ALTER TABLE zonas RENAME COLUMN name TO nombre;
ALTER TABLE zonas RENAME COLUMN description TO descripcion;
ALTER TABLE zonas RENAME COLUMN is_active TO activo;
ALTER TABLE zonas RENAME COLUMN created_at TO creado_en;
ALTER TABLE zonas RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE zonas RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE comunidades RENAME COLUMN zone_id TO zona_id;
ALTER TABLE comunidades RENAME COLUMN name TO nombre;
ALTER TABLE comunidades RENAME COLUMN municipality TO municipio;
ALTER TABLE comunidades RENAME COLUMN department TO departamento;
ALTER TABLE comunidades RENAME COLUMN notes TO notas;
ALTER TABLE comunidades RENAME COLUMN is_active TO activo;
ALTER TABLE comunidades RENAME COLUMN created_at TO creado_en;
ALTER TABLE comunidades RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE comunidades RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE familias RENAME COLUMN community_id TO comunidad_id;
ALTER TABLE familias RENAME COLUMN code TO codigo;
ALTER TABLE familias RENAME COLUMN household_name TO nombre_hogar;
ALTER TABLE familias RENAME COLUMN address_reference TO referencia_direccion;
ALTER TABLE familias RENAME COLUMN housing_condition TO condicion_vivienda;
ALTER TABLE familias RENAME COLUMN monthly_income TO ingreso_mensual;
ALTER TABLE familias RENAME COLUMN observations TO observaciones;
ALTER TABLE familias RENAME COLUMN is_active TO activo;
ALTER TABLE familias RENAME COLUMN created_at TO creado_en;
ALTER TABLE familias RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE familias RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE personas RENAME COLUMN identity_number TO numero_identidad;
ALTER TABLE personas RENAME COLUMN first_name TO nombres;
ALTER TABLE personas RENAME COLUMN last_name TO apellidos;
ALTER TABLE personas RENAME COLUMN birth_date TO fecha_nacimiento;
ALTER TABLE personas RENAME COLUMN sex TO sexo;
ALTER TABLE personas RENAME COLUMN phone TO telefono;
ALTER TABLE personas RENAME COLUMN occupation TO ocupacion;
ALTER TABLE personas RENAME COLUMN education_level TO nivel_educativo;
ALTER TABLE personas RENAME COLUMN notes TO notas;
ALTER TABLE personas RENAME COLUMN created_at TO creado_en;
ALTER TABLE personas RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE personas RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE miembros_familia RENAME COLUMN family_id TO familia_id;
ALTER TABLE miembros_familia RENAME COLUMN person_id TO persona_id;
ALTER TABLE miembros_familia RENAME COLUMN relationship TO parentesco;
ALTER TABLE miembros_familia RENAME COLUMN is_household_head TO es_jefe_hogar;
ALTER TABLE miembros_familia RENAME COLUMN joined_at TO fecha_ingreso;
ALTER TABLE miembros_familia RENAME COLUMN left_at TO fecha_salida;
ALTER TABLE miembros_familia RENAME COLUMN created_at TO creado_en;
ALTER TABLE miembros_familia RENAME COLUMN updated_at TO actualizado_en;

ALTER TABLE tipos_necesidad RENAME COLUMN name TO nombre;
ALTER TABLE tipos_necesidad RENAME COLUMN description TO descripcion;
ALTER TABLE tipos_necesidad RENAME COLUMN is_active TO activo;
ALTER TABLE tipos_necesidad RENAME COLUMN created_at TO creado_en;

ALTER TABLE necesidades_familia RENAME COLUMN family_id TO familia_id;
ALTER TABLE necesidades_familia RENAME COLUMN need_type_id TO tipo_necesidad_id;
ALTER TABLE necesidades_familia RENAME COLUMN description TO descripcion;
ALTER TABLE necesidades_familia RENAME COLUMN priority TO prioridad;
ALTER TABLE necesidades_familia RENAME COLUMN status TO estado;
ALTER TABLE necesidades_familia RENAME COLUMN identified_at TO identificado_en;
ALTER TABLE necesidades_familia RENAME COLUMN resolved_at TO resuelto_en;
ALTER TABLE necesidades_familia RENAME COLUMN notes TO notas;
ALTER TABLE necesidades_familia RENAME COLUMN created_at TO creado_en;
ALTER TABLE necesidades_familia RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE necesidades_familia RENAME COLUMN deleted_at TO eliminado_en;

-- 3. Programas, POA, proyectos y actividades
ALTER TABLE programs RENAME TO programas;
ALTER TABLE strategic_objectives RENAME TO objetivos_estrategicos;
ALTER TABLE strategic_goals RENAME TO metas_estrategicas;
ALTER TABLE projects RENAME TO proyectos;
ALTER TABLE project_communities RENAME TO proyectos_comunidades;
ALTER TABLE activities RENAME TO actividades;
ALTER TABLE activity_beneficiaries RENAME TO beneficiarios_actividad;

ALTER TABLE programas RENAME COLUMN name TO nombre;
ALTER TABLE programas RENAME COLUMN description TO descripcion;
ALTER TABLE programas RENAME COLUMN start_date TO fecha_inicio;
ALTER TABLE programas RENAME COLUMN end_date TO fecha_fin;
ALTER TABLE programas RENAME COLUMN is_active TO activo;
ALTER TABLE programas RENAME COLUMN created_at TO creado_en;
ALTER TABLE programas RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE programas RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE objetivos_estrategicos RENAME COLUMN program_id TO programa_id;
ALTER TABLE objetivos_estrategicos RENAME COLUMN code TO codigo;
ALTER TABLE objetivos_estrategicos RENAME COLUMN name TO nombre;
ALTER TABLE objetivos_estrategicos RENAME COLUMN description TO descripcion;
ALTER TABLE objetivos_estrategicos RENAME COLUMN fiscal_year TO anio_fiscal;
ALTER TABLE objetivos_estrategicos RENAME COLUMN is_active TO activo;
ALTER TABLE objetivos_estrategicos RENAME COLUMN created_at TO creado_en;
ALTER TABLE objetivos_estrategicos RENAME COLUMN updated_at TO actualizado_en;

ALTER TABLE metas_estrategicas RENAME COLUMN objective_id TO objetivo_id;
ALTER TABLE metas_estrategicas RENAME COLUMN description TO descripcion;
ALTER TABLE metas_estrategicas RENAME COLUMN target_value TO valor_meta;
ALTER TABLE metas_estrategicas RENAME COLUMN target_unit TO unidad_meta;
ALTER TABLE metas_estrategicas RENAME COLUMN due_date TO fecha_limite;
ALTER TABLE metas_estrategicas RENAME COLUMN created_at TO creado_en;
ALTER TABLE metas_estrategicas RENAME COLUMN updated_at TO actualizado_en;

ALTER TABLE proyectos RENAME COLUMN program_id TO programa_id;
ALTER TABLE proyectos RENAME COLUMN strategic_goal_id TO meta_estrategica_id;
ALTER TABLE proyectos RENAME COLUMN code TO codigo;
ALTER TABLE proyectos RENAME COLUMN name TO nombre;
ALTER TABLE proyectos RENAME COLUMN description TO descripcion;
ALTER TABLE proyectos RENAME COLUMN project_type TO tipo_proyecto;
ALTER TABLE proyectos RENAME COLUMN status TO estado;
ALTER TABLE proyectos RENAME COLUMN start_date TO fecha_inicio;
ALTER TABLE proyectos RENAME COLUMN end_date TO fecha_fin;
ALTER TABLE proyectos RENAME COLUMN planned_cost TO costo_planificado;
ALTER TABLE proyectos RENAME COLUMN currency TO moneda;
ALTER TABLE proyectos RENAME COLUMN responsible_user_id TO usuario_responsable_id;
ALTER TABLE proyectos RENAME COLUMN created_at TO creado_en;
ALTER TABLE proyectos RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE proyectos RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE proyectos_comunidades RENAME COLUMN project_id TO proyecto_id;
ALTER TABLE proyectos_comunidades RENAME COLUMN community_id TO comunidad_id;
ALTER TABLE proyectos_comunidades RENAME COLUMN notes TO notas;
ALTER TABLE proyectos_comunidades RENAME COLUMN created_at TO creado_en;

ALTER TABLE actividades RENAME COLUMN project_id TO proyecto_id;
ALTER TABLE actividades RENAME COLUMN strategic_goal_id TO meta_estrategica_id;
ALTER TABLE actividades RENAME COLUMN name TO nombre;
ALTER TABLE actividades RENAME COLUMN description TO descripcion;
ALTER TABLE actividades RENAME COLUMN status TO estado;
ALTER TABLE actividades RENAME COLUMN planned_start_date TO fecha_inicio_planificada;
ALTER TABLE actividades RENAME COLUMN planned_end_date TO fecha_fin_planificada;
ALTER TABLE actividades RENAME COLUMN actual_start_date TO fecha_inicio_real;
ALTER TABLE actividades RENAME COLUMN actual_end_date TO fecha_fin_real;
ALTER TABLE actividades RENAME COLUMN planned_cost TO costo_planificado;
ALTER TABLE actividades RENAME COLUMN actual_cost TO costo_real;
ALTER TABLE actividades RENAME COLUMN responsible_user_id TO usuario_responsable_id;
ALTER TABLE actividades RENAME COLUMN created_at TO creado_en;
ALTER TABLE actividades RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE actividades RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE beneficiarios_actividad RENAME COLUMN activity_id TO actividad_id;
ALTER TABLE beneficiarios_actividad RENAME COLUMN family_id TO familia_id;
ALTER TABLE beneficiarios_actividad RENAME COLUMN person_id TO persona_id;
ALTER TABLE beneficiarios_actividad RENAME COLUMN beneficiary_type TO tipo_beneficiario;
ALTER TABLE beneficiarios_actividad RENAME COLUMN notes TO notas;
ALTER TABLE beneficiarios_actividad RENAME COLUMN created_at TO creado_en;

-- 4. Donaciones y recursos
ALTER TABLE donors RENAME TO donantes;
ALTER TABLE donations RENAME TO donaciones;
ALTER TABLE resource_categories RENAME TO categorias_recursos;
ALTER TABLE resources RENAME TO recursos;
ALTER TABLE donation_items RENAME TO detalles_donacion;

ALTER TABLE donantes RENAME COLUMN donor_type TO tipo_donante;
ALTER TABLE donantes RENAME COLUMN name TO nombre;
ALTER TABLE donantes RENAME COLUMN contact_name TO nombre_contacto;
ALTER TABLE donantes RENAME COLUMN phone TO telefono;
ALTER TABLE donantes RENAME COLUMN country TO pais;
ALTER TABLE donantes RENAME COLUMN notes TO notas;
ALTER TABLE donantes RENAME COLUMN is_active TO activo;
ALTER TABLE donantes RENAME COLUMN created_at TO creado_en;
ALTER TABLE donantes RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE donantes RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE donaciones RENAME COLUMN donor_id TO donante_id;
ALTER TABLE donaciones RENAME COLUMN project_id TO proyecto_id;
ALTER TABLE donaciones RENAME COLUMN donation_type TO tipo_donacion;
ALTER TABLE donaciones RENAME COLUMN donation_date TO fecha_donacion;
ALTER TABLE donaciones RENAME COLUMN cash_amount TO monto_efectivo;
ALTER TABLE donaciones RENAME COLUMN currency TO moneda;
ALTER TABLE donaciones RENAME COLUMN reference TO referencia;
ALTER TABLE donaciones RENAME COLUMN notes TO notas;
ALTER TABLE donaciones RENAME COLUMN created_at TO creado_en;
ALTER TABLE donaciones RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE donaciones RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE categorias_recursos RENAME COLUMN name TO nombre;
ALTER TABLE categorias_recursos RENAME COLUMN description TO descripcion;
ALTER TABLE categorias_recursos RENAME COLUMN is_active TO activo;
ALTER TABLE categorias_recursos RENAME COLUMN created_at TO creado_en;

ALTER TABLE recursos RENAME COLUMN category_id TO categoria_id;
ALTER TABLE recursos RENAME COLUMN code TO codigo;
ALTER TABLE recursos RENAME COLUMN name TO nombre;
ALTER TABLE recursos RENAME COLUMN description TO descripcion;
ALTER TABLE recursos RENAME COLUMN unit_of_measure TO unidad_medida;
ALTER TABLE recursos RENAME COLUMN track_stock TO controla_existencia;
ALTER TABLE recursos RENAME COLUMN minimum_stock TO existencia_minima;
ALTER TABLE recursos RENAME COLUMN is_active TO activo;
ALTER TABLE recursos RENAME COLUMN created_at TO creado_en;
ALTER TABLE recursos RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE recursos RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE detalles_donacion RENAME COLUMN donation_id TO donacion_id;
ALTER TABLE detalles_donacion RENAME COLUMN resource_id TO recurso_id;
ALTER TABLE detalles_donacion RENAME COLUMN quantity TO cantidad;
ALTER TABLE detalles_donacion RENAME COLUMN unit_value TO valor_unitario;
ALTER TABLE detalles_donacion RENAME COLUMN notes TO notas;
ALTER TABLE detalles_donacion RENAME COLUMN created_at TO creado_en;

-- 5. Compras, presupuesto y finanzas
ALTER TABLE suppliers RENAME TO proveedores;
ALTER TABLE purchases RENAME TO compras;
ALTER TABLE purchase_items RENAME TO detalles_compra;
ALTER TABLE budgets RENAME TO presupuestos;
ALTER TABLE budget_items RENAME TO partidas_presupuesto;
ALTER TABLE expenses RENAME TO gastos;
ALTER TABLE payments RENAME TO pagos;
ALTER TABLE resource_movements RENAME TO movimientos_recursos;

ALTER TABLE proveedores RENAME COLUMN name TO nombre;
ALTER TABLE proveedores RENAME COLUMN tax_id TO identificacion_fiscal;
ALTER TABLE proveedores RENAME COLUMN contact_name TO nombre_contacto;
ALTER TABLE proveedores RENAME COLUMN phone TO telefono;
ALTER TABLE proveedores RENAME COLUMN address TO direccion;
ALTER TABLE proveedores RENAME COLUMN is_active TO activo;
ALTER TABLE proveedores RENAME COLUMN created_at TO creado_en;
ALTER TABLE proveedores RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE proveedores RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE compras RENAME COLUMN supplier_id TO proveedor_id;
ALTER TABLE compras RENAME COLUMN project_id TO proyecto_id;
ALTER TABLE compras RENAME COLUMN purchase_date TO fecha_compra;
ALTER TABLE compras RENAME COLUMN document_number TO numero_documento;
ALTER TABLE compras RENAME COLUMN status TO estado;
ALTER TABLE compras RENAME COLUMN currency TO moneda;
ALTER TABLE compras RENAME COLUMN tax_amount TO monto_impuesto;
ALTER TABLE compras RENAME COLUMN total_amount TO monto_total;
ALTER TABLE compras RENAME COLUMN notes TO notas;
ALTER TABLE compras RENAME COLUMN created_by TO creado_por;
ALTER TABLE compras RENAME COLUMN created_at TO creado_en;
ALTER TABLE compras RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE compras RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE detalles_compra RENAME COLUMN purchase_id TO compra_id;
ALTER TABLE detalles_compra RENAME COLUMN resource_id TO recurso_id;
ALTER TABLE detalles_compra RENAME COLUMN quantity TO cantidad;
ALTER TABLE detalles_compra RENAME COLUMN unit_cost TO costo_unitario;
ALTER TABLE detalles_compra RENAME COLUMN tax_amount TO monto_impuesto;
ALTER TABLE detalles_compra RENAME COLUMN line_total TO total_linea;
ALTER TABLE detalles_compra RENAME COLUMN created_at TO creado_en;

ALTER TABLE presupuestos RENAME COLUMN project_id TO proyecto_id;
ALTER TABLE presupuestos RENAME COLUMN fiscal_year TO anio_fiscal;
ALTER TABLE presupuestos RENAME COLUMN version_number TO numero_version;
ALTER TABLE presupuestos RENAME COLUMN status TO estado;
ALTER TABLE presupuestos RENAME COLUMN currency TO moneda;
ALTER TABLE presupuestos RENAME COLUMN total_amount TO monto_total;
ALTER TABLE presupuestos RENAME COLUMN approved_by TO aprobado_por;
ALTER TABLE presupuestos RENAME COLUMN approved_at TO aprobado_en;
ALTER TABLE presupuestos RENAME COLUMN created_at TO creado_en;
ALTER TABLE presupuestos RENAME COLUMN updated_at TO actualizado_en;

ALTER TABLE partidas_presupuesto RENAME COLUMN budget_id TO presupuesto_id;
ALTER TABLE partidas_presupuesto RENAME COLUMN activity_id TO actividad_id;
ALTER TABLE partidas_presupuesto RENAME COLUMN category TO categoria;
ALTER TABLE partidas_presupuesto RENAME COLUMN description TO descripcion;
ALTER TABLE partidas_presupuesto RENAME COLUMN planned_amount TO monto_planificado;
ALTER TABLE partidas_presupuesto RENAME COLUMN created_at TO creado_en;

ALTER TABLE gastos RENAME COLUMN project_id TO proyecto_id;
ALTER TABLE gastos RENAME COLUMN budget_item_id TO partida_presupuesto_id;
ALTER TABLE gastos RENAME COLUMN purchase_id TO compra_id;
ALTER TABLE gastos RENAME COLUMN supplier_id TO proveedor_id;
ALTER TABLE gastos RENAME COLUMN expense_date TO fecha_gasto;
ALTER TABLE gastos RENAME COLUMN category TO categoria;
ALTER TABLE gastos RENAME COLUMN description TO descripcion;
ALTER TABLE gastos RENAME COLUMN amount TO monto;
ALTER TABLE gastos RENAME COLUMN currency TO moneda;
ALTER TABLE gastos RENAME COLUMN status TO estado;
ALTER TABLE gastos RENAME COLUMN created_by TO creado_por;
ALTER TABLE gastos RENAME COLUMN approved_by TO aprobado_por;
ALTER TABLE gastos RENAME COLUMN approved_at TO aprobado_en;
ALTER TABLE gastos RENAME COLUMN created_at TO creado_en;
ALTER TABLE gastos RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE gastos RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE pagos RENAME COLUMN expense_id TO gasto_id;
ALTER TABLE pagos RENAME COLUMN payment_date TO fecha_pago;
ALTER TABLE pagos RENAME COLUMN amount TO monto;
ALTER TABLE pagos RENAME COLUMN currency TO moneda;
ALTER TABLE pagos RENAME COLUMN payment_method TO metodo_pago;
ALTER TABLE pagos RENAME COLUMN reference TO referencia;
ALTER TABLE pagos RENAME COLUMN notes TO notas;
ALTER TABLE pagos RENAME COLUMN created_by TO creado_por;
ALTER TABLE pagos RENAME COLUMN created_at TO creado_en;

ALTER TABLE movimientos_recursos RENAME COLUMN resource_id TO recurso_id;
ALTER TABLE movimientos_recursos RENAME COLUMN project_id TO proyecto_id;
ALTER TABLE movimientos_recursos RENAME COLUMN donation_item_id TO detalle_donacion_id;
ALTER TABLE movimientos_recursos RENAME COLUMN purchase_item_id TO detalle_compra_id;
ALTER TABLE movimientos_recursos RENAME COLUMN movement_type TO tipo_movimiento;
ALTER TABLE movimientos_recursos RENAME COLUMN quantity TO cantidad;
ALTER TABLE movimientos_recursos RENAME COLUMN movement_date TO fecha_movimiento;
ALTER TABLE movimientos_recursos RENAME COLUMN notes TO notas;
ALTER TABLE movimientos_recursos RENAME COLUMN created_by TO creado_por;
ALTER TABLE movimientos_recursos RENAME COLUMN created_at TO creado_en;

-- 6. Evidencias y sincronización
ALTER TABLE evidences RENAME TO evidencias;
ALTER TABLE sync_devices RENAME TO dispositivos_sincronizacion;
ALTER TABLE idempotency_keys RENAME TO claves_idempotencia;

ALTER TABLE evidencias RENAME COLUMN project_id TO proyecto_id;
ALTER TABLE evidencias RENAME COLUMN activity_id TO actividad_id;
ALTER TABLE evidencias RENAME COLUMN family_id TO familia_id;
ALTER TABLE evidencias RENAME COLUMN person_id TO persona_id;
ALTER TABLE evidencias RENAME COLUMN evidence_type TO tipo_evidencia;
ALTER TABLE evidencias RENAME COLUMN title TO titulo;
ALTER TABLE evidencias RENAME COLUMN description TO descripcion;
ALTER TABLE evidencias RENAME COLUMN file_url TO url_archivo;
ALTER TABLE evidencias RENAME COLUMN mime_type TO tipo_mime;
ALTER TABLE evidencias RENAME COLUMN captured_at TO capturado_en;
ALTER TABLE evidencias RENAME COLUMN uploaded_by TO subido_por;
ALTER TABLE evidencias RENAME COLUMN created_at TO creado_en;
ALTER TABLE evidencias RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE evidencias RENAME COLUMN deleted_at TO eliminado_en;

ALTER TABLE dispositivos_sincronizacion RENAME COLUMN user_id TO usuario_id;
ALTER TABLE dispositivos_sincronizacion RENAME COLUMN device_uuid TO uuid_dispositivo;
ALTER TABLE dispositivos_sincronizacion RENAME COLUMN device_name TO nombre_dispositivo;
ALTER TABLE dispositivos_sincronizacion RENAME COLUMN platform TO plataforma;
ALTER TABLE dispositivos_sincronizacion RENAME COLUMN last_sync_at TO ultima_sincronizacion_en;
ALTER TABLE dispositivos_sincronizacion RENAME COLUMN is_active TO activo;
ALTER TABLE dispositivos_sincronizacion RENAME COLUMN created_at TO creado_en;
ALTER TABLE dispositivos_sincronizacion RENAME COLUMN updated_at TO actualizado_en;

ALTER TABLE claves_idempotencia RENAME COLUMN user_id TO usuario_id;
ALTER TABLE claves_idempotencia RENAME COLUMN device_id TO dispositivo_id;
ALTER TABLE claves_idempotencia RENAME COLUMN idempotency_key TO clave_idempotencia;
ALTER TABLE claves_idempotencia RENAME COLUMN request_method TO metodo_solicitud;
ALTER TABLE claves_idempotencia RENAME COLUMN request_path TO ruta_solicitud;
ALTER TABLE claves_idempotencia RENAME COLUMN request_hash TO hash_solicitud;
ALTER TABLE claves_idempotencia RENAME COLUMN response_status TO estado_respuesta;
ALTER TABLE claves_idempotencia RENAME COLUMN response_body TO cuerpo_respuesta;
ALTER TABLE claves_idempotencia RENAME COLUMN expires_at TO expira_en;
ALTER TABLE claves_idempotencia RENAME COLUMN created_at TO creado_en;

COMMIT;
