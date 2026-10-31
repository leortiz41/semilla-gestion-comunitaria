import { FormEvent, useEffect, useMemo, useState } from 'react';
import BarraLateral from './componentes/estructura/BarraLateral';
import EncabezadoAdministrativo from './componentes/estructura/EncabezadoAdministrativo';
import EstructuraAdministrativa from './componentes/estructura/EstructuraAdministrativa';
import {
  cambiarContrasena,
  cerrarSesion,
  iniciarSesion,
  renovarSesion,
  type UsuarioSesion,
} from './lib/api';

const pillars = [
  {
    title: 'Comunidades',
    description: 'Organiza zonas, comunidades, familias y beneficiarios desde un solo lugar.',
  },
  {
    title: 'Recursos',
    description: 'Da seguimiento a donaciones, materiales, presupuestos y su utilización.',
  },
  {
    title: 'Proyectos',
    description: 'Relaciona programas, actividades, evidencias y resultados comunitarios.',
  },
];

type Vista = 'inicio' | 'login' | 'sesion';

function App() {
  const [vista, setVista] = useState<Vista>('inicio');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [mostrarCambioClave, setMostrarCambioClave] = useState(false);
  const [contrasenaActual, setContrasenaActual] = useState('');
  const [contrasenaNueva, setContrasenaNueva] = useState('');
  const [confirmacionContrasena, setConfirmacionContrasena] = useState('');

  useEffect(() => {
    let activo = true;

    renovarSesion()
      .then((sesion) => {
        if (!activo) return;
        setAccessToken(sesion.accessToken);
        setUsuario(sesion.usuario);
        setVista('sesion');
        setMostrarCambioClave(sesion.usuario.debeCambiarContrasena);
      })
      .catch(() => {
        // No tener cookie activa al abrir la app es un estado normal.
      });

    return () => {
      activo = false;
    };
  }, []);

  const permisosOrdenados = useMemo(
    () => [...(usuario?.permisos ?? [])].sort((a, b) => a.localeCompare(b)),
    [usuario],
  );

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProcesando(true);
    setError(null);
    setMensaje(null);

    try {
      const sesion = await iniciarSesion(email.trim(), password);
      setAccessToken(sesion.accessToken);
      setUsuario(sesion.usuario);
      setVista('sesion');
      setPassword('');
      setMostrarCambioClave(sesion.usuario.debeCambiarContrasena);
      setMensaje('Sesión iniciada correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.');
    } finally {
      setProcesando(false);
    }
  }

  async function handleRefresh() {
    setProcesando(true);
    setError(null);
    setMensaje(null);

    try {
      const sesion = await renovarSesion();
      setAccessToken(sesion.accessToken);
      setUsuario(sesion.usuario);
      setMensaje('La sesión se renovó correctamente.');
    } catch (err) {
      setAccessToken(null);
      setUsuario(null);
      setVista('login');
      setError(err instanceof Error ? err.message : 'No fue posible renovar la sesión.');
    } finally {
      setProcesando(false);
    }
  }

  async function handleLogout() {
    setProcesando(true);
    setError(null);
    setMensaje(null);

    try {
      await cerrarSesion();
    } finally {
      setAccessToken(null);
      setUsuario(null);
      setEmail('');
      setPassword('');
      setMostrarCambioClave(false);
      setVista('inicio');
      setProcesando(false);
    }
  }

  async function handleCambioContrasena(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMensaje(null);

    if (!accessToken) {
      setError('La sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }

    if (contrasenaNueva !== confirmacionContrasena) {
      setError('La confirmación de la nueva contraseña no coincide.');
      return;
    }

    setProcesando(true);

    try {
      await cambiarContrasena(accessToken, contrasenaActual, contrasenaNueva);
      setAccessToken(null);
      setUsuario(null);
      setContrasenaActual('');
      setContrasenaNueva('');
      setConfirmacionContrasena('');
      setMostrarCambioClave(false);
      setVista('login');
      setMensaje('Contraseña actualizada. Inicia sesión nuevamente con tu nueva contraseña.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cambiar la contraseña.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <main className="page-shell">
      {vista !== 'sesion' && (
        <header className="topbar">
          <div className="brand-inline">
            <span className="brand-dot" aria-hidden="true">🌱</span>
            <div>
              <strong>Semilla</strong>
              <span>Gestión comunitaria</span>
            </div>
          </div>
        </header>
      )}

      {vista === 'inicio' && (
        <>
          <section className="hero">
            <div className="brand-mark" aria-hidden="true">🌱</div>
            <p className="eyebrow">Gestión comunitaria</p>
            <h1>Semilla</h1>
            <p className="tagline">Recursos que generan desarrollo</p>
            <p className="hero-copy">
              Una plataforma para conectar recursos, programas y personas con el impacto que generan
              en las comunidades.
            </p>
            <div className="actions">
              <button className="primary-button" type="button" onClick={() => setVista('login')}>
                Iniciar sesión
              </button>
              <span className="version-badge">Entorno de validación · Autenticación</span>
            </div>
          </section>

          <section className="pillars" aria-label="Áreas principales">
            {pillars.map((pillar) => (
              <article className="pillar-card" key={pillar.title}>
                <h2>{pillar.title}</h2>
                <p>{pillar.description}</p>
              </article>
            ))}
          </section>
        </>
      )}

      {vista === 'login' && (
        <section className="auth-layout">
          <div className="auth-copy">
            <p className="eyebrow">Acceso seguro</p>
            <h1 className="auth-title">Bienvenido a Semilla</h1>
            <p>
              Inicia sesión para validar tu identidad, rol y permisos contra el backend y Neon PostgreSQL.
            </p>
            <button className="text-button" type="button" onClick={() => setVista('inicio')}>
              ← Volver al inicio
            </button>
          </div>

          <form className="auth-card" onSubmit={handleLogin}>
            <div>
              <p className="eyebrow">Cuenta</p>
              <h2>Iniciar sesión</h2>
            </div>

            {mensaje && <div className="notice success">{mensaje}</div>}
            {error && <div className="notice error">{error}</div>}

            <label>
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@organizacion.org"
                autoComplete="username"
                required
              />
            </label>

            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                required
              />
            </label>

            <button className="primary-button full" type="submit" disabled={procesando}>
              {procesando ? 'Validando…' : 'Entrar'}
            </button>

            <p className="form-help">
              La sesión utiliza un JWT de acceso y un refresh token protegido mediante cookie HttpOnly.
            </p>
          </form>
        </section>
      )}

      {vista === 'sesion' && usuario && (
        <EstructuraAdministrativa
          barraLateral={<BarraLateral />}
          encabezado={(
            <EncabezadoAdministrativo
              correoUsuario={usuario.email}
              procesando={procesando}
              alCerrarSesion={handleLogout}
            />
          )}
          contenido={(
            <section className="dashboard-shell">
              <div className="dashboard-heading">
                <div>
                  <p className="eyebrow">Sesión autenticada</p>
                  <h1 className="dashboard-title">Hola{usuario.nombre ? `, ${usuario.nombre}` : ''}</h1>
                  <p>
                    Esta vista nos permite comprobar visualmente la autenticación, los roles y los permisos
                    entregados por el backend.
                  </p>
                </div>
                <div className="status-badge">● Sesión activa</div>
              </div>

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
                        {usuario.roles.map((rol) => <span className="role-chip" key={rol}>{rol}</span>)}
                      </dd>
                    </div>
                    <div>
                      <dt>Cambio de contraseña</dt>
                      <dd>{usuario.debeCambiarContrasena ? 'Pendiente' : 'Completado'}</dd>
                    </div>
                  </dl>

                  <div className="button-stack">
                    <button className="secondary-button" type="button" onClick={handleRefresh} disabled={procesando}>
                      Renovar sesión
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setMostrarCambioClave((actual) => !actual)}
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
                <form className="panel-card password-panel" onSubmit={handleCambioContrasena}>
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
                        onChange={(event) => setContrasenaActual(event.target.value)}
                        autoComplete="current-password"
                        required
                      />
                    </label>
                    <label>
                      Nueva contraseña
                      <input
                        type="password"
                        value={contrasenaNueva}
                        onChange={(event) => setContrasenaNueva(event.target.value)}
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
                        onChange={(event) => setConfirmacionContrasena(event.target.value)}
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
          )}
        />
      )}

      <footer>
        <span>Semilla · Plataforma de Gestión Comunitaria</span>
        <span>Las transformaciones comunitarias Surgen con la gestión adecuada de los recursos</span>
      </footer>
    </main>
  );
}

export default App;
