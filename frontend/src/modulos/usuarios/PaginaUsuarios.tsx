import PanelAccesoDonantes from './PanelAccesoDonantes';
import PanelCuentasOrganizacion from './PanelCuentasOrganizacion';
import { useEffect, useState } from 'react';
import { obtenerRoles, type RolCatalogo } from '../../lib/api';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/roles.css';

const perfiles = [
  { codigo: 'ADMINISTRADOR', titulo: 'Administrador', proposito: 'Supervisa la operación y la configuración de su organización.' },
  { codigo: 'COORDINADOR', titulo: 'Coordinador', proposito: 'Planifica intervenciones y da seguimiento a comunidades, familias y proyectos.' },
  { codigo: 'FINANZAS', titulo: 'Finanzas', proposito: 'Gestiona solicitudes y pagos y consulta su contexto operativo.' },
  { codigo: 'CAMPO', titulo: 'Campo', proposito: 'Recopila información de familias y registra evidencias del trabajo en terreno.' },
  { codigo: 'DONANTE', titulo: 'Donante', proposito: 'Consulta proyectos autorizados, su avance de ejecución y las evidencias relacionadas.' },
];

function PaginaUsuarios({ tokenAcceso, puedeVer, puedeGestionarAcceso, puedeGestionarCuentas }: { tokenAcceso: string; puedeVer: boolean; puedeGestionarAcceso: boolean; puedeGestionarCuentas: boolean }) {
  const [roles, setRoles] = useState<RolCatalogo[] | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!puedeVer) return;

    let vigente = true;
    obtenerRoles(tokenAcceso).then(
      (respuesta) => { if (vigente) setRoles(respuesta.roles); },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    );
    return () => { vigente = false; };
  }, [tokenAcceso, puedeVer, intento]);

  return (
    <section className="pagina-modulo" aria-labelledby="titulo-usuarios">
      <div className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Usuarios · Administración de acceso</p>
        <h1 id="titulo-usuarios" className="pagina-modulo__titulo">Roles y permisos</h1>
        <p className="pagina-modulo__descripcion">
          Administrá cuentas de tu organización y consultá los permisos de los perfiles configurados en Semilla.
          La disponibilidad de cada acción depende del módulo y de las reglas de tu organización.
        </p>
      </div>
      {!puedeVer ? <p>Tu cuenta necesita el permiso usuarios.ver para consultar el catálogo.</p> :
        error ? (
          <div role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => { setError(''); setRoles(null); setIntento(intento + 1); }}>
              Reintentar
            </button>
          </div>
        ) : roles === null ? <p role="status">Cargando roles…</p> : (
          <>
          {puedeGestionarCuentas && (
            <PanelCuentasOrganizacion token={tokenAcceso}
              rolesActivos={roles.filter((rol) => rol.activo).map((rol) => rol.nombre)} />
          )}
          <div className="roles-panel">
            {perfiles.map((perfil) => {
              const rol = roles.find((item) => item.nombre === perfil.codigo);
              return (
                <article className="roles-panel__tarjeta" key={perfil.codigo}>
                  <span className="pagina-modulo__etiqueta">{perfil.codigo}</span>
                  <h2>{perfil.titulo}</h2>
                  <p>{perfil.proposito}</p>
                  <span className="pagina-modulo__estado">
                    {rol ? (rol.activo ? 'Activo' : 'Inactivo') : 'Sin configurar'}
                  </span>
                  {rol && (
                    <details>
                      <summary>Permisos configurados ({rol.permisos.length})</summary>
                      {rol.permisos.length ? (
                        <ul>
                          {rol.permisos.map((permiso) => (
                            <li key={permiso.codigo}>
                              <code>{permiso.codigo}</code>
                              {permiso.descripcion && <span>{permiso.descripcion}</span>}
                            </li>
                          ))}
                        </ul>
                      ) : <p>Sin permisos asignados.</p>}
                    </details>
                  )}
                  {perfil.codigo === 'DONANTE' && puedeGestionarAcceso && (
                    <details className="roles-panel__acceso">
                      <summary>Gestionar acceso de donantes</summary>
                      <PanelAccesoDonantes token={tokenAcceso} />
                    </details>
                  )}
                </article>
              );
            })}
          </div>
          </>
        )}
    </section>
  );
}

export default PaginaUsuarios;
