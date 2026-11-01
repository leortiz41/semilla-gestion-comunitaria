import type { FormEvent } from 'react';
import type { UsuarioSesion } from '../../lib/api';
import '../../estilos/modulos/perfil/perfilSeguridad.css';

interface PropiedadesPaginaPerfilSeguridad {
  usuario: UsuarioSesion;
  mensaje?: string | null;
  error?: string | null;
  procesando: boolean;
  mostrarCambioClave: boolean;
  contrasenaActual: string;
  contrasenaNueva: string;
  confirmacionContrasena: string;
  alVolverDashboard: () => void;
  alRenovarSesion: () => void;
  alAlternarCambioClave: () => void;
  alCambiarContrasena: (event: FormEvent<HTMLFormElement>) => void;
  alCambiarContrasenaActual: (valor: string) => void;
  alCambiarContrasenaNueva: (valor: string) => void;
  alCambiarConfirmacionContrasena: (valor: string) => void;
}

function PaginaPerfilSeguridad({
  usuario,
  mensaje,
  error,
  procesando,
  mostrarCambioClave,
  contrasenaActual,
  contrasenaNueva,
  confirmacionContrasena,
  alVolverDashboard,
  alRenovarSesion,
  alAlternarCambioClave,
  alCambiarContrasena,
  alCambiarContrasenaActual,
  alCambiarContrasenaNueva,
  alCambiarConfirmacionContrasena,
}: PropiedadesPaginaPerfilSeguridad) {
  const permisosOrdenados = [...usuario.permisos].sort((a, b) => a.localeCompare(b));

  return (
    <section className="pagina-perfil-seguridad" aria-labelledby="titulo-perfil-seguridad">
      <div className="pagina-perfil-seguridad__encabezado">
        <div>
          <p className="eyebrow">Cuenta de usuario</p>
          <h1 id="titulo-perfil-seguridad" className="pagina-perfil-seguridad__titulo">
            Perfil y seguridad
          </h1>
          <p className="pagina-perfil-seguridad__descripcion">
            Consulta tu identidad, roles y permisos, y administra la seguridad de tu sesión.
          </p>
        </div>

        <button
          className="pagina-perfil-seguridad__volver"
          type="button"
          onClick={alVolverDashboard}
        >
          ← Volver al dashboard
        </button>
      </div>

      <div className="status-badge">● Sesión activa</div>

      {mensaje && <div className="notice success">{mensaje}</div>}
      {error && <div className="notice error">{error}</div>}

      {usuario.debeCambiarContrasena && (
        <div className="notice warning">
          Este usuario utiliza una contraseña temporal y debe cambiarla antes de continuar.
        </div>
      )}

      <div className="dashboard-grid">
        <article className="panel-card account-panel">
          <p className="eyebrow">Identidad</p>
          <h2>{usuario.email}</h2>
          <dl className="detail-list">
            <div>
              <dt>ID de usuario</dt>
              <dd>{usuario.id}</dd>
            </div>
            <div>
              <dt>Roles</dt>
              <dd className="chip-row">
                {usuario.roles.map((rol) => (
                  <span className="role-chip" key={rol}>{rol}</span>
                ))}
              </dd>
            </div>
            <div>
              <dt>Cambio de contraseña</dt>
              <dd>{usuario.debeCambiarContrasena ? 'Pendiente' : 'Completado'}</dd>
            </div>
          </dl>

          <div className="button-stack">
            <button
              className="secondary-button"
              type="button"
              onClick={alRenovarSesion}
              disabled={procesando}
            >
              Renovar sesión
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={alAlternarCambioClave}
            >
              Cambiar contraseña
            </button>
          </div>
        </article>

        <article className="panel-card permissions-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">RBAC</p>
              <h2>Permisos efectivos</h2>
            </div>
            <span className="count-badge">{permisosOrdenados.length}</span>
          </div>
          <div className="permission-list">
            {permisosOrdenados.map((permiso) => (
              <div className="permission-item" key={permiso}>
                <span className="check-dot">✓</span>
                <code>{permiso}</code>
              </div>
            ))}
          </div>
        </article>
      </div>

      {mostrarCambioClave && (
        <form className="panel-card password-panel" onSubmit={alCambiarContrasena}>
          <div>
            <p className="eyebrow">Seguridad</p>
            <h2>Cambiar contraseña</h2>
            <p>Al cambiarla se revocarán las sesiones activas y deberás iniciar sesión nuevamente.</p>
          </div>

          <div className="password-grid">
            <label>
              Contraseña actual
              <input
                type="password"
                value={contrasenaActual}
                onChange={(event) => alCambiarContrasenaActual(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              Nueva contraseña
              <input
                type="password"
                value={contrasenaNueva}
                onChange={(event) => alCambiarContrasenaNueva(event.target.value)}
                autoComplete="new-password"
                minLength={12}
                required
              />
            </label>
            <label>
              Confirmar nueva contraseña
              <input
                type="password"
                value={confirmacionContrasena}
                onChange={(event) => alCambiarConfirmacionContrasena(event.target.value)}
                autoComplete="new-password"
                minLength={12}
                required
              />
            </label>
          </div>

          <button className="primary-button" type="submit" disabled={procesando}>
            {procesando ? 'Actualizando…' : 'Actualizar contraseña'}
          </button>
        </form>
      )}
    </section>
  );
}

export default PaginaPerfilSeguridad;
