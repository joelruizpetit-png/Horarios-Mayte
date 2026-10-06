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
    // Los tokens de OAuth de Google expiran a los 60 minutos (3600s)
    if (elapsed > 55 * 60 * 1000) {
      // Expirado o a punto de expirar
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
 * Útil cuando el usuario pulsa "Conectar Google Calendar" o al guardar un evento si el token expiró.
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
 * Construye el objeto payload para la API v3 de Google Calendar con alarmas nativas:
 * - Notificación móvil 30 minutos antes
 * - Notificación móvil 1 día (1440 minutos) antes
 */
export function prepararPayloadGoogleCalendar(fechaClave: string, evento: EventoAgendaGC) {
  let d = new Date(fechaClave);
  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  const fechaISO = `${y}-${m}-${dia}`;

  const timeZone = typeof Intl !== 'undefined'
    ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid')
    : 'Europe/Madrid';

  const horaLimpia = (evento.hora || '').trim();
  const esHoraValida = /^\d{1,2}:\d{2}$/.test(horaLimpia) && horaLimpia !== '--:--';

  let start: { dateTime?: string; date?: string; timeZone?: string };
  let end: { dateTime?: string; date?: string; timeZone?: string };

  if (esHoraValida) {
    const [hStr, mStr] = horaLimpia.split(':');
    const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate(), parseInt(hStr, 10), parseInt(mStr, 10), 0);

    let fin: Date;
    const horaFinLimpia = (evento.horaFin || '').trim();
    if (/^\d{1,2}:\d{2}$/.test(horaFinLimpia)) {
      const [hfStr, mfStr] = horaFinLimpia.split(':');
      fin = new Date(d.getFullYear(), d.getMonth(), d.getDate(), parseInt(hfStr, 10), parseInt(mfStr, 10), 0);
      if (fin <= inicio) {
        fin = new Date(inicio.getTime() + 60 * 60 * 1000);
      }
    } else {
      // Duración por defecto de 1 hora
      fin = new Date(inicio.getTime() + 60 * 60 * 1000);
    }

    start = {
      dateTime: inicio.toISOString(),
      timeZone
    };
    end = {
      dateTime: fin.toISOString(),
      timeZone
    };
  } else {
    // Evento de día completo: en Google Calendar la fecha fin es exclusiva (día siguiente)
    const dSiguiente = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const ySig = dSiguiente.getFullYear();
    const mSig = String(dSiguiente.getMonth() + 1).padStart(2, '0');
    const diaSig = String(dSiguiente.getDate()).padStart(2, '0');
    const fechaSiguienteISO = `${ySig}-${mSig}-${diaSig}`;

    start = {
      date: fechaISO
    };
    end = {
      date: fechaSiguienteISO
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
 * Inserta un nuevo evento en el Google Calendar principal ('primary').
 */
export async function insertarEventoGoogleCalendar({
  fechaClave,
  evento,
  token
}: {
  fechaClave: string;
  evento: EventoAgendaGC;
  token?: string;
}): Promise<string | null> {
  const authToken = token || obtenerTokenGoogleCalendar();
  if (!authToken) {
    console.warn('Google Calendar no sincronizado: falta token de acceso OAuth.');
    return null;
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
      console.warn('Token de Google Calendar expirado (401).');
      return null;
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Error al insertar evento en Google Calendar (${res.status}):`, errText);
      return null;
    }

    const data = await res.json();
    return data.id || null;
  } catch (error) {
    console.error('Error de red al insertar en Google Calendar:', error);
    return null;
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
}): Promise<string | null> {
  const authToken = token || obtenerTokenGoogleCalendar();
  if (!authToken) {
    return null;
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
      return null;
    }

    if (res.status === 404) {
      // Si el evento fue eliminado externamente en Google Calendar, lo recreamos
      return await insertarEventoGoogleCalendar({ fechaClave, evento, token: authToken });
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Error al actualizar evento en Google Calendar (${res.status}):`, errText);
      return null;
    }

    const data = await res.json();
    return data.id || eventId;
  } catch (error) {
    console.error('Error de red al actualizar en Google Calendar:', error);
    return null;
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
 * Retorna el ID de Google Calendar asignado y el estado de la operación.
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
}): Promise<{ googleCalendarEventId?: string; exito: boolean }> {
  let token = obtenerTokenGoogleCalendar();

  if (!token && solicitarPermisoSiFalta) {
    token = await conectarGoogleCalendar();
  }

  if (!token) {
    return { exito: false };
  }

  const existingId = evento.googleCalendarEventId;

  if (esEdicion && existingId) {
    const updatedId = await actualizarEventoGoogleCalendar({
      eventId: existingId,
      fechaClave,
      evento,
      token
    });
    return {
      googleCalendarEventId: updatedId || existingId,
      exito: !!updatedId
    };
  } else {
    const newId = await insertarEventoGoogleCalendar({
      fechaClave,
      evento,
      token
    });
    return {
      googleCalendarEventId: newId || undefined,
      exito: !!newId
    };
  }
}
