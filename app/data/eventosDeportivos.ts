// app/data/eventosDeportivos.ts
// Conexión y tipado para APIs verídicas en tiempo real: Ergast F1 (Jolpi) y TheSportsDB (FC Barcelona)

export interface SesionDeportiva {
  fechaIso: string; // YYYY-MM-DD en hora de España
  fechaTexto: string; // Ej: Sábado, 26 de septiembre de 2026
  hora: string; // Ej: 13:00 (hora local española)
  fechaClave: string; // Clave compatible con Firebase (toDateString() en hora española)
}

export interface EventoBarca {
  id: string;
  tipo: 'barca';
  rival: string;
  escudoRival?: string;
  competicion: string;
  condicion: 'casa' | 'fuera';
  estadio: string;
  fechaIso: string;
  fechaTexto: string;
  hora: string;
  fechaClave: string;
  timestampMs: number;
}

export interface EventoF1 {
  id: string;
  tipo: 'f1';
  granPremio: string;
  circuito: string;
  pais: string;
  bandera: string;
  timestampMs: number;
  carrera: SesionDeportiva;
  clasificacion?: SesionDeportiva;
}

export type EventoDeportivo = EventoBarca | EventoF1;

// Diccionario de banderas para los países de los Grandes Premios de Fórmula 1
const BANDERAS_F1: Record<string, string> = {
  'italy': '🇮🇹',
  'spain': '🇪🇸',
  'azerbaijan': '🇦🇿',
  'malaysia': '🇲🇾',
  'singapore': '🇸🇬',
  'usa': '🇺🇸',
  'united states': '🇺🇸',
  'mexico': '🇲🇽',
  'brazil': '🇧🇷',
  'qatar': '🇶🇦',
  'uae': '🇦🇪',
  'abu dhabi': '🇦🇪',
  'bahrain': '🇧🇭',
  'saudi arabia': '🇸🇦',
  'australia': '🇦🇺',
  'japan': '🇯🇵',
  'china': '🇨🇳',
  'monaco': '🇲🇨',
  'canada': '🇨🇦',
  'austria': '🇦🇹',
  'uk': '🇬🇧',
  'great britain': '🇬🇧',
  'hungary': '🇭🇺',
  'belgium': '🇧🇪',
  'netherlands': '🇳🇱'
};

export function obtenerBanderaPais(pais: string): string {
  const clave = pais.toLowerCase().trim();
  return BANDERAS_F1[clave] || '🏁';
}

/**
 * Convierte una fecha y hora UTC a la zona horaria de España (Europe/Madrid)
 * calculando automáticamente el horario de verano/invierno (CEST / CET).
 */
export function formatearFechaYHoraSpain(dateStr: string, timeStr?: string | null): SesionDeportiva {
  let isoCadena = dateStr;
  
  if (timeStr) {
    const horaLimpia = timeStr.trim();
    if (horaLimpia.endsWith('Z')) {
      isoCadena = `${dateStr}T${horaLimpia}`;
    } else {
      isoCadena = `${dateStr}T${horaLimpia}Z`;
    }
  } else {
    // Si no hay hora especificada, asumimos mediodía UTC
    isoCadena = `${dateStr}T12:00:00Z`;
  }

  const fechaObj = new Date(isoCadena);
  // Validar si la fecha es válida
  const esValida = !isNaN(fechaObj.getTime());
  const fechaSegura = esValida ? fechaObj : new Date();

  // 1. Hora local en España (24 horas)
  const hora = timeStr && esValida
    ? fechaSegura.toLocaleTimeString('es-ES', {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    : '--:--';

  // 2. Fecha en formato YYYY-MM-DD local de España (para ordenar o comparar)
  const fechaIso = fechaSegura.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });

  // 3. Clave para Firebase (toDateString() en la fecha española)
  const [y, m, d] = fechaIso.split('-').map(Number);
  const fechaClave = new Date(y, m - 1, d).toDateString();

  // 4. Texto legible en español
  const textoFormateado = fechaSegura.toLocaleDateString('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  // Capitalizar la primera letra (ej: "Sábado, 26 de sept de 2026")
  const fechaTexto = textoFormateado.charAt(0).toUpperCase() + textoFormateado.slice(1);

  return {
    fechaIso,
    fechaTexto,
    hora,
    fechaClave
  };
}

interface CarreraErgastRaw {
  season?: string;
  round?: string;
  raceName?: string;
  date: string;
  time?: string;
  Circuit?: {
    circuitName?: string;
    Location?: {
      country?: string;
    };
  };
  Qualifying?: {
    date?: string;
    time?: string;
  };
}

export interface EventoTheSportsDBRaw {
  idEvent?: string;
  idHomeTeam?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
  strLeague?: string;
  strVenue?: string;
  dateEvent?: string;
  strTime?: string;
  strTimestamp?: string;
}

/**
 * Consulta la API de Ergast F1 (jolpi.ca) en vivo y filtra las carreras
 * cuya fecha sea igual o posterior a la fecha actual en España.
 */
export async function fetchCarrerasF1(): Promise<EventoF1[]> {
  try {
    const respuesta = await fetch('https://api.jolpi.ca/ergast/f1/current.json');
    if (!respuesta.ok) {
      throw new Error(`Error HTTP al consultar F1: ${respuesta.status}`);
    }

    const datos = await respuesta.json();
    const carreras = datos?.MRData?.RaceTable?.Races;

    if (!Array.isArray(carreras)) {
      return [];
    }

    // Fecha actual en formato YYYY-MM-DD en España
    const hoySpainStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });

    // Filtrar solo carreras futuras o del día de hoy
    const carrerasFuturas = carreras.filter((c: CarreraErgastRaw) => {
      return c.date >= hoySpainStr;
    });

    // Mapear a nuestra estructura tipada con zona horaria convertida
    const resultado: EventoF1[] = carrerasFuturas.slice(0, 5).map((c: CarreraErgastRaw, index: number) => {
      const sesionCarrera = formatearFechaYHoraSpain(c.date, c.time);
      
      let sesionClasi: SesionDeportiva | undefined;
      if (c.Qualifying?.date) {
        sesionClasi = formatearFechaYHoraSpain(c.Qualifying.date, c.Qualifying.time);
      }

      const pais = c.Circuit?.Location?.country || '';
      const bandera = obtenerBanderaPais(pais);
      
      const fechaUtcCarrera = new Date(c.time ? `${c.date}T${c.time}` : `${c.date}T12:00:00Z`);

      return {
        id: `f1-${c.season || '2026'}-${c.round || index}`,
        tipo: 'f1',
        granPremio: c.raceName || 'Gran Premio de F1',
        circuito: c.Circuit?.circuitName || 'Circuito de Fórmula 1',
        pais,
        bandera,
        timestampMs: fechaUtcCarrera.getTime(),
        carrera: sesionCarrera,
        clasificacion: sesionClasi
      };
    });

    return resultado;
  } catch (error) {
    console.error("Error al cargar carreras de F1:", error);
    throw error;
  }
}

/**
 * Consulta los próximos partidos reales del FC Barcelona.
 * Primero consulta el feed oficial de la temporada a través de /api/deportes/barca
 * y aplica fallback automático a TheSportsDB si fuese necesario.
 */
export async function fetchPartidosBarca(): Promise<EventoBarca[]> {
  try {
    const url = typeof window !== 'undefined' ? '/api/deportes/barca' : 'https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=133739';
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
      throw new Error(`Error HTTP al consultar FC Barcelona: ${respuesta.status}`);
    }

    const datos = await respuesta.json();

    // 1. Si viene de /api/deportes/barca (feed de la temporada completa)
    if (Array.isArray(datos?.partidos) && datos.partidos.length > 0) {
      return datos.partidos.slice(0, 5);
    }

    // 2. Fallback a formato TheSportsDB directo
    const eventos = datos?.events;
    if (!Array.isArray(eventos) || eventos.length === 0) {
      return [];
    }

    const resultado: EventoBarca[] = eventos.slice(0, 5).map((ev: EventoTheSportsDBRaw) => {
      const idHome = String(ev.idHomeTeam || '');
      const nombreHome = String(ev.strHomeTeam || '').toLowerCase();
      const esCasa = idHome === '133739' || nombreHome.includes('barcelona');

      const rival = esCasa ? (ev.strAwayTeam || 'Rival') : (ev.strHomeTeam || 'FC Barcelona');
      const escudoRival = esCasa ? ev.strAwayTeamBadge : ev.strHomeTeamBadge;

      const dateStr = ev.dateEvent || (ev.strTimestamp ? ev.strTimestamp.split('T')[0] : '');
      const timeStr = ev.strTime || (ev.strTimestamp && ev.strTimestamp.includes('T') ? ev.strTimestamp.split('T')[1] : null);

      const sesion = formatearFechaYHoraSpain(dateStr, timeStr);

      const isoCompleto = ev.strTimestamp
        ? (ev.strTimestamp.endsWith('Z') ? ev.strTimestamp : `${ev.strTimestamp}Z`)
        : `${dateStr}T${timeStr || '12:00:00'}Z`;

      const fechaObj = new Date(isoCompleto);

      return {
        id: `barca-${ev.idEvent || Math.random()}`,
        tipo: 'barca',
        rival,
        escudoRival: escudoRival || undefined,
        competicion: ev.strLeague || 'LaLiga',
        condicion: esCasa ? 'casa' : 'fuera',
        estadio: ev.strVenue || (esCasa ? 'Spotify Camp Nou' : 'Estadio visitante'),
        fechaIso: sesion.fechaIso,
        fechaTexto: sesion.fechaTexto,
        hora: sesion.hora,
        fechaClave: sesion.fechaClave,
        timestampMs: isNaN(fechaObj.getTime()) ? Date.now() : fechaObj.getTime()
      };
    });

    return resultado;
  } catch (error) {
    console.error("Error al cargar partidos del FC Barcelona:", error);
    throw error;
  }
}
