BEGIN;

UPDATE roles
SET nombre = 'DONANTE',
    descripcion = 'Consulta de proyectos, avance de ejecución y evidencias autorizadas.'
WHERE nombre = 'CONSULTA';

INSERT INTO permisos (codigo, modulo, descripcion)
VALUES ('evidencias.ver', 'evidencias', 'Consultar evidencias autorizadas')
ON CONFLICT (codigo) DO NOTHING;

DELETE FROM roles_permisos rp
USING roles r, permisos p
WHERE rp.rol_id = r.id AND rp.permiso_id = p.id
  AND r.nombre = 'DONANTE'
  AND p.codigo NOT IN ('proyectos.ver', 'evidencias.ver');

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permisos p
WHERE (r.nombre = 'DONANTE' AND p.codigo IN ('proyectos.ver', 'evidencias.ver'))
   OR (r.nombre = 'ADMINISTRADOR' AND p.codigo = 'evidencias.ver')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

COMMIT;
