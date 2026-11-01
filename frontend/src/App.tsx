import { FormEvent, useEffect, useState } from 'react';
import logoSemilla from './assets/logo-semilla-app.png';
import BarraLateral from './componentes/estructura/BarraLateral';
import EncabezadoAdministrativo from './componentes/estructura/EncabezadoAdministrativo';
import EstructuraAdministrativa from './componentes/estructura/EstructuraAdministrativa';
import PaginaAuditoria from './modulos/auditoria/PaginaAuditoria';
import PaginaComunidades from './modulos/comunidades/PaginaComunidades';
import PaginaDashboard from './modulos/dashboard/PaginaDashboard';
import PaginaEvidencias from './modulos/evidencias/PaginaEvidencias';
import PaginaFamilias from './modulos/familias/PaginaFamilias';
import PaginaPagos from './modulos/pagos/PaginaPagos';
import PaginaPerfilSeguridad from './modulos/perfil/PaginaPerfilSeguridad';
import PaginaProyectos from './modulos/proyectos/PaginaProyectos';
import PaginaUsuarios from './modulos/usuarios/PaginaUsuarios';
import type { SeccionAdministrativa, SubseccionComunidades } from './tipos/navegacion';
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
  const [seccionAdministrativa, setSeccionAdministrativa] = useState<SeccionAdministrativa>('dashboard');
  const [subseccionComunidades, setSubseccionComunidades] = useState<SubseccionComunidades>('listado');
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
        setSeccionAdministrativa('dashboard');
        setSubseccionComunidades('listado');
        setMostrarCambioClave(sesion.usuario.debeCambiarContrasena);
      })
      .catch(() => {
        // No tener cookie activa al abrir la app es un estado normal.
      });

    return () => {
      activo = false;
    };
  }, []);

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
      setSeccionAdministrativa('dashboard');
      setSubseccionComunidades('listado');
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
      setSeccionAdministrativa('dashboard');
      setSubseccionComunidades('listado');
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
      setSeccionAdministrativa('dashboard');
      setSubseccionComunidades('listado');
      setVista('login');
      setMensaje('Contraseña actualizada. Inicia sesión nuevamente con tu nueva contraseña.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cambiar la contraseña.');
    } finally {
      setProcesando(false);
    }
  }

  function renderizarSeccionAdministrativa() {
    switch (seccionAdministrativa) {
      case 'comunidades':
        return (
          <PaginaComunidades
            subseccion={subseccionComunidades}
            alCambiarSubseccion={setSubseccionComunidades}
          />
        );
      case 'familias':
        return <PaginaFamilias />;
      case 'proyectos':
        return <PaginaProyectos />;
      case 'evidencias':
        return <PaginaEvidencias />;
      case 'pagos':
        return <PaginaPagos />;
      case 'usuarios':
        return <PaginaUsuarios />;
      case 'auditoria':
        return <PaginaAuditoria />;
      case 'perfil':
        if (!usuario) return null;

        return (
          <PaginaPerfilSeguridad
            usuario={usuario}
            mensaje={mensaje}
            error={error}
            procesando={procesando}
            mostrarCambioClave={mostrarCambioClave}
            contrasenaActual={contrasenaActual}
            contrasenaNueva={contrasenaNueva}
            confirmacionContrasena={confirmacionContrasena}
            alVolverDashboard={() => setSeccionAdministrativa('dashboard')}
            alRenovarSesion={handleRefresh}
            alAlternarCambioClave={() => setMostrarCambioClave((actual) => !actual)}
            alCambiarContrasena={handleCambioContrasena}
            alCambiarContrasenaActual={setContrasenaActual}
            alCambiarContrasenaNueva={setContrasenaNueva}
            alCambiarConfirmacionContrasena={setConfirmacionContrasena}
          />
        );
      case 'dashboard':
      default:
        return <PaginaDashboard tokenAcceso={accessToken} />;
    }
  }

  return (
    <main className={`page-shell${vista === 'inicio' ? ' page-shell--inicio' : ''}`}>
      {vista !== 'sesion' && (
        <header className="topbar">
          <div className="brand-inline">
            <img className="brand-dot" src={logoSemilla} alt="Logo de Semilla" />
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
            <img className="brand-mark" src={logoSemilla} alt="Logo de Semilla" />
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
          barraLateral={(
            <BarraLateral
              seccionActiva={seccionAdministrativa === 'perfil' ? undefined : seccionAdministrativa}
              subseccionComunidades={subseccionComunidades}
              alCambiarSeccion={setSeccionAdministrativa}
              alCambiarSubseccionComunidades={setSubseccionComunidades}
            />
          )}
          encabezado={(
            <EncabezadoAdministrativo
              correoUsuario={usuario.email}
              procesando={procesando}
              alAbrirPerfil={() => setSeccionAdministrativa('perfil')}
              alCerrarSesion={handleLogout}
            />
          )}
          contenido={renderizarSeccionAdministrativa()}
        />
      )}

      <footer>
        <div className="footer__identidad">
          <span>Semilla · Plataforma de Gestión Comunitaria</span>
          <span>Las transformaciones comunitarias Surgen con la gestión adecuada de los recursos</span>
        </div>
        <div className="footer__creditos">
          <span>© 2026 Semilla · Todos los derechos reservados</span>
          <span>Milton Ortiz · Fase I</span>
        </div>
      </footer>
    </main>
  );
}

export default App;
