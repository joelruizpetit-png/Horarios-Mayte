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

export function obtenerNombreUsuario(email?: string | null, displayName?: string | null): string {
  if (displayName && displayName.trim()) return displayName.trim();
  const e = (email || '').toLowerCase().trim();
  if (e.includes('joel')) return 'Joel';
  if (e.includes('aijg') || e.includes('arantxa') || e.includes('ana')) return 'Arantxa';
  return e ? e.split('@')[0] : 'Familiar';
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
    const nombre = usuario || obtenerNombreUsuario(email);

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
