import { useEffect, useState, type FormEvent } from 'react';
import {
  cambiarCorreoCuenta, cambiarRolesCuenta, cambiarEstadoCuentaOrganizacion, crearCuentaOrganizacion, obtenerCuentasOrganizacion,
  reemitirCredencialTemporalCuenta,
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
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState('');
  const [crearVisible, setCrearVisible] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [seleccion, setSeleccion] = useState<string[]>(['CAMPO']);
  const [edicion, setEdicion] = useState<string | null>(null);
  const [rolesEdicion, setRolesEdicion] = useState<string[]>([]);
  const [edicionCorreo, setEdicionCorreo] = useState<string | null>(null);
  const [correoEdicion, setCorreoEdicion] = useState('');
  const [confirmandoReemision, setConfirmandoReemision] = useState<string | null>(null);
  const [confirmandoEstado, setConfirmandoEstado] = useState<string | null>(null);
  const [menuCuenta, setMenuCuenta] = useState<string | null>(null);
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
    actualizar(lista.includes(nombre)
      ? lista.filter((rol) => rol !== nombre)
      : nombre === 'DONANTE' ? ['DONANTE'] : [...lista.filter((rol) => rol !== 'DONANTE'), nombre]);
  }

  async function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando || temporal || !seleccion.length || !nombre.trim() || !apellido.trim()) return;
    setGuardando(true); setError(''); setMensaje('');
    try {
      const respuesta = await crearCuentaOrganizacion(token, { nombre: nombre.trim(), apellido: apellido.trim(), email: correo, roles: seleccion });
      setCuentas((actual) => actual ? [...actual, respuesta.cuenta].sort((a, b) => a.email.localeCompare(b.email)) : actual);
      setTemporal({ correo: respuesta.cuenta.email, clave: respuesta.contrasenaTemporal });
      setNombre(''); setApellido(''); setCorreo(''); setSeleccion(['CAMPO']); setCrearVisible(false);
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

  async function guardarCorreo(cuenta: CuentaOrganizacion) {
    if (guardando) return;
    const nuevo = correoEdicion.trim().toLowerCase();
    if (!nuevo || nuevo.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevo)) {
      setError('Ingresá un correo electrónico válido.'); return;
    }
    setGuardando(true); setError(''); setMensaje('');
    try {
      const { email } = await cambiarCorreoCuenta(token, cuenta.id, nuevo);
      setCuentas((actual) => actual?.map((item) => item.id === cuenta.id
        ? { ...item, email } : item).sort((a,b) => a.email.localeCompare(b.email)) ?? null);
      setEdicionCorreo(null); setCorreoEdicion('');
      setMensaje('Correo actualizado. Si el usuario tenía una sesión abierta, debe ingresar nuevamente.');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo actualizar el correo.');
    } finally { setGuardando(false); }
  }

  async function actualizarEstado(cuenta: CuentaOrganizacion) {
    if (guardando) return;
    setGuardando(true); setError(''); setMensaje('');
    try {
      const { activo } = await cambiarEstadoCuentaOrganizacion(token, cuenta.id, !cuenta.activo);
      setCuentas((actual) => actual?.map((item) => item.id === cuenta.id ? { ...item, activo } : item) ?? null);
      setConfirmandoEstado(null);
      setMenuCuenta(null);
      setMensaje(activo ? 'Cuenta reactivada correctamente.' : 'Cuenta desactivada; sus sesiones de renovación fueron revocadas.');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible cambiar el estado de la cuenta.');
    } finally { setGuardando(false); }
  }

  async function reemitir(cuenta: CuentaOrganizacion) {
    if (guardando || temporal) return;
    setGuardando(true);setError('');setMensaje('');
    try {
      const respuesta=await reemitirCredencialTemporalCuenta(token, cuenta.id);
      setTemporal({correo:respuesta.cuenta.email,clave:respuesta.contrasenaTemporal});
      setCuentas((actual)=>actual?.map((item)=>item.id===cuenta.id
        ? {...item,debeCambiarContrasena:true}:item)??null);
      setConfirmandoReemision(null);
      setMensaje('Contraseña anterior reemplazada. Entregá la nueva por un canal seguro.');
    } catch(fallo) {
      setError(fallo instanceof Error?fallo.message:'No fue posible emitir una credencial temporal.');
    } finally {setGuardando(false);}
  }

  return (
    <section className="cuentas-org" aria-labelledby="cuentas-org-titulo">
      <div className="cuentas-org__encabezado">
        <div>
          <h2 id="cuentas-org-titulo">Cuentas de la organización</h2>
          <p>Creá accesos y asigná perfiles de Semilla. Solo se muestran usuarios de tu organización.</p>
        </div>
        <div className="cuentas-org__acciones">
          <button type="button" disabled={guardando || Boolean(temporal)} onClick={() => setCrearVisible(true)}>
            Nuevo usuario
          </button>
          <button type="button" onClick={() => setVersion((v) => v + 1)} disabled={guardando}>Actualizar</button>
        </div>
      </div>
      {error && <p role="alert" className="cuentas-org__error">{error}</p>}
      {mensaje && <p role="status" className="cuentas-org__mensaje">{mensaje}</p>}
      {crearVisible && <div className="cuentas-org__modal-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget && !guardando) setCrearVisible(false); }}>
        <div className="cuentas-org__modal" role="dialog" aria-modal="true" aria-labelledby="titulo-crear-cuenta">
          <div className="cuentas-org__modal-encabezado">
            <div><h3 id="titulo-crear-cuenta">Crear nueva cuenta</h3><p>La cuenta pertenecerá a tu organización actual.</p></div>
            <button type="button" className="cuentas-org__secundario" disabled={guardando} onClick={() => setCrearVisible(false)} aria-label="Cerrar formulario">Cerrar</button>
          </div>
          <form className="cuentas-org__formulario" onSubmit={(evento) => void crear(evento)}>
        {error && <p role="alert" className="cuentas-org__error">{error}</p>}
        <div className="cuentas-org__nombres">
          <label>Nombre
            <input type="text" required minLength={2} maxLength={100} value={nombre}
              disabled={guardando || Boolean(temporal)} autoComplete="given-name"
              onChange={(evento) => setNombre(evento.target.value)} />
          </label>
          <label>Apellido
            <input type="text" required minLength={2} maxLength={100} value={apellido}
              disabled={guardando || Boolean(temporal)} autoComplete="family-name"
              onChange={(evento) => setApellido(evento.target.value)} />
          </label>
        </div>
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
          <div className="cuentas-org__acciones"><button type="button" className="cuentas-org__secundario" disabled={guardando} onClick={() => setCrearVisible(false)}>Cancelar</button></div>
          </form>
        </div>
      </div>}
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
        <div className="cuentas-org__filtros">
          <label>Buscar usuario
            <input type="text" value={busqueda} placeholder="Nombre o correo" onChange={(e) => setBusqueda(e.target.value)} />
          </label>
          <label>Estado
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}>
              <option value="todos">Todos</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option>
            </select>
          </label>
        </div>
        {cuentas === null && !error && <p role="status">Consultando cuentas…</p>}
        {cuentas?.length === 0 && <p>Todavía no hay usuarios en esta organización.</p>}
        {cuentas?.filter((cuenta) => (cuenta.email + ' ' + (cuenta.nombreVisible ?? '')).toLowerCase().includes(busqueda.trim().toLowerCase()) &&
          (filtroEstado === 'todos' || cuenta.activo === (filtroEstado === 'activos'))).map((cuenta) => (
          <article className="cuentas-org__cuenta" key={cuenta.id}>
            <div className="cuentas-org__identidad">
              <strong>{cuenta.nombreVisible || cuenta.email}</strong>
              {cuenta.nombreVisible && <span>{cuenta.email}</span>}
              <small>{cuenta.activo ? 'Cuenta activa' : 'Cuenta inactiva'} · {cuenta.roles.join(', ') || 'Sin roles'}</small>
            </div>
            {confirmandoEstado === cuenta.id && (
              <div className="cuentas-org__confirmacion" role="alert">
                <p>¿Querés {cuenta.activo ? 'desactivar' : 'reactivar'} la cuenta de {cuenta.email}?</p>
                <div className="cuentas-org__acciones">
                  <button type="button" disabled={guardando} onClick={() => void actualizarEstado(cuenta)}>
                    Sí, {cuenta.activo ? 'desactivar' : 'reactivar'}
                  </button>
                  <button type="button" className="cuentas-org__secundario" disabled={guardando}
                    onClick={() => setConfirmandoEstado(null)}>Cancelar</button>
                </div>
              </div>
            )}
            {confirmandoReemision === cuenta.id && (
              <div className="cuentas-org__confirmacion" role="alert">
                <p>¿Generar una nueva contraseña temporal para {cuenta.email}? La anterior dejará de funcionar.</p>
                <div className="cuentas-org__acciones">
                  <button type="button" disabled={guardando || Boolean(temporal)}
                    onClick={()=>void reemitir(cuenta)}>Sí, generar nueva credencial</button>
                  <button type="button" className="cuentas-org__secundario" disabled={guardando}
                    onClick={()=>setConfirmandoReemision(null)}>Cancelar</button>
                </div>
              </div>
            )}
            {edicionCorreo === cuenta.id && (
              <form className="cuentas-org__editor" onSubmit={(e) => { e.preventDefault(); void guardarCorreo(cuenta); }}>
                <label>Correo electrónico corregido
                  <input type="email" required maxLength={150} value={correoEdicion} disabled={guardando}
                    onChange={(e) => setCorreoEdicion(e.target.value)} />
                </label>
                <div className="cuentas-org__acciones">
                  <button type="submit" disabled={guardando}>Guardar correo</button>
                  <button type="button" className="cuentas-org__secundario" disabled={guardando}
                    onClick={() => setEdicionCorreo(null)}>Cancelar</button>
                </div>
              </form>
            )}
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
              <div className="cuentas-org__menu-contenedor">
                <button type="button" className="cuentas-org__secundario" aria-expanded={menuCuenta === cuenta.id}
                  aria-controls={`acciones-cuenta-${cuenta.id}`} disabled={guardando}
                  onClick={() => setMenuCuenta((actual) => actual === cuenta.id ? null : cuenta.id)}>
                  Acciones ···
                </button>
                {menuCuenta === cuenta.id && (
                  <div className="cuentas-org__menu" id={`acciones-cuenta-${cuenta.id}`}>
                    <button type="button" disabled={guardando || !cuenta.activo} onClick={() => {
                      setEdicion(cuenta.id); setEdicionCorreo(null); setRolesEdicion(cuenta.roles); setMenuCuenta(null);
                    }}>Editar roles</button>
                    <button type="button" disabled={guardando || !cuenta.activo} onClick={() => {
                      setEdicionCorreo(cuenta.id); setCorreoEdicion(cuenta.email); setEdicion(null); setMenuCuenta(null);
                    }}>Editar correo</button>
                    <button type="button" disabled={guardando || !cuenta.activo || Boolean(temporal)} onClick={() => {
                      setConfirmandoReemision(cuenta.id); setEdicion(null); setEdicionCorreo(null); setMenuCuenta(null);
                    }}>Reemitir contraseña temporal</button>
                    <button type="button" disabled={guardando} onClick={() => {
                      setConfirmandoEstado(cuenta.id); setConfirmandoReemision(null); setMenuCuenta(null);
                    }}>{cuenta.activo ? 'Desactivar cuenta' : 'Reactivar cuenta'}</button>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
