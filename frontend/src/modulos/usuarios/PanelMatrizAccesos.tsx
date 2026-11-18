import { useEffect, useMemo, useState } from 'react';
import '../../estilos/modulos/matrizAccesos.css';

const API=import.meta.env.VITE_API_URL||'http://localhost:3000/api';
type Cuenta={id:string;email:string;activo:boolean;debeCambiarContrasena:boolean;roles:string[];permisosBase:string[];permisosRestringidos:string[]};
type Permiso={codigo:string;modulo:string;descripcion:string|null};
type Rol={nombre:string;descripcion:string|null;activo:boolean;permisos:string[];permisosRestringidos:string[]};
type Configuracion={cuentas:Cuenta[];permisos:Permiso[];roles:Rol[];yo:string};
async function api<T>(token:string,ruta:string,opciones:RequestInit={}):Promise<T>{
 const r=await fetch(API+'/usuarios/administracion'+ruta,{...opciones,cache:'no-store',headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json',...opciones.headers
 }});
 if(!r.ok){const e=await r.json().catch(()=>({})) as {message?:string};throw Error(e.message||'No se pudo completar la acción.');}
 return r.json() as Promise<T>;
}
const modulos:Record<string,string>={
 usuarios:'Administración de usuarios',comunidades:'Comunidades',familias:'Familias',
 proyectos:'Proyectos',pagos:'Pagos y contratos',evidencias:'Evidencias',
 actividades:'Actividades',donantes:'Donantes',auditoria:'Auditoría'
};
const etiqueta=(p:string)=>p.endsWith('.ver')?'Ver información':
 p.endsWith('.gestionar')?'Gestionar registros':
 p.endsWith('.revisar')?'Revisar y aprobar':
 p.endsWith('.corregir')?'Corregir información':
 p.endsWith('.validar')?'Validar información':p.split('.').slice(1).join(' · ');
export default function PanelMatrizAccesos({token}:{token:string}){
 const [config,setConfig]=useState<Configuracion|null>(null);
 const [seleccion,setSeleccion]=useState<string>('');
 const [busqueda,setBusqueda]=useState('');
 const [filtro,setFiltro]=useState<'todos'|'activos'|'inactivos'>('todos');
 const [vista,setVista]=useState<'permisos'|'roles'>('permisos');
 const [perfilElegido,setPerfilElegido]=useState('');
 const [permisosPerfil,setPermisosPerfil]=useState<string[]>([]);
 const [habilitados,setHabilitados]=useState<string[]>([]);
 const [error,setError]=useState('');
 const [mensaje,setMensaje]=useState('');
 const [ocupado,setOcupado]=useState(false);
 const [recarga,setRecarga]=useState(0);
 useEffect(()=>{
  let actual=true;
  api<Configuracion>(token,'/configuracion')
   .then(r=>{if(!actual)return;setConfig(r);})
   .catch((e:Error)=>{if(actual)setError(e.message);});
  return()=>{actual=false;};
 },[token,recarga]);
 const visibles=useMemo(()=>config?.cuentas.filter(c=>
  c.email.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es'))&&
  (filtro==='todos'||(filtro==='activos'?c.activo:!c.activo))
 )||[],[config,busqueda,filtro]);
 const cuenta=config?.cuentas.find(c=>c.id===seleccion);
 const perfilActual=config?.roles.find(r=>r.nombre===perfilElegido);
 const permisosCuenta=useMemo(()=>config?.permisos.filter(p=>cuenta?.permisosBase.includes(p.codigo))||[],[config,cuenta]);
 const grupos=useMemo(()=>{
  const mapa=new Map<string,Permiso[]>();
  for(const p of permisosCuenta){const llave=p.modulo||p.codigo.split('.')[0];
   mapa.set(llave,[...(mapa.get(llave)||[]),p]);}
  return [...mapa.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
 },[permisosCuenta]);
 function abrir(c:Cuenta){setSeleccion(c.id);setHabilitados(c.permisosBase.filter(p=>!c.permisosRestringidos.includes(p)));setVista('permisos');setError('');setMensaje('');}
 function alternar(codigo:string){setHabilitados(antes=>antes.includes(codigo)?antes.filter(p=>p!==codigo):[...antes,codigo]);}
 function editarPerfil(rol:Rol){
  setPerfilElegido(rol.nombre);
  setPermisosPerfil(rol.permisos.filter(p=>!rol.permisosRestringidos.includes(p)));
  setError('');setMensaje('');
 }
 async function guardarPerfil(){
  if(!perfilActual||perfilActual.nombre==='ADMINISTRADOR'||ocupado)return;
  if(!window.confirm('¿Actualizar permisos del perfil '+perfilActual.nombre+' para todos sus usuarios en esta organización?'))return;
  setOcupado(true);setError('');setMensaje('');
  try{
   await api(token,'/roles/'+encodeURIComponent(perfilActual.nombre)+'/permisos',{
    method:'PUT',body:JSON.stringify({permisos:permisosPerfil}),
   });
   setMensaje('Política del perfil actualizada para esta organización. Los controles del backend ya respetan el cambio.');
   setPerfilElegido('');setSeleccion('');setRecarga(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:'No se pudo actualizar el perfil.');}
  finally{setOcupado(false);}
 }
 const puedeEditar=Boolean(cuenta?.activo&&!cuenta.roles.some(r=>r==='ADMINISTRADOR'||r==='SUPERADMINISTRADOR'));
 async function guardar(){
  if(!cuenta||!puedeEditar||ocupado)return;
  setOcupado(true);setError('');setMensaje('');
  try{
   await api(token,'/cuentas/'+cuenta.id+'/permisos',{method:'PUT',body:JSON.stringify({permisos:habilitados})});
   setMensaje('Permisos actualizados. Los cambios afectan inmediatamente a las solicitudes de la cuenta.');
   setRecarga(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:'No fue posible guardar permisos.');}
  finally{setOcupado(false);}
 }
 async function cambiarEstado(c:Cuenta){
  if(c.id===config?.yo||ocupado)return;
  const activo=!c.activo;
  if(!window.confirm(activo?'¿Activar nuevamente esta cuenta?':'¿Desactivar esta cuenta y revocar sus sesiones?'))return;
  setOcupado(true);setError('');setMensaje('');
  try{
   await api(token,'/cuentas/'+c.id+'/estado',{method:'PATCH',body:JSON.stringify({activo})});
   setMensaje(activo?'Cuenta activada.':'Cuenta desactivada y sesiones de renovación revocadas.');
   if(seleccion===c.id)setSeleccion('');
   setRecarga(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:'No se pudo actualizar la cuenta.');}
  finally{setOcupado(false);}
 }
 return <section className="matriz-accesos" aria-labelledby="matriz-accesos-titulo">
  <header className="matriz-accesos__encabezado">
   <div><p className="matriz-accesos__eyebrow">Seguridad institucional</p>
    <h2 id="matriz-accesos-titulo">Configuración de accesos</h2>
    <p>Controlá qué usuarios de tu organización pueden consultar o gestionar cada módulo.</p></div>
   <button type="button" onClick={()=>setRecarga(n=>n+1)} disabled={ocupado}>Actualizar lista</button>
  </header>
  {error&&<p className="matriz-accesos__error" role="alert">{error}</p>}
  {mensaje&&<p className="matriz-accesos__mensaje" role="status">{mensaje}</p>}
  {!config&&<p role="status">Cargando configuración de seguridad…</p>}
  {config&&<>
   <div className="matriz-accesos__indicadores">
    <div><strong>{config.cuentas.length}</strong><span>Usuarios</span></div>
    <div><strong>{config.cuentas.filter(c=>c.activo).length}</strong><span>Activos</span></div>
    <div><strong>{config.cuentas.filter(c=>!c.activo).length}</strong><span>Inactivos</span></div>
    <div><strong>{config.roles.filter(r=>r.activo).length}</strong><span>Perfiles base</span></div>
   </div>
   <div className="matriz-accesos__layout">
    <aside className="matriz-accesos__listado" aria-label="Usuarios de la organización">
     <label htmlFor="matriz-accesos-busqueda">Buscar usuario</label>
     <input id="matriz-accesos-busqueda" type="search" value={busqueda}
      placeholder="Nombre o correo…" onChange={e=>setBusqueda(e.target.value)}/>
     <label htmlFor="matriz-accesos-estado">Estado de cuenta</label>
     <select id="matriz-accesos-estado" value={filtro} onChange={e=>setFiltro(e.target.value as typeof filtro)}>
      <option value="todos">Todos</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option>
     </select>
     <p className="matriz-accesos__contador">{visibles.length} cuentas encontradas</p>
     {visibles.map(c=><div key={c.id} className={'matriz-accesos__usuario'+(seleccion===c.id?' seleccionado':'')}>
      <button type="button" onClick={()=>abrir(c)} aria-pressed={seleccion===c.id}>
       <strong>{c.email}</strong><span>{c.roles.join(', ')||'Sin perfil'}</span>
       <small>{c.activo?'● Activa':'○ Inactiva'}</small>
      </button>
      {c.id!==config.yo&&<button type="button" className="matriz-accesos__estado"
       disabled={ocupado} onClick={()=>void cambiarEstado(c)}>
       {c.activo?'Desactivar cuenta':'Activar cuenta'}
      </button>}
     </div>)}
     {!visibles.length&&<p>No hay usuarios para el filtro seleccionado.</p>}
    </aside>
    <div className="matriz-accesos__detalle">
     {!cuenta?<div className="matriz-accesos__instruccion">
      <h3>Seleccioná una cuenta</h3>
      <p>Verás sus perfiles, permisos y módulos habilitados. Los cambios se aplican únicamente a esta organización.</p>
     </div>:<>
      <header><h3>{cuenta.email}</h3>
       <p>{cuenta.roles.join(' · ')} · {cuenta.activo?'Cuenta activa':'Cuenta inactiva'}</p></header>
      <div className="matriz-accesos__pestanas" role="group" aria-label="Vistas de acceso">
       <button type="button" aria-pressed={vista==='permisos'} onClick={()=>setVista('permisos')}>Permisos y vistas</button>
       <button type="button" aria-pressed={vista==='roles'} onClick={()=>setVista('roles')}>Perfiles asignados</button>
      </div>
      {vista==='permisos'&&<>
       <p className="matriz-accesos__aviso">Los perfiles determinan los permisos máximos. Podés deshabilitar accesos individuales, pero no conceder permisos fuera de los roles asignados.</p>
       {!puedeEditar&&<p className="matriz-accesos__aviso">La matriz de administradores o cuentas inactivas es de solo lectura para evitar perder el control institucional.</p>}
       {grupos.map(([modulo,permisos])=><fieldset key={modulo} className="matriz-accesos__grupo" disabled={!puedeEditar||ocupado}>
        <legend>{modulos[modulo]||modulo.replaceAll('_',' ')}</legend>
        {permisos.map(p=><label key={p.codigo} className="matriz-accesos__permiso">
         <input type="checkbox" checked={habilitados.includes(p.codigo)} onChange={()=>alternar(p.codigo)}/>
         <span><strong>{etiqueta(p.codigo)}</strong><small>{p.descripcion||p.codigo}</small><code>{p.codigo}</code></span>
        </label>)}
       </fieldset>)}
       {!grupos.length&&<p>Este usuario no tiene permisos activos en sus roles.</p>}
       {puedeEditar&&<button type="button" className="matriz-accesos__guardar" disabled={ocupado}
        onClick={()=>void guardar()}>{ocupado?'Guardando…':'Guardar permisos y vistas'}</button>}
      </>}
      {vista==='roles'&&<>
       {cuenta.roles.map(rol=>{const perfil=config.roles.find(p=>p.nombre===rol);
        return <article className="matriz-accesos__perfil" key={rol}>
         <strong>{rol}</strong><p>{perfil?.descripcion||'Perfil de acceso a la plataforma.'}</p>
         <small>{perfil?.permisos.length||0} permisos de origen</small>
        </article>;
       })}
       <p className="matriz-accesos__aviso">Para agregar o quitar perfiles utiliza «Cuentas de la organización → Editar roles». La matriz de permisos restringe las capacidades resultantes de esos perfiles.</p>
      </>}
     </>}
    </div>
   </div>
   <section className="matriz-accesos__roles-institucionales" aria-label="Políticas de roles de la organización">
    <header><h3>Permisos de los roles de tu organización</h3>
     <p>Estos ajustes afectan a quienes tengan el perfil seleccionado, sin modificar los roles de otros tenants.</p>
    </header>
    <div className="matriz-accesos__perfiles">
     {config.roles.map(r=><button type="button" key={r.nombre} disabled={!r.activo}
       aria-pressed={perfilElegido===r.nombre} onClick={()=>editarPerfil(r)}>
       <strong>{r.nombre}</strong>
       <small>{r.permisos.length-r.permisosRestringidos.length} de {r.permisos.length} permisos habilitados</small>
     </button>)}
    </div>
    {perfilActual&&<div className="matriz-accesos__config-rol">
     <h4>Perfil: {perfilActual.nombre}</h4>
     <p>{perfilActual.descripcion||'Perfil de acceso institucional.'}</p>
     {perfilActual.nombre==='ADMINISTRADOR'&&<p className="matriz-accesos__aviso">
      Los permisos del ADMINISTRADOR son protegidos para evitar bloquear la gestión de su organización.
     </p>}
     <fieldset disabled={ocupado||perfilActual.nombre==='ADMINISTRADOR'} className="matriz-accesos__grupo">
      <legend>Vistas y operaciones de este perfil</legend>
      {perfilActual.permisos.map(codigo=><label className="matriz-accesos__permiso" key={codigo}>
       <input type="checkbox" checked={permisosPerfil.includes(codigo)}
        onChange={()=>setPermisosPerfil(antes=>antes.includes(codigo)?antes.filter(x=>x!==codigo):[...antes,codigo])}/>
       <span><strong>{etiqueta(codigo)}</strong><code>{codigo}</code></span>
      </label>)}
     </fieldset>
     {perfilActual.nombre!=='ADMINISTRADOR'&&<button type="button" className="matriz-accesos__guardar"
      disabled={ocupado} onClick={()=>void guardarPerfil()}>Guardar permisos del perfil</button>}
    </div>}
   </section>
  </>}
 </section>;
}
