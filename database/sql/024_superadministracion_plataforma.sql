-- Semilla: administrador de plataforma, separado de los administradores tenant.
-- Ejecutar en una rama Neon de prueba y verificar antes de aplicar a producción.
BEGIN;

INSERT INTO roles (nombre, descripcion, activo)
VALUES ('SUPERADMINISTRADOR', 'Administración global de organizaciones y accesos iniciales de Semilla', TRUE)
ON CONFLICT (nombre) DO UPDATE
SET descripcion = EXCLUDED.descripcion, activo = TRUE;

INSERT INTO permisos (codigo, modulo, descripcion)
VALUES
  ('plataforma.organizaciones.gestionar', 'plataforma', 'Registrar y consultar organizaciones de la plataforma'),
  ('plataforma.usuarios.gestionar', 'plataforma', 'Gestionar las cuentas administradoras iniciales de organizaciones')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre='SUPERADMINISTRADOR'
  AND p.codigo IN ('plataforma.organizaciones.gestionar', 'plataforma.usuarios.gestionar')
ON CONFLICT DO NOTHING;

COMMIT;
