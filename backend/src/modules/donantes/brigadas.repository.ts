import type { Pool } from 'pg';
import type { DatosBrigada } from './brigadas.domain.js';

/** Persistencia atómica: se mantienen BEGIN, bloqueos, comprobaciones tenant y rollback. */
export async function guardarBrigadaEnRepositorio(
  pool: Pool, id: string, brigadaId: string | null, organizacion: string,
  entrada: DatosBrigada,
): Promise<'OK' | 'BRIGADA_NO_ENCONTRADA' | 'RELACIONES_INVALIDAS'> {
  const { lider, miembros, llegada, salida, proyectoIds, zonaId, comunidadIds,
    actividades, contrataciones, observaciones } = entrada;
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      if (brigadaId) {
        const bloqueo = await cliente.query(
          `SELECT b.id FROM brigadas_donantes b JOIN donantes d ON d.id = b.donante_id
           WHERE b.id = $1 AND d.id = $2 AND d.organizacion_id = $3 FOR UPDATE OF b`,
          [brigadaId, id, organizacion],
        );
        if (!bloqueo.rowCount) {
          await cliente.query('ROLLBACK');
          return 'BRIGADA_NO_ENCONTRADA' as const;
        }
      }

      const datos = `SELECT d.id AS donante_id, ($3::uuid[])[1] AS proyecto_id, $4::text AS lider,
              $5::integer AS miembros, $6::date AS llegada, $7::date AS salida,
              $8::text[] AS actividades, $9::text[] AS contrataciones, $10::text AS observaciones,
              z.id AS zona_id
         FROM donantes d
         JOIN zonas z ON z.id = $11 AND z.organizacion_id = d.organizacion_id AND z.activo
         WHERE d.id = $1 AND d.organizacion_id = $2
           ${brigadaId ? '' : 'AND d.activo'}
           AND (SELECT count(*) FROM comunidades_validas) = cardinality($12::uuid[])
           AND (SELECT count(*)
             FROM proyectos p JOIN comunidades_validas c ON c.id = p.comunidad_id
             WHERE p.id = ANY($3::uuid[])
           ) = cardinality($3::uuid[])`;
      const operacion = brigadaId
        ? `UPDATE brigadas_donantes b SET proyecto_id = d.proyecto_id, lider = d.lider,
             miembros = d.miembros, fecha_llegada = d.llegada, fecha_salida = d.salida,
             lista_actividades = d.actividades, lista_contrataciones = d.contrataciones,
             observaciones = d.observaciones, zona_id = d.zona_id, comunidad_id = NULL
           FROM datos d WHERE b.id = $13 AND b.donante_id = d.donante_id RETURNING b.id`
        : `INSERT INTO brigadas_donantes
             (donante_id, proyecto_id, lider, miembros, fecha_llegada, fecha_salida,
              lista_actividades, lista_contrataciones, observaciones, zona_id)
           SELECT * FROM datos RETURNING id`;
      const parametros = [id, organizacion, proyectoIds, lider, miembros,
        llegada, salida, actividades,
        contrataciones, observaciones, zonaId, comunidadIds];
      if (brigadaId) parametros.push(brigadaId);
      const resultado = await cliente.query(
        `WITH comunidades_validas AS (
           SELECT id FROM comunidades
           WHERE id = ANY($12::uuid[]) AND zona_id = $11 AND organizacion_id = $2 AND activo
         ), datos AS (${datos})
         ${operacion}`, parametros,
      );
      if (!resultado.rowCount) {
        await cliente.query('ROLLBACK');
        return 'RELACIONES_INVALIDAS' as const;
      }

      const guardada = resultado.rows[0].id;
      if (brigadaId) {
        await cliente.query('DELETE FROM brigadas_donantes_comunidades WHERE brigada_id = $1', [guardada]);
        await cliente.query('DELETE FROM brigadas_donantes_proyectos WHERE brigada_id = $1', [guardada]);
      }
      await cliente.query(
        `INSERT INTO brigadas_donantes_comunidades (brigada_id, comunidad_id)
         SELECT $1, id FROM unnest($2::uuid[]) AS seleccion(id)`,
        [guardada, comunidadIds],
      );
      await cliente.query(
        'INSERT INTO brigadas_donantes_proyectos (brigada_id, proyecto_id) SELECT $1, unnest($2::uuid[])',
        [guardada, proyectoIds],
      );
      await cliente.query('COMMIT');
      return 'OK' as const;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
}
