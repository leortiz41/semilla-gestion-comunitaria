import { useEffect, useState } from 'react';
import { obtenerFotosAvance, subirFotoAvance, type EvidenciaFotografica } from '../../lib/api';
import '../../estilos/modulos/proyectos/fotografiasAvance.css';

export default function FotografiasAvance({
  token, proyectoId, actividadId, avanceId, permitirCarga = false,
}: {
  token: string; proyectoId: string; actividadId: string; avanceId: string; permitirCarga?: boolean;
}) {
  const [fotos, setFotos] = useState<EvidenciaFotografica[]>([]);
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [mensajeCarga, setMensajeCarga] = useState('');
  const [progreso, setProgreso] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    obtenerFotosAvance(token, proyectoId, actividadId, avanceId).then(
      (respuesta) => { if (vigente) setFotos(respuesta.evidencias); },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    ).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [token, proyectoId, actividadId, avanceId, version]);

  async function cargar(archivos: FileList | null) {
    if (!archivos?.length || subiendo) return;
    const seleccion = Array.from(archivos);
    if (seleccion.length > 10) { setError('Podés seleccionar hasta 10 fotografías por carga.'); return; }
    setSubiendo(true);
    setError('');
    setMensajeCarga('');
    let confirmadas = 0;
    try {
      for (const [indice, foto] of seleccion.entries()) {
        setProgreso(`Subiendo y registrando fotografía ${indice + 1} de ${seleccion.length}…`);
        await subirFotoAvance(token, proyectoId, actividadId, avanceId, foto);
        confirmadas++;
      }
      setProgreso('Verificando que las fotografías aparezcan en el avance…');
      const listado = await obtenerFotosAvance(token, proyectoId, actividadId, avanceId);
      setFotos(listado.evidencias);
      if (listado.evidencias.length < confirmadas) {
        setError('La carga terminó, pero no se pudo confirmar que todas las fotos aparezcan en el registro. No envíes todavía el avance a revisión.');
      } else {
        setMensajeCarga(`Carga confirmada: ${confirmadas} ${confirmadas === 1 ? 'fotografía registrada' : 'fotografías registradas'} en el avance.`);
      }
    } catch (fallo) {
      const detalle = fallo instanceof Error ? fallo.message : 'Error desconocido.';
      setError(`No se completó la carga (${confirmadas} de ${seleccion.length} confirmadas). ${detalle} No envíes el avance a revisión hasta resolverlo.`);
      setVersion((n) => n + 1);
    } finally {
      setSubiendo(false);
      setProgreso('');
    }
  }

  return (
    <section className="fotos-avance" aria-label="Fotografías del avance">
      <div className="fotos-avance__encabezado">
        <strong>Fotografías de evidencia ({fotos.length})</strong>
        {permitirCarga && (
          <label className="fotos-avance__subir">
            {subiendo ? 'Subiendo fotos…' : '+ Adjuntar fotos'}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={subiendo}
              onChange={(e) => { void cargar(e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {permitirCarga && <small>JPG, PNG o WebP; hasta 10 MB por fotografía. Adjuntá fotos antes de enviar el avance a revisión.</small>}
      {progreso && <p role="status" className="fotos-avance__progreso">{progreso}</p>}
      {mensajeCarga && <p role="status" className="fotos-avance__exito">{mensajeCarga}</p>}
      {error && <p role="alert" className="fotos-avance__error">{error}</p>}
      {cargando && <p role="status">Cargando fotografías…</p>}
      {!cargando && fotos.length === 0 && <p className="fotos-avance__vacio">Todavía no hay fotografías vinculadas.</p>}
      <div className="fotos-avance__galeria">
        {fotos.map((foto) => (
          foto.url ? (
            <a key={foto.id} href={foto.url} target="_blank" rel="noopener noreferrer"
              className="fotos-avance__imagen" title={foto.titulo ?? 'Ampliar fotografía'}>
              <img src={foto.url} alt={foto.titulo ?? 'Fotografía de ejecución'} loading="lazy" />
              <small>{foto.titulo ?? 'Fotografía'}</small>
            </a>
          ) : <span key={foto.id}>Fotografía no disponible</span>
        ))}
      </div>
    </section>
  );
}
