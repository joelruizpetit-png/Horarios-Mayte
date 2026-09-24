import { NextResponse } from 'next/server';
import { formatearFechaYHoraSpain, EventoBarca, EventoTheSportsDBRaw } from '../../../data/eventosDeportivos';

// Mapeo de escudos / banderas / iconos para rivales frecuentes
const ESCUDOS_RIVALES: Record<string, string> = {
  'getafe': '🔵',
  'galatasaray': '🟡🔴',
  'real betis': '🟢⚪',
  'betis': '🟢⚪',
  'paris saint-germain': '🔵🔴',
  'paris sg': '🔵🔴',
  'psg': '🔵🔴',
  'real madrid': '👑⚪',
  'sevilla': '⚪🔴',
  'atletico madrid': '🔴⚪',
  'atlético de madrid': '🔴⚪',
  'athletic club': '🔴⚪',
  'athletic bilbao': '🔴⚪',
  'valencia': '🦇',
  'villarreal': '🟡',
  'real sociedad': '🔵⚪',
  'celta vigo': '🩵',
  'celta de vigo': '🩵',
  'osasuna': '🔴',
  'rayo vallecano': '⚡',
  'mallorca': '🔴',
  'girona': '🔴⚪',
  'espanyol': '🔵⚪'
};

function obtenerIconoRival(nombreRival: string): string {
  const clave = nombreRival.toLowerCase().trim();
  for (const [k, v] of Object.entries(ESCUDOS_RIVALES)) {
    if (clave.includes(k)) return v;
  }
  return '🛡️';
}

export async function GET() {
  try {
    // 1. Intentar obtener el calendario completo desde el feed iCal oficial
    const resIcs = await fetch('https://ics.fixtur.es/v2/fc-barcelona.ics', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PlanificadorFamiliar/1.0'
      },
      next: { revalidate: 1800 } // Cachear durante 30 minutos
    });

    if (resIcs.ok) {
      const text = await resIcs.text();
      const events: Record<string, string>[] = [];
      const lines = text.split(/\r?\n/);
      let cur: Record<string, string> | null = null;

      for (const line of lines) {
        if (line === 'BEGIN:VEVENT') {
          cur = {};
        } else if (line === 'END:VEVENT') {
          if (cur) events.push(cur);
          cur = null;
        } else if (cur) {
          const idx = line.indexOf(':');
          if (idx !== -1) {
            const k = line.slice(0, idx).split(';')[0];
            const v = line.slice(idx + 1);
            cur[k] = v;
          }
        }
      }

      // Fecha actual en formato YYYYMMDD en hora española
      const hoySpainStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' }).replace(/-/g, '');

      // Filtrar eventos futuros y ordenar cronológicamente
      const futureEvents = events
        .filter((e) => e.DTSTART && e.DTSTART.slice(0, 8) >= hoySpainStr)
        .sort((a, b) => a.DTSTART.localeCompare(b.DTSTART));

      if (futureEvents.length > 0) {
        // Tomar los próximos 5 partidos
        const partidos: EventoBarca[] = futureEvents.slice(0, 5).map((ev, index) => {
          let summary = ev.SUMMARY || 'FC Barcelona';
          let competicion = 'LaLiga EA Sports';

          if (summary.includes('[CL]') || summary.includes('Champions League')) {
            competicion = 'Champions League';
            summary = summary.replace(/\[CL\]/g, '').trim();
          } else if (summary.includes('[CdR]') || summary.includes('Copa del Rey')) {
            competicion = 'Copa del Rey';
            summary = summary.replace(/\[CdR\]/g, '').trim();
          } else if (summary.includes('[EL]') || summary.includes('Europa League')) {
            competicion = 'Europa League';
            summary = summary.replace(/\[EL\]/g, '').trim();
          }

          const partes = summary.split(' - ').map((s) => s.trim());
          const equipoLocal = partes[0] || 'FC Barcelona';
          const equipoVisitante = partes[1] || 'Rival';

          const esCasa = equipoLocal.toLowerCase().includes('barcelona');
          const rival = esCasa ? equipoVisitante : equipoLocal;

          // Parsear DTSTART en formato YYYYMMDDTHHMMSSZ
          const rawDt = ev.DTSTART;
          const dateStr = `${rawDt.slice(0, 4)}-${rawDt.slice(4, 6)}-${rawDt.slice(6, 8)}`;
          const timeStr = rawDt.length >= 15 ? `${rawDt.slice(9, 11)}:${rawDt.slice(11, 13)}:${rawDt.slice(13, 15)}Z` : undefined;

          const sesion = formatearFechaYHoraSpain(dateStr, timeStr);
          const fechaIsoObj = new Date(`${dateStr}T${timeStr || '12:00:00Z'}`);

          return {
            id: `barca-ics-${ev.UID || index}`,
            tipo: 'barca',
            rival,
            escudoRival: obtenerIconoRival(rival),
            competicion,
            condicion: esCasa ? 'casa' : 'fuera',
            estadio: ev.LOCATION || (esCasa ? 'Spotify Camp Nou' : 'Estadio visitante'),
            fechaIso: sesion.fechaIso,
            fechaTexto: sesion.fechaTexto,
            hora: sesion.hora,
            fechaClave: sesion.fechaClave,
            timestampMs: isNaN(fechaIsoObj.getTime()) ? Date.now() : fechaIsoObj.getTime()
          };
        });

        return NextResponse.json({ partidos, fuente: 'ical' });
      }
    }

    // 2. Si el iCal falló o estuvo vacío, recurrimos a TheSportsDB como fallback
    const resTheSportsDb = await fetch('https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=133739', {
      next: { revalidate: 1800 }
    });

    if (resTheSportsDb.ok) {
      const data = await resTheSportsDb.json();
      const eventos = data?.events;

      if (Array.isArray(eventos) && eventos.length > 0) {
        const partidosFallback: EventoBarca[] = eventos.slice(0, 5).map((ev: EventoTheSportsDBRaw) => {
          const idHome = String(ev.idHomeTeam || '');
          const nombreHome = String(ev.strHomeTeam || '').toLowerCase();
          const esCasa = idHome === '133739' || nombreHome.includes('barcelona');

          const rival = esCasa ? (ev.strAwayTeam || 'Rival') : (ev.strHomeTeam || 'FC Barcelona');
          const dateStr = ev.dateEvent || (ev.strTimestamp ? ev.strTimestamp.split('T')[0] : '');
          const timeStr = ev.strTime || (ev.strTimestamp && ev.strTimestamp.includes('T') ? ev.strTimestamp.split('T')[1] : null);

          const sesion = formatearFechaYHoraSpain(dateStr, timeStr);
          const isoCompleto = ev.strTimestamp
            ? (ev.strTimestamp.endsWith('Z') ? ev.strTimestamp : `${ev.strTimestamp}Z`)
            : `${dateStr}T${timeStr || '12:00:00'}Z`;

          const fechaObj = new Date(isoCompleto);

          return {
            id: `barca-tsdb-${ev.idEvent || Math.random()}`,
            tipo: 'barca',
            rival,
            escudoRival: ev.strAwayTeamBadge || obtenerIconoRival(rival),
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

        return NextResponse.json({ partidos: partidosFallback, fuente: 'thesportsdb' });
      }
    }

    return NextResponse.json({ partidos: [], fuente: 'none' });
  } catch (error) {
    console.error("Error en /api/deportes/barca:", error);
    return NextResponse.json({ partidos: [], error: 'Error al consultar próximos partidos' }, { status: 500 });
  }
}
