"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase'; 
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { registrarActividad, formatearNombreFamiliar } from '../utils/actividad';
import {
  sincronizarEventoGoogleCalendar,
  eliminarEventoGoogleCalendar,
  estaGoogleCalendarConectado,
  conectarGoogleCalendar,
  asegurarTokenGoogleCalendar,
  obtenerEventosGoogleCalendar,
  combinarEventosLocalesYGoogle,
  EventoAgendaGC
} from '../utils/googleCalendar';

interface Evento {
  titulo: string;
  hora: string;
  horaFin?: string;
  tipo?: 'normal' | 'trabajo' | string;
  categoria?: string;
  creador?: string;
  googleCalendarEventId?: string;
  esGoogleCalendar?: boolean;
}

const DIAS_SEMANA = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo'
];

const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

interface CalendarioSemanalProps {
  usuario?: { email?: string | null } | null;
  fechaSeleccionada?: Date;
  onFechaChange?: (fecha: Date) => void;
}

export default function CalendarioSemanal({
  usuario,
  fechaSeleccionada,
  onFechaChange
}: CalendarioSemanalProps = {}) {
  const [fechaInterna, setFechaInterna] = useState<Date>(new Date());
  const fechaReferencia = fechaSeleccionada || fechaInterna;
  const [eventos, setEventos] = useState<Record<string, (Evento | string)[]>>({});
  const [mostrarModal, setMostrarModal] = useState(false);
  const [fechaModal, setFechaModal] = useState<Date>(new Date());
  
  const [nuevoEvento, setNuevoEvento] = useState({ 
    titulo: "", 
    hora: "", 
    horaFin: "", 
    tipo: "normal" 
  });

  // Estado para eventos recurrentes (Pestaña Repetir)
  const [diasRepeticion, setDiasRepeticion] = useState<number[]>([1]);
  const [fechaInicioRep, setFechaInicioRep] = useState<string>('');
  const [fechaFinRep, setFechaFinRep] = useState<string>('');
  const [categoriaRepeticion, setCategoriaRepeticion] = useState<'normal' | 'trabajo'>('normal');

  // Estado para modal de edición
  const [mostrarModalEdicion, setMostrarModalEdicion] = useState<boolean>(false);
  const [eventoAEditar, setEventoAEditar] = useState<{
    index: number;
    fechaClave: string;
    titulo: string;
    hora: string;
    horaFin: string;
    tipo: string;
    creador: string;
    googleCalendarEventId?: string;
  }>({
    index: -1,
    fechaClave: '',
    titulo: '',
    hora: '',
    horaFin: '',
    tipo: 'normal',
    creador: 'J',
    googleCalendarEventId: ''
  });

  // Estado de conexión con Google Calendar y eventos leídos
  const [gcalConectado, setGcalConectado] = useState<boolean>(false);
  const [eventosGoogle, setEventosGoogle] = useState<Record<string, EventoAgendaGC[]>>({});
  const [cargandoGoogle, setCargandoGoogle] = useState<boolean>(false);

  useEffect(() => {
    setGcalConectado(estaGoogleCalendarConectado());
  }, []);

  const manejarConectarGoogle = async () => {
    const token = await conectarGoogleCalendar();
    if (token) {
      setGcalConectado(true);
      await cargarEventosGoogle(lunesSemana);
      alert("¡Google Calendar conectado con éxito! Tus eventos se sincronizarán con alarmas nativas (30 min y 1 día antes) en tu móvil.");
    }
  };

  const DIAS_SEMANA_OPCIONES = [
    { num: 1, label: 'L', nombre: 'Lunes' },
    { num: 2, label: 'M', nombre: 'Martes' },
    { num: 3, label: 'X', nombre: 'Miércoles' },
    { num: 4, label: 'J', nombre: 'Jueves' },
    { num: 5, label: 'V', nombre: 'Viernes' },
    { num: 6, label: 'S', nombre: 'Sábado' },
    { num: 0, label: 'D', nombre: 'Domingo' }
  ];

  const toISODate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const toggleDiaRepeticion = (num: number) => {
    if (diasRepeticion.includes(num)) {
      setDiasRepeticion(diasRepeticion.filter(d => d !== num));
    } else {
      setDiasRepeticion([...diasRepeticion, num]);
    }
  };

  // Obtener la inicial del creador ("J" para Joel, "A" para Ana)
  const obtenerInicialCreador = () => {
    const email = usuario?.email || auth?.currentUser?.email || '';
    const nombre = formatearNombreFamiliar(undefined, email);
    return nombre === 'Ana' ? 'A' : 'J';
  };

  // Identificar si un evento proviene de la Pestaña Deportes
  const esEventoDeporte = (e: Evento | string | null | undefined): boolean => {
    if (!e) return false;
    if (typeof e === 'string') {
      return e.startsWith('⚽') || e.startsWith('🏎️') || e.startsWith('⏱️');
    }
    if (e.tipo === 'deporte' || e.tipo === 'deportes' || e.categoria === 'Deportes' || e.categoria === 'deportes') {
      return true;
    }
    const tit = (e.titulo || '').toLowerCase();
    if (e.titulo && (e.titulo.startsWith('⚽') || e.titulo.startsWith('🏎️') || e.titulo.startsWith('⏱️'))) {
      return true;
    }
    if (tit.includes('barça vs') || tit.includes('f1:') || tit.includes('fórmula 1')) {
      return true;
    }
    return false;
  };

  // Conexión en tiempo real con Firestore
  useEffect(() => {
    const docRef = doc(db, "agenda", "datos");
    const cancelarSuscripcion = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setEventos(docSnap.data() as Record<string, (Evento | string)[]>);
      }
    });
    return () => cancelarSuscripcion();
  }, []);

  // Calcular el Lunes de la semana seleccionada
  const obtenerLunes = (d: Date) => {
    const fecha = new Date(d);
    const dia = fecha.getDay(); // 0 es Domingo, 1 es Lunes
    const diff = dia === 0 ? -6 : 1 - dia;
    fecha.setDate(fecha.getDate() + diff);
    fecha.setHours(0, 0, 0, 0);
    return fecha;
  };

  const lunesSemana = obtenerLunes(fechaReferencia);

  // Combinar eventos de Firestore con eventos sincronizados de Google Calendar
  const eventosCombinados = useMemo(() => {
    return combinarEventosLocalesYGoogle(eventos, eventosGoogle);
  }, [eventos, eventosGoogle]);

  const cargarEventosGoogle = async (baseLunes: Date) => {
    try {
      const inicio = new Date(baseLunes);
      inicio.setHours(0, 0, 0, 0);
      const fin = new Date(baseLunes);
      fin.setDate(baseLunes.getDate() + 7);
      fin.setHours(23, 59, 59, 999);

      setCargandoGoogle(true);
      const res = await obtenerEventosGoogleCalendar({
        fechaInicio: inicio,
        fechaFin: fin
      });

      if (res.exito) {
        setEventosGoogle(res.eventos);
      } else if (res.necesitaReconexion) {
        setGcalConectado(false);
      }
      setGcalConectado(estaGoogleCalendarConectado());
    } catch (e) {
      console.warn("No se pudieron cargar eventos de Google Calendar:", e);
    } finally {
      setCargandoGoogle(false);
    }
  };

  useEffect(() => {
    cargarEventosGoogle(lunesSemana);
  }, [lunesSemana.toDateString()]);

  // Generar los 7 días de la semana
  const diasDeLaSemana = Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(lunesSemana);
    dia.setDate(lunesSemana.getDate() + i);
    return dia;
  });

  const cambiarSemana = (offsetDias: number) => {
    const nuevaFecha = new Date(fechaReferencia);
    nuevaFecha.setDate(nuevaFecha.getDate() + offsetDias);
    setFechaInterna(nuevaFecha);
    if (onFechaChange) {
      onFechaChange(nuevaFecha);
    }
  };

  const irAHoy = () => {
    const hoy = new Date();
    setFechaInterna(hoy);
    if (onFechaChange) {
      onFechaChange(hoy);
    }
  };

  const abrirModalParaDia = async (dia: Date) => {
    setFechaModal(dia);
    const hoyStr = toISODate(dia);
    setFechaInicioRep(hoyStr);

    const fin = new Date(dia);
    if (fin.getMonth() >= 8) {
      fin.setFullYear(fin.getFullYear() + 1);
      fin.setMonth(5);
      fin.setDate(30);
    } else {
      fin.setMonth(5);
      fin.setDate(30);
    }
    setFechaFinRep(toISODate(fin));
    setDiasRepeticion([dia.getDay()]);
    setCategoriaRepeticion('normal');
    setNuevoEvento({ titulo: "", hora: "", horaFin: "", tipo: "normal" });
    setMostrarModal(true);

    // Asegurar accessToken de Google Calendar
    const token = await asegurarTokenGoogleCalendar();
    if (token) setGcalConectado(true);
  };

  const guardarNota = async () => {
    if (!nuevoEvento.titulo.trim()) {
      alert("Por favor, introduce un título para el evento.");
      return;
    }

    // MODO REPETIR (RECURRENTE / EXTRAESCOLAR)
    if (nuevoEvento.tipo === 'repetir') {
      if (diasRepeticion.length === 0) {
        alert("Por favor, selecciona al menos un día de la semana para repetir el evento.");
        return;
      }
      if (!fechaInicioRep || !fechaFinRep) {
        alert("Por favor, indica tanto la fecha de inicio como la de fin.");
        return;
      }

      const [anoIni, mesIni, diaIni] = fechaInicioRep.split('-').map(Number);
      const inicio = new Date(anoIni, mesIni - 1, diaIni);

      const [anoFin, mesFin, diaFin] = fechaFinRep.split('-').map(Number);
      const fin = new Date(anoFin, mesFin - 1, diaFin);

      if (inicio > fin) {
        alert("La fecha de inicio debe ser anterior o igual a la fecha de fin.");
        return;
      }

      const nuevosEventos = { ...eventos };
      let eventosCreados = 0;
      const actual = new Date(inicio);

      while (actual <= fin) {
        const diaSemana = actual.getDay();
        if (diasRepeticion.includes(diaSemana)) {
          const fechaClave = actual.toDateString();
          const notasDelDia = nuevosEventos[fechaClave] || [];

          const eventoAGuardar: Evento = {
            titulo: nuevoEvento.titulo.trim(),
            hora: nuevoEvento.hora || "--:--",
            horaFin: categoriaRepeticion === 'trabajo' ? (nuevoEvento.horaFin || "") : "",
            tipo: categoriaRepeticion,
            creador: obtenerInicialCreador()
          };

          // Sincronizar con Google Calendar
          try {
            const resGcal = await sincronizarEventoGoogleCalendar({
              fechaClave,
              evento: eventoAGuardar
            });
            if (resGcal?.googleCalendarEventId) {
              eventoAGuardar.googleCalendarEventId = resGcal.googleCalendarEventId;
            }
          } catch (errGcal) {
            console.warn("No se pudo sincronizar recurrente con Google Calendar:", errGcal);
          }

          nuevosEventos[fechaClave] = [...notasDelDia, eventoAGuardar];
          eventosCreados++;
        }
        actual.setDate(actual.getDate() + 1);
        if (eventosCreados > 600) break;
      }

      if (eventosCreados === 0) {
        alert("No coincide ningún día de la semana seleccionado dentro del rango de fechas.");
        return;
      }

      setEventos(nuevosEventos);
      setMostrarModal(false);
      setNuevoEvento({ titulo: "", hora: "", horaFin: "", tipo: "normal" });

      try {
        await setDoc(doc(db, "agenda", "datos"), nuevosEventos);
        registrarActividad({
          seccion: 'agenda',
          descripcion: `Nuevo evento recurrente: "${nuevoEvento.titulo.trim()}" (${eventosCreados} días)`,
          usuarioEmail: usuario?.email || auth?.currentUser?.email || '',
        });
      } catch (error) {
        console.error("Error al guardar eventos recurrentes:", error);
        alert("Error al guardar en la nube");
      }
      return;
    }

    // MODO NORMAL O TRABAJO
    const fechaClave = fechaModal.toDateString();
    const notasDelDia = eventos[fechaClave] || [];
    
    const eventoAGuardar: Evento = {
      titulo: nuevoEvento.titulo.trim(),
      hora: nuevoEvento.hora || "--:--",
      horaFin: nuevoEvento.tipo === 'trabajo' ? (nuevoEvento.horaFin || "") : "",
      tipo: nuevoEvento.tipo || "normal",
      creador: obtenerInicialCreador()
    };

    // Sincronizar automáticamente con Google Calendar
    try {
      const resGcal = await sincronizarEventoGoogleCalendar({
        fechaClave,
        evento: eventoAGuardar,
        solicitarPermisoSiFalta: false
      });
      if (resGcal?.googleCalendarEventId) {
        eventoAGuardar.googleCalendarEventId = resGcal.googleCalendarEventId;
      } else if (resGcal?.error) {
        alert(`⚠️ Google Calendar:\n${resGcal.error}\n\nEl evento se ha guardado localmente en la app.`);
      }
    } catch (errGcal) {
      console.warn("No se pudo sincronizar evento con Google Calendar:", errGcal);
      alert("⚠️ Error al sincronizar con Google Calendar. El evento se ha guardado localmente en la app.");
    }

    const nuevosEventos = {
      ...eventos,
      [fechaClave]: [...notasDelDia, eventoAGuardar]
    };

    setEventos(nuevosEventos);
    setMostrarModal(false);
    setNuevoEvento({ titulo: "", hora: "", horaFin: "", tipo: "normal" });

    try {
      await setDoc(doc(db, "agenda", "datos"), nuevosEventos);
      const fechaFormato = fechaModal.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      registrarActividad({
        seccion: 'agenda',
        descripcion: `Nuevo evento: "${nuevoEvento.titulo.trim()}" (${nuevoEvento.hora || 'Todo el día'}) para el ${fechaFormato}`,
        usuarioEmail: usuario?.email || auth?.currentUser?.email || '',
      });
      cargarEventosGoogle(lunesSemana);
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar en la nube");
    }
  };

  const abrirModalEdicion = (fechaClave: string, nota: Evento | string, index: number) => {
    const esAntigua = typeof nota === 'string';
    const esGoogle = !esAntigua && Boolean((nota as any).esGoogleCalendar || (nota as any).tipo === 'google');
    setEventoAEditar({
      index,
      fechaClave,
      titulo: esAntigua ? nota : (nota.titulo || ''),
      hora: esAntigua ? '' : (nota.hora || ''),
      horaFin: (!esAntigua && nota.horaFin) ? nota.horaFin : '',
      tipo: (!esAntigua && nota.tipo) ? nota.tipo : (esGoogle ? 'google' : 'normal'),
      creador: (!esAntigua && (nota as Evento).creador) ? (nota as Evento).creador! : 'J',
      googleCalendarEventId: (!esAntigua && (nota as any).googleCalendarEventId) ? (nota as any).googleCalendarEventId : ''
    });
    setMostrarModalEdicion(true);
  };

  const guardarEdicion = async () => {
    if (!eventoAEditar.titulo.trim()) {
      alert("Por favor, introduce un título para el evento.");
      return;
    }

    const fechaClave = eventoAEditar.fechaClave;
    const listaActual = eventosCombinados[fechaClave] || [];
    const notaActual = listaActual[eventoAEditar.index];

    // Si es un evento exclusivo de Google Calendar
    if (typeof notaActual === 'object' && (notaActual as any)?.esGoogleCalendar) {
      const gcalId = (notaActual as any).googleCalendarEventId || eventoAEditar.googleCalendarEventId;
      if (gcalId) {
        try {
          const res = await sincronizarEventoGoogleCalendar({
            fechaClave,
            evento: {
              titulo: eventoAEditar.titulo.trim(),
              hora: eventoAEditar.hora || "--:--",
              horaFin: eventoAEditar.horaFin || '',
              googleCalendarEventId: gcalId
            },
            esEdicion: true
          });
          if (res?.error) {
            alert(`⚠️ Error al actualizar en Google Calendar:\n${res.error}`);
          }
        } catch (e) {
          console.error("Error al actualizar evento de Google:", e);
        }
      }
      setMostrarModalEdicion(false);
      cargarEventosGoogle(lunesSemana);
      return;
    }

    const notasDelDia = [...(eventos[fechaClave] || [])];
    const indexLocal = notasDelDia.findIndex((n) => {
      if (typeof n === 'string') return n === (typeof notaActual === 'string' ? notaActual : '');
      return n?.titulo === (typeof notaActual === 'object' ? notaActual?.titulo : '');
    });

    const eventoActualizado: Evento = {
      titulo: eventoAEditar.titulo.trim(),
      hora: eventoAEditar.hora || "--:--",
      horaFin: eventoAEditar.tipo === 'trabajo' ? (eventoAEditar.horaFin || '') : '',
      tipo: eventoAEditar.tipo,
      creador: eventoAEditar.creador || obtenerInicialCreador(),
      googleCalendarEventId: eventoAEditar.googleCalendarEventId || (typeof notaActual === 'object' ? (notaActual as Evento)?.googleCalendarEventId : undefined)
    };

    // Actualizar en Google Calendar si está sincronizado
    try {
      const resGcal = await sincronizarEventoGoogleCalendar({
        fechaClave,
        evento: eventoActualizado,
        esEdicion: true
      });
      if (resGcal?.googleCalendarEventId) {
        eventoActualizado.googleCalendarEventId = resGcal.googleCalendarEventId;
      } else if (resGcal?.error) {
        alert(`⚠️ Aviso de Google Calendar:\n${resGcal.error}\n\nEl evento se ha actualizado localmente en la app.`);
      }
    } catch (errGcal) {
      console.warn("No se pudo actualizar evento en Google Calendar:", errGcal);
    }

    if (indexLocal >= 0) {
      notasDelDia[indexLocal] = eventoActualizado;
    } else {
      notasDelDia.push(eventoActualizado);
    }

    const nuevosEventos = {
      ...eventos,
      [fechaClave]: notasDelDia
    };

    setEventos(nuevosEventos);
    setMostrarModalEdicion(false);

    try {
      await setDoc(doc(db, "agenda", "datos"), nuevosEventos);
      registrarActividad({
        seccion: 'agenda',
        descripcion: `Evento editado: "${eventoAEditar.titulo.trim()}" (${eventoAEditar.hora || 'Todo el día'})`,
        usuarioEmail: usuario?.email || auth?.currentUser?.email || '',
      });
      cargarEventosGoogle(lunesSemana);
    } catch (error) {
      console.error("Error al actualizar evento:", error);
      alert("Error al actualizar el evento en la nube");
    }
  };

  const eliminarEventoDesdeModal = async () => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este evento?")) {
      return;
    }
    const fechaClave = eventoAEditar.fechaClave;
    const listaActual = eventosCombinados[fechaClave] || [];
    const notaAEliminar = listaActual[eventoAEditar.index];

    if (notaAEliminar && typeof notaAEliminar === 'object' && (notaAEliminar as any).esGoogleCalendar) {
      if ((notaAEliminar as any).googleCalendarEventId) {
        await eliminarEventoGoogleCalendar((notaAEliminar as any).googleCalendarEventId);
      }
      setMostrarModalEdicion(false);
      cargarEventosGoogle(lunesSemana);
      return;
    }

    if (notaAEliminar && typeof notaAEliminar === 'object' && (notaAEliminar as Evento).googleCalendarEventId) {
      eliminarEventoGoogleCalendar((notaAEliminar as Evento).googleCalendarEventId).catch(console.error);
    }

    const nuevasNotas = (eventos[fechaClave] || []).filter((n) => {
      if (typeof n === 'string') return n !== (typeof notaAEliminar === 'string' ? notaAEliminar : '');
      return (n as Evento)?.titulo !== eventoAEditar.titulo;
    });
    const nuevosEventos = { ...eventos, [fechaClave]: nuevasNotas };

    setEventos(nuevosEventos);
    setMostrarModalEdicion(false);

    try {
      await setDoc(doc(db, "agenda", "datos"), nuevosEventos);
      cargarEventosGoogle(lunesSemana);
    } catch (error) {
      console.error("Error al eliminar evento:", error);
      alert("Error al eliminar el evento en la nube");
    }
  };

  const borrarNota = async (fechaClave: string, index: number) => {
    const listaActual = eventosCombinados[fechaClave] || [];
    const notaAEliminar = listaActual[index];
    if (!notaAEliminar) return;

    // Si es un evento exclusivo de Google Calendar
    if (typeof notaAEliminar === 'object' && (notaAEliminar as any).esGoogleCalendar) {
      if (!window.confirm("¿Deseas eliminar este evento de tu Google Calendar?")) return;
      if ((notaAEliminar as any).googleCalendarEventId) {
        await eliminarEventoGoogleCalendar((notaAEliminar as any).googleCalendarEventId);
      }
      cargarEventosGoogle(lunesSemana);
      return;
    }

    if (!window.confirm("¿Estás seguro de que deseas eliminar este evento?")) {
      return;
    }

    if (typeof notaAEliminar === 'object' && (notaAEliminar as Evento).googleCalendarEventId) {
      eliminarEventoGoogleCalendar((notaAEliminar as Evento).googleCalendarEventId).catch(console.error);
    }

    const notasFirestore = (eventos[fechaClave] || []).filter((n) => {
      if (typeof n === 'string') return n !== notaAEliminar;
      return (n as Evento)?.titulo !== (notaAEliminar as Evento)?.titulo;
    });
    const nuevosEventos = { ...eventos, [fechaClave]: notasFirestore };

    setEventos(nuevosEventos);
    await setDoc(doc(db, "agenda", "datos"), nuevosEventos);
    cargarEventosGoogle(lunesSemana);
  };

  const domingoSemana = diasDeLaSemana[6];
  const rangoTexto = `${lunesSemana.getDate()} ${MESES[lunesSemana.getMonth()]} - ${domingoSemana.getDate()} ${MESES[domingoSemana.getMonth()]} ${domingoSemana.getFullYear()}`;

  const hoy = new Date();
  const hoyStr = hoy.toDateString();

  return (
    <div style={{
      width: '100%',
      maxWidth: '450px',
      marginTop: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      color: '#111827'
    }}>
      {/* BARRA DE NAVEGACIÓN SEMANAL ESTILO SOFASCORE */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '12px 16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%'
      }}>
        <button
          onClick={() => cambiarSemana(-7)}
          aria-label="Semana anterior"
          style={{
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontWeight: 700,
            color: '#111827',
            transition: 'all 0.15s ease'
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e5e7eb')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
        >
          ◀
        </button>

        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#0047b3', letterSpacing: '0.5px' }}>
            Vista Semanal
          </span>
          <span style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>
            {rangoTexto}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={irAHoy}
            title="Ir a la semana actual"
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: '#eff6ff',
              color: '#0047b3',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#dbeafe')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
          >
            Hoy
          </button>

          <button
            onClick={() => cambiarSemana(7)}
            aria-label="Semana siguiente"
            style={{
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 700,
              color: '#111827',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e5e7eb')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
          >
            ▶
          </button>
        </div>
      </div>

      {/* ESTADO GOOGLE CALENDAR & ALARMAS */}
      <div style={{
        width: "100%",
        marginBottom: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        borderRadius: "10px",
        backgroundColor: gcalConectado ? "#f0fdf4" : "#f8fafc",
        border: `1px solid ${gcalConectado ? '#bbf7d0' : '#e2e8f0'}`,
        fontSize: "12px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>{gcalConectado ? "🟢" : "🔔"}</span>
          <span style={{ fontWeight: 700, color: gcalConectado ? "#166534" : "#475569" }}>
            {gcalConectado
              ? `Google Calendar conectado (Alarmas: 30 min y 1 día antes)${cargandoGoogle ? ' • Sincronizando...' : ''}`
              : "Google Calendar no sincronizado"}
          </span>
        </div>
        {!gcalConectado ? (
          <button
            onClick={manejarConectarGoogle}
            style={{
              background: "linear-gradient(135deg, #0047b3 0%, #003380 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0, 71, 179, 0.2)"
            }}
          >
            Conectar
          </button>
        ) : (
          <button
            onClick={() => cargarEventosGoogle(lunesSemana)}
            title="Sincronizar eventos de Google Calendar"
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              color: '#334155'
            }}
          >
            {cargandoGoogle ? '⏳' : '🔄 Actualizar'}
          </button>
        )}
      </div>

      {/* LISTA DE LOS 7 DÍAS DE LA SEMANA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        {diasDeLaSemana.map((dia, idx) => {
          const claveDia = dia.toDateString();
          const esHoy = claveDia === hoyStr;
          const esFinDeSemana = dia.getDay() === 0 || dia.getDay() === 6;
          const notasDelDia = eventosCombinados[claveDia] || [];

          return (
            <div
              key={claveDia}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: esHoy ? '2px solid #0047b3' : '1px solid #e5e7eb',
                boxShadow: esHoy ? '0 4px 12px rgba(0, 71, 179, 0.1)' : '0 2px 4px rgba(0,0,0,0.03)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {/* CABECERA DEL DÍA */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontWeight: 800,
                    fontSize: '14px',
                    color: esHoy ? '#0047b3' : (esFinDeSemana ? '#b91c1c' : '#111827')
                  }}>
                    {DIAS_SEMANA[idx]}
                  </span>
                  <span style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    fontWeight: 600
                  }}>
                    {dia.getDate()} {MESES[dia.getMonth()]}
                  </span>

                  {esHoy && (
                    <span style={{
                      backgroundColor: '#0047b3',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px'
                    }}>
                      Hoy
                    </span>
                  )}
                </div>

                <button
                  onClick={() => abrirModalParaDia(dia)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: '#f3f4f6',
                    color: '#1f2937',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#0047b3';
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.borderColor = '#0047b3';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.color = '#1f2937';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  + Añadir
                </button>
              </div>

              {/* LISTA DE EVENTOS DEL DÍA */}
              {notasDelDia.length === 0 ? (
                <div style={{
                  padding: '6px 4px',
                  color: '#9ca3af',
                  fontSize: '12px',
                  fontStyle: 'italic'
                }}>
                  Sin eventos programados
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {notasDelDia.map((nota, i) => {
                    const esAntigua = typeof nota === 'string';
                    const titulo = esAntigua ? nota : nota.titulo;
                    const horaInicio = esAntigua ? "--:--" : (nota.hora || "--:--");
                    const esDeporte = esEventoDeporte(nota);
                    const esTrabajo = !esAntigua && !esDeporte && nota.tipo === 'trabajo';
                    const esGoogle = !esAntigua && Boolean((nota as any).esGoogleCalendar || (nota as any).tipo === 'google');
                    const horaFin = !esAntigua ? nota.horaFin : "";
                    // Para eventos de deporte o google: sin inicial J/A
                    const creadorNota = (esDeporte || esGoogle) ? '' : (!esAntigua && (nota as Evento).creador ? (nota as Evento).creador!.toUpperCase() : (esTrabajo ? 'J' : ''));

                    let textoHora = horaInicio;
                    if ((esTrabajo || esGoogle) && horaFin) {
                      textoHora = `${horaInicio} - ${horaFin}`;
                    }

                    let borderColor = '#9ca3af';
                    let bgColor = '#f9fafb';
                    if (esGoogle) {
                      borderColor = '#2563eb';
                      bgColor = '#eff6ff';
                    } else if (esDeporte) {
                      borderColor = '#FACC15';
                      bgColor = '#fefce8';
                    } else if (esTrabajo) {
                      borderColor = '#0070f3';
                      bgColor = '#eff6ff';
                    }

                    return (
                      <div
                        key={i}
                        onClick={() => abrirModalEdicion(claveDia, nota, i)}
                        title="Haz clic para editar este evento"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          backgroundColor: bgColor,
                          border: '1px solid #e5e7eb',
                          borderLeft: `4px solid ${borderColor}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = esDeporte ? '#fef9c3' : (esTrabajo ? '#e0f2fe' : (esGoogle ? '#dbeafe' : '#f3f4f6'));
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = bgColor;
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                            {esGoogle ? (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                letterSpacing: '0.4px'
                              }}>
                                📅 Google
                              </span>
                            ) : esDeporte ? (
                              <span
                                title="Evento deportivo"
                                style={{
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  backgroundColor: '#FACC15',
                                  border: '1.5px solid #000000',
                                  display: 'inline-block',
                                  flexShrink: 0
                                }}
                              />
                            ) : (
                              creadorNota && (
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  backgroundColor: esTrabajo ? '#111827' : '#EF4444',
                                  color: '#ffffff',
                                  letterSpacing: '0.4px'
                                }}>
                                  {creadorNota}
                                </span>
                              )
                            )}
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: esGoogle ? '#1d4ed8' : (esDeporte ? '#a16207' : (esTrabajo ? '#0070f3' : '#4b5563'))
                            }}>
                              {esGoogle ? `📅 ${textoHora}` : (esDeporte ? `🏆 ${textoHora}` : (esTrabajo ? `💼 ${textoHora}` : `🕒 ${textoHora}`))}
                            </span>
                          </div>
                          <span style={{
                            fontSize: '13px',
                            fontWeight: (esTrabajo || esDeporte) ? 700 : 600,
                            color: '#111827'
                          }}>
                            {titulo}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            borrarNota(claveDia, i);
                          }}
                          title={esGoogle ? "Eliminar de Google Calendar" : "Eliminar evento"}
                          aria-label="Borrar nota"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: '14px',
                            padding: '4px',
                            lineHeight: 1
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL PARA CREAR EVENTO EN DÍA SELECCIONADO (NORMAL, TRABAJO O REPETIR) */}
      {mostrarModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{ 
            backgroundColor: "#ffffff", 
            color: "#111827",
            padding: "24px", 
            borderRadius: "14px", 
            width: "100%", 
            maxWidth: "380px", 
            boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
            border: "1px solid #e5e7eb",
            maxHeight: "90vh",
            overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <h3 style={{ margin: 0, color: "#111827", fontSize: "18px", fontWeight: "800" }}>
                Nuevo Evento
              </h3>
              <button 
                onClick={() => setMostrarModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#9ca3af" }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: "0 0 12px 0", color: "#0047b3", fontSize: "13px", fontWeight: "600" }}>
              📅 {fechaModal.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>

            {/* AVISO DE ALARMAS AUTOMÁTICAS EN GOOGLE CALENDAR */}
            <div style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              padding: '8px 10px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              color: '#1e40af'
            }}>
              <span style={{ fontSize: '15px' }}>🔔</span>
              <div>
                <span style={{ fontWeight: 800 }}>Alarmas en el móvil (Google Calendar):</span>{' '}
                <span>Avisos nativos automáticos 30 min y 1 día antes.</span>
              </div>
            </div>
            
            {/* SELECTOR DE TIPO: NORMAL, TRABAJO O REPETIR */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              <button 
                type="button"
                onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'normal', titulo: ''})}
                style={{ 
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: '8px',
                  border: nuevoEvento.tipo === 'normal' ? '2px solid #ef4444' : '1px solid #d1d5db',
                  cursor: 'pointer',
                  backgroundColor: nuevoEvento.tipo === 'normal' ? '#fef2f2' : '#ffffff',
                  color: nuevoEvento.tipo === 'normal' ? '#ef4444' : '#374151',
                  fontWeight: nuevoEvento.tipo === 'normal' ? '800' : '600',
                  fontSize: '12px'
                }}
              >
                🎈 Normal
              </button>
              <button 
                type="button"
                onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'trabajo', titulo: 'Turno de Trabajo'})}
                style={{ 
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: '8px',
                  border: nuevoEvento.tipo === 'trabajo' ? '2px solid #111827' : '1px solid #d1d5db',
                  cursor: 'pointer',
                  backgroundColor: nuevoEvento.tipo === 'trabajo' ? '#f3f4f6' : '#ffffff',
                  color: '#111827', 
                  fontWeight: nuevoEvento.tipo === 'trabajo' ? '800' : '600',
                  fontSize: '12px'
                }}
              >
                💼 Trabajo
              </button>
              <button 
                type="button"
                onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'repetir', titulo: ''})}
                style={{ 
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: '8px',
                  border: nuevoEvento.tipo === 'repetir' ? '2px solid #0047b3' : '1px solid #d1d5db',
                  cursor: 'pointer',
                  backgroundColor: nuevoEvento.tipo === 'repetir' ? '#eff6ff' : '#ffffff',
                  color: '#0047b3', 
                  fontWeight: nuevoEvento.tipo === 'repetir' ? '800' : '600',
                  fontSize: '12px'
                }}
              >
                🔁 Repetir
              </button>
            </div>

            {/* SECCIÓN ESPECÍFICA CUANDO SE ELIGE 'REPETIR' */}
            {nuevoEvento.tipo === 'repetir' && (
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                {/* Categoría base del evento recurrente */}
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: "700", color: "#374151", fontSize: "12px" }}>
                    Categoría:
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setCategoriaRepeticion('normal')}
                      style={{
                        flex: 1, padding: '6px', borderRadius: '6px', cursor: 'pointer',
                        border: categoriaRepeticion === 'normal' ? '2px solid #ef4444' : '1px solid #d1d5db',
                        backgroundColor: categoriaRepeticion === 'normal' ? '#fef2f2' : '#ffffff',
                        color: categoriaRepeticion === 'normal' ? '#ef4444' : '#374151',
                        fontWeight: '700', fontSize: '11px'
                      }}
                    >
                      🎈 Normal / Extraescolar
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoriaRepeticion('trabajo')}
                      style={{
                        flex: 1, padding: '6px', borderRadius: '6px', cursor: 'pointer',
                        border: categoriaRepeticion === 'trabajo' ? '2px solid #111827' : '1px solid #d1d5db',
                        backgroundColor: categoriaRepeticion === 'trabajo' ? '#f3f4f6' : '#ffffff',
                        color: '#111827',
                        fontWeight: '700', fontSize: '11px'
                      }}
                    >
                      💼 Trabajo
                    </button>
                  </div>
                </div>

                {/* Días de la semana */}
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "700", color: "#374151", fontSize: "12px" }}>
                    Días que se repite:
                  </label>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "3px" }}>
                    {DIAS_SEMANA_OPCIONES.map((d) => {
                      const sel = diasRepeticion.includes(d.num);
                      return (
                        <button
                          key={d.num}
                          type="button"
                          title={d.nombre}
                          onClick={() => toggleDiaRepeticion(d.num)}
                          style={{
                            flex: 1,
                            height: "34px",
                            borderRadius: "6px",
                            border: sel ? "none" : "1px solid #cbd5e1",
                            backgroundColor: sel ? "#0047b3" : "#ffffff",
                            color: sel ? "#ffffff" : "#475569",
                            fontWeight: 800,
                            fontSize: "12px",
                            cursor: "pointer"
                          }}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Rango de fechas */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "4px", fontWeight: "700", fontSize: "11px", color: "#475569" }}>
                      Inicio 📅
                    </label>
                    <input
                      type="date"
                      value={fechaInicioRep}
                      onChange={(e) => setFechaInicioRep(e.target.value)}
                      style={{
                        width: "100%", padding: "7px 8px", borderRadius: "6px",
                        border: "1px solid #cbd5e1", backgroundColor: "#ffffff", color: "#111827", fontSize: "12px", outline: "none"
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "4px", fontWeight: "700", fontSize: "11px", color: "#475569" }}>
                      Fin 🏁
                    </label>
                    <input
                      type="date"
                      value={fechaFinRep}
                      onChange={(e) => setFechaFinRep(e.target.value)}
                      style={{
                        width: "100%", padding: "7px 8px", borderRadius: "6px",
                        border: "1px solid #cbd5e1", backgroundColor: "#ffffff", color: "#111827", fontSize: "12px", outline: "none"
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", color: "#374151", fontSize: "13px" }}>
              Título:
            </label>
            <input 
              type="text"
              placeholder={nuevoEvento.tipo === 'repetir' ? "Ej: Natación, Fútbol, Inglés..." : "Ej: Cena familiar, Consulta médica..."}
              value={nuevoEvento.titulo}
              onChange={(e) => setNuevoEvento({...nuevoEvento, titulo: e.target.value})}
              style={{ 
                width: "100%",
                padding: "10px",
                marginBottom: "14px",
                borderRadius: "8px", 
                border: "1px solid #d1d5db",
                backgroundColor: "#ffffff",
                color: "#111827",
                fontSize: "14px",
                outline: "none" 
              }}
            />
            
            {/* INPUTS DE HORA SEGÚN TIPO */}
            {(nuevoEvento.tipo === 'normal' || (nuevoEvento.tipo === 'repetir' && categoriaRepeticion === 'normal')) ? (
              <>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", color: "#374151", fontSize: "13px" }}>
                  Hora:
                </label>
                <input 
                  type="time"
                  value={nuevoEvento.hora}
                  onChange={(e) => setNuevoEvento({...nuevoEvento, hora: e.target.value})}
                  style={{ 
                    width: "100%",
                    padding: "10px",
                    marginBottom: "18px",
                    borderRadius: "8px", 
                    border: "1px solid #d1d5db",
                    backgroundColor: "#ffffff",
                    color: "#111827",
                    fontSize: "14px",
                    outline: "none" 
                  }}
                />
              </>
            ) : (
              <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", fontSize: "12px", color: "#374151" }}>
                    Entrada ☀️
                  </label>
                  <input 
                    type="time"
                    value={nuevoEvento.hora}
                    onChange={(e) => setNuevoEvento({...nuevoEvento, hora: e.target.value})}
                    style={{ 
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px", 
                      border: "1px solid #d1d5db",
                      backgroundColor: "#ffffff",
                      color: "#111827",
                      fontSize: "13px",
                      outline: "none" 
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", fontSize: "12px", color: "#374151" }}>
                    Salida 🌙
                  </label>
                  <input 
                    type="time"
                    value={nuevoEvento.horaFin}
                    onChange={(e) => setNuevoEvento({...nuevoEvento, horaFin: e.target.value})}
                    style={{ 
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px", 
                      border: "1px solid #d1d5db",
                      backgroundColor: "#ffffff",
                      color: "#111827",
                      fontSize: "13px",
                      outline: "none" 
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: '8px' }}>
              <button 
                type="button"
                onClick={() => setMostrarModal(false)} 
                style={{
                  padding: "9px 16px",
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px"
                }}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={guardarNota} 
                style={{
                  padding: "9px 18px",
                  backgroundColor: nuevoEvento.tipo === 'repetir' ? "#0047b3" : "#111827",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "700",
                  fontSize: "13px",
                  boxShadow: "0 2px 4px rgba(0, 71, 179, 0.3)"
                }}
              >
                {nuevoEvento.tipo === 'repetir' ? "Generar Repetición" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA EDITAR Y ELIMINAR EVENTO EXISTENTE */}
      {mostrarModalEdicion && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div 
            style={{ 
              backgroundColor: "#ffffff", 
              color: "#111827",
              padding: "24px", 
              borderRadius: "14px", 
              width: "100%", 
              maxWidth: "380px", 
              boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
              border: "1px solid #e5e7eb",
              maxHeight: "90vh",
              overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, color: "#111827", fontSize: "18px", fontWeight: "800" }}>
                ✏️ Editar Evento
              </h3>
              <button 
                onClick={() => setMostrarModalEdicion(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#9ca3af" }}
              >
                ✕
              </button>
            </div>

            {/* AVISO DE ALARMAS AUTOMÁTICAS EN GOOGLE CALENDAR */}
            <div style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              padding: '8px 10px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              color: '#1e40af'
            }}>
              <span style={{ fontSize: '15px' }}>🔔</span>
              <div>
                <span style={{ fontWeight: 800 }}>Alarmas en el móvil:</span>{' '}
                <span>Se actualiza en Google Calendar (avisos 30 min y 1 día antes).</span>
              </div>
            </div>

            <p style={{ margin: "0 0 14px 0", color: "#0047b3", fontSize: "13px", fontWeight: "600" }}>
              📅 {eventoAEditar.fechaClave}
            </p>

            {/* SELECTOR DE CATEGORÍA */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <button 
                type="button"
                onClick={() => setEventoAEditar({...eventoAEditar, tipo: 'normal'})}
                style={{ 
                  flex: 1, padding: '8px', borderRadius: '8px',
                  border: eventoAEditar.tipo === 'normal' ? '2px solid #ef4444' : '1px solid #d1d5db',
                  cursor: 'pointer',
                  backgroundColor: eventoAEditar.tipo === 'normal' ? '#fef2f2' : '#ffffff',
                  color: eventoAEditar.tipo === 'normal' ? '#ef4444' : '#111827',
                  fontWeight: eventoAEditar.tipo === 'normal' ? '800' : '600',
                  fontSize: '13px'
                }}
              >
                🎈 Normal
              </button>
              <button 
                type="button"
                onClick={() => setEventoAEditar({...eventoAEditar, tipo: 'trabajo'})}
                style={{ 
                  flex: 1, padding: '8px', borderRadius: '8px',
                  border: eventoAEditar.tipo === 'trabajo' ? '2px solid #111827' : '1px solid #d1d5db',
                  cursor: 'pointer',
                  backgroundColor: eventoAEditar.tipo === 'trabajo' ? '#f3f4f6' : '#ffffff',
                  color: '#111827', 
                  fontWeight: eventoAEditar.tipo === 'trabajo' ? '800' : '600',
                  fontSize: '13px'
                }}
              >
                💼 Trabajo
              </button>
            </div>

            <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", color: "#374151", fontSize: "13px" }}>
              Título:
            </label>
            <input 
              type="text" 
              value={eventoAEditar.titulo}
              onChange={(e) => setEventoAEditar({...eventoAEditar, titulo: e.target.value})}
              style={{ 
                width: "100%", padding: "10px", marginBottom: "14px", borderRadius: "8px", 
                border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "14px", outline: "none" 
              }}
            />
            
            {eventoAEditar.tipo === 'normal' ? (
              <>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", color: "#374151", fontSize: "13px" }}>
                  Hora:
                </label>
                <input 
                  type="time" 
                  value={eventoAEditar.hora}
                  onChange={(e) => setEventoAEditar({...eventoAEditar, hora: e.target.value})}
                  style={{ 
                    width: "100%", padding: "10px", marginBottom: "18px", borderRadius: "8px", 
                    border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "14px", outline: "none" 
                  }}
                />
              </>
            ) : (
              <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", fontSize: "12px", color: "#374151" }}>Entrada ☀️</label>
                  <input 
                    type="time" 
                    value={eventoAEditar.hora}
                    onChange={(e) => setEventoAEditar({...eventoAEditar, hora: e.target.value})}
                    style={{ 
                      width: "100%", padding: "10px", borderRadius: "8px", 
                      border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "13px", outline: "none" 
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", fontSize: "12px", color: "#374151" }}>Salida 🌙</label>
                  <input 
                    type="time" 
                    value={eventoAEditar.horaFin}
                    onChange={(e) => setEventoAEditar({...eventoAEditar, horaFin: e.target.value})}
                    style={{ 
                      width: "100%", padding: "10px", borderRadius: "8px", 
                      border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "13px", outline: "none" 
                    }}
                  />
                </div>
              </div>
            )}

            {/* BOTONES DE EDICIÓN / ELIMINACIÓN */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
              <button 
                type="button"
                onClick={eliminarEventoDesdeModal} 
                style={{ 
                  padding: "8px 14px", backgroundColor: "#fef2f2", color: "#dc2626", 
                  border: "1px solid #fecaca", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "13px" 
                }}
              >
                🗑️ Eliminar
              </button>

              <div style={{ display: "flex", gap: "8px" }}>
                <button 
                  type="button"
                  onClick={() => setMostrarModalEdicion(false)} 
                  style={{ padding: "8px 14px", backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={guardarEdicion} 
                  style={{ padding: "8px 16px", backgroundColor: "#0047b3", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "13px" }}
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
