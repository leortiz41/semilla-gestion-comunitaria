import type { Pool } from 'pg';

// SQL preservado: filtros tenant, relaciones entre familia/proyecto y transiciones válidas.
export function consultarProyectosDePerfilesEnRepositorio(pool: Pool, parametros: unknown[]) {
  return pool.query(`SELECT p.id,p.nombre,p.comunidad_id AS "comunidadId",
              c.nombre AS comunidad,p.estado
       FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
       WHERE c.organizacion_id=$1
       ORDER BY p.nombre,p.id`, parametros);
}

export function consultarPerfilesFamiliaresEnRepositorio(pool: Pool, parametros: unknown[]) {
  return pool.query(`SELECT pf.id,pf.familia_id AS "familiaId",pf.proyecto_id AS "proyectoId",
              p.nombre AS proyecto, pf.numero_integrantes AS "numeroIntegrantes",
              pf.nivel_riesgo AS "nivelRiesgo",
              pf.numero_habitaciones AS "numeroHabitaciones",
              pf.area_util_construccion::float8 AS "areaUtilConstruccion",
              pf.tipo_vivienda AS "tipoVivienda",pf.fecha_perfil::text AS "fechaPerfil",
              pf.ingreso_mensual::float8 AS "ingresoMensual",
              pf.observaciones,pf.estado,
              pf.condicion_terreno AS "condicionTerreno",
              pf.tiene_electricidad AS "tieneElectricidad",pf.tiene_agua AS "tieneAgua",
              pf.tiene_pila AS "tienePila",pf.tiene_fosa AS "tieneFosa",
              pf.estado_civil AS "estadoCivil",pf.telefono_contacto AS "telefonoContacto",
              pf.fuente_ingresos AS "fuenteIngresos",
              pf.fecha_revision AS "fechaRevision",pf.motivo_revision AS "motivoRevision"
       FROM perfiles_familia pf
       JOIN familias f ON f.id=pf.familia_id
       JOIN comunidades c ON c.id=f.comunidad_id
       JOIN proyectos p ON p.id=pf.proyecto_id AND p.comunidad_id=f.comunidad_id
       WHERE pf.familia_id=$1 AND c.organizacion_id=$2
       ORDER BY pf.fecha_perfil DESC,pf.id DESC`, parametros);
}

export function persistirEvaluacionFamiliarEnRepositorio(pool: Pool, parametros: unknown[]) {
  return pool.query(`INSERT INTO perfiles_familia
       (familia_id,proyecto_id,numero_integrantes,nivel_riesgo,numero_habitaciones,
        area_util_construccion,tipo_vivienda,ingreso_mensual,observaciones,
        condicion_terreno,tiene_electricidad,tiene_agua,tiene_pila,tiene_fosa,
        estado_civil,telefono_contacto,fuente_ingresos,responsable_registro_usuario_id)
       SELECT f.id,p.id,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
       FROM familias f
       JOIN comunidades c ON c.id=f.comunidad_id
       JOIN proyectos p ON p.id=$2 AND p.comunidad_id=f.comunidad_id
       WHERE f.id=$1 AND c.organizacion_id=$3 AND f.activo
       ON CONFLICT (familia_id,proyecto_id) DO UPDATE SET
         numero_integrantes=EXCLUDED.numero_integrantes,nivel_riesgo=EXCLUDED.nivel_riesgo,
         numero_habitaciones=EXCLUDED.numero_habitaciones,
         area_util_construccion=EXCLUDED.area_util_construccion,
         tipo_vivienda=EXCLUDED.tipo_vivienda,ingreso_mensual=EXCLUDED.ingreso_mensual,
         observaciones=EXCLUDED.observaciones,condicion_terreno=EXCLUDED.condicion_terreno,
         tiene_electricidad=EXCLUDED.tiene_electricidad,tiene_agua=EXCLUDED.tiene_agua,
         tiene_pila=EXCLUDED.tiene_pila,tiene_fosa=EXCLUDED.tiene_fosa,
         estado_civil=EXCLUDED.estado_civil,telefono_contacto=EXCLUDED.telefono_contacto,
         fuente_ingresos=EXCLUDED.fuente_ingresos,estado='PENDIENTE',
         revisado_por_usuario_id=NULL,fecha_revision=NULL,motivo_revision=NULL,
         actualizado_en=NOW()
       WHERE perfiles_familia.estado IN ('PENDIENTE','EVALUADO')
       RETURNING id,estado`, parametros);
}

export function persistirRevisionFamiliarEnRepositorio(pool: Pool, parametros: unknown[]) {
  return pool.query(`UPDATE perfiles_familia pf
       SET estado=$3,fecha_revision=NOW(),revisado_por_usuario_id=$4,
           motivo_revision=NULLIF($5,''),actualizado_en=NOW()
       FROM familias f JOIN comunidades c ON c.id=f.comunidad_id
       WHERE pf.id=$1 AND pf.familia_id=$2 AND f.id=pf.familia_id
         AND c.organizacion_id=$6
         AND ((pf.estado='PENDIENTE' AND $3 IN ('EVALUADO','DESCARTADO'))
           OR (pf.estado='EVALUADO' AND $3 IN ('SELECCIONADO','DESCARTADO'))
           OR (pf.estado='SELECCIONADO' AND $3='FINALIZADO'))
       RETURNING pf.id,pf.estado`, parametros);
}
