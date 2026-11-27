import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { hashPassword } from '../../security/password.js';
import {
  validarProteccionCuenta, requiereValidarUltimoAdministrador,
  esUltimoAdministradorActivo, requiereActualizarEstado,
} from './estado-cuentas.domain.js';
import {
  consultarCuentasPlataforma, insertarCuentaPlataforma, ejecutarCambioEstadoCuentaTransaccional,
} from './cuentas-plataforma.repository.js';

function poolDisponible(pool: Pool | null): Pool {
  if (!pool) throw new Error('Gestión de plataforma no disponible.');
  return pool;
}

export function listarCuentasPlataforma(
  organizacionId: string, pool: Pool | null = databasePool,
) {
  return consultarCuentasPlataforma(poolDisponible(pool), organizacionId);
}

export async function crearCuentaPlataforma(
  datos: {organizacionId:string;email:string;nombreVisible:string;roles:string[]},
  operadorId: string, pool: Pool | null = databasePool,
) {
  const temporal='Aa1-'+randomBytes(18).toString('base64url');
  const hash=await hashPassword(temporal);
  const resultado=await insertarCuentaPlataforma(poolDisponible(pool),{...datos,hash,operadorId});
  return resultado.estado==='CREADA'
    ? {...resultado,contrasenaTemporal:temporal}
    : resultado;
}

/**
 * Caso de uso: las decisiones de autorización viven aquí y en el dominio.
 * Todas las consultas de estado y escrituras ocurren dentro de una transacción,
 * no se introduce una lectura previa susceptible a carreras (TOCTOU).
 */
export function actualizarEstadoCuentaPlataforma(
  datos: {organizacionId:string;usuarioId:string;activo:boolean;operadorId:string},
  pool: Pool | null = databasePool,
) {
  return ejecutarCambioEstadoCuentaTransaccional(poolDisponible(pool), async persistencia => {
    const cuenta = await persistencia.obtenerCuentaBloqueada(datos.organizacionId, datos.usuarioId);
    if (!cuenta) return { estado: 'NO_ENCONTRADA' };

    const retirada = await persistencia.fueRetirada(datos.usuarioId);
    const esCuentaGlobal = await persistencia.esCuentaGlobal(datos.usuarioId);
    const rechazo = validarProteccionCuenta({
      retirada, esCuentaGlobal, esCuentaOperador: datos.usuarioId === datos.operadorId,
    });
    if (rechazo) return { estado: rechazo };

    if (requiereValidarUltimoAdministrador(cuenta.activoAnterior, datos.activo)) {
      const administra = await persistencia.tieneRolAdministradorActivo(datos.usuarioId);
      if (administra) {
        const otros = await persistencia.contarOtrosAdministradoresActivos(
          datos.organizacionId, datos.usuarioId,
        );
        if (esUltimoAdministradorActivo(administra, otros)) {
          return { estado: 'ULTIMO_ADMINISTRADOR' };
        }
      }
    }

    if (requiereActualizarEstado(cuenta.activoAnterior, datos.activo)) {
      await persistencia.guardarCambio({
        organizacionId: datos.organizacionId,
        usuarioId: datos.usuarioId,
        operadorId: datos.operadorId,
        activoAnterior: cuenta.activoAnterior,
        activoSolicitado: datos.activo,
      });
    }
    return { estado: 'ACTUALIZADA', id: datos.usuarioId, activo: datos.activo };
  });
}
