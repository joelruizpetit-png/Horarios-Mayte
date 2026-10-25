import { formatearNombreFamiliar } from './actividad';

export interface OpcionSonidoAlarma {
  id: string;
  nombre: string;
  descripcion: string;
  archivo: string;
  icono: string;
}

export const SONIDOS_ALARMA_DISPONIBLES: OpcionSonidoAlarma[] = [
  {
    id: 'alarm1',
    nombre: 'Beep Clásico',
    descripcion: 'Tono digital clásico, corto y directo (alarm1.wav)',
    archivo: '/sounds/alarm1.wav',
    icono: '🔔'
  },
  {
    id: 'alarm2',
    nombre: 'Campana Digital',
    descripcion: 'Timbre electrónico claro y resonante (alarm2.wav)',
    archivo: '/sounds/alarm2.wav',
    icono: '🛎️'
  },
  {
    id: 'alarm3',
    nombre: 'Melodía Suave',
    descripcion: 'Aviso melódico agradable en formato MP3 (alarm3.mp3)',
    archivo: '/sounds/alarm3.mp3',
    icono: '🎵'
  },
  {
    id: 'alarm4',
    nombre: 'Pulso Rítmico',
    descripcion: 'Secuencia acústica rítmica de recordatorio (alarm4.wav)',
    archivo: '/sounds/alarm4.wav',
    icono: '⏰'
  },
  {
    id: 'alarm5',
    nombre: 'Alerta Intensa',
    descripcion: 'Alarma prolongada de alta intensidad (alarm5.wav)',
    archivo: '/sounds/alarm5.wav',
    icono: '🚨'
  }
];

export const SONIDO_POR_DEFECTO_ID = 'alarm3';

export interface PreferenciasAlarmaUsuario {
  sonidoId: string;
  volumen: number; // 0.1 a 1.0
  activa: boolean;
  minutosAntelacion: number; // 0 = a la hora en punto, 5, 10, 15, 30
}

const PREFERENCIAS_DEFECTO: PreferenciasAlarmaUsuario = {
  sonidoId: SONIDO_POR_DEFECTO_ID,
  volumen: 0.85,
  activa: true,
  minutosAntelacion: 0
};

let audioActivo: HTMLAudioElement | null = null;

/**
 * Obtiene la clave de localStorage asociada al usuario familiar activo ("Joel" o "Ana").
 */
export function obtenerClaveStorageAlarma(email?: string | null, displayName?: string | null): string {
  const usuarioCanon = formatearNombreFamiliar(displayName, email);
  return `planificador_alarma_prefs_${usuarioCanon.toLowerCase()}`;
}

/**
 * Lee las preferencias de alarma guardadas en localStorage para el usuario activo.
 */
export function obtenerPreferenciasAlarma(
  email?: string | null,
  displayName?: string | null
): PreferenciasAlarmaUsuario {
  if (typeof window === 'undefined') return PREFERENCIAS_DEFECTO;

  try {
    const clave = obtenerClaveStorageAlarma(email, displayName);
    const guardado = window.localStorage.getItem(clave);
    if (!guardado) return PREFERENCIAS_DEFECTO;

    const parsed = JSON.parse(guardado) as Partial<PreferenciasAlarmaUsuario>;
    const existeSonido = SONIDOS_ALARMA_DISPONIBLES.some((s) => s.id === parsed.sonidoId);

    return {
      sonidoId: existeSonido && parsed.sonidoId ? parsed.sonidoId : SONIDO_POR_DEFECTO_ID,
      volumen:
        typeof parsed.volumen === 'number' && parsed.volumen >= 0 && parsed.volumen <= 1
          ? parsed.volumen
          : PREFERENCIAS_DEFECTO.volumen,
      activa: typeof parsed.activa === 'boolean' ? parsed.activa : true,
      minutosAntelacion:
        typeof parsed.minutosAntelacion === 'number' ? parsed.minutosAntelacion : 0
    };
  } catch {
    return PREFERENCIAS_DEFECTO;
  }
}

/**
 * Guarda las preferencias de alarma en localStorage asociadas al usuario activo.
 */
export function guardarPreferenciasAlarma(
  nuevasPrefs: Partial<PreferenciasAlarmaUsuario>,
  email?: string | null,
  displayName?: string | null
): PreferenciasAlarmaUsuario {
  const actuales = obtenerPreferenciasAlarma(email, displayName);
  const actualizadas: PreferenciasAlarmaUsuario = {
    ...actuales,
    ...nuevasPrefs
  };

  if (typeof window !== 'undefined') {
    try {
      const clave = obtenerClaveStorageAlarma(email, displayName);
      window.localStorage.setItem(clave, JSON.stringify(actualizadas));
      window.dispatchEvent(new CustomEvent('preferencias-alarma-actualizadas', { detail: actualizadas }));
    } catch (err) {
      console.error('Error al guardar preferencias de alarma en localStorage:', err);
    }
  }

  return actualizadas;
}

/**
 * Obtiene el objeto de configuración del sonido elegido por el usuario.
 */
export function obtenerSonidoAlarmaPorId(sonidoId?: string): OpcionSonidoAlarma {
  return (
    SONIDOS_ALARMA_DISPONIBLES.find((s) => s.id === sonidoId) ||
    SONIDOS_ALARMA_DISPONIBLES.find((s) => s.id === SONIDO_POR_DEFECTO_ID) ||
    SONIDOS_ALARMA_DISPONIBLES[0]
  );
}

/**
 * Detiene cualquier sonido de alarma o previsualización que se esté reproduciendo actualmente.
 */
export function detenerSonidoAlarma(): void {
  if (audioActivo) {
    try {
      audioActivo.pause();
      audioActivo.currentTime = 0;
    } catch {
      // Ignorar errores al pausar
    }
    audioActivo = null;
  }
}

/**
 * Reproduce un tono de alarma usando la API de Audio de JavaScript: new Audio('/sounds/...').play()
 */
export function reproducirSonidoAlarma(opciones?: {
  sonidoId?: string;
  volumen?: number;
  email?: string | null;
  displayName?: string | null;
  onEnded?: () => void;
}): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;

  detenerSonidoAlarma();

  const prefs = obtenerPreferenciasAlarma(opciones?.email, opciones?.displayName);
  const idElegido = opciones?.sonidoId || prefs.sonidoId;
  const volumenElegido = typeof opciones?.volumen === 'number' ? opciones.volumen : prefs.volumen;
  const sonido = obtenerSonidoAlarmaPorId(idElegido);

  try {
    const audio = new Audio(sonido.archivo);
    audio.volume = Math.max(0.05, Math.min(1, volumenElegido));
    audioActivo = audio;

    audio.addEventListener('ended', () => {
      if (audioActivo === audio) {
        audioActivo = null;
      }
      if (opciones?.onEnded) {
        opciones.onEnded();
      }
    });

    audio.play().catch((err) => {
      console.warn('No se pudo reproducir el archivo de audio de alarma:', err);
      if (opciones?.onEnded) {
        opciones.onEnded();
      }
    });

    return audio;
  } catch (err) {
    console.error('Error al inicializar new Audio():', err);
    return null;
  }
}
