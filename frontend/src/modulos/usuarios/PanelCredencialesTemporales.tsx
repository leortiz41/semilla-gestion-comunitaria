import { useEffect, useState } from 'react';
import {
  reemitirCredencialTemporalPlataforma,
  type CuentaOrganizacion,
  type OrganizacionPlataforma,
} from '../../lib/api';

export default function PanelCredencialesTemporales({
  token,
  organizacion,
  cuentas,
  bloqueado,
  hayCredencialVisible,
  alEmitir,
  alActualizar,
  alError,
}: {
  token: string;
  organizacion: OrganizacionPlataforma;
  cuentas: CuentaOrganizacion[];
  bloqueado: boolean;
  hayCredencialVisible: boolean;
  alEmitir: (credencial: { email: string; temporal: string }) => void;
  alActualizar: () => void;
  alError: (mensaje: string) => void;
}) {
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [emitiendoId, setEmitiendoId] = useState<string | null>(null);

  useEffect(() => {
    setConfirmandoId(null);
    setEmitiendoId(null);
  }, [organizacion.id]);

  const administradores = cuentas.filter((cuenta) =>
    cuenta.activo &&
    cuenta.roles.includes('ADMINISTRADOR') &&
    !cuenta.roles.includes('SUPERADMINISTRADOR'),
  );

  async function confirmarEmision(cuenta: CuentaOrganizacion) {
    if (bloqueado || hayCredencialVisible || emitiendoId) return;
    setEmitiendoId(cuenta.id);
    alError('');
    try {
      const respuesta = await reemitirCredencialTemporalPlataforma(token, organizacion.id, cuenta.id);
      setConfirmandoId(null);
      alEmitir({ email: respuesta.cuenta.email, temporal: respuesta.contrasenaTemporal });
      alActualizar();
    } catch (fallo) {
      alError(fallo instanceof Error ? fallo.message : 'No fue posible emitir la credencial temporal.');
    } finally {
      setEmitiendoId(null);
    }
  }

  return (
    <section className="cuentas-org__formulario cuentas-org__credenciales" aria-labelledby="titulo-credenciales-temporales">
      <div className="cuentas-org__encabezado">
        <div>
          <h3 id="titulo-credenciales-temporales">Credenciales temporales de administradores</h3>
          <p>Gestioná los accesos de la organización seleccionada sin revelar ni conservar contraseñas anteriores.</p>
        </div>
        <span className="cuentas-org__tenant">ID de organización: <code>{organizacion.id}</code></span>
      </div>

      <p className="cuentas-org__aviso">
        Reemitir una credencial reemplaza la contraseña actual, revoca las sesiones renovables y obliga a crear una nueva contraseña al ingresar.
      </p>

      {administradores.length === 0 ? (
        <p className="cuentas-org__vacio">Esta organización todavía no tiene cuentas administradoras activas.</p>
      ) : (
        <div className="cuentas-org__listado" aria-label="Administradores de la organización">
          {administradores.map((cuenta) => {
            const confirmando = confirmandoId === cuenta.id;
            const emitiendo = emitiendoId === cuenta.id;
            return (
              <article className="cuentas-org__credencial-admin" key={cuenta.id}>
                <div className="cuentas-org__identidad">
                  <strong>{cuenta.email}</strong>
                  <small>
                    {cuenta.debeCambiarContrasena
                      ? 'Contraseña temporal pendiente de cambio'
                      : 'Contraseña personalizada activa'}
                    {' · '}{cuenta.roles.join(', ')}
                  </small>
                </div>
                {confirmando ? (
                  <div className="cuentas-org__confirmacion" role="alert">
                    <p>La contraseña actual dejará de servir. ¿Querés generar una nueva credencial temporal?</p>
                    <div className="cuentas-org__acciones">
                      <button type="button" disabled={Boolean(emitiendoId)} onClick={() => void confirmarEmision(cuenta)}>
                        {emitiendo ? 'Generando…' : 'Sí, generar nueva credencial'}
                      </button>
                      <button type="button" className="cuentas-org__secundario" disabled={Boolean(emitiendoId)}
                        onClick={() => setConfirmandoId(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="cuentas-org__secundario"
                    disabled={bloqueado || hayCredencialVisible || Boolean(emitiendoId)}
                    onClick={() => setConfirmandoId(cuenta.id)}>
                    Reemitir credencial temporal
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
