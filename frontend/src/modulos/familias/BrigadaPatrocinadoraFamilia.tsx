import { useEffect, useState } from 'react';
const API=import.meta.env.VITE_API_URL||'http://localhost:3000/api';
type Brigada={id:string;donante:string;lider:string;asignada:boolean};
async function pedir<T>(ruta:string,token:string,opciones:RequestInit={}):Promise<T>{
  const respuesta=await fetch(`${API}/familias${ruta}`,{
    ...opciones,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...opciones.headers},cache:'no-store',
  });
  if(!respuesta.ok){
    const fallo=await respuesta.json().catch(()=>({})) as {message?:string};
    throw Error(fallo.message||'No fue posible actualizar la brigada.');
  }
  return respuesta.json() as Promise<T>;
}
export default function BrigadaPatrocinadoraFamilia({token,familiaId,perfilId,puedeGestionar}:{
  token:string;familiaId:string;perfilId:string;puedeGestionar:boolean;
}){
  const [brigadas,setBrigadas]=useState<Brigada[]>([]);
  const [seleccion,setSeleccion]=useState('');
  const [cargando,setCargando]=useState(true);
  const [guardando,setGuardando]=useState(false);
  const [error,setError]=useState('');
  const [mensaje,setMensaje]=useState('');
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    let vigente=true;setCargando(true);
    pedir<{brigadas:Brigada[]}>(`/${familiaId}/perfiles/${perfilId}/brigadas`,token)
      .then(({brigadas:lista})=>{if(!vigente)return;
        setBrigadas(lista);setSeleccion(lista.find(b=>b.asignada)?.id||'');
      }).catch((e:Error)=>{if(vigente)setError(e.message);})
      .finally(()=>{if(vigente)setCargando(false);});
    return()=>{vigente=false;};
  },[token,familiaId,perfilId,version]);
  async function guardar(){
    if(guardando)return;setGuardando(true);setError('');setMensaje('');
    try{
      await pedir(`/${familiaId}/perfiles/${perfilId}/brigada`,token,{
        method:'PUT',body:JSON.stringify({brigadaId:seleccion||null}),
      });
      setMensaje(seleccion?'Brigada patrocinadora asignada correctamente.':'Asignación de brigada retirada.');
      setVersion(v=>v+1);
    }catch(e){setError(e instanceof Error?e.message:'No fue posible guardar la asignación.');}
    finally{setGuardando(false);}
  }
  return <section className="familias-brigada">
    <h4>Brigada patrocinadora de esta familia</h4>
    <p className="familias-nota">Solo se pueden asignar brigadas vinculadas al proyecto de vivienda de esta familia.
      El acceso del donante nunca incluye identidad ni PDF privados.</p>
    {cargando&&<p role="status">Consultando brigadas…</p>}
    {error&&<p role="alert" className="familias-error">{error}</p>}
    {mensaje&&<p role="status" className="familias-aviso">{mensaje}</p>}
    {!cargando&&<div className="familias-acciones">
      <label>Brigada vinculada
        <select value={seleccion} disabled={!puedeGestionar||guardando}
          onChange={e=>setSeleccion(e.target.value)}>
          <option value="">Sin brigada asignada</option>
          {brigadas.map(b=><option value={b.id} key={b.id}>{b.donante} · {b.lider}</option>)}
        </select>
      </label>
      {puedeGestionar&&<button type="button" disabled={guardando}
        onClick={()=>void guardar()}>{guardando?'Guardando…':'Guardar asignación'}</button>}
    </div>}
    {!cargando&&!brigadas.length&&<p className="familias-nota">
      Aún no hay brigadas activas vinculadas a este proyecto. Primero asigná el proyecto a la brigada desde Donantes.
    </p>}
  </section>;
}
