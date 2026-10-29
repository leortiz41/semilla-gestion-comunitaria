-- ============================================================================
-- Semilla - Configuración inicial de roles y permisos
-- Idempotente: puede ejecutarse más de una vez sin duplicar registros.
-- ============================================================================

BEGIN;

-- El administrador recibe todos los permisos disponibles.
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'ADMINISTRADOR'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Coordinación comunitaria y de proyectos.
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.codigo = ANY (ARRAY[
  'comunidades.ver',
  'comunidades.gestionar',
  'familias.ver',
  'familias.gestionar',
  'proyectos.ver',
  'proyectos.gestionar',
  'pagos.ver',
  'evidencias.gestionar'
])
WHERE r.nombre = 'COORDINADOR'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Finanzas puede consultar contexto y gestionar solicitudes/pagos.
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.codigo = ANY (ARRAY[
  'familias.ver',
  'proyectos.ver',
  'pagos.ver',
  'pagos.gestionar'
])
WHERE r.nombre = 'FINANZAS'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Personal de campo registra información comunitaria y evidencias.
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.codigo = ANY (ARRAY[
  'comunidades.ver',
  'familias.ver',
  'familias.gestionar',
  'proyectos.ver',
  'evidencias.gestionar'
])
WHERE r.nombre = 'CAMPO'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Consulta mantiene acceso de solo lectura.
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.codigo = ANY (ARRAY[
  'usuarios.ver',
  'comunidades.ver',
  'familias.ver',
  'proyectos.ver',
  'pagos.ver'
])
WHERE r.nombre = 'CONSULTA'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

COMMIT;
