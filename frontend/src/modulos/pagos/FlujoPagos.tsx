import { useEffect,useState,type FormEvent } from 'react';
import SelectorBuscable from './SelectorBuscable';
const API=import.meta.env.VITE_API_URL||'http://localhost:3000/api';
type Proyecto={id:string;nombre:string;presupuesto:number};
type Proveedor={id:string;nombre:string};
type Personal={id:string;proyectoId:string;nombre:string;cargo:string;valor:number};
type Opciones={proyectos:Proyecto[];proveedores:Proveedor[];personal:Personal[]};
type Solicitud={id:string;proyecto:string;concepto:string;monto:number;estado:string;proveedor:string|null;contratado:string|null};
type Abono={id:string;solicitudId:string;proyecto:string;monto:number;estado:string;fecha:string};
type Contrato={id:string;proyecto:string;persona:string;cargo:string;valor:number;estado:string};
type Resumen={solicitudes:Solicitud[];pagos:Abono[];contratos:Contrato[]};
async function api<T>(token:string,ruta:string,opciones:RequestInit={}):Promise<T>{
 const r=await fetch(`${API}/pagos${ruta}`,{...opciones,cache:'no-store',headers:{
  Authorization:`Bearer ${token}`,'Content-Type':'application/json',...opciones.headers,
 }});
 if(!r.ok){const d=await r.json().catch(()=>({})) as {message?:string};throw Error(d.message||'No se completó la operación.');}
 return r.json() as Promise<T>;
}
const dinero=(n:number)=>new Intl.NumberFormat('es-HN',{style:'currency',currency:'HNL'}).format(n);
export default function FlujoPagos({token,puedeGestionar,onActualizar}:{
 token:string;puedeGestionar:boolean;onActualizar:()=>void;
}){
 const [opciones,setOpciones]=useState<Opciones|null>(null);
 const [resumen,setResumen]=useState<Resumen|null>(null);
 const [cargando,setCargando]=useState(true);
 const [error,setError]=useState('');
 const [mensaje,setMensaje]=useState('');
 const [guardando,setGuardando]=useState(false);
 const [version,setVersion]=useState(0);
 const [formulario,setFormulario]=useState<'contrato'|'solicitud'|'abono'|null>(null);
 const [contrato,setContrato]=useState({proyectoId:'',primerNombre:'',primerApellido:'',cargo:'',tipoContrato:'Por obra',valorContrato:''});
 const [solicitud,setSolicitud]=useState({proyectoId:'',destinatarioTipo:'PROVEEDOR',destinatarioId:'',concepto:'',monto:''});
 const [abono,setAbono]=useState({solicitudId:'',monto:'',metodo:'TRANSFERENCIA',referencia:''});
 useEffect(()=>{
  let vigente=true;setCargando(true);
  Promise.all([api<Opciones>(token,'/opciones'),api<Resumen>(token,'/resumen')])
   .then(([o,r])=>{if(!vigente)return;setOpciones(o);setResumen(r);})
   .catch((e:Error)=>{if(vigente)setError(e.message);})
   .finally(()=>{if(vigente)setCargando(false);});
  return()=>{vigente=false;};
 },[token,version]);
 async function ejecutar(ruta:string,body:object,exito:string){
  if(guardando)return false;setGuardando(true);setError('');setMensaje('');
  try{await api(token,ruta,{method:'POST',body:JSON.stringify(body)});
   setMensaje(exito);setVersion(n=>n+1);onActualizar();return true;
  }catch(e){setError(e instanceof Error?e.message:'La operación no pudo completarse.');return false;}
  finally{setGuardando(false);}
 }
 async function enviarContrato(e:FormEvent){e.preventDefault();
  const ok=await ejecutar('/contratos',{...contrato,valorContrato:Number(contrato.valorContrato)},'Contratación registrada y asociada al proyecto.');
  if(ok)setFormulario(null);
 }
 async function enviarSolicitud(e:FormEvent){e.preventDefault();
  const ok=await ejecutar('/solicitudes',{...solicitud,monto:Number(solicitud.monto)},'Solicitud registrada. Está pendiente de revisión por otra persona autorizada.');
  if(ok)setFormulario(null);
 }
 async function enviarAbono(e:FormEvent){e.preventDefault();
  const ok=await ejecutar(`/solicitudes/${abono.solicitudId}/abonos`,{
   monto:Number(abono.monto),metodo:abono.metodo,referencia:abono.referencia,
  },'Abono registrado. Aún requiere confirmación por otro usuario.');
  if(ok)setFormulario(null);
 }
 const destinatarios=solicitud.destinatarioTipo==='PROVEEDOR'?
  opciones?.proveedores||[]:(opciones?.personal||[]).filter(p=>p.proyectoId===solicitud.proyectoId)
   .map(p=>({id:p.id,nombre:`${p.nombre} · ${p.cargo}`}));
 return <section className="pagos-flujo" aria-label="Ciclo de pagos por proyecto">
  <div className="pagos-flujo__cabecera">
   <h2>Gestión de contrataciones y solicitudes</h2>
   <p>Proyecto → Contratación o proveedor → Solicitud → Autorización → Abonos confirmados.</p>
   {puedeGestionar&&<div className="pagos-flujo__acciones">
    <button type="button" onClick={()=>setFormulario('contrato')}>+ Contratar personal</button>
    <button type="button" onClick={()=>setFormulario('solicitud')}>+ Solicitar pago</button>
    <button type="button" onClick={()=>setFormulario('abono')}>+ Registrar abono</button>
   </div>}
  </div>
  {error&&<p role="alert" className="pagos-error">{error}</p>}
  {mensaje&&<p role="status" className="pagos-aviso">{mensaje}</p>}
  {cargando&&<p role="status">Consultando movimientos…</p>}
  {formulario&&opciones&&<div className="pagos-flujo__formulario">
   <h3>{formulario==='contrato'?'Registrar personal contratado':formulario==='solicitud'?'Nueva solicitud de pago':'Registrar abono administrativo'}</h3>
   {formulario==='contrato'&&<form onSubmit={e=>void enviarContrato(e)}>
    <SelectorBuscable etiqueta="Proyecto *" valor={contrato.proyectoId}
     opciones={opciones.proyectos.map(p=>({id:p.id,nombre:p.nombre}))}
     alCambiar={proyectoId=>setContrato({...contrato,proyectoId})}
     placeholder="Seleccionar proyecto" vacio="No hay proyectos disponibles en esta organización."/>
    <label>Primer nombre *<input required maxLength={100} value={contrato.primerNombre} onChange={e=>setContrato({...contrato,primerNombre:e.target.value})}/></label>
    <label>Primer apellido *<input required maxLength={100} value={contrato.primerApellido} onChange={e=>setContrato({...contrato,primerApellido:e.target.value})}/></label>
    <label>Cargo u oficio *<input required maxLength={120} placeholder="Ej. Maestro de obra" value={contrato.cargo} onChange={e=>setContrato({...contrato,cargo:e.target.value})}/></label>
    <label>Tipo de contrato *<input required maxLength={80} value={contrato.tipoContrato} onChange={e=>setContrato({...contrato,tipoContrato:e.target.value})}/></label>
    <label>Valor pactado (L) *<input required type="number" min=".01" step=".01" value={contrato.valorContrato} onChange={e=>setContrato({...contrato,valorContrato:e.target.value})}/></label>
    <div className="pagos-flujo__acciones"><button disabled={guardando} type="submit">Guardar contratación</button><button type="button" onClick={()=>setFormulario(null)}>Cancelar</button></div>
   </form>}
   {formulario==='solicitud'&&<form onSubmit={e=>void enviarSolicitud(e)}>
    <SelectorBuscable etiqueta="Proyecto *" valor={solicitud.proyectoId}
     opciones={opciones.proyectos.map(p=>({id:p.id,nombre:p.nombre+' · presupuesto '+dinero(p.presupuesto)}))}
     alCambiar={proyectoId=>setSolicitud({...solicitud,proyectoId,destinatarioId:''})}
     placeholder="Seleccionar proyecto" vacio="No hay proyectos disponibles en esta organización."/>
    <label>¿A quién se pagará? *<select value={solicitud.destinatarioTipo} onChange={e=>setSolicitud({...solicitud,destinatarioTipo:e.target.value,destinatarioId:''})}>
     <option value="PROVEEDOR">Proveedor o contratista registrado</option><option value="PERSONAL">Trabajador contratado para el proyecto</option>
    </select></label>
    <SelectorBuscable etiqueta="Beneficiario del pago *" valor={solicitud.destinatarioId}
     opciones={destinatarios} alCambiar={destinatarioId=>setSolicitud({...solicitud,destinatarioId})}
     placeholder="Seleccionar beneficiario"
     vacio={solicitud.destinatarioTipo==='PERSONAL'
      ?(!solicitud.proyectoId?'Primero seleccioná un proyecto.':'No hay trabajadores contratados activos para este proyecto. Usá «+ Contratar personal» o cambiá a «Proveedor o contratista registrado».')
      :'No hay proveedores activos registrados en esta organización. Registralos en la pestaña Proveedores y contratistas.'}/> 
    <label>Concepto del pago *<input required maxLength={400} placeholder="Ej. Primer avance de construcción" value={solicitud.concepto} onChange={e=>setSolicitud({...solicitud,concepto:e.target.value})}/></label>
    <label>Monto solicitado (L) *<input required type="number" min=".01" step=".01" value={solicitud.monto} onChange={e=>setSolicitud({...solicitud,monto:e.target.value})}/></label>
    <p className="pagos-nota">La solicitud no se paga automáticamente. Otra persona deberá aprobarla, verificando presupuesto.</p>
    <div className="pagos-flujo__acciones"><button disabled={guardando} type="submit">Enviar solicitud</button><button type="button" onClick={()=>setFormulario(null)}>Cancelar</button></div>
   </form>}
   {formulario==='abono'&&<form onSubmit={e=>void enviarAbono(e)}>
    <SelectorBuscable etiqueta="Solicitud aprobada *" valor={abono.solicitudId}
     opciones={(resumen?.solicitudes||[]).filter(s=>['APROBADA','PAGADA'].includes(s.estado))
      .map(s=>({id:s.id,nombre:s.proyecto+' · '+s.concepto+' · '+dinero(s.monto)}))}
     alCambiar={solicitudId=>setAbono({...abono,solicitudId})} placeholder="Seleccionar solicitud"
     vacio="No hay solicitudes aprobadas para registrar un abono."/>
    <label>Importe del abono (L) *<input type="number" required min=".01" step=".01" value={abono.monto} onChange={e=>setAbono({...abono,monto:e.target.value})}/></label>
    <label>Método *<select value={abono.metodo} onChange={e=>setAbono({...abono,metodo:e.target.value})}>
     <option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo</option><option value="CHEQUE">Cheque</option><option value="OTRO">Otro</option>
    </select></label>
    <label>Referencia<input maxLength={120} value={abono.referencia} onChange={e=>setAbono({...abono,referencia:e.target.value})}/></label>
    <p className="pagos-nota">Registrar no significa confirmar ni transferir fondos. La confirmación requiere otro usuario autorizado.</p>
    <div className="pagos-flujo__acciones"><button disabled={guardando} type="submit">Registrar abono</button><button type="button" onClick={()=>setFormulario(null)}>Cancelar</button></div>
   </form>}
  </div>}
  {resumen&&<>
   <h3>Abonos registrados y confirmados</h3>
   <div className="pagos-listado">{resumen.pagos.map(p=><article key={p.id}>
    <strong>{dinero(p.monto)}</strong><span>{p.proyecto} · {p.fecha}</span><span>{p.estado}</span>
    {puedeGestionar&&p.estado==='REGISTRADO'&&<button type="button" disabled={guardando}
     onClick={()=>void ejecutar(`/abonos/${p.id}/confirmar`,{},'Abono confirmado y contabilizado.')}>Confirmar abono</button>}
   </article>)}
   {!resumen.pagos.length&&<p>Aún no se han registrado abonos.</p>}</div>
  </>}
 </section>;
}
