import { useEffect, useState } from 'react';
import PanelAccesoDonantes from './PanelAccesoDonantes';
import PanelCuentasOrganizacion from './PanelCuentasOrganizacion';
import PanelMatrizAccesos from './PanelMatrizAccesos';
import { obtenerRoles, type RolCatalogo } from '../../lib/api';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/roles.css';

function PaginaUsuarios({
  tokenAcceso, puedeVer, puedeGestionarAcceso, puedeGestionarCuentas,
}: {
  tokenAcceso: string;
  puedeVer: boolean;
  puedeGestionarAcceso: boolean;
  puedeGestionarCuentas: boolean;
}) {
  const [roles, setRoles] = useState<RolCatalogo[] | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!puedeVer || !puedeGestionarCuentas) return;
    let vigente = true;
    obtenerRoles(tokenAcceso).then(
      (respuesta) => { if (vigente) { setRoles(respuesta.roles); setError(''); } },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    );
    return () => { vigente = false; };
  }, [tokenAcceso, puedeVer, puedeGestionarCuentas, intento]);

  return (
    <section className="pagina-modulo" aria-labelledby="titulo-usuarios">
      <div className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Seguridad · Organización</p>
        <h1 id="titulo-usuarios" className="pagina-modulo__titulo">Administración de usuarios y accesos</h1>
        <p className="pagina-modulo__descripcion">
          Gestioná las cuentas, los roles y los permisos de tu organización desde un único lugar.
          Los accesos se administran sin modificar las configuraciones de otros tenants.
        </p>
      </div>

      {!puedeVer ? (
        <p>Tu cuenta necesita el permiso usuarios.ver para consultar este módulo.</p>
      ) : (
        <>
          {puedeGestionarCuentas ? (
            <>
              <div className="roles-panel__administracion-cuentas">
                {error && (
                  <div role="alert">
                    <p>{error}</p>
                    <button type="button" onClick={() => {
                      setError('');
                      setRoles(null);
                      setIntento((actual) => actual + 1);
                    }}>Reintentar</button>
                  </div>
                )}
                {!error && roles === null && <p role="status">Cargando roles disponibles…</p>}
                {roles !== null && (
                  <PanelCuentasOrganizacion
                    token={tokenAcceso}
                    rolesActivos={roles.filter((rol) => rol.activo).map((rol) => rol.nombre)}
                  />
                )}
              </div>
              <details className="roles-panel__administracion-cuentas">
                <summary>Consultar matriz de accesos y permisos</summary>
                <PanelMatrizAccesos token={tokenAcceso} />
              </details>
            </>
          ) : (
            <p>La administración de usuarios requiere el rol ADMINISTRADOR y el permiso usuarios.gestionar.</p>
          )}
          {puedeGestionarAcceso && (
            <details className="roles-panel__administracion-cuentas">
              <summary>Gestionar acceso de donantes a proyectos y evidencias</summary>
              <PanelAccesoDonantes token={tokenAcceso} />
            </details>
          )}
        </>
      )}
    </section>
  );
}

export default PaginaUsuarios;
