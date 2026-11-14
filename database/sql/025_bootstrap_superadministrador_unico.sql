-- Semilla: estado durable para el asistente gráfico del primer SUPERADMINISTRADOR.
-- Esta migración no crea usuarios. Solo habilita el flujo de bootstrap de un único uso.
BEGIN;

CREATE TABLE IF NOT EXISTS bootstrap_superadministrador (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    consumido_en TIMESTAMPTZ,
    usuario_id UUID UNIQUE REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
    intentos_fallidos SMALLINT NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
    ventana_intentos_inicia_en TIMESTAMPTZ,
    bloqueado_hasta TIMESTAMPTZ,
    ultimo_intento_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una sola fila bloqueable permite impedir carreras entre instancias del backend
-- y conserva el límite de intentos aunque el servicio se reinicie.
INSERT INTO bootstrap_superadministrador (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMIT;
