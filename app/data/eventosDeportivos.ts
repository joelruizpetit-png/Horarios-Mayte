export interface EventoBarca {
  id: string;
  tipo: 'barca';
  rival: string;
  escudoRival: string;
  competicion: 'LaLiga' | 'Champions League' | 'Copa del Rey';
  condicion: 'casa' | 'fuera';
  estadio: string;
  fechaIso: string; // Formato YYYY-MM-DD para ordenación y clave
  fechaTexto: string; // Ej: Sábado, 26 Sep 2026
  hora: string; // Ej: 21:00
}

export interface EventoF1 {
  id: string;
  tipo: 'f1';
  granPremio: string;
  circuito: string;
  pais: string;
  bandera: string;
  fechaIso: string; // Fecha de la carrera principal para ordenación
  clasificacion: {
    fechaIso: string;
    fechaTexto: string;
    hora: string;
  };
  carrera: {
    fechaIso: string;
    fechaTexto: string;
    hora: string;
  };
}

export type EventoDeportivo = EventoBarca | EventoF1;

// Lista de próximos eventos deportivos organizados
export const EVENTOS_DEPORTIVOS: EventoDeportivo[] = [
  {
    id: 'barca-getafe',
    tipo: 'barca',
    rival: 'Getafe CF',
    escudoRival: '🔵',
    competicion: 'LaLiga',
    condicion: 'casa',
    estadio: 'Estadi Olímpic Lluís Companys',
    fechaIso: '2026-09-26',
    fechaTexto: 'Sábado, 26 Sep 2026',
    hora: '21:00'
  },
  {
    id: 'f1-singapur',
    tipo: 'f1',
    granPremio: 'Gran Premio de Singapur',
    circuito: 'Circuito Callejero de Marina Bay',
    pais: 'Singapur',
    bandera: '🇸🇬',
    fechaIso: '2026-10-04',
    clasificacion: {
      fechaIso: '2026-10-03',
      fechaTexto: 'Sábado, 3 Oct 2026',
      hora: '15:00'
    },
    carrera: {
      fechaIso: '2026-10-04',
      fechaTexto: 'Domingo, 4 Oct 2026',
      hora: '14:00'
    }
  },
  {
    id: 'barca-youngboys',
    tipo: 'barca',
    rival: 'Young Boys',
    escudoRival: '🟡',
    competicion: 'Champions League',
    condicion: 'casa',
    estadio: 'Estadi Olímpic Lluís Companys',
    fechaIso: '2026-10-07',
    fechaTexto: 'Miércoles, 7 Oct 2026',
    hora: '21:00'
  },
  {
    id: 'barca-alaves',
    tipo: 'barca',
    rival: 'Deportivo Alavés',
    escudoRival: '⚪🔵',
    competicion: 'LaLiga',
    condicion: 'fuera',
    estadio: 'Mendizorroza',
    fechaIso: '2026-10-11',
    fechaTexto: 'Domingo, 11 Oct 2026',
    hora: '16:15'
  },
  {
    id: 'f1-austin',
    tipo: 'f1',
    granPremio: 'Gran Premio de Estados Unidos',
    circuito: 'Circuito de las Américas (Austin)',
    pais: 'Estados Unidos',
    bandera: '🇺🇸',
    fechaIso: '2026-10-18',
    clasificacion: {
      fechaIso: '2026-10-17',
      fechaTexto: 'Sábado, 17 Oct 2026',
      hora: '23:00'
    },
    carrera: {
      fechaIso: '2026-10-18',
      fechaTexto: 'Domingo, 18 Oct 2026',
      hora: '21:00'
    }
  },
  {
    id: 'barca-sevilla',
    tipo: 'barca',
    rival: 'Sevilla FC',
    escudoRival: '⚪🔴',
    competicion: 'LaLiga',
    condicion: 'casa',
    estadio: 'Estadi Olímpic Lluís Companys',
    fechaIso: '2026-10-21',
    fechaTexto: 'Miércoles, 21 Oct 2026',
    hora: '21:00'
  },
  {
    id: 'f1-mexico',
    tipo: 'f1',
    granPremio: 'Gran Premio de México',
    circuito: 'Autódromo Hermanos Rodríguez',
    pais: 'México',
    bandera: '🇲🇽',
    fechaIso: '2026-10-25',
    clasificacion: {
      fechaIso: '2026-10-24',
      fechaTexto: 'Sábado, 24 Oct 2026',
      hora: '23:00'
    },
    carrera: {
      fechaIso: '2026-10-25',
      fechaTexto: 'Domingo, 25 Oct 2026',
      hora: '21:00'
    }
  },
  {
    id: 'barca-madrid',
    tipo: 'barca',
    rival: 'Real Madrid CF',
    escudoRival: '👑⚪',
    competicion: 'LaLiga',
    condicion: 'fuera',
    estadio: 'Estadio Santiago Bernabéu',
    fechaIso: '2026-10-28',
    fechaTexto: 'Miércoles, 28 Oct 2026',
    hora: '21:00'
  }
];

// Función para obtener eventos ordenados cronológicamente
export function obtenerEventosDeportivos(filtro: 'todos' | 'barca' | 'f1' = 'todos'): EventoDeportivo[] {
  let lista = [...EVENTOS_DEPORTIVOS];

  if (filtro === 'barca') {
    lista = lista.filter((e) => e.tipo === 'barca');
  } else if (filtro === 'f1') {
    lista = lista.filter((e) => e.tipo === 'f1');
  }

  // Ordenar por fecha ISO ascendente
  return lista.sort((a, b) => a.fechaIso.localeCompare(b.fechaIso));
}
