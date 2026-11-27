import type { Pool } from 'pg';
import { databasePool } from '../../config/database.js';
import { consultarCapacidadesEnRepositorio, guardarCapacidadesEnRepositorio } from './capacidades.repository.js';
import { ErrorExpediente } from '../../domain/expediente.js';

export interface CapacidadesComunidad {
  revision: number;
  organizaciones: string[];
  actividadesProductivas: string[];
  productosServicios: string[];
  observacionesOrganizaciones: string;
  potencialProductivo: string;
}
export function validarCapacidades(valor: unknown): CapacidadesComunidad {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor))
    throw new ErrorExpediente('Datos de capacidades inválidos.');
  const datosCapacidades = valor as Record<string, unknown>;
  if (
    typeof datosCapacidades.revision !== 'number' ||
    !Number.isInteger(datosCapacidades.revision) ||
    datosCapacidades.revision < 0 ||
    datosCapacidades.revision >= 2147483647
  )
    throw new ErrorExpediente('Versión de la sección inválida.');
  function lista(nombreCampo: string) {
    const valoresLista = datosCapacidades[nombreCampo];
    if (
      !Array.isArray(valoresLista) ||
      valoresLista.length > 50 ||
      valoresLista.some((elemento) => typeof elemento !== 'string' || !elemento.trim() || elemento.trim().length > 150)
    )
      throw new ErrorExpediente(
        `Revisa ${nombreCampo}: máximo 50 elementos de 150 caracteres, sin filas vacías.`,
      );
    const valoresNormalizados = valoresLista.map((elemento) => (elemento as string).trim());
    if (new Set(valoresNormalizados.map((elemento) => elemento.toLocaleLowerCase('es'))).size !== valoresNormalizados.length)
      throw new ErrorExpediente(`No repitas elementos en ${nombreCampo}.`);
    return valoresNormalizados;
  }
  function texto(nombreCampo: string) {
    if (typeof datosCapacidades[nombreCampo] !== 'string' || (datosCapacidades[nombreCampo] as string).length > 3000)
      throw new ErrorExpediente(`Revisa ${nombreCampo}: máximo 3000 caracteres.`);
    return (datosCapacidades[nombreCampo] as string).trim();
  }
  return {
    revision: datosCapacidades.revision,
    organizaciones: lista('organizaciones'),
    actividadesProductivas: lista('actividadesProductivas'),
    productosServicios: lista('productosServicios'),
    observacionesOrganizaciones: texto('observacionesOrganizaciones'),
    potencialProductivo: texto('potencialProductivo'),
  };
}
export function obtenerCapacidades(
  org: string, id: string, pool: Pool | null = databasePool,
): Promise<CapacidadesComunidad | null> {
  return consultarCapacidadesEnRepositorio(org, id, pool);
}

export function guardarCapacidades(
  org: string, id: string, usuario: string, datos: CapacidadesComunidad,
  pool: Pool | null = databasePool,
): Promise<CapacidadesComunidad> {
  return guardarCapacidadesEnRepositorio(org, id, usuario, datos, pool);
}
