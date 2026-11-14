import { useEffect, useState, type FormEvent } from 'react';
import {
  cambiarRolesCuenta, crearCuentaOrganizacion, obtenerCuentasOrganizacion,
  type CuentaOrganizacion,
} from '../../lib/api';
import '../../estilos/modulos/cuentasOrganizacion.css';

const perfiles = [
  { nombre: 'ADMINISTRADOR', etiqueta: 'Administrador' },
  { nombre: 'COORDINADOR', etiqueta: 'Coordinador' },
  { nombre: 'CAMPO', etiqueta: 'Campo' },
  { nombre: 'FINANZAS', etiqueta: 'Finanzas' },
  { nombre: 'DONANTE', etiqueta: 'Donante' },
];

export default function PanelCuentasOrganizacion({
  token, rolesActivos,
}: { token: string; rolesActivos: string[] }) {
  const [cuentas, setCuentas] = useState<CuentaOrganizacion[] | null>(null);
  const [correo, setCorreo] = useState('');
  const [seleccion, setSeleccion] = useState<string[]>(['CAMPO']);
  const [edicion, setEdicion] = useState<string | null>(null);
  const [rolesEdicion, setRolesEdicion] = useState<string[]>([]);
  const [temporal, setTemporal] = useState<{ correo: string; clave: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    obtenerCuentasOrganizacion(token).then(
      (respuesta) => { if (vigente) { setCuentas(respuesta.cuentas); setError(''); } },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    );
    return () => { vigente = false; };
  }, [token, version]);

  function alternar(nombre: string, lista: string[], actualizar: (nueva: string[]) => void) {
    actualizar(lista.includes(nombre) ? lista.filter((rol) => rol !== nombre) : [...lista, nombre]);
  }

  async function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando || temporal || !seleccion.length) return;
    setGuardando(true); setError(''); setMensaje('');
    try {
      const respuesta = await crearCuentaOrganizacion(token, correo, seleccion);
      setCuentas((actual) => actual ? [...actual, respuesta.cuenta].sort((a, b) => a.email.localeCompare(b.email)) : actual);
      setTemporal({ correo: respuesta.cuenta.email, clave: respuesta.contrasenaTemporal });
      setCorreo(''); setSeleccion(['CAMPO']);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo crear la cuenta.');
    } finally { setGuardando(false); }
  }

  async function guardarRoles(cuenta: CuentaOrganizacion) {
    if (!rolesEdicion.length || guardando) return;
    setGuardando(true); setError(''); setMensaje('');
    try {
      const respuesta = await cambiarRolesCuenta(token, cuenta.id, rolesEdicion);
      setCuentas((actual) => actual?.map((item) => item.id === cuenta.id
        ? { ...item, roles: respuesta.roles } : item) ?? null);
      setEdicion(null);
      setMensaje('Roles actualizados. El usuario debe volver a iniciar sesión para actualizar sus permisos.');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudieron actualizar los roles.');
    } finally { setGuardando(false); }
  }

  return (
    <section className="cuentas-org" aria-labelledby="cuentas-org-titulo">
      <div className="cuentas-org__encabezado">
        <div>
          <h2 id="cuentas-org-titulo">Cuentas de la organización</h2>
          <p>Creá accesos y asigná perfiles de Semilla. Solo se muestran usuarios de tu organización.</p>
        </div>
        <button type="button" onClick={() => setVersion((v) => v + 1)} disabled={guardando}>Actualizar</button>
      </div>
      {error && <p role="alert" className="cuentas-org__error">{error}</p>}
      {mensaje && <p role="status" className="cuentas-org__mensaje">{mensaje}</p>}
      <form className="cuentas-org__formulario" onSubmit={(evento) => void crear(evento)}>
        <h3>Crear nueva cuenta</h3>
        <label>Correo electrónico
          <input type="email" required maxLength={150} value={correo} disabled={guardando || Boolean(temporal)}
            placeholder="usuario@organizacion.org" onChange={(evento) => setCorreo(evento.target.value)} />
        </label>
        <fieldset disabled={guardando || Boolean(temporal)}>
          <legend>Roles de acceso</legend>
          <div className="cuentas-org__roles">
            {perfiles.filter((rol) => rolesActivos.includes(rol.nombre)).map((rol) => (
              <label key={rol.nombre}>
                <input type="checkbox" checked={seleccion.includes(rol.nombre)}
                  onChange={() => alternar(rol.nombre, seleccion, setSeleccion)} />
                {rol.etiqueta}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={!seleccion.length || guardando || Boolean(temporal)}>
          {guardando ? 'Creando cuenta…' : 'Crear cuenta y contraseña temporal'}
        </button>
      </form>
      {temporal && (
        <div className="cuentas-org__temporal" role="status">
          <strong>Acceso creado: {temporal.correo}</strong>
          <p>Contraseña temporal visible una sola vez. Entregala al usuario por un medio seguro. Deberá cambiarla en su primer acceso.</p>
          <code>{temporal.clave}</code>
          <button type="button" onClick={() => setTemporal(null)}>Ya guardé la contraseña; ocultar</button>
        </div>
      )}
      <div className="cuentas-org__listado">
        <h3>Usuarios registrados ({cuentas?.length ?? 0})</h3>
        {cuentas === null && !error && <p role="status">Consultando cuentas…</p>}
        {cuentas?.length === 0 && <p>Todavía no hay usuarios en esta organización.</p>}
        {cuentas?.map((cuenta) => (
          <article className="cuentas-org__cuenta" key={cuenta.id}>
            <div className="cuentas-org__identidad">
              <strong>{cuenta.email}</strong>
              <small>{cuenta.activo ? 'Cuenta activa' : 'Cuenta inactiva'} · {cuenta.roles.join(', ') || 'Sin roles'}</small>
            </div>
            {edicion === cuenta.id ? (
              <div className="cuentas-org__editor">
                <fieldset disabled={guardando}>
                  <legend>Asignar roles</legend>
                  <div className="cuentas-org__roles">
                    {perfiles.filter((rol) => rolesActivos.includes(rol.nombre)).map((rol) => (
                      <label key={rol.nombre}>
                        <input type="checkbox" checked={rolesEdicion.includes(rol.nombre)}
                          onChange={() => alternar(rol.nombre, rolesEdicion, setRolesEdicion)} />
                        {rol.etiqueta}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="cuentas-org__acciones">
                  <button type="button" disabled={guardando || !rolesEdicion.length}
                    onClick={() => void guardarRoles(cuenta)}>Guardar roles</button>
                  <button type="button" className="cuentas-org__secundario" disabled={guardando}
                    onClick={() => setEdicion(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button type="button" className="cuentas-org__secundario" disabled={guardando || !cuenta.activo}
                onClick={() => { setEdicion(cuenta.id); setRolesEdicion(cuenta.roles); }}>
                Editar roles
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
