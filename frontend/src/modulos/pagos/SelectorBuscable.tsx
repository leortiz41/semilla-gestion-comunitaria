import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export type OpcionBuscable={id:string;nombre:string};
const normalizar=(texto:string)=>texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();

/** Un único campo de búsqueda y selección; nunca dos controles para la misma opción. */
export default function SelectorBuscable({
 etiqueta,opciones,valor,alCambiar,placeholder='Seleccionar',ayuda,
 vacio='No hay opciones disponibles.',requerido=true,deshabilitado=false,
}:{
 etiqueta:string;opciones:OpcionBuscable[];valor:string;alCambiar:(id:string)=>void;
 placeholder?:string;ayuda?:string;vacio?:string;requerido?:boolean;deshabilitado?:boolean;
}){
 const id=useId();
 const raiz=useRef<HTMLDivElement>(null);
 const entrada=useRef<HTMLInputElement>(null);
 const [abierto,setAbierto]=useState(false);
 const [texto,setTexto]=useState('');
 const [indice,setIndice]=useState(0);
 const seleccionado=opciones.find(o=>o.id===valor);
 const filtrados=useMemo(()=>{
  const buscar=normalizar(texto);
  return buscar?opciones.filter(o=>normalizar(o.nombre).includes(buscar)):opciones;
 },[opciones,texto]);
 useEffect(()=>{
  if(!abierto)setTexto(seleccionado?.nombre||'');
 },[seleccionado?.nombre,abierto]);
 useEffect(()=>{
  function fuera(e:PointerEvent){
   if(raiz.current&&!raiz.current.contains(e.target as Node))setAbierto(false);
  }
  document.addEventListener('pointerdown',fuera);
  return()=>document.removeEventListener('pointerdown',fuera);
 },[]);
 function elegir(opcion:OpcionBuscable){
  alCambiar(opcion.id);setTexto(opcion.nombre);setAbierto(false);setIndice(0);
  entrada.current?.focus();
 }
 function teclado(e:KeyboardEvent<HTMLInputElement>){
  if(e.key==='Escape'){setAbierto(false);setTexto(seleccionado?.nombre||'');return;}
  if(e.key==='ArrowDown'){
   e.preventDefault();if(!abierto){setAbierto(true);setIndice(0);}
   else setIndice(i=>Math.min(i+1,filtrados.length-1));
  }else if(e.key==='ArrowUp'){
   e.preventDefault();setIndice(i=>Math.max(i-1,0));
  }else if(e.key==='Enter'&&abierto){
   e.preventDefault();if(filtrados[indice])elegir(filtrados[indice]);
  }
 }
 return <div className="pagos-selector-buscable" ref={raiz}>
  <label htmlFor={id+'-campo'}>{etiqueta}</label>
  <div className="pagos-selector-buscable__control">
   <input ref={entrada} id={id+'-campo'} type="text" role="combobox"
    autoComplete="off" aria-autocomplete="list" aria-haspopup="listbox"
    aria-expanded={abierto} aria-controls={id+'-opciones'}
    aria-activedescendant={abierto&&filtrados[indice]?id+'-opcion-'+indice:undefined}
    aria-required={requerido} aria-invalid={requerido&&!valor&&texto.length>0}
    disabled={deshabilitado} value={texto}
    placeholder={opciones.length?placeholder:'Sin opciones disponibles'}
    onFocus={()=>{if(!deshabilitado){setAbierto(true);setIndice(0);setTexto('');}}}
    onChange={e=>{setTexto(e.target.value);setAbierto(true);setIndice(0);if(valor)alCambiar('');}}
    onKeyDown={teclado}
    onBlur={e=>{if(!raiz.current?.contains(e.relatedTarget as Node)){
     setAbierto(false);setTexto(seleccionado?.nombre||'');
    }}}/>
   <span className="pagos-selector-buscable__chevron" aria-hidden="true">⌄</span>
  </div>
  {abierto&&!deshabilitado&&<div id={id+'-opciones'} role="listbox"
    aria-label={'Resultados para '+etiqueta} className="pagos-selector-buscable__opciones">
   {filtrados.length?filtrados.slice(0,100).map((o,i)=><button
    type="button" role="option" id={id+'-opcion-'+i} key={o.id}
    aria-selected={o.id===valor} className={i===indice?'activo':''}
    onMouseDown={e=>e.preventDefault()} onClick={()=>elegir(o)}>
    {o.nombre}
   </button>):<div className="pagos-selector-buscable__sin-resultados">
    {opciones.length?vacio==='No hay opciones disponibles.'?'Sin coincidencias.': 'No hay coincidencias para tu búsqueda.':vacio}
   </div>}
   {filtrados.length>100&&<small>Mostrando 100 resultados. Escribí más para precisar la búsqueda.</small>}
  </div>}
  {ayuda&&<small className="pagos-ayuda">{ayuda}</small>}
  {!opciones.length&&!abierto&&<small className="pagos-selector-buscable__vacio" role="status">{vacio}</small>}
 </div>;
}
