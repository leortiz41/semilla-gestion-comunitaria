import { useEffect, useMemo, useState } from 'react';
import '../../estilos/modulos/matrizAccesos.css';

type CuentaTenant = {
  id:string; email:string; activo:boolean; roles:string[];
  permisosBase:string[]; permisosRestringidos:string[];
};
type Permiso = {codigo:string;modulo:string;descripcion:string|null};
type Config = {cuentas:CuentaTenant[];permisos:Permiso[];roles:{nombre:string;permisos:string[];permisosRestringidos:string[]}[]};
const API=import.meta.env.VITE_API_URL||'http://localhost:3000/api';

export default function PanelPermisosTenant({token,organizacionId,nombreOrganizacion}:{
  token:string;organizacionId:string;nombreOrganizacion:string;
}){
  const [datos,setDatos]=useState<Config|null>(null);
  const [seleccion,setSeleccion]=useState('');
  const [habilitados,setHabilitados]=useState<string[]>([]);
  const [busqueda,setBusqueda]=useState('');
  const [ocupado,setOcupado]=useState(false);
  const [error,setError]=useState('');
  const [mensaje,setMensaje]=useState('');
  const [recarga,setRecarga]=useState(0);
  const base=API+'/plataforma/organizaciones/'+encodeURIComponent(organizacionId)+'/accesos';

  useEffect(()=>{
    let vigente=true;
    setDatos(null);setSeleccion('');setHabilitados([]);setError('');setMensaje('');
    fetch(base,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
      .then(async r=>{
        const respuesta=await r.json();
        if(!r.ok)throw Error(respuesta.message||'No fue posible consultar los permisos.');
        return respuesta as Config;
      })
      .then(respuesta=>{if(vigente)setDatos(respuesta);})
      .catch(e=>{if(vigente)setError(e instanceof Error?e.message:'Error consultando permisos.');});
    return()=>{vigente=false;};
  },[base,token,recarga]);

  const cuenta=datos?.cuentas.find(c=>c.id===seleccion);
  const visibles=useMemo(()=>datos?.cuentas.filter(c=>
    c.email.toLowerCase().includes(busqueda.trim().toLowerCase()))??[],[datos,busqueda]);
  const permisos=useMemo(()=>datos?.permisos.filter(p=>cuenta?.permisosBase.includes(p.codigo))??[],[datos,cuenta]);
  const grupos=useMemo(()=>{
    const mapa=new Map<string,Permiso[]>();
    for(const permiso of permisos){
      const clave=permiso.modulo||permiso.codigo.split('.')[0];
      mapa.set(clave,[...(mapa.get(clave)||[]),permiso]);
    }
    return [...mapa.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  },[permisos]);
  const protegido=!cuenta?.activo||cuenta.roles.some(r=>r==='ADMINISTRADOR'||r==='SUPERADMINISTRADOR');

  async function guardar(){
    if(!cuenta||protegido||ocupado)return;
    if(!window.confirm('¿Actualizar permisos individuales de '+cuenta.email+' en '+nombreOrganizacion+'?'))return;
    setOcupado(true);setError('');setMensaje('');
    try{
      const respuesta=await fetch(base+'/cuentas/'+encodeURIComponent(cuenta.id)+'/permisos',{
        method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({permisos:habilitados}),
      });
      const cuerpo=await respuesta.json();
      if(!respuesta.ok)throw Error(cuerpo.message||'No fue posible guardar los permisos.');
      setMensaje('Restricciones guardadas para esta organización. No se han modificado otros tenants.');
      setRecarga(n=>n+1);
    }catch(e){setError(e instanceof Error?e.message:'No fue posible guardar los permisos.');}
    finally{setOcupado(false);}
  }

  return <section className="matriz-accesos" aria-label="Permisos por Tenant ID">
    <header className="matriz-accesos__encabezado">
      <div><h2>Permisos individuales por tenant</h2>
        <p>Organización: <strong>{nombreOrganizacion}</strong></p>
        <p>Tenant ID: <code>{organizacionId}</code></p>
        <p>Solo se permite restringir o restaurar permisos dentro de los roles asignados.</p>
      </div>
      <button type="button" disabled={ocupado} onClick={()=>setRecarga(n=>n+1)}>Actualizar matriz</button>
    </header>
    {error&&<p role="alert" className="matriz-accesos__error">{error}</p>}
    {mensaje&&<p role="status" className="matriz-accesos__mensaje">{mensaje}</p>}
    {!datos&&!error&&<p role="status">Cargando permisos del tenant…</p>}
    {datos&&<div className="matriz-accesos__layout">
      <aside className="matriz-accesos__listado">
        <label htmlFor="buscar-permiso-tenant">Buscar cuenta</label>
        <input id="buscar-permiso-tenant" type="search" value={busqueda}
          onChange={e=>setBusqueda(e.target.value)} placeholder="Correo electrónico"/>
        <p>{visibles.length} cuentas vigentes encontradas</p>
        {visibles.map(c=><button type="button" key={c.id} aria-pressed={seleccion===c.id}
          onClick={()=>{
            setSeleccion(c.id);
            setHabilitados(c.permisosBase.filter(p=>!c.permisosRestringidos.includes(p)));
            setError('');setMensaje('');
          }}>
          <strong>{c.email}</strong><small>{c.roles.join(', ')}</small>
        </button>)}
      </aside>
      <div className="matriz-accesos__detalle">
        {!cuenta?<p>Seleccioná una cuenta para consultar y gestionar sus permisos.</p>:<>
          <h3>{cuenta.email}</h3>
          <p>{cuenta.roles.join(' · ')}</p>
          {protegido&&<p className="matriz-accesos__aviso">Cuenta administrativa o inactiva: permisos protegidos, solo lectura.</p>}
          {grupos.map(([modulo,items])=><fieldset key={modulo} className="matriz-accesos__grupo"
            disabled={protegido||ocupado}>
            <legend>{modulo}</legend>
            {items.map(p=><label key={p.codigo} className="matriz-accesos__permiso">
              <input type="checkbox" checked={habilitados.includes(p.codigo)}
                onChange={()=>setHabilitados(actual=>actual.includes(p.codigo)?
                  actual.filter(x=>x!==p.codigo):[...actual,p.codigo])}/>
              <span><strong>{p.descripcion||p.codigo}</strong><code>{p.codigo}</code></span>
            </label>)}
          </fieldset>)}
          {!protegido&&<button type="button" disabled={ocupado} className="matriz-accesos__guardar"
            onClick={()=>void guardar()}>{ocupado?'Guardando…':'Guardar permisos del usuario'}</button>}
        </>}
      </div>
    </div>}
    <p className="matriz-accesos__aviso">Los permisos de roles compartidos por varios usuarios no se modifican desde esta primera versión. Los cambios individuales se registran en auditoría.</p>
  </section>;
}
