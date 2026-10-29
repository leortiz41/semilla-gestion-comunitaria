-- ============================================================================
-- SEMILLA - Recursos que generan desarrollo
-- Esquema inicial PostgreSQL
-- Basado en el modelo original de DrawDB (14 tablas) y normalizado para Semilla.
-- Objetivos:
--   * Conservar los 14 conceptos funcionales originales.
--   * Corregir relaciones inconsistentes y dependencias transitivas.
--   * Normalizar familia/persona, pagos/solicitudes y actividades programadas.
--   * Incorporar seguridad JWT/RBAC, auditoría y soporte offline.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. TERRITORIO Y EQUIPOS MISIONEROS
-- ============================================================================

CREATE TABLE zonas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE equipos_misioneros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zona_id UUID REFERENCES zonas(id) ON UPDATE CASCADE ON DELETE SET NULL,
    nombre VARCHAR(150) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PLANIFICADO'
        CHECK (estado IN ('PLANIFICADO','ACTIVO','FINALIZADO','CANCELADO')),
    presupuesto_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (presupuesto_total >= 0),
    fecha_llegada DATE,
    fecha_salida DATE,
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fecha_salida IS NULL OR fecha_llegada IS NULL OR fecha_salida >= fecha_llegada)
);

CREATE TABLE comunidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zona_id UUID REFERENCES zonas(id) ON UPDATE CASCADE ON DELETE SET NULL,
    nombre VARCHAR(150) NOT NULL,
    barrio_colonia VARCHAR(150),
    localidad VARCHAR(150),
    municipio VARCHAR(120) NOT NULL,
    departamento VARCHAR(120) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (nombre, municipio, departamento)
);

-- ============================================================================
-- 2. PROYECTOS Y ACTIVIDADES
-- ============================================================================

CREATE TABLE proyectos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comunidad_id UUID NOT NULL REFERENCES comunidades(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    equipo_misionero_id UUID REFERENCES equipos_misioneros(id) ON UPDATE CASCADE ON DELETE SET NULL,
    nombre VARCHAR(200) NOT NULL,
    tipo VARCHAR(60) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PLANIFICADO'
        CHECK (estado IN ('PLANIFICADO','EN_EJECUCION','PAUSADO','FINALIZADO','CANCELADO')),
    presupuesto_asignado NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (presupuesto_asignado >= 0),
    gastos_administrativos NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (gastos_administrativos >= 0),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    descripcion TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE actividades_programadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipo_misionero_id UUID NOT NULL REFERENCES equipos_misioneros(id) ON UPDATE CASCADE ON DELETE CASCADE,
    proyecto_id UUID REFERENCES proyectos(id) ON UPDATE CASCADE ON DELETE SET NULL,
    nombre VARCHAR(180) NOT NULL,
    descripcion TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'PLANIFICADA'
        CHECK (estado IN ('PLANIFICADA','EN_PROCESO','COMPLETADA','CANCELADA')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE servicios_basicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id UUID NOT NULL UNIQUE REFERENCES proyectos(id) ON UPDATE CASCADE ON DELETE CASCADE,
    descripcion TEXT,
    estado_terreno VARCHAR(50),
    tiene_electricidad BOOLEAN NOT NULL DEFAULT FALSE,
    tiene_agua BOOLEAN NOT NULL DEFAULT FALSE,
    tiene_pila BOOLEAN NOT NULL DEFAULT FALSE,
    tiene_fosa BOOLEAN NOT NULL DEFAULT FALSE,
    estatus_ambiental BOOLEAN NOT NULL DEFAULT FALSE,
    foto_terreno_url TEXT,
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. FAMILIAS Y PERSONAS
-- ============================================================================

CREATE TABLE familias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comunidad_id UUID NOT NULL REFERENCES comunidades(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    numero_casa VARCHAR(30),
    nombre_referencia VARCHAR(180),
    direccion_referencia TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE perfiles_familia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    familia_id UUID NOT NULL REFERENCES familias(id) ON UPDATE CASCADE ON DELETE CASCADE,
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    numero_integrantes INTEGER NOT NULL CHECK (numero_integrantes > 0),
    nivel_riesgo VARCHAR(20) NOT NULL
        CHECK (nivel_riesgo IN ('BAJO','MEDIO','ALTO','CRITICO')),
    numero_habitaciones INTEGER NOT NULL DEFAULT 0 CHECK (numero_habitaciones >= 0),
    area_util_construccion NUMERIC(10,2) CHECK (area_util_construccion IS NULL OR area_util_construccion >= 0),
    tipo_vivienda VARCHAR(60),
    fecha_perfil DATE NOT NULL DEFAULT CURRENT_DATE,
    foto_familia_url TEXT,
    ingreso_mensual NUMERIC(14,2) CHECK (ingreso_mensual IS NULL OR ingreso_mensual >= 0),
    observaciones TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE','EVALUADO','SELECCIONADO','DESCARTADO','FINALIZADO')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (familia_id, proyecto_id)
);

CREATE TABLE parentescos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(50) NOT NULL UNIQUE,
    observaciones TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identidad VARCHAR(20) UNIQUE,
    primer_nombre VARCHAR(100) NOT NULL,
    segundo_nombre VARCHAR(100),
    primer_apellido VARCHAR(100) NOT NULL,
    segundo_apellido VARCHAR(100),
    ocupacion VARCHAR(120),
    estado_civil VARCHAR(30),
    genero VARCHAR(30),
    telefono VARCHAR(30),
    email VARCHAR(150),
    fecha_nacimiento DATE,
    tipo_persona VARCHAR(30),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE miembros_familia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    familia_id UUID NOT NULL REFERENCES familias(id) ON UPDATE CASCADE ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES personas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    parentesco_id UUID REFERENCES parentescos(id) ON UPDATE CASCADE ON DELETE SET NULL,
    es_jefe_hogar BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_salida DATE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (familia_id, persona_id),
    CHECK (fecha_salida IS NULL OR fecha_salida >= fecha_ingreso)
);

CREATE TABLE contactos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    familia_id UUID NOT NULL REFERENCES familias(id) ON UPDATE CASCADE ON DELETE CASCADE,
    persona_id UUID REFERENCES personas(id) ON UPDATE CASCADE ON DELETE SET NULL,
    nombre_contacto VARCHAR(150) NOT NULL,
    telefono VARCHAR(30),
    email VARCHAR(150),
    es_principal BOOLEAN NOT NULL DEFAULT FALSE,
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. PROVEEDORES, EMPLEADOS Y PERSONAL CONTRATADO
-- ============================================================================

CREATE TABLE proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_comercial VARCHAR(150) NOT NULL,
    rtn VARCHAR(20) UNIQUE,
    propietario VARCHAR(150),
    direccion TEXT,
    telefono VARCHAR(30),
    email VARCHAR(150),
    cuenta_bancaria VARCHAR(50),
    observaciones TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE empleados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL UNIQUE REFERENCES personas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    cargo VARCHAR(100) NOT NULL,
    fecha_ingreso DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO'
        CHECK (estado IN ('ACTIVO','INACTIVO','SUSPENDIDO','RETIRADO')),
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE personal_contratado (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES personas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    cargo VARCHAR(100) NOT NULL,
    valor_contrato NUMERIC(14,2) NOT NULL CHECK (valor_contrato >= 0),
    tipo_contrato VARCHAR(40) NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO'
        CHECK (estado IN ('ACTIVO','FINALIZADO','CANCELADO')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio),
    UNIQUE (persona_id, proyecto_id, cargo)
);

-- ============================================================================
-- 5. AVANCES, SOLICITUDES Y PAGOS
-- ============================================================================

CREATE TABLE avances_proyecto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON UPDATE CASCADE ON DELETE CASCADE,
    personal_contratado_id UUID REFERENCES personal_contratado(id) ON UPDATE CASCADE ON DELETE SET NULL,
    porcentaje_avance NUMERIC(5,2) NOT NULL CHECK (porcentaje_avance >= 0 AND porcentaje_avance <= 100),
    fecha_avance DATE NOT NULL DEFAULT CURRENT_DATE,
    comentarios TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE solicitudes_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    avance_proyecto_id UUID REFERENCES avances_proyecto(id) ON UPDATE CASCADE ON DELETE SET NULL,
    proveedor_id UUID REFERENCES proveedores(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    personal_contratado_id UUID REFERENCES personal_contratado(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    empleado_id UUID REFERENCES empleados(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
    concepto VARCHAR(250) NOT NULL,
    valor_solicitado NUMERIC(14,2) NOT NULL CHECK (valor_solicitado > 0),
    anticipo NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (anticipo >= 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'SOLICITADA'
        CHECK (estado IN ('SOLICITADA','APROBADA','RECHAZADA','PAGADA','CANCELADA')),
    fecha_confirmacion DATE,
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (anticipo <= valor_solicitado),
    CHECK (num_nonnulls(proveedor_id, personal_contratado_id, empleado_id) = 1)
);

CREATE TABLE pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_pago_id UUID NOT NULL REFERENCES solicitudes_pago(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    tipo_pago VARCHAR(30) NOT NULL,
    monto NUMERIC(14,2) NOT NULL CHECK (monto > 0),
    fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
    estado_pago VARCHAR(20) NOT NULL DEFAULT 'REGISTRADO'
        CHECK (estado_pago IN ('REGISTRADO','CONFIRMADO','ANULADO')),
    metodo_pago VARCHAR(30),
    referencia VARCHAR(100),
    foto_comprobante_url TEXT,
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. SEGURIDAD Y CONTROL DE ACCESO (JWT + RBAC)
-- ============================================================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(60) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(100) NOT NULL UNIQUE,
    modulo VARCHAR(80) NOT NULL,
    descripcion TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID UNIQUE REFERENCES empleados(id) ON UPDATE CASCADE ON DELETE SET NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    hash_contrasena TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    debe_cambiar_contrasena BOOLEAN NOT NULL DEFAULT FALSE,
    ultimo_acceso_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios_roles (
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE,
    rol_id UUID NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    asignado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, rol_id)
);

CREATE TABLE roles_permisos (
    rol_id UUID NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES permisos(id) ON UPDATE CASCADE ON DELETE CASCADE,
    otorgado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE tokens_refresco (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE,
    hash_token TEXT NOT NULL UNIQUE,
    expira_en TIMESTAMPTZ NOT NULL,
    revocado_en TIMESTAMPTZ,
    direccion_ip INET,
    agente_usuario TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. EVIDENCIAS, AUDITORÍA Y SOPORTE OFFLINE
-- ============================================================================

CREATE TABLE evidencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON UPDATE CASCADE ON DELETE CASCADE,
    avance_proyecto_id UUID REFERENCES avances_proyecto(id) ON UPDATE CASCADE ON DELETE SET NULL,
    solicitud_pago_id UUID REFERENCES solicitudes_pago(id) ON UPDATE CASCADE ON DELETE SET NULL,
    tipo_evidencia VARCHAR(40) NOT NULL,
    titulo VARCHAR(180),
    descripcion TEXT,
    archivo_url TEXT NOT NULL,
    tipo_mime VARCHAR(120),
    capturado_en TIMESTAMPTZ,
    subido_por_usuario_id UUID REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bitacora_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
    accion VARCHAR(80) NOT NULL,
    nombre_entidad VARCHAR(100) NOT NULL,
    entidad_id UUID,
    valores_anteriores JSONB,
    valores_nuevos JSONB,
    direccion_ip INET,
    agente_usuario TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dispositivos_sincronizacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE,
    uuid_dispositivo UUID NOT NULL UNIQUE,
    nombre_dispositivo VARCHAR(150),
    plataforma VARCHAR(50),
    ultima_sincronizacion_en TIMESTAMPTZ,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE claves_idempotencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
    dispositivo_id UUID REFERENCES dispositivos_sincronizacion(id) ON UPDATE CASCADE ON DELETE SET NULL,
    clave_idempotencia VARCHAR(150) NOT NULL UNIQUE,
    metodo_solicitud VARCHAR(10) NOT NULL,
    ruta_solicitud VARCHAR(250) NOT NULL,
    hash_solicitud VARCHAR(128),
    estado_respuesta INTEGER,
    cuerpo_respuesta JSONB,
    expira_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. ÍNDICES
-- PostgreSQL no crea automáticamente índices para columnas FK.
-- ============================================================================

CREATE INDEX idx_equipos_misioneros_zona_id ON equipos_misioneros(zona_id);
CREATE INDEX idx_comunidades_zona_id ON comunidades(zona_id);
CREATE INDEX idx_proyectos_comunidad_id ON proyectos(comunidad_id);
CREATE INDEX idx_proyectos_equipo_misionero_id ON proyectos(equipo_misionero_id);
CREATE INDEX idx_actividades_equipo_id ON actividades_programadas(equipo_misionero_id);
CREATE INDEX idx_actividades_proyecto_id ON actividades_programadas(proyecto_id);
CREATE INDEX idx_familias_comunidad_id ON familias(comunidad_id);
CREATE INDEX idx_perfiles_familia_familia_id ON perfiles_familia(familia_id);
CREATE INDEX idx_perfiles_familia_proyecto_id ON perfiles_familia(proyecto_id);
CREATE INDEX idx_miembros_familia_familia_id ON miembros_familia(familia_id);
CREATE INDEX idx_miembros_familia_persona_id ON miembros_familia(persona_id);
CREATE INDEX idx_miembros_familia_parentesco_id ON miembros_familia(parentesco_id);
CREATE INDEX idx_contactos_familia_id ON contactos(familia_id);
CREATE INDEX idx_contactos_persona_id ON contactos(persona_id);
CREATE INDEX idx_personal_contratado_persona_id ON personal_contratado(persona_id);
CREATE INDEX idx_personal_contratado_proyecto_id ON personal_contratado(proyecto_id);
CREATE INDEX idx_avances_proyecto_id ON avances_proyecto(proyecto_id);
CREATE INDEX idx_avances_personal_id ON avances_proyecto(personal_contratado_id);
CREATE INDEX idx_solicitudes_pago_proyecto_id ON solicitudes_pago(proyecto_id);
CREATE INDEX idx_solicitudes_pago_avance_id ON solicitudes_pago(avance_proyecto_id);
CREATE INDEX idx_solicitudes_pago_proveedor_id ON solicitudes_pago(proveedor_id);
CREATE INDEX idx_solicitudes_pago_personal_id ON solicitudes_pago(personal_contratado_id);
CREATE INDEX idx_solicitudes_pago_empleado_id ON solicitudes_pago(empleado_id);
CREATE INDEX idx_pagos_solicitud_id ON pagos(solicitud_pago_id);
CREATE INDEX idx_usuarios_empleado_id ON usuarios(empleado_id);
CREATE INDEX idx_tokens_refresco_usuario_id ON tokens_refresco(usuario_id);
CREATE INDEX idx_evidencias_proyecto_id ON evidencias(proyecto_id);
CREATE INDEX idx_evidencias_avance_id ON evidencias(avance_proyecto_id);
CREATE INDEX idx_evidencias_solicitud_id ON evidencias(solicitud_pago_id);
CREATE INDEX idx_bitacora_usuario_id ON bitacora_auditoria(usuario_id);
CREATE INDEX idx_bitacora_entidad ON bitacora_auditoria(nombre_entidad, entidad_id);
CREATE INDEX idx_dispositivos_usuario_id ON dispositivos_sincronizacion(usuario_id);
CREATE INDEX idx_idempotencia_usuario_id ON claves_idempotencia(usuario_id);
CREATE INDEX idx_idempotencia_dispositivo_id ON claves_idempotencia(dispositivo_id);

-- ============================================================================
-- 9. DATOS BASE
-- ============================================================================

INSERT INTO parentescos (nombre) VALUES
    ('Jefe/a de hogar'),
    ('Cónyuge'),
    ('Hijo/a'),
    ('Padre/Madre'),
    ('Hermano/a'),
    ('Otro')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO roles (nombre, descripcion) VALUES
    ('ADMINISTRADOR', 'Administración general de Semilla'),
    ('COORDINADOR', 'Coordinación de proyectos y comunidades'),
    ('FINANZAS', 'Gestión de solicitudes y pagos'),
    ('CAMPO', 'Registro de información y evidencias en comunidades'),
    ('CONSULTA', 'Acceso de solo lectura')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO permisos (codigo, modulo, descripcion) VALUES
    ('usuarios.ver', 'usuarios', 'Consultar usuarios'),
    ('usuarios.gestionar', 'usuarios', 'Crear y modificar usuarios'),
    ('comunidades.ver', 'comunidades', 'Consultar comunidades'),
    ('comunidades.gestionar', 'comunidades', 'Crear y modificar comunidades'),
    ('familias.ver', 'familias', 'Consultar familias y perfiles'),
    ('familias.gestionar', 'familias', 'Crear y modificar familias y perfiles'),
    ('proyectos.ver', 'proyectos', 'Consultar proyectos'),
    ('proyectos.gestionar', 'proyectos', 'Crear y modificar proyectos'),
    ('pagos.ver', 'pagos', 'Consultar solicitudes y pagos'),
    ('pagos.gestionar', 'pagos', 'Crear, aprobar y registrar pagos'),
    ('evidencias.gestionar', 'evidencias', 'Registrar evidencias de campo'),
    ('auditoria.ver', 'auditoria', 'Consultar bitácora de auditoría')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================================
-- FIN DEL ESQUEMA
-- Total: 28 tablas.
-- Núcleo: 14 conceptos del modelo original DrawDB, corregidos y normalizados.
-- Extensiones: territorio normalizado, familia/persona, actividades, seguridad,
-- auditoría y sincronización offline.
-- ============================================================================
