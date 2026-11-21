import { useEffect, useState, type FormEvent } from 'react';
const API=import.meta.env.VITE_API_URL||'http://localhost:3000/api';
type Integrante={id:string;primerNombre:string;segundoNombre:string|null;primerApellido:string;segundoApellido:string|null;parentesco:string|null;esJefeHogar:boolean;fechaNacimiento:string|null;ocupacion:string|null;fechaSalida:string|null;parentescoId:string|null;asisteEscuela:boolean|null;gradoEstudioId:string|null;gradoEstudio:string|null;nivelEstudio:string|null};
type Parentesco={id:string;nombre:string};
type Grado={id:string;nombre:string;nivel:string;organizacionId:string|null};
type Formulario={primerNombre:string;segundoNombre:string;primerApellido:string;segundoApellido:string;fechaNacimiento:string;ocupacion:string;parentescoId:string;esJefeHogar:boolean;asisteEscuela:string;gradoEstudioId:string};
const nuevo:Formulario={primerNombre:'',segundoNombre:'',primerApellido:'',segundoApellido:'',fechaNacimiento:'',ocupacion:'',parentescoId:'',esJefeHogar:false,asisteEscuela:'',gradoEstudioId:''};
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
  const [grados,setGrados]=useState<Grado[]>([]);
  const [editando,setEditando]=useState<string|null>(null);
  const [nuevoGrado,setNuevoGrado]=useState({nivel:'Básica',nombre:''});
  const [crearGrado,setCrearGrado]=useState(false);
  const [mensaje,setMensaje]=useState('');
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
      consultar<{grados:Grado[]}>(token,'/catalogos/grados-estudio'),
    ]).then(([personas,lista,escolaridad])=>{if(!activo)return;setIntegrantes(personas.integrantes);setParentescos(lista.parentescos);setGrados(escolaridad.grados);})
      .catch((e:Error)=>{if(activo)setError(e.message);})
      .finally(()=>{if(activo)setCargando(false);});
    return ()=>{activo=false;};
  },[token,familiaId,recarga]);
  async function guardar(e:FormEvent){
    e.preventDefault();if(!formulario||guardando)return;
    setGuardando(true);setError('');setMensaje('');
    try{
      await consultar(token,`/${familiaId}/integrantes${editando?'/'+editando:''}`,{
        method:editando?'PUT':'POST',body:JSON.stringify({...formulario,
        fechaNacimiento:formulario.fechaNacimiento||null,parentescoId:formulario.parentescoId||null,
        gradoEstudioId:formulario.asisteEscuela==='si'?(formulario.gradoEstudioId||null):null,
        asisteEscuela:formulario.asisteEscuela===''?null:formulario.asisteEscuela==='si',
      })});
      setMensaje(editando?'Integrante actualizado correctamente.':'Integrante registrado correctamente.');
      setFormulario(null);setEditando(null);setRecarga(n=>n+1);onActualizacion();
    }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el integrante.');}
    finally{setGuardando(false);}
  }
  function abrirEditar(p:Integrante){
    setEditando(p.id);setError('');setMensaje('');
    setFormulario({
      primerNombre:p.primerNombre,segundoNombre:p.segundoNombre||'',
      primerApellido:p.primerApellido,segundoApellido:p.segundoApellido||'',
      fechaNacimiento:p.fechaNacimiento||'',ocupacion:p.ocupacion||'',
      parentescoId:p.parentescoId||'',esJefeHogar:p.esJefeHogar,
      asisteEscuela:p.asisteEscuela===null?'':p.asisteEscuela?'si':'no',
      gradoEstudioId:p.gradoEstudioId||'',
    });
  }
  async function guardarGrado(){
    if(!nuevoGrado.nombre.trim()||guardando)return;
    setGuardando(true);setError('');
    try{
      const {grado}=await consultar<{grado:Grado}>(token,'/catalogos/grados-estudio',{
        method:'POST',body:JSON.stringify(nuevoGrado),
      });
      setGrados(actual=>[...actual,grado]);
      setFormulario(actual=>actual?{...actual,gradoEstudioId:grado.id,asisteEscuela:'si'}:null);
      setCrearGrado(false);setNuevoGrado({nivel:'Básica',nombre:''});
    }catch(e){setError(e instanceof Error?e.message:'No se pudo crear el grado.');}
    finally{setGuardando(false);}
  }
    async function salida(id:string){
    if(guardando||!window.confirm('¿Registrar la salida del hogar? Se conservará su historial.'))return;setGuardando(true);setError('');
    try{await consultar(token,`/${familiaId}/integrantes/${id}/salida`,{method:'POST'});
      setRecarga(n=>n+1);onActualizacion();}
    catch(e){setError(e instanceof Error?e.message:'No se pudo registrar la salida.');}
    finally{setGuardando(false);}
  }
  const campo=(nombre:keyof Formulario,valor:string|boolean)=>setFormulario(actual=>actual?{...actual,[nombre]:valor}:null);
  return <section className="familias-integrantes" aria-label="Integrantes del hogar">
    <header><h3>Integrantes del hogar</h3>{puedeGestionar&&!formulario&&<button type="button" onClick={()=>{setFormulario({...nuevo});setEditando(null);setMensaje('');}}>+ Agregar integrante</button>}</header>
    <p className="familias-nota">Se registran todos los integrantes del hogar, independientemente de su parentesco. Los números de identidad se gestionarán únicamente mediante documentación privada.</p>
    {error&&<p role="alert" className="familias-error">{error}</p>}
    {mensaje&&<p role="status" className="familias-aviso">{mensaje}</p>}
    {cargando&&<p role="status">Consultando integrantes…</p>}
    {!cargando&&!integrantes.length&&<p>Todavía no hay integrantes registrados.</p>}
    <div className="familias-lista">{integrantes.map(p=><article className="familias-tarjeta" key={p.id}>
      <h4>{[p.primerNombre,p.segundoNombre,p.primerApellido,p.segundoApellido].filter(Boolean).join(' ')}</h4>
      <p>{p.parentesco||'Parentesco por definir'}{p.esJefeHogar?' · Responsable del hogar':''}</p>
      {p.fechaNacimiento&&<p>Nacimiento: {p.fechaNacimiento}</p>}
      {p.ocupacion&&<p>Ocupación: {p.ocupacion}</p>}
      <p>Escolaridad: {p.asisteEscuela===null?'Por determinar':
        p.asisteEscuela?(`Asiste · ${p.nivelEstudio||''} ${p.gradoEstudio||'Grado no definido'}`):'No asiste'}</p>
      {p.fechaSalida?<span className="familias-estado">Salida del hogar: {p.fechaSalida} (historial conservado)</span>:puedeGestionar&&
        <div className="familias-acciones">
          <button type="button" disabled={guardando} onClick={()=>abrirEditar(p)}>Editar integrante</button>
          <button type="button" disabled={guardando} onClick={()=>void salida(p.id)}>Dar de baja del hogar</button>
        </div>}
    </article>)}</div>
    {formulario&&<form className="familias-evaluacion" onSubmit={(e)=>void guardar(e)}>
      <h4>{editando?'Editar integrante':'Nuevo integrante'}</h4><div className="familias-campos-dos">
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
        <label>¿Asiste a un centro educativo?
          <select value={formulario.asisteEscuela}
            onChange={e=>setFormulario({...formulario,asisteEscuela:e.target.value,gradoEstudioId:e.target.value==='si'?formulario.gradoEstudioId:''})}>
            <option value="">Por determinar</option><option value="si">Sí</option><option value="no">No</option>
          </select>
        </label>
        {formulario.asisteEscuela==='si'&&<label>Grado de estudio
          <select value={formulario.gradoEstudioId} onChange={e=>campo('gradoEstudioId',e.target.value)}>
            <option value="">Seleccione un grado</option>
            {grados.map(g=><option key={g.id} value={g.id}>{g.nivel} · {g.nombre}</option>)}
          </select>
        </label>}
        <label>Ocupación<input maxLength={120} value={formulario.ocupacion}
          onChange={e=>campo('ocupacion',e.target.value)}/></label>
        <label className="familias-casilla"><input type="checkbox" checked={formulario.esJefeHogar}
          onChange={e=>campo('esJefeHogar',e.target.checked)}/> Responsable del hogar</label>
      </div>
      {formulario.asisteEscuela==='si'&&<div>
        <button type="button" disabled={guardando} onClick={()=>setCrearGrado(!crearGrado)}>
          {crearGrado?'Cancelar nuevo grado':'+ Crear grado de estudio'}
        </button>
        {crearGrado&&<div className="familias-campos-dos">
          <label>Nivel educativo<input maxLength={60} value={nuevoGrado.nivel} onChange={e=>setNuevoGrado({...nuevoGrado,nivel:e.target.value})}/></label>
          <label>Nombre del grado<input maxLength={100} value={nuevoGrado.nombre} onChange={e=>setNuevoGrado({...nuevoGrado,nombre:e.target.value})}/></label>
          <button type="button" disabled={guardando||!nuevoGrado.nombre.trim()} onClick={()=>void guardarGrado()}>Guardar grado</button>
        </div>}
      </div>}
      <footer>
        <button type="button" disabled={guardando} onClick={()=>{setFormulario(null);setEditando(null);}}>Cancelar</button>
        <button className="familias-boton-principal" disabled={guardando} type="submit">{guardando?'Guardando…':editando?'Guardar cambios':'Guardar integrante'}</button>
      </footer>
    </form>}
  </section>;
}
