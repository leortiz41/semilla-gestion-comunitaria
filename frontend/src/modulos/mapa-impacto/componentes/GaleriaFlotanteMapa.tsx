import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Images, X } from 'lucide-react';
import FotografiaPrivadaMapa from './FotografiaPrivadaMapa';
import type { DetalleImpacto } from '../../../servicios/mapa-impacto/servicioMapaImpacto';

export default function GaleriaFlotanteMapa({
  token, proyectoId, fotos, cerrar,
}: {
  token: string;
  proyectoId: string;
  fotos: DetalleImpacto['evidencias'];
  cerrar: () => void;
}) {
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const tituloId = 'mapa-impacto-galeria-titulo';

  useEffect(() => {
    const elementoAnterior = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    botonCerrar.current?.focus();
    const alTeclado = (evento: KeyboardEvent) => {
      // Si una fotografía está ampliada, Escape corresponde primero a su visor.
      if (document.querySelector('.mapa-impacto__visor-modal')) return;
      if (evento.key === 'Escape') { evento.preventDefault(); cerrar(); }
      if (evento.key === 'Tab') {
        const controles = Array.from(document.querySelectorAll<HTMLElement>(
          '.mapa-impacto__galeria-flotante button:not(:disabled)',
        ));
        if (!controles.length) return;
        const primero = controles[0];
        const ultimo = controles[controles.length - 1];
        if (evento.shiftKey && document.activeElement === primero) {
          evento.preventDefault(); ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
          evento.preventDefault(); primero.focus();
        }
      }
    };
    document.addEventListener('keydown', alTeclado);
    return () => {
      document.removeEventListener('keydown', alTeclado);
      elementoAnterior?.focus();
    };
  }, [cerrar]);

  return createPortal(
    <div className="mapa-impacto__galeria-flotante" onMouseDown={(evento) => {
      if (evento.target === evento.currentTarget) cerrar();
    }}>
      <section className="mapa-impacto__galeria-flotante-panel" role="dialog"
        aria-modal="true" aria-labelledby={tituloId}>
        <header className="mapa-impacto__galeria-flotante-cabecera">
          <div>
            <h2 id={tituloId}><Images size={21} strokeWidth={1.8} aria-hidden="true" /> Evidencias del avance</h2>
            <p>{fotos.length} {fotos.length === 1 ? 'fotografía registrada' : 'fotografías registradas'}</p>
          </div>
          <button ref={botonCerrar} type="button" onClick={cerrar} aria-label="Cerrar galería">
            <X size={19} strokeWidth={1.8} aria-hidden="true" /> Cerrar
          </button>
        </header>
        <div className="mapa-impacto__galeria-flotante-lista">
          {fotos.map((foto, indice) => (
            <article className="mapa-impacto__galeria-flotante-item" key={foto.id}>
              <span className="mapa-impacto__galeria-flotante-indice">Fotografía {indice + 1}</span>
              <FotografiaPrivadaMapa token={token} proyectoId={proyectoId}
                evidenciaId={foto.id} titulo={foto.titulo || `Fotografía ${indice + 1}`} compacta />
            </article>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}
