export type ConfiguracionInstitucional={
 organizacionId:string;
 nombrePublico:string;
 lema:string;
 bienvenidaTitulo:string;
 bienvenidaTexto:string;
 colorPrimario:string;
 colorSecundario:string;
 colorFondo:string;
 logo:string|null;
 pdfPapel:'A4'|'LETTER'|'LEGAL';
 pdfOrientacion:'portrait'|'landscape';
 pdfMargenMm:number;
 pdfMostrarLogo:boolean;
 pdfMostrarLema:boolean;
};
const API=import.meta.env.VITE_API_URL||'http://localhost:3000/api';
export async function cargarConfiguracion(token:string):Promise<ConfiguracionInstitucional>{
 const r=await fetch(API+'/configuracion-institucional',{cache:'no-store',headers:{Authorization:'Bearer '+token}});
 if(!r.ok)throw Error('No fue posible consultar la configuración institucional.');
 const j=await r.json() as {configuracion:ConfiguracionInstitucional};
 return j.configuracion;
}
export async function guardarConfiguracion(token:string,configuracion:ConfiguracionInstitucional):Promise<ConfiguracionInstitucional>{
 const r=await fetch(API+'/configuracion-institucional',{
  method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(configuracion),
 });
 if(!r.ok){const e=await r.json().catch(()=>({})) as {message?:string};
  throw Error(e.message||'No fue posible guardar la configuración.');}
 const j=await r.json() as {configuracion:ConfiguracionInstitucional};
 return j.configuracion;
}
export function contraste(color:string):string{
 const c=color.replace('#','');
 const s=[0,2,4].map(i=>{
  const v=parseInt(c.slice(i,i+2),16)/255;
  return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
 });
 const luminancia=.2126*s[0]+.7152*s[1]+.0722*s[2];
 return luminancia>.179?'#172C20':'#FFFFFF';
}
