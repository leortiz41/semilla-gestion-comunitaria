import { useEffect, useMemo, useState } from 'react';

const API=import.meta.env.VITE_API_URL||'http://localhost:3000/api';
type Solicitud={
 id:string;proyecto:string;concepto:string;monto:number;estado:string;
 proveedor:string|null;contratado:string|null;fecha:string;
 solicitante:string|null;solicitanteId:string|null;revisor:string|null;
 revisadoEn:string|null;motivoRevision:string|null;
};
type Vista='pendientes'|'aprobadas'|'rechazadas'|'historial';
const estados:Record<Vista,string[]>={
 pendientes:['SOLICITADA'],aprobadas:['APROBADA'],rechazadas:['RECHAZADA'],
 historial:['SOLICITADA','APROBADA','RECHAZADA','PAGADA','CANCELADA'],
};
const dinero=(n:number)=>new Intl.NumberFormat('es-HN',{style:'currency',currency:'HNL'}).format(n);
async function solicitar<T>(token:string,ruta:string,options:RequestInit={}):Promise<T>{
 const respuesta=await fetch(`${API}/pagos${ruta}`,{
  ...options,cache:'no-store',
  headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers},
 });
 if(!respuesta.ok){
  const error=await respuesta.json().catch(()=>({})) as {message?:string};
  throw Error(error.message||'No se pudo completar la revisión.');
 }
 return respuesta.json() as Promise<T>;
}
export default function BandejaAprobaciones({token,puedeGestionar,onActualizar}:{
 token:string;puedeGestionar:boolean;onActualizar:()=>void;
}){
 const [vista,setVista]=useState<Vista>('pendientes');
 const [solicitudes,setSolicitudes]=useState<Solicitud[]>([]);
 const [motivos,setMotivos]=useState<Record<string,string>>({});
 const [error,setError]=useState('');
 const [mensaje,setMensaje]=useState('');
 const [busqueda,setBusqueda]=useState('');
 const [cargando,setCargando]=useState(true);
 const [procesando,setProcesando]=useState<string|null>(null);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let vigente=true;setCargando(true);setError('');
  solicitar<{solicitudes:Solicitud[]}>(token,'/resumen')
   .then(r=>{if(vigente)setSolicitudes(r.solicitudes);})
   .catch((e:Error)=>{if(vigente)setError(e.message);})
   .finally(()=>{if(vigente)setCargando(false);});
  return()=>{vigente=false;};
 },[token,revision]);
 const conteos=useMemo(()=>Object.fromEntries(
  (Object.keys(estados) as Vista[]).map(v=>[v,solicitudes.filter(s=>estados[v].includes(s.estado)).length])
 ) as Record<Vista,number>,[solicitudes]);
 const visibles=useMemo(()=>solicitudes.filter(s=>
  estados[vista].includes(s.estado)&&
  [s.proyecto,s.concepto,s.proveedor||'',s.contratado||'',s.solicitante||'']
   .join(' ').toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es'))
 ),[solicitudes,vista,busqueda]);
 async function revisar(s:Solicitud,estado:'APROBADA'|'RECHAZADA'){
  const motivo=motivos[s.id]?.trim()||'';
  if(procesando||s.estado!=='SOLICITADA'||(estado==='RECHAZADA'&&!motivo))return;
  if(!window.confirm(estado==='APROBADA'?
   '¿Confirmás que revisaste el presupuesto y deseás aprobar esta solicitud?':
   '¿Confirmás que deseás rechazar esta solicitud con el motivo indicado?'))return;
  setProcesando(s.id);setError('');setMensaje('');
  try{
   await solicitar(token,`/solicitudes/${s.id}/revisar`,{
    method:'POST',body:JSON.stringify({estado,motivo}),
   });
   setMensaje(estado==='APROBADA'?'Solicitud aprobada.':'Solicitud rechazada con motivo.');
   setRevision(n=>n+1);onActualizar();
  }catch(e){setError(e instanceof Error?e.message:'No se pudo revisar la solicitud.');}
  finally{setProcesando(null);}
 }
 return <section className="pagos-bandeja" aria-label="Bandeja de aprobaciones de pagos">
  <header>
   <h2>Bandeja de aprobaciones</h2>
   <p>Revisá solicitudes por proyecto, consultá quién las presentó y autorizá o rechazá según el presupuesto disponible.</p>
  </header>
  <div className="pagos-bandeja__tabs" role="group" aria-label="Filtrar solicitudes por estado">
   {([
    ['pendientes','Pendientes'],['aprobadas','Aprobadas'],['rechazadas','Rechazadas'],['historial','Historial']
   ] as [Vista,string][]).map(([clave,nombre])=>
    <button type="button" key={clave} aria-pressed={vista===clave} onClick={()=>setVista(clave)}>
     {nombre} ({conteos[clave]})
    </button>
   )}
  </div>
  <label htmlFor="pagos-bandeja-buscar">Buscar por proyecto, concepto o solicitante
   <input id="pagos-bandeja-buscar" type="search" value={busqueda}
    placeholder="Ej. Construcción de vivienda"
    onChange={e=>setBusqueda(e.target.value)}/>
  </label>
  {error&&<p role="alert" className="pagos-error">{error}</p>}
  {mensaje&&<p role="status" className="pagos-aviso">{mensaje}</p>}
  {cargando&&<p role="status">Consultando solicitudes…</p>}
  {!cargando&&!visibles.length&&<p>No hay solicitudes para esta vista.</p>}
  <div className="pagos-listado">
   {visibles.map(s=><article key={s.id} className="pagos-bandeja__solicitud">
    <div className="pagos-bandeja__cabecera">
     <strong>{s.concepto}</strong><span>{s.estado}</span>
    </div>
    <p><strong>Proyecto:</strong> {s.proyecto}</p>
    <p><strong>Beneficiario:</strong> {s.proveedor||s.contratado||'Sin identificar'}</p>
    <p><strong>Importe solicitado:</strong> {dinero(s.monto)}</p>
    <p><strong>Solicitante:</strong> {s.solicitante||'No registrado'}</p>
    <p><strong>Fecha de solicitud:</strong> {s.fecha?new Date(s.fecha).toLocaleDateString('es-HN'):'No registrada'}</p>
    {s.revisor&&<p><strong>Revisó:</strong> {s.revisor}</p>}
    {s.revisadoEn&&<p><strong>Fecha de revisión:</strong> {new Date(s.revisadoEn).toLocaleString('es-HN')}</p>}
    {s.motivoRevision&&<p><strong>Motivo:</strong> {s.motivoRevision}</p>}
    {puedeGestionar&&vista==='pendientes'&&<div className="pagos-bandeja__revision">
     <label htmlFor={`pagos-motivo-${s.id}`}>Observaciones o motivo del rechazo
      <textarea id={`pagos-motivo-${s.id}`} maxLength={2000} rows={2}
       value={motivos[s.id]||''}
       onChange={e=>setMotivos(actual=>({...actual,[s.id]:e.target.value}))}/>
     </label>
     <div className="pagos-bandeja__acciones">
      <button type="button" disabled={procesando!==null||!s.solicitanteId}
       title={!s.solicitanteId?'No se puede aprobar una solicitud sin solicitante registrado.':undefined}
       onClick={()=>void revisar(s,'APROBADA')}>Aprobar</button>
      <button type="button" disabled={procesando!==null||!motivos[s.id]?.trim()||!s.solicitanteId}
       onClick={()=>void revisar(s,'RECHAZADA')}>Rechazar con motivo</button>
     </div>
     <small>Una persona distinta del solicitante debe revisar. El sistema comprueba los permisos y el presupuesto antes de aprobar.</small>
    </div>}
   </article>)}
  </div>
 </section>;
}
