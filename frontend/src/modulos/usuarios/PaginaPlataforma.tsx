import { useEffect, useState, type FormEvent } from 'react';
import {
  cambiarCorreoCuentaPlataforma, cambiarRolesCuentaPlataforma, cambiarEstadoOrganizacionPlataforma, cambiarEstadoCuentaPlataforma, crearCuentaPlataforma, crearOrganizacionPlataforma, obtenerCuentasPlataforma,
  obtenerOrganizacionesPlataforma, type CuentaOrganizacion, type OrganizacionPlataforma,
} from '../../lib/api';
import PanelCredencialesTemporales from './PanelCredencialesTemporales';
import '../../estilos/modulos/cuentasOrganizacion.css';

const perfiles = [
  { codigo: 'ADMINISTRADOR', etiqueta: 'Administrador' },
  { codigo: 'COORDINADOR', etiqueta: 'Coordinador' },
  { codigo: 'CAMPO', etiqueta: 'Campo' },
  { codigo: 'FINANZAS', etiqueta: 'Finanzas' },
  { codigo: 'DONANTE', etiqueta: 'Donante' },
];

export default function PaginaPlataforma({ token }: { token: string }) {
  const [organizaciones, setOrganizaciones] = useState<OrganizacionPlataforma[]>([]);
  const [organizacionId, setOrganizacionId] = useState('');
  const [cuentas, setCuentas] = useState<CuentaOrganizacion[]>([]);
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [emailContacto, setEmailContacto] = useState('');
  const [correo, setCorreo] = useState('');
  const [roles, setRoles] = useState<string[]>(['ADMINISTRADOR']);
  const [edicionId, setEdicionId] = useState<string | null>(null);
  const [rolesEdicion, setRolesEdicion] = useState<string[]>([]);
  const [edicionCorreo, setEdicionCorreo] = useState<string | null>(null);
  const [correoEdicion, setCorreoEdicion] = useState('');
  const [credencial, setCredencial] = useState<{ email: string; temporal: string; titulo: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [version, setVersion] = useState(0);
  const [filtroRol, setFiltroRol] = useState('TODOS');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [confirmacion, setConfirmacion] = useState<{tipo:'organizacion'|'cuenta';id:string;nombre:string;activo:boolean}|null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerOrganizacionesPlataforma(token).then(
      ({ organizaciones: lista }) => {
        if (vigente) {
          setOrganizaciones(lista);
          setOrganizacionId((prev) => lista.some((o) => o.id === prev) ? prev : (lista[0]?.id ?? ''));
        }
      },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    );
    return () => { vigente = false; };
  }, [token, version]);

  useEffect(() => {
    if (!organizacionId) { setCuentas([]); return; }
    let vigente = true;
    obtenerCuentasPlataforma(token, organizacionId).then(
      ({ cuentas: lista }) => { if (vigente) setCuentas(lista); },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    );
    return () => { vigente = false; };
  }, [token, organizacionId, version]);

  async function registrarOrganizacion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado) return;
    setOcupado(true); setError(''); setMensaje('');
    try {
      const { organizacion } = await crearOrganizacionPlataforma(token, { nombre, slug, emailContacto });
      setNombre(''); setSlug(''); setEmailContacto('');
      setOrganizacionId(organizacion.id);
      setVersion((v) => v + 1);
      setMensaje('Organización registrada. Creá ahora su primera cuenta administradora.');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible crear la organización.');
    } finally { setOcupado(false); }
  }

  function alternarRol(rol: string) {
    setRoles((actual) => actual.includes(rol) ? actual.filter((r) => r !== rol) :
      rol === 'DONANTE' ? ['DONANTE'] : [...actual.filter((r) => r !== 'DONANTE'), rol]);
  }

  async function registrarCuenta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado || credencial || !organizacionId || !roles.length) return;
    setOcupado(true); setError(''); setMensaje('');
    try {
      const respuesta = await crearCuentaPlataforma(token, organizacionId, correo, roles);
      setCorreo(''); setRoles(['ADMINISTRADOR']);
      setCredencial({
        email: respuesta.cuenta.email,
        temporal: respuesta.contrasenaTemporal,
        titulo: 'Cuenta creada',
      });
      setVersion((v) => v + 1);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible crear la cuenta.');
    } finally { setOcupado(false); }
  }

  async function guardarRoles(cuenta: CuentaOrganizacion) {
    if (!organizacionId || !rolesEdicion.length || ocupado) return;
    setOcupado(true); setError(''); setMensaje('');
    try {
      const respuesta = await cambiarRolesCuentaPlataforma(token, organizacionId, cuenta.id, rolesEdicion);
      setCuentas((actual) => actual.map((item) => item.id === cuenta.id
        ? { ...item, roles: respuesta.roles } : item));
      setEdicionId(null);
      setMensaje('Roles guardados. El usuario debe volver a iniciar sesión para actualizar sus permisos.');
      setVersion((v) => v + 1);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible guardar los roles.');
    } finally { setOcupado(false); }
  }

  async function guardarCorreo(cuenta: CuentaOrganizacion) {
    if (!organizacionId || ocupado) return;
    const nuevo=correoEdicion.trim().toLowerCase();
    if (!nuevo || nuevo.length>150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevo)) {
      setError('Ingresá un correo electrónico válido.');return;
    }
    setOcupado(true);setError('');setMensaje('');
    try {
      const {email}=await cambiarCorreoCuentaPlataforma(token,organizacionId,cuenta.id,nuevo);
      setCuentas((actual)=>actual.map((item)=>item.id===cuenta.id?{...item,email}:item)
        .sort((a,b)=>a.email.localeCompare(b.email)));
      setEdicionCorreo(null);setCorreoEdicion('');
      setMensaje('Correo actualizado. Las sesiones anteriores del usuario se revocaron.');
    } catch(fallo) {
      setError(fallo instanceof Error?fallo.message:'No fue posible actualizar el correo.');
    } finally {setOcupado(false);}
  }

  async function cambiarEstadoConfirmado() {
    if (!confirmacion || ocupado || !organizacionId) return;
    setOcupado(true);setError('');setMensaje('');
    try {
      if(confirmacion.tipo==='organizacion') {
        await cambiarEstadoOrganizacionPlataforma(token,confirmacion.id,confirmacion.activo);
        setOrganizaciones((actual)=>actual.map((o)=>o.id===confirmacion.id?{...o,activo:confirmacion.activo}:o));
        setMensaje(confirmacion.activo?'Organización reactivada.':'Organización desactivada: sus cuentas no podrán iniciar nuevas sesiones.');
      } else {
        await cambiarEstadoCuentaPlataforma(token,organizacionId,confirmacion.id,confirmacion.activo);
        setCuentas((actual)=>actual.map((u)=>u.id===confirmacion.id?{...u,activo:confirmacion.activo}:u));
        setMensaje(confirmacion.activo?'Cuenta activada.':'Cuenta desactivada.');
      }
      setConfirmacion(null);
      setVersion((v)=>v+1);
    } catch(fallo) {
      setError(fallo instanceof Error?fallo.message:'No fue posible modificar el estado.');
    } finally {setOcupado(false);}
  }

  const cuentasFiltradas=cuentas.filter((cuenta)=>
    (filtroRol==='TODOS'||cuenta.roles.includes(filtroRol)) &&
    (filtroEstado==='TODOS'||(filtroEstado==='ACTIVOS' ? cuenta.activo : !cuenta.activo))
  );
  const resumenRoles=perfiles.map((perfil)=>({
    ...perfil,total:cuentas.filter((cuenta)=>cuenta.roles.includes(perfil.codigo)).length,
  }));

  const seleccionada = organizaciones.find((o) => o.id === organizacionId);
  return (
    <section className="pagina-modulo cuentas-org" aria-labelledby="titulo-plataforma">
      <div className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Acceso exclusivo de plataforma</p>
        <h1 id="titulo-plataforma">Superadministración</h1>
        <p>Administrá organizaciones independientes y creá sus cuentas de acceso. Los administradores de cada organización gestionarán sus equipos desde Usuarios.</p>
      </div>
      {error && <p role="alert" className="cuentas-org__error">{error}</p>}
      {mensaje && <p role="status" className="cuentas-org__mensaje">{mensaje}</p>}
      <form className="cuentas-org__formulario" onSubmit={(e) => void registrarOrganizacion(e)}>
        <h2>Registrar organización</h2>
        <label>Nombre
          <input type="text" required maxLength={150} value={nombre} disabled={ocupado}
            placeholder="Nombre de la organización" onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label>Identificador (slug)
          <input type="text" required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug} disabled={ocupado} placeholder="nombre-organizacion"
            onChange={(e) => setSlug(e.target.value.toLowerCase())} />
        </label>
        <label>Correo de contacto (opcional)
          <input type="email" maxLength={150} value={emailContacto} disabled={ocupado}
            placeholder="contacto@organizacion.org" onChange={(e) => setEmailContacto(e.target.value)} />
        </label>
        <button type="submit" disabled={ocupado}>Crear organización</button>
      </form>
      <div className="cuentas-org__formulario">
        <div className="cuentas-org__encabezado">
          <h2>Gestionar cuentas por organización</h2>
          <button type="button" className="cuentas-org__secundario"
            disabled={ocupado} onClick={() => setVersion((v) => v + 1)}>Actualizar</button>
        </div>
        <label>Organización
          <select value={organizacionId} disabled={ocupado}
            onChange={(e) => { setOrganizacionId(e.target.value); setEdicionId(null); setEdicionCorreo(null); setFiltroRol('TODOS'); setFiltroEstado('TODOS'); setConfirmacion(null); setError(''); setMensaje(''); }}>
            <option value="">Seleccioná una organización</option>
            {organizaciones.map((o) =>
              <option value={o.id} key={o.id}>{o.nombre}{!o.activo ? ' (inactiva)' : ''}</option>)}
          </select>
        </label>
        {seleccionada && (
          <div className="cuentas-org__formulario">
            <p><strong>{seleccionada.nombre}</strong> · Tenant ID: <code>{seleccionada.id}</code> ·
              {seleccionada.cantidadUsuarios} usuarios · {seleccionada.cantidadAdministradores} administradores ·
              {seleccionada.activo?' Organización activa':' Organización inactiva'}</p>
            <button type="button" className="cuentas-org__secundario" disabled={ocupado}
              onClick={()=>setConfirmacion({tipo:'organizacion',id:seleccionada.id,nombre:seleccionada.nombre,activo:!seleccionada.activo})}>
              {seleccionada.activo?'Desactivar organización':'Reactivar organización'}
            </button>
          </div>
        )}
        {confirmacion && (
          <div className="cuentas-org__confirmacion" role="alert">
            <p><strong>{confirmacion.activo?'Confirmar activación':'Confirmar desactivación'}:</strong> {confirmacion.nombre}.</p>
            {!confirmacion.activo && <p>Se revocarán las sesiones renovables. No se eliminarán datos, cuentas ni roles.</p>}
            <div className="cuentas-org__acciones">
              <button type="button" disabled={ocupado} onClick={()=>void cambiarEstadoConfirmado()}>
                {ocupado?'Procesando…':confirmacion.activo?'Sí, activar':'Sí, desactivar'}
              </button>
              <button type="button" className="cuentas-org__secundario" disabled={ocupado}
                onClick={()=>setConfirmacion(null)}>Cancelar</button>
            </div>
          </div>
        )}
        {seleccionada && (
          <section className="cuentas-org__formulario" aria-label="Roles y cuentas de la organización">
            <h3>Roles asociados a {seleccionada.nombre}</h3>
            <p>Se muestran las asignaciones de usuarios de esta organización, no los roles globales de otras organizaciones.</p>
            <div className="cuentas-org__roles">
              {resumenRoles.map((rol)=><span key={rol.codigo}>{rol.etiqueta}: <strong>{rol.total}</strong></span>)}
            </div>
            <div className="cuentas-org__acciones">
              <label>Filtrar por rol
                <select value={filtroRol} onChange={(e)=>setFiltroRol(e.target.value)}>
                  <option value="TODOS">Todos los roles</option>
                  {perfiles.map((rol)=><option key={rol.codigo} value={rol.codigo}>{rol.etiqueta}</option>)}
                </select>
              </label>
              <label>Filtrar por estado
                <select value={filtroEstado} onChange={(e)=>setFiltroEstado(e.target.value)}>
                  <option value="TODOS">Todos los estados</option>
                  <option value="ACTIVOS">Activos</option>
                  <option value="INACTIVOS">Inactivos</option>
                </select>
              </label>
            </div>
          </section>
        )}
        {seleccionada && (
          <PanelCredencialesTemporales
            token={token}
            organizacion={seleccionada}
            cuentas={cuentas}
            bloqueado={ocupado}
            hayCredencialVisible={Boolean(credencial)}
            alEmitir={({ email, temporal }) => {
              setCredencial({ email, temporal, titulo: 'Nueva credencial emitida' });
              setMensaje('La contraseña anterior fue reemplazada. Compartí la nueva credencial solo por un canal seguro.');
            }}
            alActualizar={() => setVersion((v) => v + 1)}
            alError={setError}
          />
        )}
        {seleccionada && (
          <form className="cuentas-org__formulario" onSubmit={(e) => void registrarCuenta(e)}>
            <h3>Nueva cuenta</h3>
            <label>Correo del usuario
              <input type="email" required maxLength={150} value={correo}
                disabled={ocupado || Boolean(credencial) || !seleccionada.activo}
                onChange={(e) => setCorreo(e.target.value)} />
            </label>
            <fieldset disabled={ocupado || Boolean(credencial) || !seleccionada.activo}>
              <legend>Asignar perfiles</legend>
              <div className="cuentas-org__roles">
                {perfiles.map((rol) => (
                  <label key={rol.codigo}>
                    <input type="checkbox" checked={roles.includes(rol.codigo)}
                      onChange={() => alternarRol(rol.codigo)} />
                    {rol.etiqueta}
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" disabled={ocupado || !roles.length || Boolean(credencial) || !seleccionada.activo}>
              Crear cuenta y contraseña temporal
            </button>
          </form>
        )}
        {credencial && <div className="cuentas-org__temporal" role="status">
          <strong>{credencial.titulo}: {credencial.email}</strong>
          <p>Contraseña temporal visible una sola vez. Compartila únicamente por un canal seguro.</p>
          <code>{credencial.temporal}</code>
          <button type="button" onClick={() => setCredencial(null)}>Ocultar contraseña</button>
        </div>}
        <h3>Usuarios de la organización ({cuentasFiltradas.length} de {cuentas.length})</h3>
        {cuentasFiltradas.length===0 && <p>No hay usuarios para los filtros seleccionados.</p>}
        {cuentasFiltradas.map((cuenta) => (
          <div className="cuentas-org__cuenta" key={cuenta.id}>
            <div className="cuentas-org__identidad">
              <strong>{cuenta.email}</strong>
              <small>{cuenta.activo ? 'Activa' : 'Inactiva'} · {cuenta.roles.join(', ') || 'Sin roles'}</small>
            </div>
            {!cuenta.roles.includes('SUPERADMINISTRADOR') && (
              <button type="button" className="cuentas-org__secundario" disabled={ocupado}
                onClick={()=>setConfirmacion({tipo:'cuenta',id:cuenta.id,nombre:cuenta.email,activo:!cuenta.activo})}>
                {cuenta.activo?'Desactivar cuenta':'Activar cuenta'}
              </button>
            )}
            {edicionCorreo === cuenta.id && (
              <form className="cuentas-org__editor" onSubmit={(e)=>{e.preventDefault();void guardarCorreo(cuenta);}}>
                <label>Correo electrónico corregido
                  <input type="email" required maxLength={150} value={correoEdicion} disabled={ocupado}
                    onChange={(e)=>setCorreoEdicion(e.target.value)} />
                </label>
                <div className="cuentas-org__acciones">
                  <button type="submit" disabled={ocupado}>Guardar correo</button>
                  <button type="button" className="cuentas-org__secundario" disabled={ocupado}
                    onClick={()=>setEdicionCorreo(null)}>Cancelar</button>
                </div>
              </form>
            )}
            {!cuenta.roles.includes('SUPERADMINISTRADOR') && cuenta.activo && (
              edicionId === cuenta.id ? (
                <div className="cuentas-org__editor">
                  <fieldset disabled={ocupado}>
                    <legend>Editar perfiles de la cuenta</legend>
                    <div className="cuentas-org__roles">
                      {perfiles.map((rol) => (
                        <label key={rol.codigo}>
                          <input type="checkbox" checked={rolesEdicion.includes(rol.codigo)}
                            onChange={() => setRolesEdicion((actual) => actual.includes(rol.codigo)
                              ? actual.filter((r) => r !== rol.codigo)
                              : rol.codigo === 'DONANTE' ? ['DONANTE']
                              : [...actual.filter((r) => r !== 'DONANTE'), rol.codigo])} />
                          {rol.etiqueta}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="cuentas-org__acciones">
                    <button type="button" disabled={ocupado || !rolesEdicion.length}
                      onClick={() => void guardarRoles(cuenta)}>Guardar perfiles</button>
                    <button type="button" className="cuentas-org__secundario"
                      onClick={() => setEdicionId(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="cuentas-org__acciones">
                  <button type="button" className="cuentas-org__secundario" disabled={ocupado || edicionCorreo===cuenta.id}
                    onClick={() => { setEdicionId(cuenta.id); setEdicionCorreo(null); setRolesEdicion(cuenta.roles); }}>
                    Editar perfiles
                  </button>
                  <button type="button" className="cuentas-org__secundario" disabled={ocupado || edicionCorreo===cuenta.id}
                    onClick={() => { setEdicionCorreo(cuenta.id); setCorreoEdicion(cuenta.email); setEdicionId(null); }}>
                    Editar correo
                  </button>
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
