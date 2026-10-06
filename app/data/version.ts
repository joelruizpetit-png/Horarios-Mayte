// app/data/version.ts

export const APP_VERSION = "1.2.0";

export interface ItemNovedadVersion {
  icono: string;
  titulo: string;
  descripcion: string;
  badge?: string;
  badgeColor?: string;
  badgeBg?: string;
}

export interface NovedadesVersionConfig {
  version: string;
  lema: string;
  fecha: string;
  items: ItemNovedadVersion[];
}

export const NOVEDADES_VERSION: NovedadesVersionConfig = {
  version: APP_VERSION,
  lema: "OS Familiar de Ana, Joel y Alma",
  fecha: "Octubre 2026",
  items: [
    {
      icono: "🚀",
      titulo: "¡Bienvenido a AJA v1.2.0!",
      descripcion: "Tu sistema operativo familiar (Ana, Joel y Alma) se renueva con más velocidad, estabilidad y diseño optimizado.",
      badge: "Nueva Versión",
      badgeColor: "#0047b3",
      badgeBg: "#eff6ff"
    },
    {
      icono: "📅",
      titulo: "Sincronización con Google Calendar",
      descripcion: "Los eventos creados o editados en la Agenda se sincronizan automáticamente con tu Google Calendar principal, activando alarmas nativas en tu móvil (30 min y 1 día antes).",
      badge: "Alarmas Móvil",
      badgeColor: "#047857",
      badgeBg: "#ecfdf5"
    },
    {
      icono: "✏️",
      titulo: "Corrección de nombres de usuario (Ana)",
      descripcion: "Estandarización en el registro de actividad y toda la app: los nombres ahora se muestran de manera canónica siempre como 'Ana' y 'Joel'.",
      badge: "Estandarización",
      badgeColor: "#b91c1c",
      badgeBg: "#fef2f2"
    },
    {
      icono: "🔔",
      titulo: "Optimizaciones de refresco en segundo plano",
      descripcion: "Detección instantánea al volver a la app tras desbloquear el móvil para sincronizar avisos, calendarios y finanzas en tiempo real.",
      badge: "Rendimiento",
      badgeColor: "#6b21a8",
      badgeBg: "#faf5ff"
    }
  ]
};
