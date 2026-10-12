import { auth, db, googleCalendarProvider } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

interface GoogleCalendarApiItem {
  id?: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

const STORAGE_KEY_TOKEN = 'google_calendar_token';
const STORAGE_KEY_REFRESH_TOKEN = 'google_calendar_refresh_token';
const STORAGE_KEY_TIMESTAMP = 'google_calendar_token_timestamp';
const STORAGE_KEY_EXPIRES_IN = 'google_calendar_token_expires_in';

/**
 * Obtiene el token de acceso de Google Calendar almacenado en localStorage.
 */
export function obtenerTokenGoogleCalendar(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_TOKEN);
}

/**
 * Obtiene el token de actualización (refresh token) almacenado en localStorage.
 */
export function obtenerRefreshTokenGoogleCalendar(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_REFRESH_TOKEN);
}

/**
 * Comprueba si el token almacenado ha superado los 50 minutos desde su emisión
 * (próximo a caducar, dado que Google emite tokens con validez de 60 minutos).
 */
export function esTokenPorExpirar(): boolean {
  if (typeof window === 'undefined') return false;
  const timestampStr = localStorage.getItem(STORAGE_KEY_TIMESTAMP);
  if (!timestampStr) return true;
  const elapsed = Date.now() - Number(timestampStr);
  return elapsed > 50 * 60 * 1000;
}

/**
 * Guarda el token de acceso, el refresh_token y la marca de tiempo actual tanto en localStorage
 * como vinculados a la sesión del usuario en Firebase (Firestore) para persistencia multidispositivo.
 */
export async function guardarTokenGoogleCalendar(
  token: string,
  refreshToken?: string | null,
  expiresIn?: number
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_TIMESTAMP, Date.now().toString());
    if (refreshToken) {
      localStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, refreshToken);
    }
    if (expiresIn) {
      localStorage.setItem(STORAGE_KEY_EXPIRES_IN, expiresIn.toString());
    }

    // Emitir evento para actualizar componentes reactivos
    window.dispatchEvent(
      new CustomEvent('google-calendar-auth-changed', {
        detail: { conectado: true, token }
      })
    );
  } catch (e) {
    console.warn('Error al guardar tokens en localStorage:', e);
  }

  // Persistir en Firestore vinculado al usuario activo en Firebase Auth
  try {
    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, 'usuarios_config', user.uid);
      const datos: Record<string, unknown> = {
        googleCalendarToken: token,
        actualizadoEn: new Date().toISOString(),
        timestamp: Date.now()
      };
      if (refreshToken) {
        datos.googleCalendarRefreshToken = refreshToken;
      }
      await setDoc(userRef, datos, { merge: true });

      // También mantener registro en la configuración general de sincronización compartida
      await setDoc(
        doc(db, 'configuracion', 'google_calendar'),
        {
          ultimoToken: token,
          ultimoRefreshToken: refreshToken || null,
          actualizadoPor: user.email || user.uid,
          actualizadoEn: new Date().toISOString()
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('Error al persistir tokens en Firestore:', err);
  }
}

/**
 * Elimina los tokens de Google Calendar (solo al cerrar sesión explícitamente).
 */
export async function limpiarTokenGoogleCalendar(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEY_TIMESTAMP);
    localStorage.removeItem(STORAGE_KEY_EXPIRES_IN);

    window.dispatchEvent(
      new CustomEvent('google-calendar-auth-changed', {
        detail: { conectado: false, token: null }
      })
    );
  } catch (e) {
    console.warn('Error al limpiar localStorage de Google Calendar:', e);
  }

  try {
    const user = auth.currentUser;
    if (user) {
      await setDoc(
        doc(db, 'usuarios_config', user.uid),
        {
          googleCalendarToken: null,
          googleCalendarRefreshToken: null,
          desconectadoEn: new Date().toISOString()
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('Error al limpiar sesión en Firestore:', err);
  }
}

/**
 * Indica si el usuario tiene una sesión de Google Calendar activa y válida o renovable.
 * Es permanente mientras exista un token de acceso o un refresh token.
 */
export function estaGoogleCalendarConectado(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH_TOKEN);
  return Boolean(token || refreshToken);
}

/**
 * Recupera los tokens persistidos en Firestore en caso de que localStorage haya sido vaciado.
 */
export async function sincronizarTokensDesdeFirestore(): Promise<{
  token: string | null;
  refreshToken: string | null;
}> {
  try {
    const user = auth.currentUser;
    if (!user) return { token: null, refreshToken: null };

    const docRef = doc(db, 'usuarios_config', user.uid);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      const token = (data.googleCalendarToken as string) || null;
      const refreshToken = (data.googleCalendarRefreshToken as string) || null;

      if (token && typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_TOKEN, token);
        if (data.timestamp) {
          localStorage.setItem(STORAGE_KEY_TIMESTAMP, String(data.timestamp));
        }
        if (refreshToken) {
          localStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, refreshToken);
        }
        window.dispatchEvent(
          new CustomEvent('google-calendar-auth-changed', {
            detail: { conectado: true, token }
          })
        );
      }
      return { token, refreshToken };
    }
  } catch (err) {
    console.warn('Error al recuperar tokens de Firestore:', err);
  }
  return { token: null, refreshToken: null };
}

// Bloqueo de concurrencia: si hay una renovación en marcha, todas las llamadas esperan a la misma promesa
let renovacionEnCurso: Promise<string | null> | null = null;

/**
 * 2. RENOVACIÓN AUTOMÁTICA (Silent Refresh):
 * Renueva el token de acceso de Google Calendar en segundo plano utilizando el refresh_token
 * sin requerir la intervención del usuario ni mostrar ventanas emergentes.
 */
export async function renovarTokenGoogleCalendar(): Promise<string | null> {
  if (renovacionEnCurso) {
    return renovacionEnCurso;
  }

  renovacionEnCurso = (async (): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null;

      let refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH_TOKEN);

      if (!refreshToken) {
        const recuperados = await sincronizarTokensDesdeFirestore();
        refreshToken = recuperados.refreshToken;
      }

      if (!refreshToken) {
        console.warn('No se dispone de refresh_token para renovación silenciosa de Google Calendar.');
        return null;
      }

      console.log('🔄 Renovando token de Google Calendar en segundo plano (Silent Refresh)...');

      // 1. Intentar renovación mediante endpoint de API interna Next.js
      try {
        const res = await fetch('/api/auth/google/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.exito && data.accessToken) {
            console.log('✓ Token de Google Calendar renovado exitosamente en segundo plano.');
            await guardarTokenGoogleCalendar(data.accessToken, refreshToken, data.expiresIn);
            return data.accessToken;
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('Aviso API de renovación:', errData);
        }
      } catch (errApi) {
        console.warn('Fallo de conexión con /api/auth/google/refresh:', errApi);
      }

      // 2. Intentar renovación directa con endpoint de Google OAuth si hay client_id público
      try {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        const params = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        });
        if (clientId) {
          params.append('client_id', clientId);
        }

        const googleRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });

        if (googleRes.ok) {
          const googleData = await googleRes.json();
          if (googleData.access_token) {
            console.log('✓ Token renovado directamente desde endpoint de Google.');
            await guardarTokenGoogleCalendar(googleData.access_token, refreshToken, googleData.expires_in);
            return googleData.access_token;
          }
        }
      } catch (errDirect) {
        console.warn('Fallo en endpoint directo de Google:', errDirect);
      }

      // 3. Forzar refresco de ID token de Firebase Auth si el usuario está autenticado
      try {
        if (auth.currentUser) {
          await auth.currentUser.getIdToken(true);
        }
      } catch (errFb) {
        console.warn('Error al actualizar token de sesión de Firebase:', errFb);
      }

      return null;
    } catch (error) {
      console.error('Error durante la renovación automática de Google Calendar:', error);
      return null;
    } finally {
      renovacionEnCurso = null;
    }
  })();

  return renovacionEnCurso;
}

/**
 * 1. PERSISTENCIA Y REFRESCAMIENTO:
 * Solicita permisos interactivos para Google Calendar forzando acceso offline
 * y consentimiento, almacenando de forma persistente tanto el accessToken como el refreshToken.
 */
export async function conectarGoogleCalendar(): Promise<string | null> {
  try {
    const result = await signInWithPopup(auth, googleCalendarProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    const rawResponse = (result as unknown as {
      _tokenResponse?: {
        refreshToken?: string;
        oauthRefreshToken?: string;
        expiresIn?: number;
      };
      user?: {
        refreshToken?: string;
      };
    })._tokenResponse;

    const refreshToken =
      rawResponse?.refreshToken ||
      rawResponse?.oauthRefreshToken ||
      (credential as unknown as { refreshToken?: string })?.refreshToken ||
      result.user?.refreshToken;

    if (token) {
      await guardarTokenGoogleCalendar(token, refreshToken, rawResponse?.expiresIn);
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
 * Asegura la disponibilidad de un token válido de Google Calendar.
 * Si el token no existe o está por expirar (> 50 min), ejecuta renovación silenciosa en segundo plano.
 * Solo si todo lo anterior falla y `promptSiFalta` es true, invoca la ventana interactiva.
 */
export async function asegurarTokenGoogleCalendar(promptSiFalta = false): Promise<string | null> {
  let token = obtenerTokenGoogleCalendar();

  // Si no hay token o está próximo a expirar, renovar en segundo plano de forma silenciosa
  if (!token || esTokenPorExpirar()) {
    const nuevoToken = await renovarTokenGoogleCalendar();
    if (nuevoToken) {
      return nuevoToken;
    }
  }

  if (token) return token;

  // Intentar rescatar desde Firestore
  const desdeFirestore = await sincronizarTokensDesdeFirestore();
  if (desdeFirestore.token) {
    return desdeFirestore.token;
  }

  if (promptSiFalta) {
    token = await conectarGoogleCalendar();
    return token;
  }

  return null;
}

/**
 * Ejecutor HTTP con reintento automático para la API de Google Calendar:
 * Si la petición devuelve 401 (Unauthorized) o 403 (Token caducado),
 * renueva el token en segundo plano y reintenta la llamada inmediatamente.
 */
async function fetchGoogleCalendarConReintento(
  url: string,
  options: RequestInit,
  tokenInicial: string
): Promise<{ res: Response; tokenUsado: string }> {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${tokenInicial}`);

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    console.warn(`Respuesta ${res.status} de Google Calendar. Ejecutando renovación silenciosa...`);
    const nuevoToken = await renovarTokenGoogleCalendar();
    if (nuevoToken && nuevoToken !== tokenInicial) {
      console.log('Reintentando petición a Google Calendar con el nuevo token renovado...');
      const headersReintento = new Headers(options.headers || {});
      headersReintento.set('Authorization', `Bearer ${nuevoToken}`);
      res = await fetch(url, { ...options, headers: headersReintento });
      return { res, tokenUsado: nuevoToken };
    }
  }

  return { res, tokenUsado: tokenInicial };
}

export const TIMEZONE_MADRID = 'Europe/Madrid';

/**
 * Obtiene el offset de la zona horaria de Madrid (ej. "+02:00" o "+01:00") para un objeto Date.
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
        { method: 'popup', minutes: 30 },
        { method: 'popup', minutes: 1440 }
      ]
    }
  };
}

/**
 * 1. ESCRITURA: Inserta un nuevo evento en el Google Calendar principal ('primary').
 * Con reintento transparente por renovación automática en caso de caducidad.
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
  const authToken = token || await asegurarTokenGoogleCalendar(false);
  if (!authToken) {
    return {
      exito: false,
      error: 'Google Calendar no conectado: falta el token de acceso. Pulsa "Conectar Google Calendar" para activar alarmas.',
      necesitaReconexion: true
    };
  }

  const payload = prepararPayloadGoogleCalendar(fechaClave, evento);

  try {
    const { res } = await fetchGoogleCalendarConReintento(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      },
      authToken
    );

    if (res.status === 401) {
      return {
        exito: false,
        error: 'La sesión de Google Calendar ha caducado. Pulsa "Conectar" para renovar la autorización.',
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
 * Si el evento no existe en Google (404), lo recrea.
 * Con reintento automático por renovación silenciosa de token.
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
  const authToken = token || await asegurarTokenGoogleCalendar(false);
  if (!authToken) {
    return {
      exito: false,
      error: 'Falta token de acceso para actualizar en Google Calendar.',
      necesitaReconexion: true
    };
  }

  const payload = prepararPayloadGoogleCalendar(fechaClave, evento);

  try {
    const { res, tokenUsado } = await fetchGoogleCalendarConReintento(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      },
      authToken
    );

    if (res.status === 401) {
      return {
        exito: false,
        error: 'La sesión de Google Calendar ha caducado.',
        necesitaReconexion: true
      };
    }

    if (res.status === 404) {
      return await insertarEventoGoogleCalendar({ fechaClave, evento, token: tokenUsado });
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
 * Elimina un evento de Google Calendar con renovación automática en segundo plano.
 */
export async function eliminarEventoGoogleCalendar(eventId?: string, token?: string): Promise<boolean> {
  if (!eventId) return false;
  const authToken = token || await asegurarTokenGoogleCalendar(false);
  if (!authToken) return false;

  try {
    const { res } = await fetchGoogleCalendarConReintento(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' },
      authToken
    );

    return res.ok || res.status === 404;
  } catch (error) {
    console.error('Error de red al eliminar evento en Google Calendar:', error);
    return false;
  }
}

/**
 * Función principal para sincronizar un evento con Google Calendar (inserción o actualización).
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
  let token = await asegurarTokenGoogleCalendar(solicitarPermisoSiFalta);

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
 * Obtiene los eventos del usuario de Google Calendar para un rango de fechas (mes/semana)
 * con reintento automático y renovación silenciosa en caso de caducidad.
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
  const authToken = token || await asegurarTokenGoogleCalendar(false);
  if (!authToken) {
    return { exito: false, eventos: {} };
  }

  const timeMin = fechaInicio.toISOString();
  const timeMax = fechaFin.toISOString();

  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&timeZone=Europe%2FMadrid&singleEvents=true&orderBy=startTime&maxResults=250`;

    const { res } = await fetchGoogleCalendarConReintento(
      url,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      },
      authToken
    );

    if (res.status === 401) {
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
    const items: GoogleCalendarApiItem[] = (data.items || []) as GoogleCalendarApiItem[];
    const eventosPorDia: Record<string, EventoAgendaGC[]> = {};

    items.forEach((item) => {
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

export interface EventoGenericoAgenda {
  titulo: string;
  hora?: string;
  horaFin?: string;
  tipo?: string;
  categoria?: string;
  creador?: string;
  googleCalendarEventId?: string;
  esGoogleCalendar?: boolean;
}

/**
 * Combina y sincroniza los eventos de Google Calendar con los eventos locales de Firestore,
 * evitando duplicados por ID de Google Calendar o por coincidencia de título y hora.
 */
export function combinarEventosLocalesYGoogle<T extends EventoGenericoAgenda = EventoGenericoAgenda>(
  eventosLocales: Record<string, (T | string)[]>,
  eventosGoogle: Record<string, EventoAgendaGC[]>
): Record<string, (T | EventoAgendaGC | string)[]> {
  const resultado: Record<string, (T | EventoAgendaGC | string)[]> = {};

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

