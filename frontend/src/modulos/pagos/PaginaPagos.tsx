import { useEffect, useState, type FormEvent } from 'react';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/pagos/pagos.css';
const API=import.meta.env.VITE_API_URL||'http://localhost:3000/api';
type Proveedor={id:string;nombre:string;tipo:string;categoria:string|null;telefono:string|null;email:string|null;rtn:string|null;propietario:string|null;direccion:string|null;observaciones:string|null;activo:boolean};
type Formulario={nombre:string;tipo:string;categoria:string;telefono:string;email:string;rtn:string;propietario:string;direccion:string;observaciones:string;activo:boolean};
type Resumen={solicitudes:{id:string;proyecto:string;concepto:string;monto:number;estado:string}[];pagos:{id:string;proyecto:string;monto:number;fecha:string;estado:string}[];contratos:{id:string;persona:string;proyecto:string;cargo:string;valor:number;estado:string}[]};
const vacio:Formulario={nombre:'',tipo:'PROVEEDOR',categoria:'',telefono:'',email:'',rtn:'',propietario:'',direccion:'',observaciones:'',activo:true};
async function api<T>(token:string,ruta:string,opciones:RequestInit={}):Promise<T>{
 const r=await fetch(`${API}${ruta}`,{...opciones,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...opciones.headers},cache:'no-store'});
 if(!r.ok){const e=await r.json().catch(()=>({})) as {message?:string};throw Error(e.message||'No se pudo completar la operación.');}
 return r.status===204?undefined as T:r.json() as Promise<T>;
}
const dinero=(n:number)=>new Intl.NumberFormat('es-HN',{style:'currency',currency:'HNL'}).format(n);
export default function PaginaPagos({token,puedeGestionar}:{token:string;puedeGestionar:boolean}){
 const [vista,setVista]=useState<'pagos'|'proveedores'>('pagos');
 const [proveedores,setProveedores]=useState<Proveedor[]>([]);
 const [resumen,setResumen]=useState<Resumen|null>(null);
 const [filtro,setFiltro]=useState('');
 const [formulario,setFormulario]=useState<Formulario|null>(null);
 const [editando,setEditando]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [mensaje,setMensaje]=useState('');
 const [cargando,setCargando]=useState(true);
 const [guardando,setGuardando]=useState(false);
 const [version,setVersion]=useState(0);
 useEffect(()=>{let activo=true;setCargando(true);setError('');
  Promise.all([api<{proveedores:Proveedor[]}>(token,'/proveedores'),api<Resumen>(token,'/pagos/resumen')])
   .then(([p,r])=>{if(activo){setProveedores(p.proveedores);setResumen(r);}})
   .catch((e:Error)=>{if(activo)setError(e.message);})
   .finally(()=>{if(activo)setCargando(false);});
  return()=>{activo=false;};
 },[token,version]);
 function abrir(p?:Proveedor){setEditando(p?.id||null);setFormulario(p?{
  nombre:p.nombre,tipo:p.tipo,categoria:p.categoria||'',telefono:p.telefono||'',email:p.email||'',rtn:p.rtn||'',
  propietario:p.propietario||'',direccion:p.direccion||'',observaciones:p.observaciones||'',activo:p.activo}:{...vacio});}
 async function guardar(e:FormEvent){e.preventDefault();if(!formulario||guardando)return;
  setGuardando(true);setError('');
  try{await api(token,editando?`/proveedores/${editando}`:'/proveedores',{method:editando?'PUT':'POST',body:JSON.stringify(formulario)});
   setMensaje(editando?'Ficha actualizada correctamente.':'Proveedor o contratista registrado.');
   setFormulario(null);setVersion(n=>n+1);
  }catch(err){setError(err instanceof Error?err.message:'No se pudo guardar.');}finally{setGuardando(false);}
 }
 return <section className="pagina-modulo pagos-pagina" aria-labelledby="titulo-pagos">
  <header className="pagina-modulo__encabezado"><p className="pagina-modulo__etiqueta">Gestión financiera</p>
   <h1 className="pagina-modulo__titulo" id="titulo-pagos">Pagos y contrataciones</h1>
   <p className="pagina-modulo__descripcion">Gestioná los proveedores y consultá solicitudes, personal contratado y pagos vinculados a proyectos.</p>
  </header>
  <div className="pagos-pestanas" role="group" aria-label="Vistas financieras">
   <button type="button" aria-pressed={vista==='pagos'} onClick={()=>setVista('pagos')}>Pagos y solicitudes</button>
   <button type="button" aria-pressed={vista==='proveedores'} onClick={()=>setVista('proveedores')}>Proveedores y contratistas</button>
  </div>
  {error&&<p className="pagos-error" role="alert">{error}</p>}
  {mensaje&&<p className="pagos-aviso" role="status">{mensaje}</p>}
  {cargando&&<p role="status">Cargando información…</p>}
  {vista==='pagos'&&resumen&&<>
   <div className="pagos-indicadores">
    <article><span>Solicitudes registradas</span><strong>{resumen.solicitudes.length}</strong></article>
    <article><span>Pendientes de aprobación</span><strong>{resumen.solicitudes.filter(s=>s.estado==='SOLICITADA').length}</strong></article>
    <article><span>Total confirmado</span><strong>{dinero(resumen.pagos.filter(p=>p.estado==='CONFIRMADO').reduce((n,p)=>n+p.monto,0))}</strong></article>
   </div>
   <p className="pagos-aviso">Consulta inicial. La autorización y el registro de desembolsos se habilitarán después de validar presupuesto, comprobantes y auditoría.</p>
   <h2>Solicitudes de pago</h2>
   <div className="pagos-listado">{resumen.solicitudes.map(s=><article key={s.id}><strong>{s.concepto}</strong><span>{s.proyecto}</span><span>{dinero(s.monto)} · {s.estado}</span></article>)}
    {!resumen.solicitudes.length&&<p>No existen solicitudes registradas.</p>}</div>
   <h2>Personal contratado</h2>
   <div className="pagos-listado">{resumen.contratos.map(c=><article key={c.id}><strong>{c.persona}</strong><span>{c.cargo} · {c.proyecto}</span><span>{dinero(c.valor)} · {c.estado}</span></article>)}
    {!resumen.contratos.length&&<p>No hay contratos registrados.</p>}</div>
   <h2>Pagos registrados</h2>
   <div className="pagos-listado">{resumen.pagos.map(p=><article key={p.id}><strong>{p.proyecto}</strong><span>{p.fecha}</span><span>{dinero(p.monto)} · {p.estado}</span></article>)}
    {!resumen.pagos.length&&<p>No hay desembolsos registrados.</p>}</div>
  </>}
  {vista==='proveedores'&&<>
   <div className="pagos-herramientas">
    <label>Buscar proveedor o contratista <input value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Nombre o especialidad"/></label>
    {puedeGestionar&&<button type="button" onClick={()=>abrir()}>+ Registrar proveedor o contratista</button>}
   </div>
   <div className="pagos-listado">{proveedores.filter(p=>(p.nombre+' '+(p.categoria||'')).toLowerCase().includes(filtro.toLowerCase())).map(p=>
    <article key={p.id}><strong>{p.nombre}</strong><span>{p.tipo} · {p.categoria||'Sin especialidad'}</span>
      <span>{p.telefono||'Sin teléfono'} · {p.activo?'Activo':'Inactivo'}</span>
      {puedeGestionar&&<button type="button" onClick={()=>abrir(p)}>Editar ficha</button>}</article>)}
    {!cargando&&!proveedores.length&&<p>No existen proveedores registrados.</p>}</div>
  </>}
  {formulario&&puedeGestionar&&<div className="pagos-modal-fondo" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target&&!guardando)setFormulario(null);}}>
   <section className="pagos-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-proveedor">
    <h2 id="titulo-proveedor">{editando?'Editar':'Registrar'} proveedor o contratista</h2>
    <form onSubmit={e=>void guardar(e)}>
     <label>Nombre comercial o completo *<input required maxLength={180} value={formulario.nombre} onChange={e=>setFormulario({...formulario,nombre:e.target.value})}/></label>
     <label>Tipo<select value={formulario.tipo} onChange={e=>setFormulario({...formulario,tipo:e.target.value})}>
      <option value="PROVEEDOR">Proveedor</option><option value="CONTRATISTA">Contratista</option><option value="SERVICIOS">Servicios</option><option value="PROFESIONAL">Profesional independiente</option>
     </select></label>
     {(['categoria','rtn','propietario','telefono','email','direccion','observaciones'] as const).map(k=>
      <label key={k}>{({categoria:'Especialidad',rtn:'RTN',propietario:'Responsable',telefono:'Teléfono',email:'Correo',direccion:'Dirección',observaciones:'Observaciones'} as const)[k]}
       <input maxLength={k==='observaciones'?2000:k==='direccion'?1000:k==='categoria'?100:k==='rtn'?30:180}
        value={formulario[k]} onChange={e=>setFormulario({...formulario,[k]:e.target.value})}/></label>)}
     {editando&&<label><input type="checkbox" checked={formulario.activo} onChange={e=>setFormulario({...formulario,activo:e.target.checked})}/> Activo</label>}
     <footer><button type="button" disabled={guardando} onClick={()=>setFormulario(null)}>Cancelar</button>
      <button type="submit" disabled={guardando}>{guardando?'Guardando…':'Guardar'}</button></footer>
    </form>
   </section>
  </div>}
 </section>;
}
