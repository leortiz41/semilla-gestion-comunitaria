import '../../../estilos/modulos/dashboard/tarjetaResumen.css';

interface PropiedadesTarjetaResumen {
  titulo: string;
  valor: string | number;
  descripcion?: string;
}

function TarjetaResumen({
  titulo,
  valor,
  descripcion,
}: PropiedadesTarjetaResumen) {
  return (
    <article className="tarjeta-resumen">
      <p className="tarjeta-resumen__titulo">{titulo}</p>
      <p className="tarjeta-resumen__valor">{valor}</p>
      {descripcion && (
        <p className="tarjeta-resumen__descripcion">{descripcion}</p>
      )}
    </article>
  );
}

export default TarjetaResumen;
