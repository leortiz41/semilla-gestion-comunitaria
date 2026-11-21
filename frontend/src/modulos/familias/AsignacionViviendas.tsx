import { useEffect, useMemo, useState, type FormEvent } from 'react';

const API=import.meta.env.VITE_API_URL||'http://localhost:3000/api';
type Familia={id:string;nombre:string;comunidad:string;comunidadId:string};
type Brigada={id:string;lider:string;donante:string;donanteId:string};
type Proyecto={id:string;nombre:string;comunidadId:string};
type Cuenta={id:string;email:string};
type Opciones={familias:Familia[];brigadas:Brigada[];proyectos:Proyecto[];cuentas:Cuenta[]};
type Datos={familiaId:string;brigadaId:string;cuentaId:string;proyectoId:string;nombreProyecto:string;fechaInicio:string;nivelRiesgo:string;numeroIntegrantes:number;numeroHabitaciones:number};
const vacio:Datos={familiaId:'',brigadaId:'',cuentaId:'',proyectoId:'',nombreProyecto:'',fechaInicio:new Date().toISOString().slice(0,10),nivelRiesgo:'',numeroIntegrantes:1,numeroHabitaciones:0};
async function api<T>(token:string,ruta:string,opciones:RequestInit={}):Promise<T>{
  const r=await fetch(`${API}/familias/viviendas${ruta}`,{
    ...opciones,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...opciones.headers},cache:'no-store',
  });
  if(!r.ok){const error=await r.json().catch(()=>({})) as {message?:string};throw Error(error.message||'No se completó la operación.');}
  return r.json() as Promise<T>;
}
export default function AsignacionViviendas({token,onTerminar}:{
  token:string;onTerminar:()=>void;
}){
  const [opciones,setOpciones]=useState<Opciones|null>(null);
  const [datos,setDatos]=useState<Datos>({...vacio});
  const [modo,setModo]=useState<'nuevo'|'existente'>('nuevo');
  const [error,setError]=useState('');
  const [mensaje,setMensaje]=useState('');
  const [guardando,setGuardando]=useState(false);
  const [cargando,setCargando]=useState(true);
  useEffect(()=>{
    let activo=true;
    api<Opciones>(token,'/opciones').then(o=>{if(activo)setOpciones(o);})
      .catch((e:Error)=>{if(activo)setError(e.message);})
      .finally(()=>{if(activo)setCargando(false);});
    return()=>{activo=false;};
  },[token]);
  const familia=opciones?.familias.find(f=>f.id===datos.familiaId);
  const proyectos=useMemo(()=>opciones?.proyectos.filter(p=>p.comunidadId===familia?.comunidadId)??[],[opciones,familia?.comunidadId]);
  const brigada=opciones?.brigadas.find(b=>b.id===datos.brigadaId);
  function campo<K extends keyof Datos>(clave:K,valor:Datos[K]){
    setDatos(actual=>({...actual,[clave]:valor}));
  }
  async function guardar(e:FormEvent){
    e.preventDefault();if(guardando)return;
    setGuardando(true);setError('');setMensaje('');
    try{
      const r=await api<{proyectoId:string}>(token,'/asignar',{method:'POST',body:JSON.stringify({
        ...datos,proyectoId:modo==='existente'?datos.proyectoId:null,
      })});
      setMensaje(`Asignación guardada. Proyecto vinculado: ${r.proyectoId}. Ya figura en el acceso de la cuenta donante seleccionada.`);
      setDatos({...vacio});onTerminar();
    }catch(e){setError(e instanceof Error?e.message:'No se pudo asignar la vivienda.');}
    finally{setGuardando(false);}
  }
  return <section className="familias-asignacion" aria-label="Asignación de viviendas">
    <header><h2>Asignación de viviendas</h2>
      <p>Seleccioná la familia, su brigada y el proyecto. Semilla relacionará todo sin repetir pasos en otros módulos.</p></header>
    {error&&<p role="alert" className="familias-error">{error}</p>}
    {mensaje&&<p role="status" className="familias-aviso">{mensaje}</p>}
    {cargando&&<p role="status">Cargando familias, brigadas y proyectos…</p>}
    {opciones&&<form onSubmit={e=>void guardar(e)} className="familias-evaluacion">
      <div className="familias-asignacion__paso">
        <h3>1. Familia registrada</h3>
        <label>Familia *
          <select required value={datos.familiaId} onChange={e=>{campo('familiaId',e.target.value);campo('proyectoId','');}}>
            <option value="">Seleccionar familia</option>
            {opciones.familias.map(f=><option value={f.id} key={f.id}>{f.nombre} · {f.comunidad}</option>)}
          </select>
        </label>
      </div>
      <div className="familias-asignacion__paso">
        <h3>2. Brigada patrocinadora y cuenta de acceso</h3>
        <div className="familias-campos-dos">
          <label>Brigada *
            <select required value={datos.brigadaId} onChange={e=>campo('brigadaId',e.target.value)}>
              <option value="">Seleccionar brigada</option>
              {opciones.brigadas.map(b=><option key={b.id} value={b.id}>{b.donante} · {b.lider}</option>)}
            </select>
          </label>
          <label>Cuenta DONANTE autorizada *
            <select required value={datos.cuentaId} onChange={e=>campo('cuentaId',e.target.value)}>
              <option value="">Seleccionar cuenta</option>
              {opciones.cuentas.map(u=><option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
          </label>
        </div>
        {brigada&&<p className="familias-nota">Brigada: {brigada.lider}. La cuenta seleccionada recibirá acceso a este proyecto; no verá el expediente familiar privado.</p>}
      </div>
      <div className="familias-asignacion__paso">
        <h3>3. Crear o vincular el proyecto</h3>
        <div className="familias-acciones">
          <label className="familias-casilla"><input type="radio" checked={modo==='nuevo'} onChange={()=>setModo('nuevo')}/> Nuevo proyecto de vivienda</label>
          <label className="familias-casilla"><input type="radio" checked={modo==='existente'} onChange={()=>setModo('existente')}/> Proyecto existente</label>
        </div>
        {modo==='nuevo'?<div className="familias-campos-dos">
          <label>Nombre del proyecto *
            <input maxLength={200} required value={datos.nombreProyecto} onChange={e=>campo('nombreProyecto',e.target.value)}
              placeholder="Ej. Construcción de vivienda" />
          </label>
          <label>Fecha de inicio *
            <input required type="date" value={datos.fechaInicio} onChange={e=>campo('fechaInicio',e.target.value)}/>
          </label>
        </div>:<label>Proyecto de la misma comunidad *
          <select required value={datos.proyectoId} disabled={!familia} onChange={e=>campo('proyectoId',e.target.value)}>
            <option value="">Seleccionar proyecto</option>
            {proyectos.map(p=><option value={p.id} key={p.id}>{p.nombre}</option>)}
          </select>
        </label>}
      </div>
      <div className="familias-asignacion__paso">
        <h3>4. Datos mínimos de evaluación</h3>
        <p className="familias-nota">Necesarios para abrir el perfil de vivienda. La familia permanecerá pendiente hasta validar sus documentos.</p>
        <div className="familias-campos-dos">
          <label>Número de integrantes *
            <input type="number" min={1} max={100} required value={datos.numeroIntegrantes}
              onChange={e=>campo('numeroIntegrantes',Number(e.target.value))}/>
          </label>
          <label>Habitaciones actuales *
            <input type="number" min={0} max={50} required value={datos.numeroHabitaciones}
              onChange={e=>campo('numeroHabitaciones',Number(e.target.value))}/>
          </label>
          <label>Nivel de riesgo evaluado *
            <select required value={datos.nivelRiesgo} onChange={e=>campo('nivelRiesgo',e.target.value)}>
              <option value="">Seleccionar nivel</option>
              <option value="BAJO">Bajo</option><option value="MEDIO">Medio</option>
              <option value="ALTO">Alto</option><option value="CRITICO">Crítico</option>
            </select>
          </label>
        </div>
      </div>
      <footer>
        <button className="familias-boton-principal" disabled={guardando||!opciones.familias.length||!opciones.brigadas.length||!opciones.cuentas.length} type="submit">
          {guardando?'Guardando relaciones…':'Confirmar y vincular'}
        </button>
      </footer>
    </form>}
    <p className="familias-nota">El mapa de impacto y las evidencias del proyecto se consultan desde la pestaña Evidencias del DONANTE. Las evidencias requieren validación y autorización antes de compartirse.</p>
  </section>;
}
