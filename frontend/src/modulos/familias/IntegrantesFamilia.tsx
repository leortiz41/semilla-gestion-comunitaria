import { useEffect, useState, type FormEvent } from 'react';
const API=import.meta.env.VITE_API_URL||'http://localhost:3000/api';
type Integrante={id:string;primerNombre:string;segundoNombre:string|null;primerApellido:string;segundoApellido:string|null;parentesco:string|null;esJefeHogar:boolean;fechaNacimiento:string|null;ocupacion:string|null;fechaSalida:string|null};
type Parentesco={id:string;nombre:string};
type Formulario={primerNombre:string;segundoNombre:string;primerApellido:string;segundoApellido:string;fechaNacimiento:string;ocupacion:string;parentescoId:string;esJefeHogar:boolean};
const nuevo:Formulario={primerNombre:'',segundoNombre:'',primerApellido:'',segundoApellido:'',fechaNacimiento:'',ocupacion:'',parentescoId:'',esJefeHogar:false};
async function consultar<T>(token:string,ruta:string,opciones:RequestInit={}):Promise<T>{
  const respuesta=await fetch(`${API}/familias${ruta}`,{
    ...opciones,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...opciones.headers},cache:'no-store',
  });
  if(!respuesta.ok){const fallo=await respuesta.json().catch(()=>({})) as {message?:string};throw Error(fallo.message||'No fue posible completar la operación.');}
  return respuesta.status===204?undefined as T:respuesta.json() as Promise<T>;
}
export default function IntegrantesFamilia({token,familiaId,puedeGestionar,onActualizacion}:{
  token:string;familiaId:string;puedeGestionar:boolean;onActualizacion:()=>void;
}){
  const [integrantes,setIntegrantes]=useState<Integrante[]>([]);
  const [parentescos,setParentescos]=useState<Parentesco[]>([]);
  const [formulario,setFormulario]=useState<Formulario|null>(null);
  const [error,setError]=useState('');
  const [cargando,setCargando]=useState(true);
  const [guardando,setGuardando]=useState(false);
  const [recarga,setRecarga]=useState(0);
  useEffect(()=>{
    let activo=true;setCargando(true);
    Promise.all([
      consultar<{integrantes:Integrante[]}>(token,`/${familiaId}/integrantes`),
      consultar<{parentescos:Parentesco[]}>(token,'/catalogos/parentescos'),
    ]).then(([personas,lista])=>{if(!activo)return;setIntegrantes(personas.integrantes);setParentescos(lista.parentescos);})
      .catch((e:Error)=>{if(activo)setError(e.message);})
      .finally(()=>{if(activo)setCargando(false);});
    return ()=>{activo=false;};
  },[token,familiaId,recarga]);
  async function guardar(e:FormEvent){
    e.preventDefault();if(!formulario||guardando)return;
    setGuardando(true);setError('');
    try{
      await consultar(token,`/${familiaId}/integrantes`,{method:'POST',body:JSON.stringify({...formulario,
        fechaNacimiento:formulario.fechaNacimiento||null,parentescoId:formulario.parentescoId||null,
      })});
      setFormulario(null);setRecarga(n=>n+1);onActualizacion();
    }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el integrante.');}
    finally{setGuardando(false);}
  }
  async function salida(id:string){
    if(guardando)return;setGuardando(true);setError('');
    try{await consultar(token,`/${familiaId}/integrantes/${id}/salida`,{method:'POST'});
      setRecarga(n=>n+1);onActualizacion();}
    catch(e){setError(e instanceof Error?e.message:'No se pudo registrar la salida.');}
    finally{setGuardando(false);}
  }
  const campo=(nombre:keyof Formulario,valor:string|boolean)=>setFormulario(actual=>actual?{...actual,[nombre]:valor}:null);
  return <section className="familias-integrantes" aria-label="Integrantes del hogar">
    <header><h3>Integrantes del hogar</h3>{puedeGestionar&&!formulario&&<button type="button" onClick={()=>setFormulario({...nuevo})}>+ Agregar integrante</button>}</header>
    <p className="familias-nota">Se registran todos los integrantes del hogar, independientemente de su parentesco. Los números de identidad se gestionarán únicamente mediante documentación privada.</p>
    {error&&<p role="alert" className="familias-error">{error}</p>}
    {cargando&&<p role="status">Consultando integrantes…</p>}
    {!cargando&&!integrantes.length&&<p>Todavía no hay integrantes registrados.</p>}
    <div className="familias-lista">{integrantes.map(p=><article className="familias-tarjeta" key={p.id}>
      <h4>{[p.primerNombre,p.segundoNombre,p.primerApellido,p.segundoApellido].filter(Boolean).join(' ')}</h4>
      <p>{p.parentesco||'Parentesco por definir'}{p.esJefeHogar?' · Responsable del hogar':''}</p>
      {p.fechaNacimiento&&<p>Nacimiento: {p.fechaNacimiento}</p>}
      {p.ocupacion&&<p>Ocupación: {p.ocupacion}</p>}
      {p.fechaSalida?<span className="familias-estado">Salida: {p.fechaSalida}</span>:puedeGestionar&&
        <button type="button" disabled={guardando} onClick={()=>void salida(p.id)}>Registrar salida del hogar</button>}
    </article>)}</div>
    {formulario&&<form className="familias-evaluacion" onSubmit={(e)=>void guardar(e)}>
      <h4>Nuevo integrante</h4><div className="familias-campos-dos">
        <label>Primer nombre *<input required maxLength={100} value={formulario.primerNombre}
          onChange={e=>campo('primerNombre',e.target.value)}/></label>
        <label>Segundo nombre<input maxLength={100} value={formulario.segundoNombre}
          onChange={e=>campo('segundoNombre',e.target.value)}/></label>
        <label>Primer apellido *<input required maxLength={100} value={formulario.primerApellido}
          onChange={e=>campo('primerApellido',e.target.value)}/></label>
        <label>Segundo apellido<input maxLength={100} value={formulario.segundoApellido}
          onChange={e=>campo('segundoApellido',e.target.value)}/></label>
        <label>Fecha de nacimiento<input type="date" value={formulario.fechaNacimiento}
          onChange={e=>campo('fechaNacimiento',e.target.value)}/></label>
        <label>Parentesco<select value={formulario.parentescoId} onChange={e=>campo('parentescoId',e.target.value)}>
          <option value="">Por definir</option>{parentescos.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select></label>
        <label>Ocupación<input maxLength={120} value={formulario.ocupacion}
          onChange={e=>campo('ocupacion',e.target.value)}/></label>
        <label className="familias-casilla"><input type="checkbox" checked={formulario.esJefeHogar}
          onChange={e=>campo('esJefeHogar',e.target.checked)}/> Responsable del hogar</label>
      </div><footer>
        <button type="button" disabled={guardando} onClick={()=>setFormulario(null)}>Cancelar</button>
        <button className="familias-boton-principal" disabled={guardando} type="submit">{guardando?'Guardando…':'Guardar integrante'}</button>
      </footer>
    </form>}
  </section>;
}
