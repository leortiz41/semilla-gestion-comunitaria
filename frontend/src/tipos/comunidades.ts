export type EstadoComunidad = 'activa' | 'inactiva';

export interface ComunidadVisual {
  id: string;
  nombre: string;
  zona: 'zona-1' | 'zona-2';
  nombreZona: string;
  estado: EstadoComunidad;
}
