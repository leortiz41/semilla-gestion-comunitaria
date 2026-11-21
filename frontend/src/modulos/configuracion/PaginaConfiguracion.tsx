import { useEffect,useState,type ChangeEvent } from 'react';
import type { ConfiguracionInstitucional } from './configuracionInstitucional';
import { cargarConfiguracion,guardarConfiguracion,contraste } from './configuracionInstitucional';
import logoSemilla from '../../assets/logo-semilla-app.png';
import '../../estilos/modulos/configuracionInstitucional.css';
type Seccion='identidad'|'apariencia'|'bienvenida'|'pdf';
const menus:[Seccion,string,string][]=[
 ['identidad','Identidad institucional','Nombre, lema y logotipo'],
 ['apariencia','Apariencia y colores','Paleta institucional'],
 ['bienvenida','Pantalla de bienvenida','Mensaje para los usuarios'],
 ['pdf','Documentos y PDF','Papel, márgenes y encabezado'],
];
export default function PaginaConfiguracion({token,onActualizar}:{
 token:string;onActualizar:(c:ConfiguracionInstitucional)=>void;
}){
 const [datos,setDatos]=useState<ConfiguracionInstitucional|null>(null);
 const [seccion,setSeccion]=useState<Seccion>('identidad');
 const [cargando,setCargando]=useState(true);
 const [guardando,setGuardando]=useState(false);
 const [error,setError]=useState('');
 const [mensaje,setMensaje]=useState('');
 const [original,setOriginal]=useState<ConfiguracionInstitucional|null>(null);
 useEffect(()=>{
  let vivo=true;
  cargarConfiguracion(token).then(c=>{if(vivo){setDatos(c);setOriginal(c);}})
   .catch((e:Error)=>{if(vivo)setError(e.message);})
   .finally(()=>{if(vivo)setCargando(false);});
  return()=>{vivo=false;};
 },[token]);
 const cambiar=<K extends keyof ConfiguracionInstitucional>(clave:K,valor:ConfiguracionInstitucional[K])=>{
  setDatos(actual=>actual?{...actual,[clave]:valor}:actual);setMensaje('');
 };
 function archivoLogo(e:ChangeEvent<HTMLInputElement>){
  const archivo=e.target.files?.[0];if(!archivo)return;
  if(!['image/png','image/jpeg','image/webp'].includes(archivo.type)||archivo.size>200000){
   setError('Usá una imagen PNG, JPG o WEBP de hasta 200 KB.');e.target.value='';return;
  }
  const lector=new FileReader();
  lector.onload=()=>{
   if(typeof lector.result==='string'){cambiar('logo',lector.result);setError('');}
  };
  lector.onerror=()=>setError('No se pudo leer el logotipo.');
  lector.readAsDataURL(archivo);
  e.target.value='';
 }
 async function guardar(){
  if(!datos||guardando)return;
  setGuardando(true);setError('');setMensaje('');
  try{
   const nuevo=await guardarConfiguracion(token,datos);
   setDatos(nuevo);setOriginal(nuevo);onActualizar(nuevo);
   setMensaje('Configuración institucional guardada correctamente.');
  }catch(e){setError(e instanceof Error?e.message:'No se pudieron guardar los ajustes.');}
  finally{setGuardando(false);}
 }
 const cambio=JSON.stringify(datos)!==JSON.stringify(original);
 return <section className="config-institucional" aria-labelledby="config-institucional-titulo">
  <header className="config-institucional__header">
   <div>
    <p className="config-institucional__eyebrow">Administración · Organización</p>
    <h1 id="config-institucional-titulo">Configuración institucional</h1>
    <p>Personalizá la identidad de tu organización sin alterar las demás organizaciones de Semilla.</p>
   </div>
   <button type="button" className="config-institucional__guardar" onClick={()=>void guardar()}
    disabled={!datos||guardando||!cambio}>{guardando?'Guardando…':'Guardar cambios'}</button>
  </header>
  {error&&<p role="alert" className="config-institucional__error">{error}</p>}
  {mensaje&&<p role="status" className="config-institucional__exito">{mensaje}</p>}
  {cargando&&<p role="status">Cargando configuración…</p>}
  {datos&&<div className="config-institucional__layout">
   <nav className="config-institucional__menu" aria-label="Apartados de configuración">
    {menus.map(([id,nombre,descripcion])=><button type="button" key={id} aria-current={seccion===id?'page':undefined}
     className={seccion===id?'activo':''} onClick={()=>setSeccion(id)}>
     <strong>{nombre}</strong><small>{descripcion}</small>
    </button>)}
   </nav>
   <div className="config-institucional__contenido">
    {seccion==='identidad'&&<div className="config-institucional__panel">
     <h2>Identidad institucional</h2>
     <p>Estos datos se mostrarán en el menú y los encabezados del espacio de tu organización.</p>
     <label htmlFor="institucion-nombre">Nombre público de la organización
      <input id="institucion-nombre" maxLength={150} required value={datos.nombrePublico}
       onChange={e=>cambiar('nombrePublico',e.target.value)} placeholder="Ej. Ministerio Sal y Luz"/>
      <small>El nombre que verán tus usuarios, sin modificar el nombre legal registrado.</small>
     </label>
     <label htmlFor="institucion-lema">Lema institucional
      <input id="institucion-lema" maxLength={240} value={datos.lema}
       onChange={e=>cambiar('lema',e.target.value)} placeholder="Ej. Recursos que generan desarrollo"/>
     </label>
     <div className="config-institucional__logo">
      <img src={datos.logo||logoSemilla} alt="Vista previa del logotipo institucional"/>
      <div><label htmlFor="institucion-logo">Logotipo de la organización
       <input id="institucion-logo" type="file" accept="image/png,image/jpeg,image/webp"
        onChange={archivoLogo}/>
      </label><small>PNG, JPG o WEBP. Tamaño máximo: 200 KB. Recomendado: imagen cuadrada con fondo transparente.</small>
       {datos.logo&&<button type="button" onClick={()=>cambiar('logo',null)}>Quitar logo personalizado</button>}
      </div>
     </div>
    </div>}
    {seccion==='apariencia'&&<div className="config-institucional__panel">
     <h2>Apariencia y colores</h2>
     <p>Elegí una combinación institucional. Se aplicará al menú, acentos y componentes que admiten el tema.</p>
     <div className="config-institucional__colores">
      {([['colorPrimario','Color principal'],['colorSecundario','Color de acento'],['colorFondo','Color de fondo']] as const)
       .map(([clave,nombre])=><label key={clave} htmlFor={'config-'+clave}>{nombre}
        <div className="config-institucional__color-input">
         <input type="color" id={'config-'+clave} value={datos[clave]} onChange={e=>cambiar(clave,e.target.value)}/>
         <code>{datos[clave].toUpperCase()}</code>
        </div>
       </label>)}
     </div>
     <div className="config-institucional__preview" style={{background:datos.colorFondo}}>
      <div style={{background:datos.colorPrimario,color:contraste(datos.colorPrimario)}}>Encabezado institucional</div>
      <p style={{color:'#243C2C'}}>{datos.nombrePublico}</p>
      <small style={{color:'#425F49'}}>{datos.lema}</small>
      <span style={{background:datos.colorSecundario,color:contraste(datos.colorSecundario)}}>Acción destacada</span>
     </div>
     <button type="button" onClick={()=>{
      cambiar('colorPrimario','#2D7545');setDatos(actual=>actual?{...actual,
       colorPrimario:'#2D7545',colorSecundario:'#D98B36',colorFondo:'#F5F8F2'}:actual);
     }}>Restaurar colores</button>
    </div>}
    {seccion==='bienvenida'&&<div className="config-institucional__panel">
     <h2>Pantalla de bienvenida</h2>
     <p>Personalizá el mensaje que aparece al ingresar al dashboard de tu organización.</p>
     <label htmlFor="bienvenida-titulo">Título principal
      <input id="bienvenida-titulo" maxLength={160} value={datos.bienvenidaTitulo}
       onChange={e=>cambiar('bienvenidaTitulo',e.target.value)}/>
     </label>
     <label htmlFor="bienvenida-texto">Mensaje institucional
      <textarea id="bienvenida-texto" rows={4} maxLength={500} value={datos.bienvenidaTexto}
       onChange={e=>cambiar('bienvenidaTexto',e.target.value)}/>
     </label>
     <div className="config-institucional__bienvenida-preview">
      <span>Vista previa del dashboard</span>
      <h3>{datos.bienvenidaTitulo}</h3><p>{datos.bienvenidaTexto}</p>
      <small>{datos.nombrePublico} · {datos.lema}</small>
     </div>
    </div>}
    {seccion==='pdf'&&<div className="config-institucional__panel">
     <h2>Documentos e impresión PDF</h2>
     <p>Preferencias institucionales para la impresión de contratos y documentos que utilicen el sistema de impresión de Semilla.</p>
     <div className="config-institucional__campos-dobles">
      <label htmlFor="pdf-papel">Tamaño del papel
       <select id="pdf-papel" value={datos.pdfPapel}
        onChange={e=>cambiar('pdfPapel',e.target.value as ConfiguracionInstitucional['pdfPapel'])}>
        <option value="A4">A4 (210 × 297 mm)</option><option value="LETTER">Carta (216 × 279 mm)</option>
        <option value="LEGAL">Oficio / Legal (216 × 356 mm)</option>
       </select>
      </label>
      <label htmlFor="pdf-orientacion">Orientación
       <select id="pdf-orientacion" value={datos.pdfOrientacion}
        onChange={e=>cambiar('pdfOrientacion',e.target.value as ConfiguracionInstitucional['pdfOrientacion'])}>
        <option value="portrait">Vertical</option><option value="landscape">Horizontal</option>
       </select>
      </label>
      <label htmlFor="pdf-margen">Márgenes (mm)
       <input id="pdf-margen" type="number" min={8} max={35} step={1} value={datos.pdfMargenMm}
        onChange={e=>cambiar('pdfMargenMm',Number(e.target.value))}/>
      </label>
     </div>
     <label className="config-institucional__check"><input type="checkbox" checked={datos.pdfMostrarLogo}
      onChange={e=>cambiar('pdfMostrarLogo',e.target.checked)}/> Incluir logo institucional en documentos compatibles</label>
     <label className="config-institucional__check"><input type="checkbox" checked={datos.pdfMostrarLema}
      onChange={e=>cambiar('pdfMostrarLema',e.target.checked)}/> Incluir lema institucional en documentos compatibles</label>
     <div className="config-institucional__nota">
      Los ajustes de papel, orientación y márgenes se aplican a la impresión desde el navegador. Los PDF generados
      mediante otros motores requieren integrar estas preferencias en cada plantilla.
     </div>
    </div>}
   </div>
  </div>}
 </section>;
}
