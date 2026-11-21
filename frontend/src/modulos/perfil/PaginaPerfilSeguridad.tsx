import { useEffect,useState,type FormEvent,type ChangeEvent } from 'react';
import type { UsuarioSesion } from '../../lib/api';
import '../../estilos/modulos/perfil/perfilSeguridad.css';

interface PropiedadesPaginaPerfilSeguridad {
 usuario: UsuarioSesion; token: string;
 mensaje?: string|null;error?: string|null;procesando:boolean;
 mostrarCambioClave:boolean;contrasenaActual:string;contrasenaNueva:string;confirmacionContrasena:string;
 alVolverDashboard:()=>void;alRenovarSesion:()=>void;alAlternarCambioClave:()=>void;
 alCambiarContrasena:(event:FormEvent<HTMLFormElement>)=>void;
 alCambiarContrasenaActual:(valor:string)=>void;alCambiarContrasenaNueva:(valor:string)=>void;
 alCambiarConfirmacionContrasena:(valor:string)=>void;
}
type Perfil={nombreVisible:string;foto:string|null;email?:string;organizacion?:string;ultimoAcceso?:string|null};
const API=import.meta.env.VITE_API_URL||'http://localhost:3000/api';
const iniciales=(texto:string)=>texto.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'US';
function formatoFoto(file:File):Promise<string>{
 return new Promise((resolve,reject)=>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8000000){
   reject(Error('Seleccioná una imagen JPG, PNG o WEBP de hasta 8 MB.'));return;
  }
  const url=URL.createObjectURL(file);
  const imagen=new Image();
  imagen.onload=()=>{
   try{
    const lado=420,escala=Math.min(1,lado/Math.max(imagen.width,imagen.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(imagen.width*escala));
    canvas.height=Math.max(1,Math.round(imagen.height*escala));
    const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('No se pudo preparar la fotografía.');
    ctx.drawImage(imagen,0,0,canvas.width,canvas.height);
    let resultado='';
    for(let calidad=.85;calidad>=.35;calidad-=.1){
     resultado=canvas.toDataURL('image/jpeg',calidad);
     if(resultado.length<260000)break;
    }
    if(resultado.length>260000)throw Error('La imagen no pudo reducirse a un tamaño seguro.');
    resolve(resultado);
   }catch(e){reject(e);}finally{URL.revokeObjectURL(url);}
  };
  imagen.onerror=()=>{URL.revokeObjectURL(url);reject(Error('No fue posible leer la fotografía.'));};
  imagen.src=url;
 });
}
export default function PaginaPerfilSeguridad({
 usuario,token,mensaje,error,procesando,mostrarCambioClave,contrasenaActual,
 contrasenaNueva,confirmacionContrasena,alVolverDashboard,alRenovarSesion,
 alAlternarCambioClave,alCambiarContrasena,alCambiarContrasenaActual,
 alCambiarContrasenaNueva,alCambiarConfirmacionContrasena,
}:PropiedadesPaginaPerfilSeguridad){
 const [perfil,setPerfil]=useState<Perfil|null>(null);
 const [nombre,setNombre]=useState('');
 const [foto,setFoto]=useState<string|null>(null);
 const [cargando,setCargando]=useState(true);
 const [guardando,setGuardando]=useState(false);
 const [mensajePerfil,setMensajePerfil]=useState('');
 const [errorPerfil,setErrorPerfil]=useState('');
 const permisos=[...usuario.permisos].sort((a,b)=>a.localeCompare(b));
 useEffect(()=>{
  let activo=true;setCargando(true);
  fetch(API+'/perfil',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   .then(async r=>{if(!r.ok)throw Error('No se pudo consultar el perfil.');return r.json() as Promise<{perfil:Perfil}>;})
   .then(r=>{if(!activo)return;setPerfil(r.perfil);setNombre(r.perfil.nombreVisible||'');setFoto(r.perfil.foto);})
   .catch((e:Error)=>{if(activo)setErrorPerfil(e.message);})
   .finally(()=>{if(activo)setCargando(false);});
  return()=>{activo=false;};
 },[token,usuario.id]);
 async function subirFoto(e:ChangeEvent<HTMLInputElement>){
  const archivo=e.target.files?.[0];e.target.value='';
  if(!archivo)return;
  setErrorPerfil('');setMensajePerfil('');
  try{setFoto(await formatoFoto(archivo));}
  catch(err){setErrorPerfil(err instanceof Error?err.message:'Imagen inválida.');}
 }
 async function guardar(){
  if(guardando||cargando)return;
  setGuardando(true);setErrorPerfil('');setMensajePerfil('');
  try{
   const r=await fetch(API+'/perfil',{method:'PUT',headers:{
    Authorization:'Bearer '+token,'Content-Type':'application/json',
   },body:JSON.stringify({nombreVisible:nombre.trim(),foto})});
   if(!r.ok){const body=await r.json().catch(()=>({})) as {message?:string};throw Error(body.message||'No se pudo guardar el perfil.');}
   const d=await r.json() as {perfil:Perfil};
   setPerfil(d.perfil);setNombre(d.perfil.nombreVisible);setFoto(d.perfil.foto);
   setMensajePerfil('Tu perfil se actualizó correctamente.');
  }catch(err){setErrorPerfil(err instanceof Error?err.message:'Error al guardar el perfil.');}
  finally{setGuardando(false);}
 }
 const nombreMostrado=nombre.trim()||usuario.nombre||usuario.email.split('@')[0];
 const hayCambios=perfil!==null&&(nombre!==perfil.nombreVisible||foto!==perfil.foto);
 return <section className="pagina-perfil-seguridad" aria-labelledby="titulo-perfil-seguridad">
  <header className="pagina-perfil-seguridad__encabezado">
   <div><p className="eyebrow">Mi cuenta</p>
    <h1 id="titulo-perfil-seguridad" className="pagina-perfil-seguridad__titulo">Mi perfil</h1>
    <p className="pagina-perfil-seguridad__descripcion">
     Administrá tu información personal, la seguridad de tu cuenta y los accesos que tenés asignados.
    </p></div>
   <button className="pagina-perfil-seguridad__volver" type="button" onClick={alVolverDashboard}>
    ← Volver al dashboard
   </button>
  </header>
  {mensaje&&<div role="status" className="notice success">{mensaje}</div>}
  {error&&<div role="alert" className="notice error">{error}</div>}
  {mensajePerfil&&<div role="status" className="notice success">{mensajePerfil}</div>}
  {errorPerfil&&<div role="alert" className="notice error">{errorPerfil}</div>}
  {usuario.debeCambiarContrasena&&<div role="alert" className="notice warning">
   La contraseña de esta cuenta es temporal. Actualizala para proteger tu acceso.
  </div>}
  <div className="perfil-hero panel-card">
   <div className="perfil-hero__foto">
    {foto?<img src={foto} alt={'Fotografía de perfil de '+nombreMostrado}/>:
     <span aria-label="Avatar con iniciales">{iniciales(nombreMostrado)}</span>}
   </div>
   <div className="perfil-hero__contenido">
    <p className="eyebrow">Perfil personal</p>
    <h2>{nombreMostrado}</h2>
    <p>{usuario.email}</p>
    <div className="perfil-hero__metadatos">
     <span className="perfil-estado">● Cuenta activa</span>
     {usuario.roles.map(r=><span className="role-chip" key={r}>{r.replaceAll('_',' ')}</span>)}
    </div>
    <p className="perfil-hero__organizacion">{perfil?.organizacion||usuario.organizacion.nombre}</p>
   </div>
   <div className="perfil-hero__accion">
    <label htmlFor="foto-perfil" className="perfil-hero__subir">Cambiar fotografía</label>
    <input id="foto-perfil" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void subirFoto(e)}/>
    {foto&&<button type="button" className="secondary-button" onClick={()=>setFoto(null)}>Quitar fotografía</button>}
   </div>
  </div>
  <div className="perfil-contenido-grid">
   <article className="panel-card perfil-datos">
    <div><p className="eyebrow">Información personal</p><h2>Datos de mi perfil</h2>
     <p className="perfil-card__descripcion">Personalizá cómo se muestra tu nombre dentro de Semilla.</p></div>
    {cargando?<p role="status">Cargando datos…</p>:<>
     <label htmlFor="perfil-nombre">Nombre para mostrar
      <input id="perfil-nombre" maxLength={140} value={nombre} onChange={e=>setNombre(e.target.value)}
       placeholder="Tu nombre completo"/>
     </label>
     <label>Correo electrónico
      <input value={usuario.email} disabled readOnly/>
      <small>El correo de acceso lo gestiona el administrador de tu organización.</small>
     </label>
     <label>Organización
      <input value={perfil?.organizacion||usuario.organizacion.nombre} disabled readOnly/>
     </label>
     <button className="primary-button" type="button" onClick={()=>void guardar()}
      disabled={guardando||!hayCambios}>{guardando?'Guardando…':'Guardar cambios del perfil'}</button>
    </>}
   </article>
   <article className="panel-card perfil-seguridad-card">
    <div><p className="eyebrow">Protección de cuenta</p><h2>Seguridad y acceso</h2>
     <p className="perfil-card__descripcion">Mantené tu contraseña y sesiones bajo control.</p></div>
    <div className="perfil-seguridad-card__item"><span>Estado de sesión</span><strong>● Activa</strong></div>
    <div className="perfil-seguridad-card__item"><span>Contraseña</span>
     <strong>{usuario.debeCambiarContrasena?'Cambio obligatorio':'Configurada'}</strong></div>
    {perfil?.ultimoAcceso&&<div className="perfil-seguridad-card__item"><span>Último acceso</span>
     <strong>{new Date(perfil.ultimoAcceso).toLocaleString('es-HN')}</strong></div>}
    <div className="perfil-seguridad-card__acciones">
     <button type="button" className="primary-button" onClick={alAlternarCambioClave}>Cambiar contraseña</button>
     <button type="button" className="secondary-button" onClick={alRenovarSesion} disabled={procesando}>Renovar sesión</button>
    </div>
   </article>
  </div>
  {mostrarCambioClave&&<form className="panel-card password-panel" onSubmit={alCambiarContrasena}>
   <div><p className="eyebrow">Seguridad</p><h2>Actualizar contraseña</h2>
    <p>Al cambiarla, se revocarán las sesiones y tendrás que ingresar nuevamente.</p></div>
   <div className="password-grid">
    <label>Contraseña actual<input type="password" autoComplete="current-password" required value={contrasenaActual}
     onChange={e=>alCambiarContrasenaActual(e.target.value)}/></label>
    <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} required value={contrasenaNueva}
     onChange={e=>alCambiarContrasenaNueva(e.target.value)}/></label>
    <label>Confirmar nueva contraseña<input type="password" autoComplete="new-password" minLength={12} required
     value={confirmacionContrasena} onChange={e=>alCambiarConfirmacionContrasena(e.target.value)}/></label>
   </div>
   <button className="primary-button" type="submit" disabled={procesando}>{procesando?'Actualizando…':'Actualizar contraseña'}</button>
  </form>}
  <details className="panel-card perfil-permisos">
   <summary><span><span className="eyebrow">Roles y autorizaciones</span>
    <strong>Permisos y accesos asignados</strong><small>Consultá los permisos técnicos de tu cuenta.</small>
   </span><span className="count-badge">{permisos.length}</span></summary>
   <div className="permission-list">{permisos.map(p=><div key={p} className="permission-item">
    <span className="check-dot">✓</span><code>{p}</code>
   </div>)}</div>
  </details>
 </section>;
}
