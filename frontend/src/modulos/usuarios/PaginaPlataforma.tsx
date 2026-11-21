import { useEffect, useState, type FormEvent } from 'react';
import {
  cambiarCorreoCuentaPlataforma, cambiarNombreCuentaPlataforma, retirarCuentaPlataforma, reemitirCredencialTemporalPlataforma,
  cambiarRolesCuentaPlataforma, cambiarEstadoOrganizacionPlataforma, cambiarEstadoCuentaPlataforma, crearCuentaPlataforma, crearOrganizacionPlataforma, obtenerCuentasPlataforma,
  obtenerOrganizacionesPlataforma, obtenerDashboardSaas, type IndicadoresSaas, type CuentaOrganizacion, type OrganizacionPlataforma,
} from '../../lib/api';
import PanelCredencialesTemporales from './PanelCredencialesTemporales';
import PanelPermisosTenant from './PanelPermisosTenant';
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
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [apellidoUsuario, setApellidoUsuario] = useState('');
  const [roles, setRoles] = useState<string[]>(['ADMINISTRADOR']);
  const [edicionId, setEdicionId] = useState<string | null>(null);
  const [menuCuenta, setMenuCuenta] = useState<string | null>(null);
  const [edicionNombre, setEdicionNombre] = useState<string | null>(null);
  const [nombreEdicion, setNombreEdicion] = useState('');
  const [confirmandoCredencial, setConfirmandoCredencial] = useState<string | null>(null);
  const [confirmandoRetiro, setConfirmandoRetiro] = useState<string | null>(null);
  const [rolesEdicion, setRolesEdicion] = useState<string[]>([]);
  const [edicionCorreo, setEdicionCorreo] = useState<string | null>(null);
  const [correoEdicion, setCorreoEdicion] = useState('');
  const [credencial, setCredencial] = useState<{ email: string; temporal: string; titulo: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [version, setVersion] = useState(0);
  const [pestana, setPestana] = useState<'dashboard' | 'cuentas' | 'organizaciones' | 'permisos'>('dashboard');
  const [indicadores, setIndicadores] = useState<IndicadoresSaas | null>(null);
  const [errorIndicadores, setErrorIndicadores] = useState('');
  const [busqueda, setBusqueda] = useState('');
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

  useEffect(() => {
    let vigente = true;
    obtenerDashboardSaas(token).then(
      (datos) => { if(vigente) { setIndicadores(datos); setErrorIndicadores(''); } },
      (fallo: Error) => { if(vigente) setErrorIndicadores(fallo.message); },
    );
    return () => { vigente = false; };
  }, [token, version]);

  async function registrarOrganizacion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado) return;
    setOcupado(true); setError(''); setMensaje('');
    try {
      const { organizacion } = await crearOrganizacionPlataforma(token, { nombre, slug, emailContacto });
      setNombre(''); setSlug(''); setEmailContacto('');
      setOrganizacionId(organizacion.id);
      setVersion((v) => v + 1);
      setPestana('cuentas');
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
    const nombreLimpio = nombreUsuario.trim().replace(/\s+/g, ' ');
    const apellidoLimpio = apellidoUsuario.trim().replace(/\s+/g, ' ');
    if (nombreLimpio.length < 2 || apellidoLimpio.length < 2 ||
        `${nombreLimpio} ${apellidoLimpio}`.length > 140) {
      setError('Ingresá un nombre y apellido válidos (mínimo 2 caracteres cada uno).'); return;
    }
    setOcupado(true); setError(''); setMensaje('');
    try {
      const respuesta = await crearCuentaPlataforma(token, organizacionId, {
        nombre: nombreLimpio, apellido: apellidoLimpio, email: correo, roles,
      });
      setNombreUsuario(''); setApellidoUsuario(''); setCorreo(''); setRoles(['ADMINISTRADOR']);
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

  async function guardarNombre(cuenta: CuentaOrganizacion) {
    if (!organizacionId || ocupado) return;
    const nuevo=nombreEdicion.trim().replace(/\s+/g,' ');
    if(nuevo.length<2||nuevo.length>140){setError('Ingresá un nombre de 2 a 140 caracteres.');return;}
    setOcupado(true);setError('');setMensaje('');
    try {
      const {nombreVisible}=await cambiarNombreCuentaPlataforma(token,organizacionId,cuenta.id,nuevo);
      setCuentas((actual)=>actual.map((item)=>item.id===cuenta.id?{...item,nombreVisible}:item));
      setEdicionNombre(null);setNombreEdicion('');
      setMensaje('Nombre visible actualizado correctamente.');
    }catch(error){setError(error instanceof Error?error.message:'No se pudo editar el nombre.');}
    finally{setOcupado(false);}
  }

  async function reemitirDesdeCuenta(cuenta: CuentaOrganizacion) {
    if (!organizacionId || ocupado || credencial) return;
    setOcupado(true);setError('');setMensaje('');
    try {
      const respuesta=await reemitirCredencialTemporalPlataforma(token,organizacionId,cuenta.id);
      setCredencial({email:respuesta.cuenta.email,temporal:respuesta.contrasenaTemporal,titulo:'Nueva credencial emitida'});
      setConfirmandoCredencial(null);
      setVersion((v)=>v+1);
      setMensaje('Credencial renovada. Entregala mediante un canal seguro.');
    }catch(error){setError(error instanceof Error?error.message:'No se pudo reemitir la credencial.');}
    finally{setOcupado(false);}
  }

  async function retirarDesdePlataforma(cuenta: CuentaOrganizacion) {
    if(!organizacionId||ocupado)return;
    setOcupado(true);setError('');setMensaje('');
    try {
      await retirarCuentaPlataforma(token,organizacionId,cuenta.id);
      setCuentas((actual)=>actual.map((u)=>u.id===cuenta.id?{...u,activo:false,retirado:true}:u));
      setConfirmandoRetiro(null);setMenuCuenta(null);
      setMensaje('Cuenta retirada. Se revocó el acceso y se conservó el historial.');
      setVersion((v)=>v+1);
    }catch(error){setError(error instanceof Error?error.message:'No se pudo retirar la cuenta.');}
    finally{setOcupado(false);}
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

  const cuentasVigentes = cuentas.filter((cuenta) => !cuenta.retirado);
  const retiradas = cuentas.filter((cuenta) => cuenta.retirado);
  const cuentasFiltradas = cuentas.filter((cuenta) =>
    (filtroEstado === 'RETIRADOS' ? Boolean(cuenta.retirado) :
      !cuenta.retirado && (filtroEstado === 'TODOS' ||
        (filtroEstado === 'ACTIVOS' ? cuenta.activo : !cuenta.activo))) &&
    (filtroRol === 'TODOS' || cuenta.roles.includes(filtroRol)) &&
    (cuenta.email + ' ' + (cuenta.nombreVisible ?? '')).toLowerCase().includes(busqueda.trim().toLowerCase())
  );
  const resumenRoles = perfiles.map((perfil) => ({
    ...perfil, total: cuentasVigentes.filter((cuenta) => cuenta.roles.includes(perfil.codigo)).length,
  }));

  const seleccionada = organizaciones.find((o) => o.id === organizacionId);
  return (
    <section className="pagina-modulo cuentas-org" aria-labelledby="titulo-plataforma">
      <div className="pagina-modulo__encabezado">
        <p className="pagina-modulo__etiqueta">Acceso exclusivo de plataforma</p>
        <h1 id="titulo-plataforma">Superadministración</h1>
        <p>Control de organizaciones, cuentas y seguridad. Cada organización administra sus equipos desde Usuarios.</p>
      </div>
      <div className="plataforma-resumen" aria-label="Resumen de organizaciones">
        <div><strong>{organizaciones.length}</strong><span>Organizaciones</span></div>
        <div><strong>{organizaciones.filter((o) => o.activo).length}</strong><span>Activas</span></div>
        <div><strong>{organizaciones.filter((o) => !o.activo).length}</strong><span>Suspendidas</span></div>
      </div>
      <nav className="plataforma-pestanas" aria-label="Secciones de Superadministración">
        <button type="button" aria-current={pestana === 'dashboard' ? 'page' : undefined}
          onClick={() => { setPestana('dashboard'); setConfirmacion(null); }}>Dashboard SaaS</button>
        <button type="button" aria-current={pestana === 'cuentas' ? 'page' : undefined} onClick={() => { setPestana('cuentas'); setConfirmacion(null); }}>Cuentas y accesos</button>
        <button type="button" aria-current={pestana === 'organizaciones' ? 'page' : undefined} onClick={() => { setPestana('organizaciones'); setConfirmacion(null); }}>Organizaciones</button>
        <button type="button" aria-current={pestana === 'permisos' ? 'page' : undefined} onClick={() => { setPestana('permisos'); setConfirmacion(null); }}>Roles y permisos</button>
      </nav>
      {error && <p role="alert" className="cuentas-org__error">{error}</p>}
      {mensaje && <p role="status" className="cuentas-org__mensaje">{mensaje}</p>}
      {pestana === 'dashboard' && (
        <section className="plataforma-dashboard" aria-label="Dashboard global del SaaS">
          <div className="plataforma-dashboard__encabezado">
            <div><h2>Estado general del SaaS</h2>
              <p>Estadísticas reales de Neon PostgreSQL, agrupadas por organización.</p></div>
            <button type="button" className="cuentas-org__secundario" disabled={ocupado}
              onClick={() => setVersion((actual) => actual + 1)}>Actualizar indicadores</button>
          </div>
          {errorIndicadores && <p role="alert" className="cuentas-org__error">{errorIndicadores}</p>}
          {!indicadores && !errorIndicadores && <p role="status">Consultando indicadores…</p>}
          {indicadores && (
            <>
              <div className="plataforma-dashboard__metricas">
                {([
                  ['Organizaciones', indicadores.totales.organizaciones],
                  ['Organizaciones activas', indicadores.totales.activas],
                  ['Organizaciones suspendidas', indicadores.totales.suspendidas],
                  ['Usuarios vigentes', indicadores.totales.usuariosVigentes],
                  ['Usuarios activos', indicadores.totales.usuariosActivos],
                  ['Usuarios retirados', indicadores.totales.usuariosRetirados],
                  ['Comunidades', indicadores.totales.comunidades],
                  ['Proyectos', indicadores.totales.proyectos],
                  ['Evidencias', indicadores.totales.evidencias],
                ] as [string, number][]).map(([etiqueta, total]) => (
                  <div className="plataforma-dashboard__metrica" key={etiqueta}>
                    <span>{etiqueta}</span><strong>{total}</strong>
                  </div>
                ))}
              </div>
              <h3>Organizaciones y uso de la plataforma</h3>
              <div className="plataforma-dashboard__tenants">
                {indicadores.organizaciones.map((tenant) => (
                  <article className="plataforma-dashboard__tenant" key={tenant.id}>
                    <div className="plataforma-dashboard__encabezado">
                      <div><h4>{tenant.nombre}</h4><span>{tenant.activo ? 'Activa' : 'Suspendida'} · {tenant.slug}</span></div>
                      <button type="button" className="cuentas-org__secundario"
                        onClick={() => {setOrganizacionId(tenant.id);setPestana('organizaciones');}}>
                        Ver ficha del tenant
                      </button>
                    </div>
                    <div className="plataforma-dashboard__datos">
                      <span>Usuarios vigentes: <strong>{tenant.usuariosVigentes}</strong></span>
                      <span>Activos: <strong>{tenant.usuariosActivos}</strong></span>
                      <span>Retirados: <strong>{tenant.usuariosRetirados}</strong></span>
                      <span>Comunidades: <strong>{tenant.comunidades}</strong></span>
                      <span>Proyectos: <strong>{tenant.proyectos}</strong></span>
                      <span>Evidencias: <strong>{tenant.evidencias}</strong></span>
                    </div>
                    <details><summary>Detalles técnicos del tenant</summary>
                      <p>Tenant ID: <code>{tenant.id}</code></p>
                      <p>Último acceso de usuario: {tenant.ultimoAcceso
                        ? new Date(tenant.ultimoAcceso).toLocaleString('es-HN')
                        : 'Sin registro'}</p>
                    </details>
                  </article>
                ))}
              </div>
              <p className="plataforma-dashboard__fecha">Actualizado: {new Date(indicadores.consultadoEn).toLocaleString('es-HN')}</p>
            </>
          )}
        </section>
      )}
      {pestana === 'organizaciones' && <div className="plataforma-organizaciones">
        {organizaciones.map((o) => (
          <button type="button" key={o.id} aria-pressed={organizacionId === o.id}
            onClick={() => { setOrganizacionId(o.id); setConfirmacion(null); }}>
            <strong>{o.nombre}</strong>
            <span>{o.activo ? 'Activa' : 'Suspendida'} · {o.cantidadUsuarios} cuentas</span>
          </button>
        ))}
      </div>}
      {pestana === 'organizaciones' && <details className="plataforma-desplegable"><summary>Registrar nueva organización</summary>
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
      </form></details>}
      {pestana === 'permisos' && (
        <section className="plataforma-dashboard">
          <div className="plataforma-dashboard__encabezado">
            <div><h2>Permisos por organización</h2>
              <p>Elegí el tenant para consultar y configurar restricciones individuales.</p></div>
          </div>
          <label>Organización
            <select value={organizacionId} onChange={e=>setOrganizacionId(e.target.value)}>
              <option value="">Seleccioná una organización</option>
              {organizaciones.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </label>
          {organizacionId && <PanelPermisosTenant key={organizacionId} token={token}
            organizacionId={organizacionId}
            nombreOrganizacion={organizaciones.find(o=>o.id===organizacionId)?.nombre||'Organización'}/>}
        </section>
      )}
      {(pestana === 'cuentas' || pestana === 'organizaciones') && <div className="cuentas-org__formulario plataforma-panel">
        <div className="cuentas-org__encabezado">
          <h2>{pestana === 'cuentas' ? 'Cuentas por organización' : 'Organización seleccionada'}</h2>
          <button type="button" className="cuentas-org__secundario"
            disabled={ocupado} onClick={() => setVersion((v) => v + 1)}>Actualizar</button>
        </div>
        <label>Organización
          <select value={organizacionId} disabled={ocupado}
            onChange={(e) => { setOrganizacionId(e.target.value); setEdicionId(null); setEdicionCorreo(null); setFiltroRol('TODOS'); setFiltroEstado('TODOS'); setBusqueda(''); setConfirmacion(null); setConfirmandoRetiro(null); setConfirmandoCredencial(null); setEdicionNombre(null); setMenuCuenta(null); setError(''); setMensaje(''); }}>
            <option value="">Seleccioná una organización</option>
            {organizaciones.map((o) =>
              <option value={o.id} key={o.id}>{o.nombre}{!o.activo ? ' (inactiva)' : ''}</option>)}
          </select>
        </label>
        {seleccionada && (
          <div className="cuentas-org__formulario">
            <div className="plataforma-seleccion">
              <strong>{seleccionada.nombre}</strong>
              <span>{seleccionada.activo ? 'Organización activa' : 'Organización suspendida'}</span>
              <span>{cuentasVigentes.length} cuentas vigentes · {retiradas.length} retiradas · {seleccionada.cantidadAdministradores} administradores activos</span>
              <details><summary>Detalles técnicos</summary><code>{seleccionada.id}</code><p>Slug: {seleccionada.slug}</p></details>
            </div>
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
        {pestana === 'cuentas' && seleccionada && (
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
                  <option value="TODOS">Cuentas vigentes</option>
                  <option value="ACTIVOS">Activos</option>
                  <option value="INACTIVOS">Inactivos</option>
                  <option value="RETIRADOS">Retirados (historial)</option>
                </select>
              </label>
            </div>
          </section>
        )}
        {pestana === 'cuentas' && seleccionada && (
          <details className="plataforma-desplegable">
            <summary>Credenciales temporales (operación sensible)</summary>
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
          </details>
        )}
        {pestana === 'cuentas' && seleccionada && (
          <details className="plataforma-desplegable">
            <summary>Crear nueva cuenta</summary>
          <form className="cuentas-org__formulario" onSubmit={(e) => void registrarCuenta(e)}>
            <h3>Nueva cuenta</h3>
            <p>Registrá a la persona que administrará o utilizará la organización seleccionada.</p>
            <div className="cuentas-org__nombres">
              <label>Nombre
                <input type="text" required minLength={2} maxLength={100} autoComplete="given-name"
                  value={nombreUsuario} disabled={ocupado || Boolean(credencial) || !seleccionada.activo}
                  onChange={(e) => setNombreUsuario(e.target.value)} />
              </label>
              <label>Apellido
                <input type="text" required minLength={2} maxLength={100} autoComplete="family-name"
                  value={apellidoUsuario} disabled={ocupado || Boolean(credencial) || !seleccionada.activo}
                  onChange={(e) => setApellidoUsuario(e.target.value)} />
              </label>
            </div>
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
          </details>
        )}
        {credencial && <div className="cuentas-org__temporal" role="status">
          <strong>{credencial.titulo}: {credencial.email}</strong>
          <p>Contraseña temporal visible una sola vez. Compartila únicamente por un canal seguro.</p>
          <code>{credencial.temporal}</code>
          <button type="button" onClick={() => setCredencial(null)}>Ocultar contraseña</button>
        </div>}
        {pestana === 'cuentas' && (
          <section className="plataforma-directorio" aria-labelledby="directorio-usuarios">
            <div className="plataforma-directorio__cabecera">
              <div>
                <h3 id="directorio-usuarios">Administrar usuarios</h3>
                <p>{cuentasFiltradas.length} cuentas mostradas · {cuentasVigentes.length} vigentes</p>
              </div>
              <label>Buscar nombre o correo
                <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar cuenta" />
              </label>
            </div>
            {cuentasFiltradas.length === 0 ? (
              <p className="plataforma-directorio__vacio">No hay cuentas que coincidan con los filtros seleccionados.</p>
            ) : (
              <div className="plataforma-directorio__lista">
                <div className="plataforma-directorio__titulos" aria-hidden="true">
                  <span>Usuario</span><span>Perfil</span><span>Estado</span><span>Gestión</span>
                </div>
                {cuentasFiltradas.map((cuenta) => (
                  <div className="plataforma-directorio__fila" key={cuenta.id}>
                    <div className="plataforma-directorio__identidad">
                      <strong>{cuenta.nombreVisible || cuenta.email}</strong>
                      {cuenta.nombreVisible && <small>{cuenta.email}</small>}
                    </div>
                    <div className="plataforma-directorio__perfil">{cuenta.roles.join(', ') || 'Sin roles'}</div>
                    <div><span className={`plataforma-directorio__estado ${cuenta.retirado ? 'plataforma-directorio__estado--retirado' : cuenta.activo ? 'plataforma-directorio__estado--activo' : 'plataforma-directorio__estado--inactivo'}`}>
                      {cuenta.retirado ? 'Retirada' : cuenta.activo ? 'Activa' : 'Inactiva'}
                    </span></div>
                    <div className="plataforma-directorio__accion">
                      {!cuenta.retirado && !cuenta.roles.includes('SUPERADMINISTRADOR') ? (
                        <div className="plataforma-directorio__menu">
                          <button type="button" className="cuentas-org__secundario"
                            disabled={ocupado} aria-expanded={menuCuenta === cuenta.id}
                            onClick={() => setMenuCuenta((prev) => prev === cuenta.id ? null : cuenta.id)}>
                            Acciones ···
                          </button>
                          {menuCuenta === cuenta.id && (
                            <div className="plataforma-directorio__opciones">
                              {cuenta.activo && (
                                <>
                                  <button type="button" disabled={ocupado} onClick={() => {
                                    setEdicionNombre(cuenta.id); setNombreEdicion(cuenta.nombreVisible || '');
                                    setEdicionId(null); setEdicionCorreo(null); setMenuCuenta(null);
                                  }}>Editar nombre</button>
                                  <button type="button" disabled={ocupado} onClick={() => {
                                    setEdicionId(cuenta.id); setRolesEdicion(cuenta.roles);
                                    setEdicionNombre(null); setEdicionCorreo(null); setMenuCuenta(null);
                                  }}>Editar perfiles</button>
                                  <button type="button" disabled={ocupado} onClick={() => {
                                    setEdicionCorreo(cuenta.id); setCorreoEdicion(cuenta.email);
                                    setEdicionNombre(null); setEdicionId(null); setMenuCuenta(null);
                                  }}>Editar correo</button>
                                  <button type="button" disabled={ocupado || Boolean(credencial)} onClick={() => {
                                    setConfirmandoCredencial(cuenta.id); setConfirmandoRetiro(null);
                                    setEdicionNombre(null);setEdicionId(null);setEdicionCorreo(null);setMenuCuenta(null);
                                  }}>Reemitir contraseña temporal</button>
                                </>
                              )}
                              <button type="button" disabled={ocupado} onClick={() => {
                                setConfirmacion({ tipo: 'cuenta', id: cuenta.id, nombre: cuenta.email, activo: !cuenta.activo });
                                setEdicionNombre(null);setEdicionId(null);setEdicionCorreo(null);setMenuCuenta(null);
                              }}>{cuenta.activo ? 'Desactivar cuenta' : 'Activar cuenta'}</button>
                              <button type="button" disabled={ocupado} onClick={() => {
                                setConfirmandoRetiro(cuenta.id);setConfirmandoCredencial(null);
                                setEdicionNombre(null);setEdicionId(null);setEdicionCorreo(null);setMenuCuenta(null);
                              }}>Retirar de organización</button>
                            </div>
                          )}
                        </div>
                      ) : <span className="plataforma-directorio__sin-acciones">Solo historial</span>}
                    </div>
                    {confirmandoCredencial === cuenta.id && !cuenta.retirado && (
                      <div className="cuentas-org__confirmacion plataforma-directorio__editor" role="alert">
                        <p>¿Reemitir contraseña temporal para {cuenta.email}? La anterior dejará de funcionar y se cerrarán sus sesiones renovables.</p>
                        <div className="cuentas-org__acciones">
                          <button type="button" disabled={ocupado || Boolean(credencial)}
                            onClick={()=>void reemitirDesdeCuenta(cuenta)}>Sí, reemitir</button>
                          <button type="button" className="cuentas-org__secundario" disabled={ocupado}
                            onClick={()=>setConfirmandoCredencial(null)}>Cancelar</button>
                        </div>
                      </div>
                    )}
                    {confirmandoRetiro === cuenta.id && !cuenta.retirado && (
                      <div className="cuentas-org__confirmacion plataforma-directorio__editor" role="alert">
                        <p>¿Retirar a {cuenta.email} de la organización? Se bloqueará su acceso y su registro quedará en el historial. No podrá reactivarse desde los paneles habituales.</p>
                        <div className="cuentas-org__acciones">
                          <button type="button" disabled={ocupado} onClick={()=>void retirarDesdePlataforma(cuenta)}>Sí, retirar cuenta</button>
                          <button type="button" className="cuentas-org__secundario" disabled={ocupado}
                            onClick={()=>setConfirmandoRetiro(null)}>Cancelar</button>
                        </div>
                      </div>
                    )}
                    {edicionNombre === cuenta.id && !cuenta.retirado && (
                      <form className="cuentas-org__editor plataforma-directorio__editor"
                        onSubmit={(e)=>{e.preventDefault();void guardarNombre(cuenta);}}>
                        <label>Nombre visible
                          <input type="text" required minLength={2} maxLength={140}
                            value={nombreEdicion} disabled={ocupado}
                            onChange={(e)=>setNombreEdicion(e.target.value)} />
                        </label>
                        <div className="cuentas-org__acciones">
                          <button type="submit" disabled={ocupado}>Guardar nombre</button>
                          <button type="button" className="cuentas-org__secundario" disabled={ocupado}
                            onClick={()=>setEdicionNombre(null)}>Cancelar</button>
                        </div>
                      </form>
                    )}
                    {edicionCorreo === cuenta.id && !cuenta.retirado && (
                      <form className="cuentas-org__editor plataforma-directorio__editor"
                        onSubmit={(e) => { e.preventDefault(); void guardarCorreo(cuenta); }}>
                        <label>Nuevo correo electrónico
                          <input type="email" required maxLength={150} value={correoEdicion} disabled={ocupado}
                            onChange={(e) => setCorreoEdicion(e.target.value)} />
                        </label>
                        <div className="cuentas-org__acciones">
                          <button type="submit" disabled={ocupado}>Guardar correo</button>
                          <button type="button" className="cuentas-org__secundario" disabled={ocupado}
                            onClick={() => setEdicionCorreo(null)}>Cancelar</button>
                        </div>
                      </form>
                    )}
                    {edicionId === cuenta.id && cuenta.activo && !cuenta.retirado && (
                      <div className="cuentas-org__editor plataforma-directorio__editor">
                        <fieldset disabled={ocupado}>
                          <legend>Editar perfiles</legend>
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
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>}
    </section>
  );
}
