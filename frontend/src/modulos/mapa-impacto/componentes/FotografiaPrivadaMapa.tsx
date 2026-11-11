import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { renovarEnlaceFotografiaMapa } from '../../../servicios/mapa-impacto/servicioMapaImpacto';

export default function FotografiaPrivadaMapa({
  token, proyectoId, evidenciaId, titulo, compacta = false,
}: {
  token: string;
  proyectoId: string;
  evidenciaId: string;
  titulo: string;
  compacta?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const [modalCargando, setModalCargando] = useState(false);
  const [modalError, setModalError] = useState('');
  const reintento = useRef(false);
  const reintentoModal = useRef(false);
  const vigente = useRef(true);
  const botonAbrir = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const idTitulo = `foto-mapa-${evidenciaId}`;

  const renovar = useCallback(async () => {
    const respuesta = await renovarEnlaceFotografiaMapa(token, proyectoId, evidenciaId);
    if (vigente.current) {
      setUrl(respuesta.url);
      setError('');
    }
    return respuesta.url;
  }, [token, proyectoId, evidenciaId]);

  useEffect(() => {
    vigente.current = true;
    reintento.current = false;
    setCargando(true);
    setError('');
    setUrl(null);
    void renovar().catch((fallo: unknown) => {
      if (vigente.current) setError(fallo instanceof Error ? fallo.message : 'No se pudo consultar la fotografía.');
    }).finally(() => {
      if (vigente.current) setCargando(false);
    });
    return () => { vigente.current = false; };
  }, [renovar]);

  useEffect(() => {
    if (!modalAbierto) return;
    botonCerrar.current?.focus();
    const alTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        setModalAbierto(false);
      }
      // La ventana contiene un solo control interactivo: mantener el foco dentro del diálogo.
      if (evento.key === 'Tab') {
        evento.preventDefault();
        botonCerrar.current?.focus();
      }
    };
    document.addEventListener('keydown', alTeclado);
    return () => {
      document.removeEventListener('keydown', alTeclado);
      botonAbrir.current?.focus();
    };
  }, [modalAbierto]);

  function imagenFallida() {
    if (!reintento.current) {
      reintento.current = true;
      setCargando(true);
      void renovar().catch((fallo: unknown) => {
        if (vigente.current) setError(fallo instanceof Error ? fallo.message : 'No se pudo renovar la imagen.');
      }).finally(() => {
        if (vigente.current) setCargando(false);
      });
    } else {
      setUrl(null);
      setError('R2 rechazó la imagen. Intentá abrirla de nuevo.');
    }
  }

  async function actualizarModal() {
    setModalCargando(true);
    setModalError('');
    try {
      // Cada apertura o reintento solicita una firma fresca; no reutilizar enlaces vencidos.
      const enlace = await renovar();
      if (vigente.current) setModalUrl(enlace);
    } catch (fallo) {
      if (vigente.current) setModalError(
        fallo instanceof Error ? fallo.message : 'No fue posible abrir la fotografía.',
      );
    } finally {
      if (vigente.current) setModalCargando(false);
    }
  }

  function abrir() {
    reintentoModal.current = false;
    setModalUrl(null);
    setModalError('');
    setModalAbierto(true);
    void actualizarModal();
  }

  function errorImagenModal() {
    if (!reintentoModal.current) {
      reintentoModal.current = true;
      setModalUrl(null);
      void actualizarModal();
    } else {
      setModalUrl(null);
      setModalError('No se pudo mostrar la fotografía. Cerrá la ventana e intentá nuevamente.');
    }
  }

  return (
    <div className={compacta ? 'mapa-impacto__foto-privada mapa-impacto__foto-privada--compacta'
      : 'mapa-impacto__foto-privada'}>
      {url && <img src={url} alt={titulo} loading="lazy" onError={imagenFallida} />}
      {!url && <div className="mapa-impacto__foto-estado" role="status">
        {cargando ? 'Cargando imagen…' : (error || 'Imagen no disponible')}
      </div>}
      <button ref={botonAbrir} type="button" onClick={abrir}>
        Ver fotografía
      </button>
      {error && url && <small role="alert">{error}</small>}
      {modalAbierto && createPortal(
        <div className="mapa-impacto__visor-modal" onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) setModalAbierto(false);
        }}>
          <section className="mapa-impacto__visor-modal-contenido" role="dialog" aria-modal="true"
            aria-labelledby={idTitulo}>
            <header className="mapa-impacto__visor-modal-cabecera">
              <h2 id={idTitulo}>{titulo}</h2>
              <button ref={botonCerrar} type="button" onClick={() => setModalAbierto(false)}
                aria-label="Cerrar fotografía">Cerrar ✕</button>
            </header>
            <div className="mapa-impacto__visor-modal-imagen">
              {modalCargando && <p role="status">Cargando fotografía desde R2…</p>}
              {!modalCargando && modalError && <p role="alert">{modalError}</p>}
              {modalUrl && <img src={modalUrl} alt={titulo} onError={errorImagenModal} />}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
