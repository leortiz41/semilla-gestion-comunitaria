import { useEffect, useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import EditorContrato from './EditorContrato';
import SelectorBuscable from './SelectorBuscable';
import { completarPlantilla, plantillaMarco, variablesContrato } from './plantillaMarco';
import '../../estilos/modulos/pagos/gestorContratos.css';

const API=import.meta.env.VITE_API_URL||'http://localhost:3000/api';
type Proyecto={id:string;nombre:string};
type Proveedor={id:string;nombre:string;direccion:string|null};
type Personal={id:string;proyectoId:string;nombre:string;cargo:string;valorContrato:number};
type Opciones={organizacion:{nombre:string;nombre_legal:string|null};proyectos:Proyecto[];proveedores:Proveedor[];personal:Personal[]};
type Plantilla={id:string;nombre:string;contenido:JSONContent;version:number};
type Borrador={id:string;titulo:string;estado:string;version:number;proyectoId:string;proveedorId:string|null;personalId:string|null;plantillaId:string|null;contenido:JSONContent;proyecto:string};
const vacio=()=>Object.fromEntries(variablesContrato.map(x=>[x.clave,''])) as Record<string,string>;
async function pedir<T>(token:string,ruta:string,opciones:RequestInit={}):Promise<T>{
 const r=await fetch(API+'/pagos/gestor-contratos'+ruta,{...opciones,cache:'no-store',headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json',...opciones.headers
 }});
 if(!r.ok){const e=await r.json().catch(()=>({})) as {message?:string};throw Error(e.message||'No se pudo completar la operación.');}
 return r.json() as Promise<T>;
}
export default function GestorContratos({token,puedeGestionar}:{token:string;puedeGestionar:boolean}){
 const [opciones,setOpciones]=useState<Opciones|null>(null);
 const [plantillas,setPlantillas]=useState<Plantilla[]>([]);
 const [documentos,setDocumentos]=useState<Borrador[]>([]);
 const [vista,setVista]=useState<'borradores'|'plantillas'>('borradores');
 const [plantillaId,setPlantillaId]=useState('marco');
 const [plantillaEditando,setPlantillaEditando]=useState<Plantilla|null>(null);
 const [nombrePlantilla,setNombrePlantilla]=useState('Contrato de prestación de servicios');
 const [documentoId,setDocumentoId]=useState<string|null>(null);
 const [version,setVersion]=useState(0);
 const [titulo,setTitulo]=useState('Contrato de prestación de servicios');
 const [proyectoId,setProyectoId]=useState('');
 const [tipo,setTipo]=useState<'proveedor'|'personal'>('proveedor');
 const [beneficiarioId,setBeneficiarioId]=useState('');
 const [valores,setValores]=useState<Record<string,string>>(vacio());
 const [contenido,setContenido]=useState<JSONContent>(plantillaMarco);
 const [editorKey,setEditorKey]=useState(0);
 const [cargando,setCargando]=useState(true);
 const [guardando,setGuardando]=useState(false);
 const [error,setError]=useState('');
 const [mensaje,setMensaje]=useState('');
 const [recarga,setRecarga]=useState(0);
 useEffect(()=>{
  let activo=true;setCargando(true);setError('');
  Promise.all([
   pedir<Opciones>(token,'/opciones'),
   pedir<{plantillas:Plantilla[]}>(token,'/plantillas'),
   pedir<{documentos:Borrador[]}>(token,'/documentos'),
  ]).then(([o,p,d])=>{
   if(!activo)return;setOpciones(o);setPlantillas(p.plantillas);setDocumentos(d.documentos);
   setValores(actual=>({...actual,'organizacion.nombre':actual['organizacion.nombre']||o.organizacion.nombre_legal||o.organizacion.nombre}));
  }).catch((e:Error)=>{if(activo)setError(e.message);})
   .finally(()=>{if(activo)setCargando(false);});
  return()=>{activo=false;};
 },[token,recarga]);
 function cargarEditor(doc:JSONContent){setContenido(doc);setEditorKey(n=>n+1);}
 function reiniciar(){
  setVista('borradores');setDocumentoId(null);setVersion(0);
  setTitulo('Contrato de prestación de servicios');setProyectoId('');
  setBeneficiarioId('');setTipo('proveedor');setPlantillaId('marco');
  setValores({...vacio(),'organizacion.nombre':opciones?.organizacion.nombre_legal||opciones?.organizacion.nombre||''});
  cargarEditor(plantillaMarco);setError('');setMensaje('');
 }
 function abrir(doc:Borrador){
  setVista('borradores');setDocumentoId(doc.id);setVersion(doc.version);
  setTitulo(doc.titulo);setProyectoId(doc.proyectoId);
  setTipo(doc.personalId?'personal':'proveedor');
  setBeneficiarioId(doc.personalId||doc.proveedorId||'');setPlantillaId(doc.plantillaId||'marco');
  cargarEditor(doc.contenido);setError('');setMensaje('');
 }
 function prepararPlantilla(p?:Plantilla){
  setVista('plantillas');setPlantillaEditando(p||null);
  setNombrePlantilla(p?.nombre||'Nueva plantilla de servicios');
  cargarEditor(p?.contenido||plantillaMarco);setError('');setMensaje('');
 }
 function generar(){
  const proyecto=opciones?.proyectos.find(p=>p.id===proyectoId);
  const contratado=tipo==='proveedor'?opciones?.proveedores.find(p=>p.id===beneficiarioId):
   opciones?.personal.find(p=>p.id===beneficiarioId);
  const datos={...valores,
   'organizacion.nombre':opciones?.organizacion.nombre_legal||opciones?.organizacion.nombre||'',
   'proyecto.nombre':proyecto?.nombre||'',
   'contratista.nombre':contratado?.nombre||'',
  };
  setValores(datos);
  const base=plantillaId==='marco'?plantillaMarco:plantillas.find(p=>p.id===plantillaId)?.contenido||plantillaMarco;
  cargarEditor(completarPlantilla(base,datos));
  setMensaje('Borrador generado. Revisá el texto y las cláusulas antes de guardarlo.');
 }
 async function guardarPlantilla(){
  if(!puedeGestionar||guardando)return;
  setGuardando(true);setError('');setMensaje('');
  try{
   if(plantillaEditando){
    await pedir(token,'/plantillas/'+plantillaEditando.id,{method:'PUT',
     body:JSON.stringify({version:plantillaEditando.version,contenido})});
   }else{
    await pedir(token,'/plantillas',{method:'POST',body:JSON.stringify({nombre:nombrePlantilla,contenido})});
   }
   setMensaje('Plantilla guardada para esta organización.');setRecarga(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}
  finally{setGuardando(false);}
 }
 async function guardarDocumento(){
  if(!puedeGestionar||guardando)return;
  if(!documentoId&&(!proyectoId||!beneficiarioId)){
   setError('Seleccioná proyecto y contratista para guardar el borrador.');return;
  }
  setGuardando(true);setError('');setMensaje('');
  try{
   const datos=documentoId?{titulo,contenido,version}:{
    titulo,contenido,proyectoId,proveedorId:tipo==='proveedor'?beneficiarioId:null,
    personalId:tipo==='personal'?beneficiarioId:null,plantillaId:plantillaId==='marco'?null:plantillaId
   };
   const r=await pedir<{id:string;version:number}>(token,
    documentoId?'/documentos/'+documentoId:'/documentos',{
     method:documentoId?'PUT':'POST',body:JSON.stringify(datos)
    });
   setDocumentoId(r.id);setVersion(r.version);
   setMensaje('Borrador guardado, versión '+r.version+'. No equivale a contrato firmado.');
   setRecarga(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}
  finally{setGuardando(false);}
 }
 const contratados=tipo==='proveedor'?
  (opciones?.proveedores||[]).map(p=>({id:p.id,nombre:p.nombre})):
  (opciones?.personal||[]).filter(p=>p.proyectoId===proyectoId).map(p=>({id:p.id,nombre:p.nombre+' · '+p.cargo}));
 return <section className="gestor-contratos">
  <header><h2>Gestor de contratos</h2>
   <p>Usá machotes, completá los datos del proyecto y conservá las versiones de tus borradores.</p>
  </header>
  <div className="gestor-contratos__pestanas" role="group" aria-label="Secciones de contratos">
   <button type="button" aria-pressed={vista==='borradores'} onClick={()=>setVista('borradores')}>Contratos y borradores</button>
   <button type="button" aria-pressed={vista==='plantillas'} onClick={()=>setVista('plantillas')}>Plantillas</button>
  </div>
  {cargando&&<p role="status">Cargando gestor…</p>}
  {error&&<p role="alert" className="pagos-error">{error}</p>}
  {mensaje&&<p role="status" className="pagos-aviso">{mensaje}</p>}
  {opciones&&vista==='borradores'&&<>
   <div className="gestor-contratos__lista">
    <h3>Documentos guardados</h3>
    {documentos.map(d=><button key={d.id} type="button" onClick={()=>abrir(d)}>
     <strong>{d.titulo}</strong><span>{d.proyecto} · {d.estado} · Versión {d.version}</span>
    </button>)}
    {!documentos.length&&<p>No hay borradores guardados.</p>}
    {puedeGestionar&&<button type="button" onClick={reiniciar}>+ Nuevo borrador</button>}
   </div>
   <div className="gestor-contratos__campos">
    <label>Título del documento<input value={titulo} maxLength={180} disabled={!puedeGestionar}
     onChange={e=>setTitulo(e.target.value)}/></label>
    {!documentoId&&<>
     <label>Machote<select value={plantillaId} onChange={e=>setPlantillaId(e.target.value)}>
      <option value="marco">Prestación de servicios · plantilla inicial</option>
      {plantillas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
     </select></label>
     <SelectorBuscable etiqueta="Proyecto" valor={proyectoId} opciones={opciones.proyectos}
      requerido={false} alCambiar={id=>{setProyectoId(id);setBeneficiarioId('');}}
      vacio="No hay proyectos disponibles para la organización."/>
     <label>Tipo de contratación<select value={tipo} onChange={e=>{
      setTipo(e.target.value as 'proveedor'|'personal');setBeneficiarioId('');
     }}><option value="proveedor">Proveedor o contratista</option>
      <option value="personal">Personal contratado para proyecto</option></select></label>
     <SelectorBuscable etiqueta="Contratista" valor={beneficiarioId}
      opciones={contratados} requerido={false} alCambiar={setBeneficiarioId}
      vacio={tipo==='personal'?'No hay personal contratado para el proyecto.':'No hay proveedores disponibles en la organización.'}/>
     {variablesContrato.map(v=><label key={v.clave}>{v.etiqueta}
      <input maxLength={2500} value={valores[v.clave]||''}
       onChange={e=>setValores(a=>({...a,[v.clave]:e.target.value}))}/>
     </label>)}
     {puedeGestionar&&<button className="gestor-contratos__principal" type="button"
      onClick={generar}>Generar documento desde plantilla</button>}
    </>}
   </div>
   {documentoId&&<p className="pagos-nota">Versión {version}. La edición crea un historial; no modifica documentos anteriores.</p>}
   <h3>Editor y vista de hoja A4</h3>
   <EditorContrato key={editorKey} contenido={contenido} alCambiar={setContenido} soloLectura={!puedeGestionar}/>
   <div className="gestor-contratos__acciones">
    {puedeGestionar&&<button className="gestor-contratos__principal" type="button"
     disabled={guardando} onClick={()=>void guardarDocumento()}>{guardando?'Guardando…':'Guardar borrador'}</button>}
    <button type="button" onClick={()=>window.print()}>Imprimir / Guardar PDF desde el navegador</button>
   </div>
   <p className="pagos-nota">Este documento es un borrador. No representa un contrato firmado ni autoriza pagos por sí mismo.</p>
  </>}
  {opciones&&vista==='plantillas'&&<>
   <div className="gestor-contratos__lista">
    <h3>Plantillas disponibles</h3>
    <button type="button" onClick={()=>prepararPlantilla()}>+ Crear plantilla desde el machote</button>
    {plantillas.map(p=><button type="button" key={p.id} onClick={()=>prepararPlantilla(p)}>
     <strong>{p.nombre}</strong><span>Versión {p.version}</span>
    </button>)}
   </div>
   <label>Nombre de la plantilla<input maxLength={160} value={nombrePlantilla}
    disabled={!puedeGestionar||Boolean(plantillaEditando)}
    onChange={e=>setNombrePlantilla(e.target.value)}/></label>
   <p className="pagos-nota">Conservá variables como {'{{contratista.nombre}}'} en los machotes. Evitá guardar datos personales concretos en plantillas generales.</p>
   <EditorContrato key={editorKey} contenido={contenido} alCambiar={setContenido} soloLectura={!puedeGestionar}/>
   {puedeGestionar&&<button type="button" className="gestor-contratos__principal"
    disabled={guardando} onClick={()=>void guardarPlantilla()}>{guardando?'Guardando…':plantillaEditando?'Actualizar plantilla':'Guardar nueva plantilla'}</button>}
  </>}
 </section>;
}
