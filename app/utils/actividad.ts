import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export interface RegistroActividad {
  id?: string;
  seccion: 'agenda' | 'finanzas' | 'lista_compra';
  descripcion: string;
  usuario: string;
  usuarioEmail: string;
  timestamp: string; // ISO 8601
}

/**
 * Normaliza y formatea el nombre del usuario para que en toda la aplicación
 * únicamente aparezcan los nombres canónicos familiares: "Joel" y "Ana".
 * Cualquier variante de Arantxa ("Arantxa", "Arantxa [Apellidos]", email con aijg/arantxa/ana)
 * se mapea de forma estricta a "Ana".
 */
export function formatearNombreFamiliar(nombre?: string | null, email?: string | null): string {
  const n = (nombre || '').toLowerCase().trim();
  const e = (email || '').toLowerCase().trim();

  // 1. Detección de Ana / Arantxa
  if (
    n.includes('arantxa') ||
    n.includes('ana') ||
    e.includes('aijg') ||
    e.includes('arantxa') ||
    e.includes('ana') ||
    e === 'aijg1985@gmail.com'
  ) {
    return 'Ana';
  }

  // 2. Detección de Joel
  if (
    n.includes('joel') ||
    e.includes('joel') ||
    e === 'joelruizpetit@gmail.com'
  ) {
    return 'Joel';
  }

  // Fallbacks con expresiones regulares sobre el nombre completo (por si vienen apellidos)
  if (nombre && /arantxa/i.test(nombre)) return 'Ana';
  if (nombre && /joel/i.test(nombre)) return 'Joel';

  // Si no coincide con ninguno conocido, retornar nombre limpio o 'Familiar'
  if (nombre && nombre.trim()) return nombre.trim();
  if (e) {
    const parte = e.split('@')[0];
    if (/arantxa|aijg|ana/i.test(parte)) return 'Ana';
    if (/joel/i.test(parte)) return 'Joel';
    return parte;
  }

  return 'Familiar';
}

/**
 * Obtiene el nombre estandarizado a partir del email o nombre para mostrar.
 * Garantiza que siempre devuelva "Ana" o "Joel".
 */
export function obtenerNombreUsuario(email?: string | null, displayName?: string | null): string {
  return formatearNombreFamiliar(displayName, email);
}

export async function registrarActividad({
  seccion,
  descripcion,
  usuario,
  usuarioEmail
}: {
  seccion: 'agenda' | 'finanzas' | 'lista_compra';
  descripcion: string;
  usuario?: string;
  usuarioEmail?: string;
}) {
  try {
    const email = (usuarioEmail || '').toLowerCase().trim();
    // Forzamos el nombre estandarizado ("Joel" o "Ana")
    const nombre = formatearNombreFamiliar(usuario, email);

    await addDoc(collection(db, 'actividad_reciente'), {
      seccion,
      descripcion,
      usuario: nombre,
      usuarioEmail: email,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al registrar actividad reciente en Firestore:', error);
  }
}
