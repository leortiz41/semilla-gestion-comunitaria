import { useEffect, useState, type FormEvent } from 'react';
import FlujoPagos from './FlujoPagos';
import BandejaAprobaciones from './BandejaAprobaciones';
import GestorContratos from './GestorContratos';
import '../../estilos/modulos/paginaModuloBase.css';
import '../../estilos/modulos/pagos/pagos.css';
const API=import.meta.env.VITE_API_URL||'http://localhost:3000/api';
type TipoProveedor={codigo:string;nombre:string;descripcion:string|null};
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
 const [vista,setVista]=useState<'pagos'|'aprobaciones'|'proveedores'|'contratos'>('pagos');
 const [proveedores,setProveedores]=useState<Proveedor[]>([]);
 const [tipos,setTipos]=useState<TipoProveedor[]>([]);
 const [nuevoTipo,setNuevoTipo]=useState(false);
 const [nombreTipo,setNombreTipo]=useState('');
 const [descripcionTipo,setDescripcionTipo]=useState('');
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
  Promise.all([
    api<{proveedores:Proveedor[]}>(token,'/proveedores'),
    api<Resumen>(token,'/pagos/resumen'),
    api<{tipos:TipoProveedor[]}>(token,'/proveedores/tipos'),
   ]).then(([p,r,t])=>{if(activo){setProveedores(p.proveedores);setResumen(r);setTipos(t.tipos);}})
   .catch((e:Error)=>{if(activo)setError(e.message);})
   .finally(()=>{if(activo)setCargando(false);});
  return()=>{activo=false;};
 },[token,version]);
 function abrir(p?:Proveedor){setNuevoTipo(false);setNombreTipo('');setDescripcionTipo('');setError('');
  setEditando(p?.id||null);setFormulario(p?{
  nombre:p.nombre,tipo:p.tipo,categoria:p.categoria||'',telefono:p.telefono||'',email:p.email||'',rtn:p.rtn||'',
  propietario:p.propietario||'',direccion:p.direccion||'',observaciones:p.observaciones||'',activo:p.activo}:{...vacio});}
 async function crearTipo(){
  const nombre=nombreTipo.trim();
  if(!nombre||guardando)return;
  setGuardando(true);setError('');
  try{
   const {tipo}=await api<{tipo:TipoProveedor}>(token,'/proveedores/tipos',{
    method:'POST',body:JSON.stringify({nombre,descripcion:descripcionTipo.trim()}),
   });
   setTipos(actual=>[...actual,tipo]);
   setFormulario(actual=>actual?{...actual,tipo:tipo.codigo}:null);
   setNuevoTipo(false);setNombreTipo('');setDescripcionTipo('');
  }catch(err){setError(err instanceof Error?err.message:'No fue posible guardar el nuevo tipo.');}
  finally{setGuardando(false);}
 }
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
   <button type="button" aria-pressed={vista==='aprobaciones'} onClick={()=>setVista('aprobaciones')}>Bandeja de aprobaciones{resumen ? ` (${resumen.solicitudes.filter(s=>s.estado==='SOLICITADA').length})` : ''}</button>
   <button type="button" aria-pressed={vista==='proveedores'} onClick={()=>setVista('proveedores')}>Proveedores y contratistas</button>
   <button type="button" aria-pressed={vista==='contratos'} onClick={()=>setVista('contratos')}>Gestor de contratos</button>
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
   <FlujoPagos token={token} puedeGestionar={puedeGestionar} onActualizar={()=>setVersion(n=>n+1)}/>

  </>}
  {vista==='aprobaciones'&&<BandejaAprobaciones token={token} puedeGestionar={puedeGestionar} onActualizar={()=>setVersion(n=>n+1)}/>}
  {vista==='contratos'&&<GestorContratos token={token} puedeGestionar={puedeGestionar}/>}
  {vista==='proveedores'&&<>
   <div className="pagos-herramientas">
    <label htmlFor="pagos-buscar-proveedor">Buscar proveedor o contratista <input id="pagos-buscar-proveedor" type="search" value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Nombre o especialidad"/></label>
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
     <label>Nombre comercial o completo *
      <input required maxLength={180} value={formulario.nombre}
       onChange={e=>setFormulario({...formulario,nombre:e.target.value})}
       placeholder="Ej. Ferretería El Centro o nombre de la persona"/>
      <small className="pagos-ayuda">Escribí el nombre de la empresa o de la persona que prestará el servicio.</small>
     </label>
     <label>Tipo *
      <select required value={nuevoTipo?'__crear__':formulario.tipo} disabled={guardando}
       onChange={e=>{
        if(e.target.value==='__crear__'){setNuevoTipo(true);return;}
        setNuevoTipo(false);setFormulario({...formulario,tipo:e.target.value});
       }}>
       {tipos.map(t=><option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
       <option value="__crear__">+ Crear nuevo tipo…</option>
      </select>
      <small className="pagos-ayuda">Clasificá qué clase de proveedor es. Ej.: Contratista para una obra o Servicios para transporte.</small>
     </label>
     {nuevoTipo&&<div className="pagos-nuevo-tipo">
      <h3>Crear tipo de proveedor</h3>
      <label>Nombre del nuevo tipo *
       <input maxLength={80} value={nombreTipo} onChange={e=>setNombreTipo(e.target.value)}
        placeholder="Ej. Transporte comunitario"/>
       <small className="pagos-ayuda">Escribí una categoría general reutilizable, no el nombre de una persona.</small>
      </label>
      <label>Descripción breve (opcional)
       <input maxLength={240} value={descripcionTipo} onChange={e=>setDescripcionTipo(e.target.value)}
        placeholder="Ej. Traslado de materiales y brigadas"/>
       <small className="pagos-ayuda">Explicá qué tipo de contratación incluirá esta categoría.</small>
      </label>
      <div className="pagos-acciones-tipo">
       <button type="button" disabled={guardando} onClick={()=>setNuevoTipo(false)}>Cancelar</button>
       <button type="button" disabled={guardando||nombreTipo.trim().length<2}
        onClick={()=>void crearTipo()}>Guardar y seleccionar tipo</button>
      </div>
     </div>}
     {(['categoria','rtn','propietario','telefono','email','direccion','observaciones'] as const).map(k=>
      <label key={k}>{({categoria:'Especialidad',rtn:'RTN',propietario:'Responsable',telefono:'Teléfono',email:'Correo',direccion:'Dirección',observaciones:'Observaciones'} as const)[k]}
       <input maxLength={k==='observaciones'?2000:k==='direccion'?1000:k==='categoria'?100:k==='rtn'?30:180}
        value={formulario[k]} onChange={e=>setFormulario({...formulario,[k]:e.target.value})}
        placeholder={({
          categoria:'Ej. Albañilería, soldadura, materiales',
          rtn:'RTN, si lo proporciona',
          propietario:'Nombre del representante o encargado',
          telefono:'Ej. +504 9999-9999',
          email:'Ej. contacto@empresa.com',
          direccion:'Dirección de referencia',
          observaciones:'Información útil para futuras contrataciones',
        } as const)[k]}/>
       <small className="pagos-ayuda">{({
          categoria:'Detallá el oficio, producto o servicio específico que ofrece.',
          rtn:'Registro Tributario Nacional, si corresponde; es opcional.',
          propietario:'Persona responsable con quien la organización se comunica.',
          telefono:'Número de contacto, preferiblemente con código de país.',
          email:'Correo electrónico para consultas y documentación.',
          direccion:'Ubicación o referencia donde opera el proveedor.',
          observaciones:'Anotá condiciones o información relevante; evitá incluir contraseñas o cuentas bancarias.',
        } as const)[k]}</small>
      </label>)}
     {editando&&<label><input type="checkbox" checked={formulario.activo} onChange={e=>setFormulario({...formulario,activo:e.target.checked})}/> Activo</label>}
     <footer><button type="button" disabled={guardando} onClick={()=>setFormulario(null)}>Cancelar</button>
      <button type="submit" disabled={guardando||nuevoTipo}>{guardando?'Guardando…':'Guardar'}</button></footer>
    </form>
   </section>
  </div>}
 </section>;
}
