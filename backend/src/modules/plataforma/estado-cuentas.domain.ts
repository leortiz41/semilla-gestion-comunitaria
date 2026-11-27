/**
 * Reglas puras del caso de uso de activación/suspensión de cuentas.
 *
 * El servicio toma las decisiones; el repositorio obtiene el estado vigente
 * y ejecuta comprobaciones y escrituras bajo una MISMA transacción.
 */
export type RechazoCambioEstadoCuenta = 'RETIRADA' | 'PROTEGIDA' | 'ULTIMO_ADMINISTRADOR';

export function validarProteccionCuenta(datos: {
  retirada: boolean;
  esCuentaGlobal: boolean;
  esCuentaOperador: boolean;
}): Extract<RechazoCambioEstadoCuenta, 'RETIRADA' | 'PROTEGIDA'> | null {
  if (datos.retirada) return 'RETIRADA';
  if (datos.esCuentaGlobal || datos.esCuentaOperador) return 'PROTEGIDA';
  return null;
}

export function requiereValidarUltimoAdministrador(
  activoAnterior: boolean,
  activoSolicitado: boolean,
): boolean {
  return activoAnterior && !activoSolicitado;
}

export function esUltimoAdministradorActivo(
  tieneRolAdministradorActivo: boolean,
  otrosAdministradoresActivos: number,
): boolean {
  return tieneRolAdministradorActivo && otrosAdministradoresActivos === 0;
}

export function requiereActualizarEstado(
  activoAnterior: boolean,
  activoSolicitado: boolean,
): boolean {
  return activoAnterior !== activoSolicitado;
}
