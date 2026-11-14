import { useEffect, useState, type FormEvent } from 'react';
import {
  inicializarSuperadmin,
  obtenerEstadoBootstrapSuperadmin,
} from '../../lib/api';

const correoInicial = 'leortiz41@gmail.com';

export default function AsistenteSuperadminInicial({
  alVolver,
  alCompletar,
}: {
  alVolver: () => void;
  alCompletar: (email: string) => void;
}) {
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [secretoInstalacion, setSecretoInstalacion] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    obtenerEstadoBootstrapSuperadmin().then(
      ({ disponible: habilitado }) => { if (vigente) setDisponible(habilitado); },
      () => { if (vigente) setDisponible(false); },
    );
    return () => { vigente = false; };
  }, []);

  async function completar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (procesando) return;
    if (contrasena !== confirmacion) {
      setError('La confirmación de la contraseña no coincide.');
      return;
    }

    setProcesando(true);
    setError('');
    try {
      const resultado = await inicializarSuperadmin(secretoInstalacion, contrasena);
      setSecretoInstalacion('');
      setContrasena('');
      setConfirmacion('');
      alCompletar(resultado.email);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible completar la configuración inicial.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <section className="auth-layout" aria-labelledby="titulo-bootstrap">
      <div className="auth-copy">
        <p className="eyebrow">Configuración única</p>
        <h1 className="auth-title" id="titulo-bootstrap">Activa el acceso de plataforma</h1>
        <p>
          Este asistente crea una sola cuenta global y se desactiva inmediatamente después.
          No crea organizaciones ni modifica cuentas existentes.
        </p>
        <ol className="bootstrap-steps">
          <li><strong>Verificá el secreto de instalación</strong><span>Se configuró fuera del repositorio en el servicio de despliegue.</span></li>
          <li><strong>Definí la contraseña</strong><span>Debe tener 12 caracteres, mayúsculas, minúsculas y números.</span></li>
          <li><strong>Ingresá a Semilla</strong><span>Luego podrás administrar organizaciones desde Superadministración.</span></li>
        </ol>
        <button className="text-button" type="button" onClick={alVolver} disabled={procesando}>
          ← Volver a iniciar sesión
        </button>
      </div>

      <form className="auth-card bootstrap-card" onSubmit={(evento) => void completar(evento)}>
        <div>
          <p className="eyebrow">Paso final</p>
          <h2>Cuenta inicial</h2>
        </div>

        {disponible === null && <div className="notice warning" role="status">Comprobando si el asistente está disponible…</div>}
        {disponible === false && (
          <div className="notice warning" role="status">
            La configuración inicial no está disponible. Puede haber sido completada o requerir preparación del entorno.
          </div>
        )}
        {error && <div className="notice error" role="alert">{error}</div>}

        {disponible && <>
          <div className="bootstrap-account" aria-label="Cuenta que se creará">
            <span>Cuenta SUPERADMINISTRADOR</span>
            <strong>{correoInicial}</strong>
          </div>

          <label>
            Secreto de instalación
            <input
              type="password"
              value={secretoInstalacion}
              onChange={(evento) => setSecretoInstalacion(evento.target.value)}
              autoComplete="off"
              maxLength={512}
              required
            />
          </label>

          <label>
            Contraseña para esta cuenta
            <input
              type="password"
              value={contrasena}
              onChange={(evento) => setContrasena(evento.target.value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={256}
              required
            />
          </label>

          <label>
            Confirmar contraseña
            <input
              type="password"
              value={confirmacion}
              onChange={(evento) => setConfirmacion(evento.target.value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={256}
              required
            />
          </label>

          <button className="primary-button full" type="submit" disabled={procesando}>
            {procesando ? 'Creando cuenta única…' : 'Crear cuenta SUPERADMINISTRADOR'}
          </button>
          <p className="form-help">El secreto y la contraseña no se guardan en el navegador. La operación se limita y queda registrada.</p>
        </>}
      </form>
    </section>
  );
}
