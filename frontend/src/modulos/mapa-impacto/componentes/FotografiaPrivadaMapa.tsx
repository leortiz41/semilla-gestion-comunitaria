import { useCallback, useEffect, useRef, useState } from 'react';
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
  const reintento = useRef(false);
  const vigente = useRef(true);
  const renovar = useCallback(async () => {
    try {
      const respuesta = await renovarEnlaceFotografiaMapa(token, proyectoId, evidenciaId);
      if (vigente.current) {
        setUrl(respuesta.url);
        setError('');
      }
      return respuesta.url;
    } catch (fallo) {
      if (vigente.current) {
        setError(fallo instanceof Error ? fallo.message : 'No se pudo consultar la fotografía.');
        setUrl(null);
      }
      throw fallo;
    }
  }, [token, proyectoId, evidenciaId]);

  useEffect(() => {
    vigente.current = true;
    reintento.current = false;
    setCargando(true);
    setError('');
    setUrl(null);
    void renovar().catch(() => undefined).finally(() => {
      if (vigente.current) setCargando(false);
    });
    return () => { vigente.current = false; };
  }, [renovar]);

  function imagenFallida() {
    // Un GET a R2 puede vencer mientras el usuario explora: reintentar una sola vez.
    if (!reintento.current) {
      reintento.current = true;
      setCargando(true);
      void renovar().catch(() => undefined).finally(() => {
        if (vigente.current) setCargando(false);
      });
    } else {
      setUrl(null);
      setError('R2 rechazó la imagen. Verificá el acceso o intentá renovar el enlace.');
    }
  }

  async function abrir() {
    // Se crea desde el clic para que el navegador no bloquee la nueva pestaña.
    const ventana = window.open('about:blank', '_blank');
    if (!ventana) {
      setError('El navegador bloqueó la pestaña. Permití ventanas emergentes para abrir la fotografía.');
      return;
    }
    try {
      ventana.opener = null;
      const enlace = await renovar();
      ventana.location.replace(enlace);
    } catch {
      ventana.close();
    }
  }

  return (
    <div className={compacta ? 'mapa-impacto__foto-privada mapa-impacto__foto-privada--compacta'
      : 'mapa-impacto__foto-privada'}>
      {url && <img src={url} alt={titulo} loading="lazy" onError={imagenFallida} />}
      {!url && <div className="mapa-impacto__foto-estado" role="status">
        {cargando ? 'Cargando imagen…' : (error || 'Imagen no disponible')}
      </div>}
      <button type="button" disabled={cargando} onClick={() => void abrir()}>
        Abrir fotografía
      </button>
      {error && url && <small role="alert">{error}</small>}
    </div>
  );
}
