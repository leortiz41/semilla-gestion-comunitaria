import type { RequestHandler } from 'express';
import { databasePool } from '../../config/database.js';
import { esUuid } from '../../domain/expediente.js';
import { numero, texto, opcion } from './perfiles-familia.domain.js';
import { consultarProyectosDePerfiles, consultarPerfilesFamiliares, persistirEvaluacionFamiliar, persistirRevisionFamiliar } from './perfiles-familia.service.js';

export const listarProyectosElegibles: RequestHandler = async (req, res) => {
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const { rows } = await consultarProyectosDePerfiles([req.auth!.organizacionId]);
    res.set('Cache-Control', 'no-store');
    res.json({ proyectos: rows });
  } catch (error) {
    console.error('Error consultando proyectos para perfil familiar:', error);
    res.status(500).json({ message: 'No fue posible consultar los proyectos.' });
  }
};

export const listarEvaluacionesFamiliares: RequestHandler = async (req, res) => {
  const familiaId = req.params.familiaId;
  if (!esUuid(familiaId)) { res.status(400).json({ message: 'Familia no válida.' }); return; }
  try {
    if (!databasePool) { res.status(503).json({ message: 'Base de datos no disponible.' }); return; }
    const { rows } = await consultarPerfilesFamiliares([familiaId,req.auth!.organizacionId]);
    res.set('Cache-Control', 'no-store');
    res.json({ perfiles: rows });
  } catch (error) {
    console.error('Error consultando perfiles familiares:', error);
    res.status(500).json({ message: 'No fue posible consultar las evaluaciones familiares.' });
  }
};

export const guardarEvaluacionFamiliar: RequestHandler = async (req, res) => {
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
    const { rows } = await persistirEvaluacionFamiliar([familiaId,proyectoId,req.auth!.organizacionId,numeroIntegrantes,nivelRiesgo,numeroHabitaciones,
        areaUtilConstruccion,tipoVivienda,ingresoMensual,observaciones,condicionTerreno,tieneElectricidad,tieneAgua,tienePila,
        tieneFosa,estadoCivil,telefonoContacto,fuenteIngresos,req.auth!.sub]);
    if (!rows.length) {
      res.status(409).json({ message: 'La evaluación no puede modificarse; verificá el proyecto o su estado.' }); return;
    }
    res.json({ perfil: rows[0] });
  } catch (error) {
    console.error('Error guardando evaluación familiar:', error);
    res.status(500).json({ message: 'No fue posible guardar la evaluación.' });
  }
};

export const revisarEvaluacionFamiliar: RequestHandler = async (req, res) => {
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
    const { rows } = await persistirRevisionFamiliar([perfilId,familiaId,estado,req.auth!.sub,motivo,req.auth!.organizacionId]);
    if (!rows.length) {
      res.status(409).json({ message: 'La transición no está permitida o no tenés acceso al expediente.' }); return;
    }
    res.json({ perfil: rows[0] });
  } catch (error) {
    console.error('Error revisando evaluación familiar:', error);
    res.status(500).json({ message: 'No fue posible revisar el expediente.' });
  }
};
