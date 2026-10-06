import { auth, googleCalendarProvider } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export interface EventoAgendaGC {
  titulo: string;
  hora?: string;
  horaFin?: string;
  tipo?: string;
  categoria?: string;
  creador?: string;
  googleCalendarEventId?: string;
  esGoogleCalendar?: boolean;
}

export interface ResultadoSincronizacionGC {
  exito: boolean;
  googleCalendarEventId?: string;
  error?: string;
  necesitaReconexion?: boolean;
}

const STORAGE_KEY_TOKEN = 'google_calendar_token';
const STORAGE_KEY_TIMESTAMP = 'google_calendar_token_timestamp';

/**
 * Obtiene el token de acceso de Google Calendar almacenado si sigue vigente (< 55 min).
 */
export function obtenerTokenGoogleCalendar(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  const timestampStr = localStorage.getItem(STORAGE_KEY_TIMESTAMP);

  if (!token) return null;

  if (timestampStr) {
    const elapsed = Date.now() - Number(timestampStr);
    // Los tokens de OAuth de Google expiran a los 60 minutos (3600s). Si han pasado más de 55m, lo consideramos por expirar
    if (elapsed > 55 * 60 * 1000) {
      return null;
    }
  }

  return token;
}

/**
 * Guarda el token de acceso de Google Calendar y la marca de tiempo actual.
 */
export function guardarTokenGoogleCalendar(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  localStorage.setItem(STORAGE_KEY_TIMESTAMP, Date.now().toString());
}

/**
 * Elimina el token de acceso de Google Calendar.
 */
export function limpiarTokenGoogleCalendar() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_TIMESTAMP);
}

/**
 * Indica si el usuario tiene una sesión de Google Calendar activa y válida.
 */
export function estaGoogleCalendarConectado(): boolean {
  return obtenerTokenGoogleCalendar() !== null;
}

/**
 * Solicita interactivamente permisos para Google Calendar mediante ventana emergente de Google.
 * Útil cuando el usuario pulsa "+ Añadir", "Conectar Google Calendar" o al guardar un evento.
 */
export async function conectarGoogleCalendar(): Promise<string | null> {
  try {
    const result = await signInWithPopup(auth, googleCalendarProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (token) {
      guardarTokenGoogleCalendar(token);
      return token;
    }
  } catch (error: unknown) {
    const authError = error as { code?: string; message?: string };
    if (authError.code === 'auth/popup-closed-by-user') {
      console.warn('El usuario cerró la ventana de autorización de Google Calendar.');
      return null;
    }
    console.error('Error al autorizar Google Calendar:', error);
  }
  return null;
}

/**
 * Asegura la disponibilidad del token de Google Calendar.
 * Si no está disponible y `promptSiFalta` es true, invoca la ventana interactiva.
 */
export async function asegurarTokenGoogleCalendar(promptSiFalta = false): Promise<string | null> {
  let token = obtenerTokenGoogleCalendar();
  if (token) return token;

  if (promptSiFalta) {
    token = await conectarGoogleCalendar();
    return token;
  }
  return null;
}

export const TIMEZONE_MADRID = 'Europe/Madrid';

/**
 * Obtiene el offset de la zona horaria de Madrid (ej. "+02:00" en horario de verano CEST o "+01:00" en invierno CET)
 * para un objeto Date dado.
 */
export function obtenerOffsetMadrid(fecha: Date): string {
  try {
    const formato = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE_MADRID,
      timeZoneName: 'longOffset'
    });
    const partes = formato.formatToParts(fecha);
    const part = partes.find((p) => p.type === 'timeZoneName');
    if (part && part.value) {
      const match = part.value.match(/GMT([+-]\d{2}:\d{2})/);
      if (match) return match[1];
    }
  } catch {
    // Si longOffset no está soportado en este entorno
  }

  try {
    const fechaUTC = new Date(fecha.toLocaleString('en-US', { timeZone: 'UTC' }));
    const fechaMadrid = new Date(fecha.toLocaleString('en-US', { timeZone: TIMEZONE_MADRID }));
    const diffMin = Math.round((fechaMadrid.getTime() - fechaUTC.getTime()) / 60000);
    const sign = diffMin >= 0 ? '+' : '-';
    const absMin = Math.abs(diffMin);
    const h = String(Math.floor(absMin / 60)).padStart(2, '0');
    const m = String(absMin % 60).padStart(2, '0');
    return `${sign}${h}:${m}`;
  } catch {
    return '+02:00';
  }
}

/**
 * Formatea una fecha a hora "HH:mm" garantizando la zona horaria Europe/Madrid.
 */
export function formatearHoraMadrid(fecha: Date): string {
  return fecha.toLocaleTimeString('es-ES', {
    timeZone: TIMEZONE_MADRID,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Convierte un objeto Date a la clave de fecha en formato de la app (ej. "Tue Oct 06 2026")
 * según el día calendario que corresponde en Europe/Madrid.
 */
export function obtenerFechaClaveMadrid(fecha: Date): string {
  const formateador = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_MADRID,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const partes = formateador.formatToParts(fecha);
  const y = Number(partes.find((p) => p.type === 'year')?.value);
  const m = Number(partes.find((p) => p.type === 'month')?.value);
  const d = Number(partes.find((p) => p.type === 'day')?.value);
  return new Date(y, m - 1, d).toDateString();
}

/**
 * Extrae año, mes, día y la cadena YYYY-MM-DD para una fecha dada como string.
 */
export function extraerPartesFecha(fechaClave: string): { y: number; m: number; dia: number; fechaISO: string } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaClave)) {
    const [cy, cm, cd] = fechaClave.split('-').map(Number);
    return {
      y: cy,
      m: cm,
      dia: cd,
      fechaISO: `${String(cy).padStart(4, '0')}-${String(cm).padStart(2, '0')}-${String(cd).padStart(2, '0')}`
    };
  }

  const d = new Date(fechaClave);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const dia = d.getDate();
    return {
      y,
      m,
      dia,
      fechaISO: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    };
  }

  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth() + 1;
  const dia = hoy.getDate();
  return {
    y,
    m,
    dia,
    fechaISO: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  };
}

/**
 * Construye el objeto payload para la API v3 de Google Calendar con zona horaria Europe/Madrid
 * y alarmas nativas (30 min y 1 día antes).
 * Especifica explícitamente tanto el offset ISO como el timeZone 'Europe/Madrid' en start y end.
 */
export function prepararPayloadGoogleCalendar(fechaClave: string, evento: EventoAgendaGC) {
  const { y, m, dia, fechaISO } = extraerPartesFecha(fechaClave);

  const horaLimpia = (evento.hora || '').trim();
  const esHoraValida = /^\d{1,2}:\d{2}$/.test(horaLimpia) && horaLimpia !== '--:--';

  let start: { dateTime?: string; date?: string; timeZone?: string };
  let end: { dateTime?: string; date?: string; timeZone?: string };

  if (esHoraValida) {
    const [hStr, mStr] = horaLimpia.split(':');
    const h = parseInt(hStr, 10);
    const min = parseInt(mStr, 10);
    const dInicioRef = new Date(y, m - 1, dia, h, min, 0);
    const offsetInicio = obtenerOffsetMadrid(dInicioRef);
    const startDateTime = `${fechaISO}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00${offsetInicio}`;

    let dFinRef: Date;
    const horaFinLimpia = (evento.horaFin || '').trim();
    if (/^\d{1,2}:\d{2}$/.test(horaFinLimpia) && horaFinLimpia !== '--:--') {
      const [hfStr, mfStr] = horaFinLimpia.split(':');
      const hf = parseInt(hfStr, 10);
      const minf = parseInt(mfStr, 10);
      dFinRef = new Date(y, m - 1, dia, hf, minf, 0);
      if (dFinRef <= dInicioRef) {
        dFinRef = new Date(dInicioRef.getTime() + 60 * 60 * 1000);
      }
    } else {
      // Duración por defecto de 1 hora
      dFinRef = new Date(dInicioRef.getTime() + 60 * 60 * 1000);
    }

    const yf = dFinRef.getFullYear();
    const mf = dFinRef.getMonth() + 1;
    const diaf = dFinRef.getDate();
    const hfNum = dFinRef.getHours();
    const minfNum = dFinRef.getMinutes();
    const offsetFin = obtenerOffsetMadrid(dFinRef);
    const fechaFinISO = `${String(yf).padStart(4, '0')}-${String(mf).padStart(2, '0')}-${String(diaf).padStart(2, '0')}`;
    const endDateTime = `${fechaFinISO}T${String(hfNum).padStart(2, '0')}:${String(minfNum).padStart(2, '0')}:00${offsetFin}`;

    start = {
      dateTime: startDateTime,
      timeZone: TIMEZONE_MADRID
    };
    end = {
      dateTime: endDateTime,
      timeZone: TIMEZONE_MADRID
    };
  } else {
    // Evento de día completo: en Google Calendar la fecha fin es exclusiva (día siguiente)
    const dSiguiente = new Date(y, m - 1, dia + 1);
    const ySig = dSiguiente.getFullYear();
    const mSig = String(dSiguiente.getMonth() + 1).padStart(2, '0');
    const diaSig = String(dSiguiente.getDate()).padStart(2, '0');
    const fechaSiguienteISO = `${ySig}-${mSig}-${diaSig}`;

    start = {
      date: fechaISO,
      timeZone: TIMEZONE_MADRID
    };
    end = {
      date: fechaSiguienteISO,
      timeZone: TIMEZONE_MADRID
    };
  }

  const autor = evento.creador === 'A' ? 'Ana' : (evento.creador === 'J' ? 'Joel' : 'Planificador');
  const summary = evento.titulo?.trim() || 'Evento Familiar';
  const description = `Evento de Planificador Familiar\nCreador: ${autor}${evento.tipo ? `\nTipo: ${evento.tipo}` : ''}`;

  return {
    summary,
    description,
    start,
    end,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 },   // Notificación 30 minutos antes
        { method: 'popup', minutes: 1440 }  // Notificación 1 día antes (24h * 60m = 1440m)
      ]
    }
  };
}

/**
 * 1. ESCRITURA: Inserta un nuevo evento en el Google Calendar principal ('primary').
 * Devuelve un resultado detallado con control de errores para alertas visuales.
 */
export async function insertarEventoGoogleCalendar({
  fechaClave,
  evento,
  token
}: {
  fechaClave: string;
  evento: EventoAgendaGC;
  token?: string;
}): Promise<ResultadoSincronizacionGC> {
  const authToken = token || obtenerTokenGoogleCalendar();
  if (!authToken) {
    return {
      exito: false,
      error: 'Google Calendar no conectado: falta el token de acceso. Pulsa "Conectar Google Calendar" para activar alarmas.',
      necesitaReconexion: true
    };
  }

  const payload = prepararPayloadGoogleCalendar(fechaClave, evento);

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      limpiarTokenGoogleCalendar();
      return {
        exito: false,
        error: 'La sesión de Google Calendar ha caducado (401). Pulsa "Conectar" para renovar la sincronización.',
        necesitaReconexion: true
      };
    }

    if (res.status === 403) {
      return {
        exito: false,
        error: 'Permisos insuficientes en Google Calendar (403). Falta autorizar el acceso de eventos.',
        necesitaReconexion: true
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      return {
        exito: false,
        error: `Error de Google Calendar API (${res.status}): ${errText}`
      };
    }

    const data = await res.json();
    return {
      exito: true,
      googleCalendarEventId: data.id || undefined
    };
  } catch (error) {
    console.error('Error de red al insertar en Google Calendar:', error);
    return {
      exito: false,
      error: 'Error de red o conexión al comunicar con Google Calendar API.'
    };
  }
}

/**
 * Actualiza un evento existente en el Google Calendar principal.
 * Si el evento no existe en Google (404), intenta crearlo de nuevo.
 */
export async function actualizarEventoGoogleCalendar({
  eventId,
  fechaClave,
  evento,
  token
}: {
  eventId: string;
  fechaClave: string;
  evento: EventoAgendaGC;
  token?: string;
}): Promise<ResultadoSincronizacionGC> {
  const authToken = token || obtenerTokenGoogleCalendar();
  if (!authToken) {
    return {
      exito: false,
      error: 'Falta token de acceso para actualizar en Google Calendar.',
      necesitaReconexion: true
    };
  }

  const payload = prepararPayloadGoogleCalendar(fechaClave, evento);

  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      limpiarTokenGoogleCalendar();
      return {
        exito: false,
        error: 'La sesión de Google Calendar ha caducado (401).',
        necesitaReconexion: true
      };
    }

    if (res.status === 404) {
      // Si el evento fue eliminado externamente en Google Calendar, lo recreamos
      return await insertarEventoGoogleCalendar({ fechaClave, evento, token: authToken });
    }

    if (!res.ok) {
      const errText = await res.text();
      return {
        exito: false,
        error: `Error al actualizar en Google Calendar (${res.status}): ${errText}`
      };
    }

    const data = await res.json();
    return {
      exito: true,
      googleCalendarEventId: data.id || eventId
    };
  } catch (error) {
    console.error('Error de red al actualizar en Google Calendar:', error);
    return {
      exito: false,
      error: 'Error de red al actualizar evento en Google Calendar.'
    };
  }
}

/**
 * Elimina un evento de Google Calendar.
 */
export async function eliminarEventoGoogleCalendar(eventId?: string, token?: string): Promise<boolean> {
  if (!eventId) return false;
  const authToken = token || obtenerTokenGoogleCalendar();
  if (!authToken) return false;

  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (res.status === 401) {
      limpiarTokenGoogleCalendar();
      return false;
    }

    return res.ok || res.status === 404;
  } catch (error) {
    console.error('Error de red al eliminar evento en Google Calendar:', error);
    return false;
  }
}

/**
 * Función principal para sincronizar un evento con Google Calendar (inserción o actualización).
 * Retorna un resultado detallado con ID, éxito y mensaje de error si aplica.
 */
export async function sincronizarEventoGoogleCalendar({
  fechaClave,
  evento,
  esEdicion = false,
  solicitarPermisoSiFalta = false
}: {
  fechaClave: string;
  evento: EventoAgendaGC;
  esEdicion?: boolean;
  solicitarPermisoSiFalta?: boolean;
}): Promise<ResultadoSincronizacionGC> {
  let token = obtenerTokenGoogleCalendar();

  if (!token && solicitarPermisoSiFalta) {
    token = await conectarGoogleCalendar();
  }

  if (!token) {
    return {
      exito: false,
      error: 'Google Calendar no conectado. Conecta tu cuenta para sincronizar y activar alertas.',
      necesitaReconexion: true
    };
  }

  const existingId = evento.googleCalendarEventId;

  if (esEdicion && existingId) {
    return await actualizarEventoGoogleCalendar({
      eventId: existingId,
      fechaClave,
      evento,
      token
    });
  } else {
    return await insertarEventoGoogleCalendar({
      fechaClave,
      evento,
      token
    });
  }
}

/**
 * 2. LECTURA Y SINCRONIZACIÓN (Google Calendar -> App):
 * Obtiene los eventos del usuario de Google Calendar para un rango de fechas (mes/día).
 */
export async function obtenerEventosGoogleCalendar({
  fechaInicio,
  fechaFin,
  token
}: {
  fechaInicio: Date;
  fechaFin: Date;
  token?: string;
}): Promise<{
  exito: boolean;
  eventos: Record<string, EventoAgendaGC[]>;
  error?: string;
  necesitaReconexion?: boolean;
}> {
  const authToken = token || obtenerTokenGoogleCalendar();
  if (!authToken) {
    return { exito: false, eventos: {} };
  }

  const timeMin = fechaInicio.toISOString();
  const timeMax = fechaFin.toISOString();

  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&timeZone=Europe%2FMadrid&singleEvents=true&orderBy=startTime&maxResults=250`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.status === 401) {
      limpiarTokenGoogleCalendar();
      return {
        exito: false,
        eventos: {},
        error: 'Sesión de Google Calendar caducada (401).',
        necesitaReconexion: true
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      return {
        exito: false,
        eventos: {},
        error: `Error al leer eventos de Google Calendar (${res.status}): ${errText}`
      };
    }

    const data = await res.json();
    const items = data.items || [];
    const eventosPorDia: Record<string, EventoAgendaGC[]> = {};

    items.forEach((item: any) => {
      if (item.status === 'cancelled') return;

      let fechaClave = '';
      let hora = '--:--';
      let horaFin = '';

      if (item.start?.dateTime) {
        const dInicio = new Date(item.start.dateTime);
        fechaClave = obtenerFechaClaveMadrid(dInicio);
        hora = formatearHoraMadrid(dInicio);
        if (item.end?.dateTime) {
          const dFin = new Date(item.end.dateTime);
          if (dFin.getTime() > dInicio.getTime()) {
            horaFin = formatearHoraMadrid(dFin);
          }
        }
      } else if (item.start?.date) {
        // Evento de todo el día ("YYYY-MM-DD"). En Google Calendar la fecha de fin es exclusiva
        const [y, m, d] = item.start.date.split('-').map(Number);
        const dInicio = new Date(y, m - 1, d);
        let dFin = new Date(dInicio);
        if (item.end?.date) {
          const [ey, em, ed] = item.end.date.split('-').map(Number);
          dFin = new Date(ey, em - 1, ed);
        } else {
          dFin.setDate(dFin.getDate() + 1);
        }

        const cursor = new Date(dInicio);
        while (cursor < dFin) {
          const k = cursor.toDateString();
          if (!eventosPorDia[k]) {
            eventosPorDia[k] = [];
          }
          eventosPorDia[k].push({
            titulo: item.summary?.trim() || '(Sin título en Google Calendar)',
            hora: '--:--',
            horaFin: '',
            tipo: 'google',
            categoria: 'Google Calendar',
            creador: 'G',
            googleCalendarEventId: item.id,
            esGoogleCalendar: true
          });
          cursor.setDate(cursor.getDate() + 1);
        }
        return;
      }

      if (!fechaClave) return;

      if (!eventosPorDia[fechaClave]) {
        eventosPorDia[fechaClave] = [];
      }

      eventosPorDia[fechaClave].push({
        titulo: item.summary?.trim() || '(Sin título en Google Calendar)',
        hora,
        horaFin,
        tipo: 'google',
        categoria: 'Google Calendar',
        creador: 'G',
        googleCalendarEventId: item.id,
        esGoogleCalendar: true
      });
    });

    return { exito: true, eventos: eventosPorDia };
  } catch (error) {
    console.error('Error de red al consultar Google Calendar API:', error);
    return {
      exito: false,
      eventos: {},
      error: 'Error de conexión al obtener eventos de Google Calendar'
    };
  }
}

/**
 * Combina y sincroniza los eventos de Google Calendar con los eventos locales de Firestore,
 * evitando duplicados por ID de Google Calendar o por coincidencia de título y hora.
 */
export function combinarEventosLocalesYGoogle(
  eventosLocales: Record<string, any[]>,
  eventosGoogle: Record<string, EventoAgendaGC[]>
): Record<string, any[]> {
  const resultado: Record<string, any[]> = {};

  // 1. Copiar eventos locales de Firestore
  Object.keys(eventosLocales).forEach((key) => {
    resultado[key] = [...(eventosLocales[key] || [])];
  });

  // 2. Fusionar eventos de Google Calendar
  Object.keys(eventosGoogle).forEach((fechaClave) => {
    const listaLocal = resultado[fechaClave] ? [...resultado[fechaClave]] : [];
    const listaGoogle = eventosGoogle[fechaClave] || [];

    listaGoogle.forEach((gEvent) => {
      // Verificar si ya existe en Firestore para evitar duplicados:
      // a) Por googleCalendarEventId
      const yaExistePorId = listaLocal.some((loc) => {
        if (typeof loc === 'string') return false;
        return loc?.googleCalendarEventId && loc.googleCalendarEventId === gEvent.googleCalendarEventId;
      });

      // b) Por coincidencia exacta de título y hora
      const yaExistePorTituloYHora = listaLocal.some((loc) => {
        const titLoc = typeof loc === 'string' ? loc : loc?.titulo;
        const horaLoc = typeof loc === 'string' ? '--:--' : (loc?.hora || '--:--');
        return (
          titLoc &&
          titLoc.trim().toLowerCase() === gEvent.titulo.trim().toLowerCase() &&
          horaLoc === gEvent.hora
        );
      });

      if (!yaExistePorId && !yaExistePorTituloYHora) {
        listaLocal.push(gEvent);
      }
    });

    resultado[fechaClave] = listaLocal;
  });

  return resultado;
}
