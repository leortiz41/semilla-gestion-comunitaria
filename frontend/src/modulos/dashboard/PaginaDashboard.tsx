import { useEffect, useState } from 'react';
import '../../estilos/modulos/dashboard/dashboard.css';
import { obtenerResumenDashboard, type ResumenDashboard } from '../../servicios/dashboard/servicioDashboard';
import TarjetaResumen from './componentes/TarjetaResumen';

interface PropiedadesPaginaDashboard {
  tokenAcceso?: string | null;
}

function PaginaDashboard({ tokenAcceso }: PropiedadesPaginaDashboard) {
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [errorResumen, setErrorResumen] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenAcceso) {
      setResumen(null);
      setCargandoResumen(false);
      setErrorResumen(null);
      return;
    }

    let activo = true;

    setCargandoResumen(true);
    setErrorResumen(null);

    obtenerResumenDashboard(tokenAcceso)
      .then((datos) => {
        if (!activo) return;
        setResumen(datos);
      })
      .catch((error) => {
        if (!activo) return;
        setResumen(null);
        setErrorResumen(
          error instanceof Error
            ? error.message
            : 'No fue posible obtener el resumen del dashboard.',
        );
      })
      .finally(() => {
        if (activo) {
          setCargandoResumen(false);
        }
      });

    return () => {
      activo = false;
    };
  }, [tokenAcceso]);

  const descripcionComunidades = errorResumen
    ? errorResumen
    : cargandoResumen
      ? 'Consultando información registrada en el sistema…'
      : 'Cantidad total de comunidades registradas en Semilla.';

  return (
    <section className="pagina-dashboard" aria-labelledby="titulo-dashboard">
      <p className="pagina-dashboard__etiqueta">Dashboard</p>
      <h1 id="titulo-dashboard" className="pagina-dashboard__titulo">
        Resumen general
      </h1>
      <p className="pagina-dashboard__descripcion">
        Este módulo muestra una vista resumida del estado de la gestión comunitaria.
      </p>

      <div className="pagina-dashboard__resumen">
        <TarjetaResumen
          titulo="Comunidades registradas"
          valor={cargandoResumen ? '…' : (resumen?.comunidadesRegistradas ?? '—')}
          descripcion={descripcionComunidades}
        />
      </div>
    </section>
  );
}

export default PaginaDashboard;
