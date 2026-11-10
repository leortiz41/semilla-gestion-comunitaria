import { useEffect, useRef, useState } from 'react';
import { obtenerFotosAvance, subirFotoAvance, type EvidenciaFotografica } from '../../lib/api';
import '../../estilos/modulos/proyectos/fotografiasAvance.css';

type FotoPendiente = { id: string; archivo: File; vista: string };

export default function FotografiasAvance({
  token, proyectoId, actividadId, avanceId, permitirCarga = false,
}: {
  token: string; proyectoId: string; actividadId: string; avanceId: string; permitirCarga?: boolean;
}) {
  const [fotos, setFotos] = useState<EvidenciaFotografica[]>([]);
  const [pendientes, setPendientes] = useState<FotoPendiente[]>([]);
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [mensajeCarga, setMensajeCarga] = useState('');
  const [progreso, setProgreso] = useState('');
  const [ampliada, setAmpliada] = useState<EvidenciaFotografica | null>(null);
  const [version, setVersion] = useState(0);
  const vistasTemporales = useRef<string[]>([]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    obtenerFotosAvance(token, proyectoId, actividadId, avanceId).then(
      (respuesta) => { if (vigente) setFotos(respuesta.evidencias); },
      (fallo: Error) => { if (vigente) setError(fallo.message); },
    ).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [token, proyectoId, actividadId, avanceId, version]);

  useEffect(() => {
    const vistas = vistasTemporales.current;
    return () => { vistas.forEach((vista) => URL.revokeObjectURL(vista)); };
  }, []);

  function seleccionar(archivos: FileList | null) {
    if (!archivos?.length || subiendo) return;
    const seleccion = Array.from(archivos);
    if (seleccion.length + pendientes.length > 10) {
      setError('Podés seleccionar hasta 10 fotografías por carga.'); return;
    }
    const nueva: FotoPendiente[] = [];
    for (const archivo of seleccion) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
        setError('Solo se permiten fotos JPG, PNG y WebP.');
        nueva.forEach((foto) => URL.revokeObjectURL(foto.vista));
        return;
      }
      if (archivo.size === 0 || archivo.size > 10 * 1024 * 1024) {
        setError('Cada fotografía debe pesar más de 0 bytes y como máximo 10 MB.');
        nueva.forEach((foto) => URL.revokeObjectURL(foto.vista));
        return;
      }
      const vista = URL.createObjectURL(archivo);
      vistasTemporales.current.push(vista);
      nueva.push({ id: crypto.randomUUID(), archivo, vista });
    }
    setError('');
    setMensajeCarga('');
    setPendientes((actual) => [...actual, ...nueva]);
  }

  async function cargar() {
    if (!pendientes.length || subiendo) return;
    setSubiendo(true);
    setError('');
    setMensajeCarga('');
    let confirmadas = 0;
    try {
      for (const [indice, foto] of pendientes.entries()) {
        setProgreso(`Subiendo y registrando fotografía ${indice + 1} de ${pendientes.length}…`);
        await subirFotoAvance(token, proyectoId, actividadId, avanceId, foto.archivo);
        confirmadas++;
      }
      setProgreso('Verificando los registros en Neon…');
      const listado = await obtenerFotosAvance(token, proyectoId, actividadId, avanceId);
      setFotos(listado.evidencias);
      if (listado.evidencias.length < confirmadas) {
        setError('Las fotografías se enviaron, pero la consulta no confirmó todos los registros. No envíes el avance a revisión.');
        setVersion((n) => n + 1);
      } else {
        setMensajeCarga(`Carga confirmada: ${confirmadas} ${confirmadas === 1 ? 'fotografía registrada' : 'fotografías registradas'} en el avance.`);
      }
      setPendientes([]);
    } catch (fallo) {
      const detalle = fallo instanceof Error ? fallo.message : 'Error desconocido.';
      setError(`La carga quedó incompleta (${confirmadas} de ${pendientes.length}). ${detalle} No envíes el avance a revisión hasta resolverlo.`);
      // Conservar únicamente los archivos que aún no se confirmaron para reintentarlos.
      setPendientes((actual) => actual.slice(confirmadas));
      setVersion((n) => n + 1);
    } finally {
      setSubiendo(false);
      setProgreso('');
    }
  }

  return (
    <section className="fotos-avance" aria-label="Fotografías del avance">
      <div className="fotos-avance__encabezado">
        <div>
          <strong>Fotografías de evidencia</strong>
          <span className="fotos-avance__contador">{fotos.length} registradas</span>
        </div>
        {permitirCarga && (
          <label className="fotos-avance__subir">
            Seleccionar fotografías
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={subiendo}
              onChange={(e) => { seleccionar(e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {permitirCarga && <small>Seleccioná fotografías y verificá su vista previa. Después presioná «Subir y registrar» para guardarlas. JPG, PNG o WebP, máximo 10 MB por foto.</small>}
      {pendientes.length > 0 && permitirCarga && (
        <div className="fotos-avance__seleccion" aria-label="Fotografías pendientes de subir">
          <strong>Pendientes de guardar ({pendientes.length})</strong>
          <div className="fotos-avance__galeria">
            {pendientes.map((foto) => (
              <div className="fotos-avance__imagen fotos-avance__pendiente" key={foto.id}>
                <img src={foto.vista} alt={foto.archivo.name} />
                <small title={foto.archivo.name}>{foto.archivo.name}</small>
                <button type="button" disabled={subiendo} onClick={() =>
                  setPendientes((actual) => actual.filter((item) => item.id !== foto.id))
                }>Quitar</button>
              </div>
            ))}
          </div>
          <div className="fotos-avance__botones">
            <button type="button" className="fotos-avance__confirmar" disabled={subiendo}
              onClick={() => void cargar()}>{subiendo ? 'Registrando fotografías…' : `Subir y registrar ${pendientes.length} ${pendientes.length === 1 ? 'foto' : 'fotos'}`}</button>
            <button type="button" className="fotos-avance__cancelar" disabled={subiendo}
              onClick={() => setPendientes([])}>Cancelar selección</button>
          </div>
        </div>
      )}
      {progreso && <p role="status" className="fotos-avance__progreso">{progreso}</p>}
      {mensajeCarga && <p role="status" className="fotos-avance__exito">{mensajeCarga}</p>}
      {error && <p role="alert" className="fotos-avance__error">{error}</p>}
      {cargando && <p role="status">Consultando fotografías registradas…</p>}
      {!cargando && fotos.length === 0 && <p className="fotos-avance__vacio">Todavía no hay fotografías guardadas en este avance.</p>}
      <div className="fotos-avance__galeria">
        {fotos.map((foto) => (
          foto.url ? (
            <button type="button" key={foto.id} className="fotos-avance__imagen fotos-avance__foto-guardada"
              onClick={() => setAmpliada(foto)} title="Ampliar fotografía">
              <img src={foto.url} alt={foto.titulo ?? 'Fotografía de ejecución'} loading="lazy" />
              <small>{foto.titulo ?? 'Fotografía'}</small>
            </button>
          ) : <span key={foto.id}>Fotografía no disponible</span>
        ))}
      </div>
      {ampliada?.url && (
        <div className="fotos-avance__visor" role="dialog" aria-modal="true" aria-label="Vista ampliada de evidencia"
          onKeyDown={(evento) => { if (evento.key === 'Escape') setAmpliada(null); }}>
          <div className="fotos-avance__visor-contenido">
            <button type="button" className="fotos-avance__cerrar" onClick={() => setAmpliada(null)}>Cerrar ×</button>
            <img src={ampliada.url} alt={ampliada.titulo ?? 'Fotografía ampliada'} />
            <p>{ampliada.titulo ?? 'Fotografía de ejecución'}</p>
          </div>
        </div>
      )}
    </section>
  );
}
