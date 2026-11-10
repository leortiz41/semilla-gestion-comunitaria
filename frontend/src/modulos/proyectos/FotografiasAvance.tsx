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
    if (archivos.length > 10) { setError('Podés seleccionar hasta 10 fotografías por carga.'); return; }
    setSubiendo(true);
    setError('');
    try {
      for (const foto of Array.from(archivos)) {
        await subirFotoAvance(token, proyectoId, actividadId, avanceId, foto);
      }
      setVersion((n) => n + 1);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar la fotografía.');
      setVersion((n) => n + 1);
    } finally {
      setSubiendo(false);
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
