import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
type Categoria = { codigo: string; nombre: string };
type Documento = {
  id: string;
  perfilId: string | null;
  tipoDocumento: string;
  nombreArchivo: string;
  tipoMime: string;
  tamanoBytes: number;
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  observaciones: string | null;
  creadoEn: string;
  revisadoEn: string | null;
};
async function solicitar<T>(token: string, ruta: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(`${API}/familias${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opciones.headers },
    cache: 'no-store',
  });
  if (!respuesta.ok) {
    const fallo = await respuesta.json().catch(() => ({})) as { message?: string };
    throw new Error(fallo.message || 'Error consultando documentos familiares.');
  }
  return respuesta.json() as Promise<T>;
}
const estados: Record<Documento['estado'], string> = {
  PENDIENTE: 'Pendiente de revisión',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
};

export default function DocumentosFamilia({
  token, familiaId, puedeGestionar,
}: { token: string; familiaId: string; puedeGestionar: boolean }) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    Promise.all([
      solicitar<{ documentos: Documento[] }>(token, `/${familiaId}/documentos`),
      solicitar<{ categorias: Categoria[] }>(token, '/documentos/categorias'),
    ]).then(([docs, tipos]) => {
      if (!vigente) return;
      setDocumentos(docs.documentos);
      setCategorias(tipos.categorias);
    }).catch((fallo: Error) => {
      if (vigente) setError(fallo.message);
    }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [token, familiaId, recarga]);

  const tipo = (codigo: string) => categorias.find((item) => item.codigo === codigo)?.nombre || codigo;
  async function abrirDocumento(id: string) {
    if (procesandoId) return;
    setProcesandoId(id);
    setError('');
    try {
      const { url } = await solicitar<{ url: string }>(token, `/${familiaId}/documentos/${id}/descarga`);
      // Solo abrir una URL generada por la API de la misma sesión, no permitir enlaces guardados en el navegador.
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') throw new Error('Enlace privado no seguro.');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo abrir el PDF.');
    } finally { setProcesandoId(null); }
  }

  async function revisar(id: string, estado: 'APROBADO' | 'RECHAZADO') {
    if (procesandoId) return;
    setProcesandoId(id);
    setError('');
    setMensaje('');
    try {
      await solicitar(token, `/${familiaId}/documentos/${id}/revisar`, {
        method: 'POST',
        body: JSON.stringify({ estado, motivo: motivos[id]?.trim() || '' }),
      });
      setMensaje(estado === 'APROBADO' ? 'Documento aprobado.' : 'Documento rechazado con motivo.');
      setRecarga((n) => n + 1);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo revisar el PDF.');
    } finally { setProcesandoId(null); }
  }

  return (
    <section className="familias-documentos-aviso" aria-label="Expediente documental privado">
      <h3>Documentación acreditativa — PDF</h3>
      <p>Documentos privados de la familia. Solo el equipo autorizado podrá consultarlos; los donantes
        no tienen acceso a estas identificaciones ni constancias.</p>
      <p className="familias-nota">
        Categorías orientativas. Los requisitos obligatorios serán definidos por Ministerio Sal y Luz.
        La carga de nuevos PDF está pendiente de verificar el almacenamiento privado R2.
      </p>
      {error && <p role="alert" className="familias-error">{error}</p>}
      {mensaje && <p role="status" className="familias-aviso">{mensaje}</p>}
      {cargando && <p role="status">Consultando documentos…</p>}
      {!cargando && !documentos.length && (
        <p>Aún no existen documentos PDF confirmados en este expediente.</p>
      )}
      <div className="familias-lista">
        {documentos.map((doc) => (
          <article className="familias-tarjeta" key={doc.id}>
            <header>
              <div>
                <span className="familias-tarjeta__etiqueta">{tipo(doc.tipoDocumento)}</span>
                <h4>{doc.nombreArchivo}</h4>
              </div>
              <span className="familias-estado">{estados[doc.estado]}</span>
            </header>
            <p>{(doc.tamanoBytes / 1024 / 1024).toFixed(2)} MB · {new Date(doc.creadoEn).toLocaleDateString('es-HN')}</p>
            {doc.observaciones && <p>Observaciones de revisión: {doc.observaciones}</p>}
            <div className="familias-acciones">
              <button type="button" disabled={procesandoId !== null}
                onClick={() => void abrirDocumento(doc.id)}>Consultar PDF</button>
            </div>
            {puedeGestionar && doc.estado === 'PENDIENTE' && (
              <div className="familias-documentos-revision">
                <label>Motivo u observación
                  <textarea maxLength={2000} value={motivos[doc.id] ?? ''} rows={2}
                    onChange={(e) => setMotivos((actual) => ({ ...actual, [doc.id]: e.target.value }))} />
                </label>
                <div className="familias-acciones">
                  <button type="button" disabled={procesandoId !== null}
                    onClick={() => void revisar(doc.id, 'APROBADO')}>Aprobar documento</button>
                  <button type="button" disabled={procesandoId !== null || !motivos[doc.id]?.trim()}
                    onClick={() => void revisar(doc.id, 'RECHAZADO')}>Rechazar con motivo</button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
