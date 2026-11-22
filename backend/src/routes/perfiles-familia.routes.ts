import { Router } from 'express';
import { databasePool } from '../config/database.js';
import { authenticateAccessToken, requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { esUuid } from '../domain/expediente.js';

export const perfilesFamiliaRouter = Router();
perfilesFamiliaRouter.use(
  authenticateAccessToken, requireRole('ADMINISTRADOR', 'COORDINADOR', 'CAMPO'),
  requirePermission('comunidades.ver'),
);
const editar = [requireRole('ADMINISTRADOR', 'COORDINADOR'), requirePermission('comunidades.gestionar')];

function numero(valor: unknown, valorMaximo: number, entero = false): number | null {
  if (valor === null || valor === '' || valor === undefined) return null;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > valorMaximo ||
      (entero && !Number.isInteger(valor))) return null;
  return valor;
}
function texto(valor: unknown, longitudMaxima: number): string | null {
  return typeof valor === 'string' && valor.trim().length <= longitudMaxima ? valor.trim() || null : null;
}
function opcion(valor: unknown): boolean | null | undefined {
  if (valor === null || valor === undefined || valor === '') return null;
  return typeof valor === 'boolean' ? valor : undefined;
}

perfilesFamiliaRouter.get('/opciones/proyectos', async (req, res) => {
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const { rows } = await databasePool.query(
      `SELECT p.id,p.nombre,p.comunidad_id AS "comunidadId",
              c.nombre AS comunidad,p.estado
       FROM proyectos p JOIN comunidades c ON c.id=p.comunidad_id
       WHERE c.organizacion_id=$1
       ORDER BY p.nombre,p.id`,
      [req.auth!.organizacionId],
    );
    res.set('Cache-Control', 'no-store');
    res.json({ proyectos: rows });
  } catch (error) {
    console.error('Error consultando proyectos para perfil familiar:', error);
    res.status(500).json({ message: 'No fue posible consultar los proyectos.' });
  }
});

perfilesFamiliaRouter.get('/:familiaId/perfiles', async (req, res) => {
  const familiaId = req.params.familiaId;
  if (!esUuid(familiaId)) { res.status(400).json({ message: 'Familia no válida.' }); return; }
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const { rows } = await databasePool.query(
      `SELECT pf.id,pf.familia_id AS "familiaId",pf.proyecto_id AS "proyectoId",
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
       ORDER BY pf.fecha_perfil DESC,pf.id DESC`,
      [familiaId,req.auth!.organizacionId],
    );
    res.set('Cache-Control', 'no-store');
    res.json({ perfiles: rows });
  } catch (error) {
    console.error('Error consultando perfiles familiares:', error);
    res.status(500).json({ message: 'No fue posible consultar las evaluaciones familiares.' });
  }
});

perfilesFamiliaRouter.put('/:familiaId/perfiles/:proyectoId', ...editar, async (req, res) => {
  const { familiaId, proyectoId } = req.params;
  const datosPerfilFamiliar = req.body || {};
  const numeroIntegrantes = numero(datosPerfilFamiliar.numeroIntegrantes, 100, true);
  const numeroHabitaciones = numero(datosPerfilFamiliar.numeroHabitaciones, 50, true);
  const areaUtilConstruccion = datosPerfilFamiliar.areaUtilConstruccion == null || datosPerfilFamiliar.areaUtilConstruccion === '' ? null : numero(datosPerfilFamiliar.areaUtilConstruccion, 100000);
  const ingresoMensual = datosPerfilFamiliar.ingresoMensual == null || datosPerfilFamiliar.ingresoMensual === '' ? null : numero(datosPerfilFamiliar.ingresoMensual, 100000000);
  const nivelRiesgo = datosPerfilFamiliar.nivelRiesgo;
  const tipoVivienda = texto(datosPerfilFamiliar.tipoVivienda, 150);
  const condicionTerreno = texto(datosPerfilFamiliar.condicionTerreno, 120);
  const estadoCivil = texto(datosPerfilFamiliar.estadoCivil, 80);
  const telefonoContacto = texto(datosPerfilFamiliar.telefonoContacto, 50);
  const fuenteIngresos = texto(datosPerfilFamiliar.fuenteIngresos, 200);
  const observaciones = texto(datosPerfilFamiliar.observaciones, 3000);
  const tieneElectricidad = opcion(datosPerfilFamiliar.tieneElectricidad);
  const tieneAgua = opcion(datosPerfilFamiliar.tieneAgua);
  const tienePila = opcion(datosPerfilFamiliar.tienePila);
  const tieneFosa = opcion(datosPerfilFamiliar.tieneFosa);
  if (!esUuid(familiaId) || !esUuid(proyectoId) || numeroIntegrantes === null || numeroIntegrantes < 1 ||
      numeroHabitaciones === null || (datosPerfilFamiliar.areaUtilConstruccion != null && datosPerfilFamiliar.areaUtilConstruccion !== '' && areaUtilConstruccion === null) ||
      (datosPerfilFamiliar.ingresoMensual != null && datosPerfilFamiliar.ingresoMensual !== '' && ingresoMensual === null) ||
      !['BAJO','MEDIO','ALTO','CRITICO'].includes(nivelRiesgo) ||
      [tieneElectricidad,tieneAgua,tienePila,tieneFosa].some((opcionVivienda) => opcionVivienda === undefined) ||
      [datosPerfilFamiliar.tipoVivienda,datosPerfilFamiliar.condicionTerreno,datosPerfilFamiliar.estadoCivil,datosPerfilFamiliar.telefonoContacto,datosPerfilFamiliar.fuenteIngresos,datosPerfilFamiliar.observaciones]
        .some((valorCampo) => valorCampo != null && typeof valorCampo !== 'string')) {
    res.status(400).json({ message: 'Revisá los campos de la evaluación familiar.' }); return;
  }
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const { rows } = await databasePool.query(
      `INSERT INTO perfiles_familia
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
       RETURNING id,estado`,
      [familiaId,proyectoId,req.auth!.organizacionId,numeroIntegrantes,nivelRiesgo,numeroHabitaciones,
        areaUtilConstruccion,tipoVivienda,ingresoMensual,observaciones,condicionTerreno,tieneElectricidad,tieneAgua,tienePila,
        tieneFosa,estadoCivil,telefonoContacto,fuenteIngresos,req.auth!.sub],
    );
    if (!rows.length) {
      res.status(409).json({ message: 'La evaluación no puede modificarse; verificá el proyecto o su estado.' }); return;
    }
    res.json({ perfil: rows[0] });
  } catch (error) {
    console.error('Error guardando evaluación familiar:', error);
    res.status(500).json({ message: 'No fue posible guardar la evaluación.' });
  }
});

perfilesFamiliaRouter.post('/:familiaId/perfiles/:perfilId/revisar', ...editar, async (req, res) => {
  const { familiaId, perfilId } = req.params;
  const estado = req.body?.estado;
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
  if (!esUuid(familiaId) || !esUuid(perfilId) ||
      !['EVALUADO','SELECCIONADO','DESCARTADO','FINALIZADO'].includes(estado) ||
      motivo.length > 2000 || (estado === 'DESCARTADO' && !motivo)) {
    res.status(400).json({ message: 'Estado o motivo de revisión inválido.' }); return;
  }
  // Selección y entrega requieren expediente documental revisado, todavía en desarrollo.
  // Nunca aprobar familias sin comprobar PDF de identidad/tenencia/actas y trazabilidad.
  if (estado === 'SELECCIONADO' || estado === 'FINALIZADO') {
    res.status(409).json({ message: 'La selección y entrega requieren validación documental; esta función estará disponible al completar los PDF del expediente.' });
    return;
  }
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const { rows } = await databasePool.query(
      `UPDATE perfiles_familia pf
       SET estado=$3,fecha_revision=NOW(),revisado_por_usuario_id=$4,
           motivo_revision=NULLIF($5,''),actualizado_en=NOW()
       FROM familias f JOIN comunidades c ON c.id=f.comunidad_id
       WHERE pf.id=$1 AND pf.familia_id=$2 AND f.id=pf.familia_id
         AND c.organizacion_id=$6
         AND ((pf.estado='PENDIENTE' AND $3 IN ('EVALUADO','DESCARTADO'))
           OR (pf.estado='EVALUADO' AND $3 IN ('SELECCIONADO','DESCARTADO'))
           OR (pf.estado='SELECCIONADO' AND $3='FINALIZADO'))
       RETURNING pf.id,pf.estado`,
      [perfilId,familiaId,estado,req.auth!.sub,motivo,req.auth!.organizacionId],
    );
    if (!rows.length) {
      res.status(409).json({ message: 'La transición no está permitida o no tenés acceso al expediente.' }); return;
    }
    res.json({ perfil: rows[0] });
  } catch (error) {
    console.error('Error revisando evaluación familiar:', error);
    res.status(500).json({ message: 'No fue posible revisar el expediente.' });
  }
});
