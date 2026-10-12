// app/data/version.ts

export const APP_VERSION = "1.4.1";

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
      icono: "📅",
      titulo: "Desglose agrupado por día en Horas Trabajadas",
      descripcion: "El resumen de turnos ahora agrupa todos los turnos del mismo día en una sola tarjeta. El encabezado muestra la fecha y el total de horas del día, y el cuerpo lista cada turno con su título, horario y horas individuales.",
      badge: "Mejora UX",
      badgeColor: "#166534",
      badgeBg: "#dcfce7"
    },
    {
      icono: "⏱️",
      titulo: "Contador de Horas Trabajadas",
      descripcion: "Nueva sección accesible desde el menú lateral: calcula automáticamente el total de horas de trabajo semanal para Joel y Ana por separado. Navega entre semanas con flechas, visualiza cada turno con su duración y consulta el resumen total con indicador visual de progreso.",
      badge: "Nueva Sección",
      badgeColor: "#166534",
      badgeBg: "#dcfce7"
    },
    {
      icono: "🛒",
      titulo: "Logo de Condis en turnos de trabajo de Joel",
      descripcion: "Visualización personalizada del logo oficial de Condis en las tarjetas de eventos de trabajo creados por el usuario principal (Joel / 'J'). Exclusivo para sus turnos, manteniéndose oculto en eventos personales o creados por Ana.",
      badge: "Turnos Condis",
      badgeColor: "#dc2626",
      badgeBg: "#fef2f2"
    },
    {
      icono: "🔄",
      titulo: "Conexión permanente con Google Calendar",
      descripcion: "Se acabó la desconexión por inactividad. La conexión con Google Calendar ahora es ininterrumpida y permanente: el token de acceso se renueva de forma automática y transparente en segundo plano (Silent Refresh) mediante refresh token, sin requerir reconectar manualmente.",
      badge: "Permanente",
      badgeColor: "#059669",
      badgeBg: "#ecfdf5"
    },
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
      titulo: "¡Bienvenido a AJA v1.4.1!",
      descripcion: "Tu sistema operativo familiar (Ana, Joel y Alma) se actualiza con el desglose diario agrupado de turnos, el Contador de Horas Trabajadas semanal, identificación visual exclusiva de Condis en los turnos de Joel, conexión permanente a Google Calendar y mejoras continuas.",
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
