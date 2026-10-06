// app/data/version.ts

export const APP_VERSION = "1.3.1";

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
      icono: "⏰",
      titulo: "Sincronización horaria exacta con Google Calendar",
      descripcion: "Ajuste y fijación de zona horaria oficial (Europe/Madrid) al crear, editar y consultar eventos con la API de Google Calendar. Se resuelven desajustes de horas en móviles y tarjetas de la Agenda.",
      badge: "Zona Horaria",
      badgeColor: "#0284c7",
      badgeBg: "#e0f2fe"
    },
    {
      icono: "🍱",
      titulo: "¡Menú Escolar de Octubre de Alma cargado!",
      descripcion: "Carga completa plato por plato de todos los días lectivos de octubre de Alma (Institut Escola Castellterçol, Moianès): Primer plato, Segundo plato, Postre, valores nutricionales y el Menú Especial de la Castanyada del 30 de octubre.",
      badge: "Menú Escolar",
      badgeColor: "#059669",
      badgeBg: "#ecfdf5"
    },
    {
      icono: "🚀",
      titulo: "¡Bienvenido a AJA v1.3.1!",
      descripcion: "Tu sistema operativo familiar (Ana, Joel y Alma) se actualiza con corrección de sincronización horaria en Google Calendar, menú escolar de Alma y mejoras generales.",
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
