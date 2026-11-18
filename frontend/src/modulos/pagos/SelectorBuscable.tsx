import { useId, useMemo, useState } from 'react';

export type OpcionBuscable={id:string;nombre:string};
export default function SelectorBuscable({
 etiqueta,opciones,valor,alCambiar,placeholder='Seleccionar',ayuda,vacio='No hay opciones disponibles.',
 requerido=true,deshabilitado=false,
}:{
 etiqueta:string;opciones:OpcionBuscable[];valor:string;alCambiar:(valor:string)=>void;
 placeholder?:string;ayuda?:string;vacio?:string;requerido?:boolean;deshabilitado?:boolean;
}){
 const id=useId();
 const [busqueda,setBusqueda]=useState('');
 const filtradas=useMemo(()=>{
  const texto=busqueda.trim().toLocaleLowerCase('es');
  return texto?opciones.filter(o=>o.nombre.toLocaleLowerCase('es').includes(texto)):opciones;
 },[opciones,busqueda]);
 // Mantener visible la opción elegida al filtrar para evitar perder la selección por error.
 const seleccionada=valor?opciones.find(o=>o.id===valor):undefined;
 const visibles=seleccionada&&!filtradas.some(o=>o.id===seleccionada.id)
  ?[seleccionada,...filtradas]:filtradas;
 return <div className="pagos-selector-buscable">
  <label htmlFor={id+'-busqueda'}>{etiqueta}</label>
  <input id={id+'-busqueda'} type="search" value={busqueda} disabled={deshabilitado}
   placeholder="Escribí para buscar…" onChange={e=>setBusqueda(e.target.value)}
   aria-controls={id+'-seleccion'}/>
  <select id={id+'-seleccion'} aria-label={etiqueta} required={requerido}
   value={valor} disabled={deshabilitado||opciones.length===0} onChange={e=>alCambiar(e.target.value)}>
   <option value="">{placeholder}</option>
   {visibles.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}
  </select>
  {ayuda&&<small className="pagos-ayuda">{ayuda}</small>}
  {opciones.length===0&&<small className="pagos-selector-buscable__vacio" role="status">{vacio}</small>}
  {opciones.length>0&&visibles.length===0&&<small className="pagos-ayuda">Sin coincidencias para la búsqueda.</small>}
 </div>;
}
