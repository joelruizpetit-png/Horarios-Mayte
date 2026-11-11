"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
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
  combinarEventosLocalesYGoogle
} from '../utils/googleCalendar';

/**
 * @param {{ usuario?: any, fechaSeleccionada?: Date, onFechaChange?: (fecha: Date) => void }} [props]
 */
export default function Calendario({ usuario, fechaSeleccionada, onFechaChange } = {}) {
  const [fechaInterna, setFechaInterna] = useState(new Date());
  const date = fechaSeleccionada || fechaInterna;

  const manejarCambioFecha = (nuevaFecha) => {
    setFechaInterna(nuevaFecha);
    if (onFechaChange) {
      onFechaChange(nuevaFecha);
    }
  };
  const [eventos, setEventos] = useState({});
  const [mostrarModal, setMostrarModal] = useState(false);
  
  // AÑADIDO: 'horaFin' para saber cuándo sales de trabajar
  const [nuevoEvento, setNuevoEvento] = useState({ 
    titulo: "", 
    hora: "", 
    horaFin: "", 
    tipo: "normal" 
  });

  // Estado para creación con repetición (recurrentes / extraescolares)
  const [diasRepeticion, setDiasRepeticion] = useState([1]);
  const [fechaInicioRep, setFechaInicioRep] = useState('');
  const [fechaFinRep, setFechaFinRep] = useState('');
  const [categoriaRepeticion, setCategoriaRepeticion] = useState('normal');

  // Estado para modal de edición
  const [mostrarModalEdicion, setMostrarModalEdicion] = useState(false);
  const [eventoAEditar, setEventoAEditar] = useState({
    index: -1,
    fechaClave: '',
    titulo: '',
    hora: '',
    horaFin: '',
    tipo: 'normal',
    creador: 'J',
    googleCalendarEventId: ''
  });

  // Estado de sincronización con Google Calendar
  const [gcalConectado, setGcalConectado] = useState(false);
  const [eventosGoogle, setEventosGoogle] = useState({});
  const [cargandoGoogle, setCargandoGoogle] = useState(false);

  useEffect(() => {
    setGcalConectado(estaGoogleCalendarConectado());

    const handleAuthChange = () => {
      setGcalConectado(estaGoogleCalendarConectado());
    };
    const handleVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        setGcalConectado(estaGoogleCalendarConectado());
      }
    };

    window.addEventListener('google-calendar-auth-changed', handleAuthChange);
    window.addEventListener('focus', handleAuthChange);
    document.addEventListener('visibilitychange', handleVisibilidad);

    return () => {
      window.removeEventListener('google-calendar-auth-changed', handleAuthChange);
      window.removeEventListener('focus', handleAuthChange);
      document.removeEventListener('visibilitychange', handleVisibilidad);
    };
  }, []);

  // 2. LECTURA Y SINCRONIZACIÓN (Google Calendar -> App):
  // Llamada GET a la API de Google Calendar para obtener los eventos del usuario del mes activo
  const cargarEventosGoogle = useCallback(async (fechaReferencia = date) => {
    if (!estaGoogleCalendarConectado()) {
      setEventosGoogle({});
      return;
    }

    try {
      setCargandoGoogle(true);
      const y = fechaReferencia.getFullYear();
      const m = fechaReferencia.getMonth();
      const fechaInicio = new Date(y, m - 1, 1, 0, 0, 0);
      const fechaFin = new Date(y, m + 2, 0, 23, 59, 59);

      const res = await obtenerEventosGoogleCalendar({ fechaInicio, fechaFin });
      if (res.exito) {
        setEventosGoogle(res.eventos);
      } else if (res.necesitaReconexion) {
        setGcalConectado(false);
      }
    } catch (err) {
      console.warn("Error al cargar eventos de Google Calendar:", err);
    } finally {
      setCargandoGoogle(false);
    }
  }, [date]);

  // Cargar eventos de Google Calendar al montar o al cambiar de mes o estado de conexión
  useEffect(() => {
    cargarEventosGoogle(date);
  }, [date.getFullYear(), date.getMonth(), gcalConectado, cargarEventosGoogle]);

  // Combinación y sincronización de eventos locales de Firestore con eventos de Google Calendar
  const eventosCombinados = useMemo(() => {
    return combinarEventosLocalesYGoogle(eventos, eventosGoogle);
  }, [eventos, eventosGoogle]);

  const manejarConectarGoogle = async () => {
    const token = await conectarGoogleCalendar();
    if (token) {
      setGcalConectado(true);
      await cargarEventosGoogle(date);
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

  const toISODate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const abrirModalCrear = async () => {
    // Al pulsar "+ Añadir", recuperar y asegurar el accessToken de Google Auth del usuario actual
    const token = await asegurarTokenGoogleCalendar();
    if (token) {
      setGcalConectado(true);
    }

    const hoyStr = toISODate(date);
    setFechaInicioRep(hoyStr);

    const fin = new Date(date);
    if (fin.getMonth() >= 8) { // Septiembre en adelante
      fin.setFullYear(fin.getFullYear() + 1);
      fin.setMonth(5); // Junio
      fin.setDate(30);
    } else {
      fin.setMonth(5); // Junio
      fin.setDate(30);
    }
    setFechaFinRep(toISODate(fin));
    setDiasRepeticion([date.getDay()]);
    setCategoriaRepeticion('normal');
    setNuevoEvento({ titulo: "", hora: "", horaFin: "", tipo: "normal" });
    setMostrarModal(true);
  };

  const toggleDiaRepeticion = (num) => {
    if (diasRepeticion.includes(num)) {
      setDiasRepeticion(diasRepeticion.filter(d => d !== num));
    } else {
      setDiasRepeticion([...diasRepeticion, num]);
    }
  };

  // Obtener la inicial del creador según la sesión activa ("J" para Joel, "A" para Ana)
  const obtenerInicialCreador = () => {
    const email = usuario?.email || auth?.currentUser?.email || '';
    const nombre = formatearNombreFamiliar(usuario?.displayName, email);
    return nombre === 'Ana' ? 'A' : 'J';
  };

  // Identificar si un evento proviene de la Pestaña Deportes
  const esEventoDeporte = (e) => {
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

  // Comprobar si un evento es exclusivamente un turno de trabajo de Joel para mostrar el logo de Condis
  const esTurnoTrabajoCondisJoel = (e) => {
    if (!e) return false;
    const esStr = typeof e === 'string';
    const titulo = (esStr ? e : (e.titulo || '')).trim();
    const tipo = !esStr ? (e.tipo || '') : '';
    const categoria = !esStr ? (e.categoria || '') : '';
    const creador = !esStr ? ((e.creador || '').toUpperCase().trim()) : '';
    const esDeporte = esEventoDeporte(e);

    if (esDeporte) return false;

    // REGLA DE EXCLUSIVIDAD: Si fue creado por o está asignado a Ana ("A") o Natalia ("N"), NO mostrar bajo ninguna circunstancia
    if (creador === 'A' || creador === 'ANA' || creador.includes('ANA') || creador === 'N' || creador === 'NATALIA' || tipo === 'natalia') {
      return false;
    }

    // Condición a: El evento es de tipo trabajo (título contiene "Turno", "Trabajo", "Condis" o categoría/tipo trabajo)
    const titLower = titulo.toLowerCase();
    const contienePalabraTrabajo = /turno|trabajo|condis/i.test(titLower);
    const esTipoOCategoriaTrabajo =
      tipo === 'trabajo' ||
      tipo === 'job' ||
      (typeof categoria === 'string' && (categoria.toLowerCase() === 'trabajo' || categoria.toLowerCase() === 'laboral'));
    const esTrabajo = esTipoOCategoriaTrabajo || contienePalabraTrabajo;

    if (!esTrabajo) return false;

    // Condición b: Creado por o pertenece al usuario principal (Joel / "J")
    const perteneceAJoel = creador === 'J' || creador === 'JOEL' || creador === '';

    return perteneceAJoel;
  };

  // Mostrar el logo de Biba únicamente en turnos de trabajo de Ana.
  const esTurnoTrabajoBibaAna = (e) => {
    if (!e || typeof e === 'string' || esEventoDeporte(e)) return false;
    const creador = (e.creador || '').toUpperCase().trim();
    const titulo = (e.titulo || '').toLowerCase();
    const esTrabajo = e.tipo === 'trabajo' || e.tipo === 'job'
      || ['trabajo', 'laboral'].includes((e.categoria || '').toLowerCase())
      || /turno|trabajo|biba/i.test(titulo);
    return esTrabajo && (creador === 'A' || creador === 'ANA' || creador.includes('ANA'));
  };

  useEffect(() => {
    const docRef = doc(db, "agenda", "datos");
    const cancelarSuscripcion = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        setEventos(doc.data());
      }
    });
    return () => cancelarSuscripcion();
  }, []);

  const guardarNota = async () => {
    const esModoNatalia = nuevoEvento.tipo === 'natalia' || (nuevoEvento.tipo === 'repetir' && categoriaRepeticion === 'natalia');
    const tituloFinal = esModoNatalia ? (nuevoEvento.titulo.trim() || 'Natalia') : nuevoEvento.titulo.trim();

    if (!tituloFinal) {
      alert("Por favor, introduce un título para el evento.");
      return;
    }

    // SI ES MODO REPETIR (RECURRENTE / EXTRAESCOLAR)
    if (nuevoEvento.tipo === 'repetir') {
      if (diasRepeticion.length === 0) {
        alert("Por favor, selecciona al menos un día de la semana para repetir el evento.");
        return;
      }
      if (!fechaInicioRep || !fechaFinRep) {
        alert("Por favor, indica tanto la fecha de inicio como la fecha de fin.");
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

          const eventoAGuardar = {
            titulo: tituloFinal,
            hora: nuevoEvento.hora || "--:--",
            horaFin: (categoriaRepeticion === 'trabajo' || categoriaRepeticion === 'natalia') ? (nuevoEvento.horaFin || "") : "",
            tipo: categoriaRepeticion,
            creador: categoriaRepeticion === 'natalia' ? 'N' : obtenerInicialCreador()
          };

          // Sincronizar con Google Calendar si está conectado
          try {
            const resGcal = await sincronizarEventoGoogleCalendar({
              fechaClave,
              evento: eventoAGuardar
            });
            if (resGcal?.googleCalendarEventId) {
              eventoAGuardar.googleCalendarEventId = resGcal.googleCalendarEventId;
            }
          } catch (errGcal) {
            console.warn("No se pudo sincronizar evento recurrente con Google Calendar:", errGcal);
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
          descripcion: `Nuevo evento recurrente: "${tituloFinal}" (${eventosCreados} días)`,
          usuarioEmail: usuario?.email || auth?.currentUser?.email || '',
        });
      } catch (error) {
        console.error("Error al guardar eventos recurrentes:", error);
        alert("Error al guardar en la nube");
      }
      return;
    }

    // MODO NORMAL, TRABAJO O NATALIA (DÍA ÚNICO)
    const fechaClave = date.toDateString();
    const notasDelDia = eventos[fechaClave] || [];
    
    const eventoAGuardar = {
      titulo: tituloFinal,
      hora: nuevoEvento.hora || "--:--",
      horaFin: (nuevoEvento.tipo === 'trabajo' || nuevoEvento.tipo === 'natalia') ? (nuevoEvento.horaFin || "") : "",
      tipo: nuevoEvento.tipo || "normal",
      creador: nuevoEvento.tipo === 'natalia' ? 'N' : obtenerInicialCreador()
    };

    // Sincronizar automáticamente con Google Calendar y configurar alarmas móviles
    try {
      const resGcal = await sincronizarEventoGoogleCalendar({
        fechaClave,
        evento: eventoAGuardar,
        solicitarPermisoSiFalta: false
      });
      if (resGcal?.exito && resGcal?.googleCalendarEventId) {
        eventoAGuardar.googleCalendarEventId = resGcal.googleCalendarEventId;
      } else if (resGcal?.error) {
        // Alerta visual clara si la API de Google responde con error
        alert("⚠️ Aviso de Google Calendar:\n" + resGcal.error + "\n\nEl evento se guardará en la Agenda familiar.");
        if (resGcal.necesitaReconexion) {
          setGcalConectado(false);
        }
      }
    } catch (errGcal) {
      console.warn("No se pudo sincronizar evento con Google Calendar:", errGcal);
      alert("⚠️ Error de conexión con Google Calendar. El evento se guardará en la Agenda familiar.");
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
      const fechaFormato = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      registrarActividad({
        seccion: 'agenda',
        descripcion: `Nuevo evento: "${tituloFinal}" (${nuevoEvento.hora || 'Todo el día'}) para el ${fechaFormato}`,
        usuarioEmail: usuario?.email || auth?.currentUser?.email || '',
      });
      // Refrescar lectura de eventos de Google Calendar
      cargarEventosGoogle(date);
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar en la nube");
    }
  };

  const abrirModalEdicion = (nota, index) => {
    const esAntigua = typeof nota === 'string';
    setEventoAEditar({
      index,
      fechaClave: date.toDateString(),
      titulo: esAntigua ? nota : (nota.titulo || ''),
      hora: esAntigua ? '' : (nota.hora || ''),
      horaFin: (!esAntigua && nota.horaFin) ? nota.horaFin : '',
      tipo: (!esAntigua && nota.tipo) ? nota.tipo : 'normal',
      creador: (!esAntigua && nota.creador) ? nota.creador : 'J',
      googleCalendarEventId: (!esAntigua && nota.googleCalendarEventId) ? nota.googleCalendarEventId : ''
    });
    setMostrarModalEdicion(true);
  };

  const guardarEdicion = async () => {
    const tituloEditado = eventoAEditar.tipo === 'natalia' ? (eventoAEditar.titulo.trim() || 'Natalia') : eventoAEditar.titulo.trim();
    if (!tituloEditado) {
      alert("Por favor, introduce un título para el evento.");
      return;
    }
    if (eventoAEditar.tipo === 'trabajo' && !['Mañana', 'Tarde'].includes(eventoAEditar.titulo)) {
      alert('Selecciona si el turno es de Mañana o de Tarde.');
      return;
    }

    const fechaClave = eventoAEditar.fechaClave;
    const notasDelDia = [...(eventos[fechaClave] || [])];
    if (eventoAEditar.index < 0 || eventoAEditar.index >= notasDelDia.length) return;

    const notaActual = notasDelDia[eventoAEditar.index];
    const eventoActualizado = {
      titulo: tituloEditado,
      hora: eventoAEditar.hora || "--:--",
      horaFin: (eventoAEditar.tipo === 'trabajo' || eventoAEditar.tipo === 'natalia') ? (eventoAEditar.horaFin || '') : '',
      tipo: eventoAEditar.tipo,
      creador: eventoAEditar.tipo === 'natalia' ? 'N' : (eventoAEditar.creador === 'N' ? obtenerInicialCreador() : (eventoAEditar.creador || obtenerInicialCreador())),
      googleCalendarEventId: eventoAEditar.googleCalendarEventId || (typeof notaActual === 'object' ? notaActual?.googleCalendarEventId : undefined)
    };

    // Actualizar evento en Google Calendar si está sincronizado
    try {
      const resGcal = await sincronizarEventoGoogleCalendar({
        fechaClave,
        evento: eventoActualizado,
        esEdicion: true
      });
      if (resGcal?.exito && resGcal?.googleCalendarEventId) {
        eventoActualizado.googleCalendarEventId = resGcal.googleCalendarEventId;
      } else if (resGcal?.error) {
        alert("⚠️ Aviso de Google Calendar:\n" + resGcal.error);
        if (resGcal.necesitaReconexion) {
          setGcalConectado(false);
        }
      }
    } catch (errGcal) {
      console.warn("No se pudo actualizar en Google Calendar:", errGcal);
      alert("⚠️ Error al actualizar el evento en Google Calendar.");
    }

    notasDelDia[eventoAEditar.index] = eventoActualizado;

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
      cargarEventosGoogle(date);
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
    const notaAEliminar = (eventos[fechaClave] || [])[eventoAEditar.index];
    if (notaAEliminar && typeof notaAEliminar === 'object' && notaAEliminar.googleCalendarEventId) {
      eliminarEventoGoogleCalendar(notaAEliminar.googleCalendarEventId).catch(console.error);
    }

    const nuevasNotas = (eventos[fechaClave] || []).filter((_, i) => i !== eventoAEditar.index);
    const nuevosEventos = { ...eventos, [fechaClave]: nuevasNotas };

    setEventos(nuevosEventos);
    setMostrarModalEdicion(false);

    try {
      await setDoc(doc(db, "agenda", "datos"), nuevosEventos);
    } catch (error) {
      console.error("Error al eliminar evento:", error);
      alert("Error al eliminar el evento en la nube");
    }
  };

  const borrarNota = async (index) => {
    const fechaClave = date.toDateString();
    const listaActual = eventosCombinados[fechaClave] || [];
    const notaAEliminar = listaActual[index];

    if (!notaAEliminar) return;

    // Si es un evento exclusivo de Google Calendar
    if (typeof notaAEliminar === 'object' && notaAEliminar.esGoogleCalendar) {
      if (!window.confirm("¿Deseas eliminar este evento de tu Google Calendar?")) return;
      if (notaAEliminar.googleCalendarEventId) {
        await eliminarEventoGoogleCalendar(notaAEliminar.googleCalendarEventId);
      }
      cargarEventosGoogle(date);
      return;
    }

    if (!window.confirm("¿Estás seguro de que deseas eliminar este evento?")) {
      return;
    }

    if (typeof notaAEliminar === 'object' && notaAEliminar.googleCalendarEventId) {
      eliminarEventoGoogleCalendar(notaAEliminar.googleCalendarEventId).catch(console.error);
    }

    // Filtrar de los eventos locales de Firestore
    const notasFirestore = (eventos[fechaClave] || []).filter((n) => {
      if (typeof n === 'string') return n !== notaAEliminar;
      return n?.titulo !== notaAEliminar?.titulo;
    });
    const nuevosEventos = { ...eventos, [fechaClave]: notasFirestore };

    setEventos(nuevosEventos);
    await setDoc(doc(db, "agenda", "datos"), nuevosEventos);
    cargarEventosGoogle(date);
  };

  // --- LÓGICA DE MARCADORES CON INICIALES DEL CREADOR (J y A), GOOGLE Y DEPORTES ---
  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const fechaClave = date.toDateString();
      const eventosDelDia = eventosCombinados[fechaClave] || [];

      if (eventosDelDia.length > 0) {
        let hayDeportes = false;
        let hayGoogle = false;
        // Mapear combinaciones únicas de creador y tipo para eventos no deportivos
        const marcadoresMap = new Map();

        eventosDelDia.forEach((e) => {
          // Identificar si es un evento de deportes
          if (esEventoDeporte(e)) {
            hayDeportes = true;
            return; // NO mostrar ni 'J' ni 'A'
          }

          if (e.esGoogleCalendar || e.tipo === 'google') {
            hayGoogle = true;
            return;
          }

          const esAntigua = typeof e === 'string';
          const esTrabajo = !esAntigua && e.tipo === 'trabajo';
          const esNatalia = !esAntigua && (e.tipo === 'natalia' || (e.creador && e.creador.toUpperCase() === 'N'));
          const tipo = esNatalia ? 'natalia' : (esTrabajo ? 'trabajo' : 'normal');

          // Asignar creador ('J', 'A' o 'N')
          let creador = 'J';
          if (esNatalia) {
            creador = 'N';
          } else if (!esAntigua && e.creador) {
            creador = e.creador.toUpperCase();
          } else if (esTrabajo) {
            creador = 'J';
          }

          const clave = `${creador}-${tipo}`;
          if (!marcadoresMap.has(clave)) {
            marcadoresMap.set(clave, { creador, tipo });
          }
        });

        const marcadores = Array.from(marcadoresMap.values());
        marcadores.sort((a, b) => a.creador.localeCompare(b.creador));

        if (marcadores.length === 0 && !hayDeportes && !hayGoogle) {
          return null;
        }

        return (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '3px',
            marginTop: '3px',
            lineHeight: 1
          }}>
            {marcadores.map((m, idx) => {
              const esTrabajo = m.tipo === 'trabajo';
              const esNatalia = m.tipo === 'natalia' || m.creador === 'N';
              const nombrePersona = m.creador === 'N' ? 'Natalia' : (m.creador === 'J' ? 'Joel' : 'Ana');
              return (
                <span
                  key={idx}
                  title={`Evento de ${nombrePersona}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '8px',
                    fontWeight: '800',
                    color: '#ffffff',
                    backgroundColor: esNatalia ? '#7c3aed' : (esTrabajo ? '#111827' : '#EF4444'),
                    width: '13px',
                    height: '13px',
                    borderRadius: '50%',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.25)'
                  }}
                >
                  {m.creador}
                </span>
              );
            })}

            {hayGoogle && (
              <span
                title="Evento sincronizado de Google Calendar"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '8px',
                  fontWeight: '800',
                  color: '#ffffff',
                  backgroundColor: '#2563eb',
                  width: '13px',
                  height: '13px',
                  borderRadius: '50%',
                  boxShadow: '0 1px 2px rgba(37,99,235,0.3)'
                }}
              >
                G
              </span>
            )}

            {hayDeportes && (
              <span
                className="marcador-circulo-deporte"
                title="Evento deportivo"
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#FACC15',
                  border: '1.5px solid #000000',
                  display: 'inline-block',
                  flexShrink: 0,
                  boxShadow: '0 0 0 0.5px rgba(255,255,255,0.6)'
                }}
              />
            )}
          </div>
        );
      }
    }
    return null;
  };

  const fechaActual = date.toDateString();
  const listaNotas = eventosCombinados[fechaActual] || [];

  return (
    <div 
      className="bg-white text-gray-900"
      style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        marginTop: '20px', 
        width: '100%', 
        maxWidth: '400px',
        color: '#111827'
      }}
    >
      
      {/* CALENDARIO: Fondo blanco forzado y texto oscuro #111827 */}
      <div 
        className="bg-white text-gray-900"
        style={{ 
          boxShadow: "0px 4px 15px rgba(0,0,0,0.08)", 
          borderRadius: "12px", 
          overflow: "hidden", 
          marginBottom: "20px", 
          backgroundColor: '#ffffff', 
          color: '#111827',
          width: '100%',
          border: '1px solid #e5e7eb'
        }}
      >
        <Calendar 
          onChange={manejarCambioFecha} 
          value={date} 
          locale="es-ES" 
          tileContent={tileContent} 
        />
      </div>

      {/* LISTA DE EVENTOS DEL DÍA */}
      <div 
        className="bg-white text-gray-900"
        style={{ 
          width: "100%", 
          padding: "20px", 
          border: "1px solid #e5e7eb", 
          borderRadius: "12px", 
          backgroundColor: "#ffffff", 
          color: "#111827",
          minHeight: "200px",
          boxShadow: "0px 2px 8px rgba(0,0,0,0.04)"
        }}
      >
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
                ? "Google Calendar conectado (Alarmas: 30 min y 1 día antes)"
                : "Google Calendar no sincronizado"}
            </span>
          </div>
          {!gcalConectado && (
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
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h3 style={{ margin: 0, color: "#111827", fontSize: "16px", fontWeight: "700" }}>
            📅 {date.toLocaleDateString()}
          </h3>
          <button 
            onClick={abrirModalCrear}
            style={{ 
              padding: "8px 15px", 
              backgroundColor: "#111827", 
              color: "white", 
              border: "none", 
              borderRadius: "6px", 
              cursor: "pointer", 
              fontWeight: "bold",
              fontSize: "14px"
            }}
          >
            + Añadir
          </button>
        </div>

        <div>
          {listaNotas.length === 0 ? (
            <p style={{ color: "#6b7280", fontStyle: "italic", margin: "10px 0" }}>No hay planes para hoy.</p>
          ) : (
            <ul style={{ paddingLeft: "0", listStyle: "none", margin: 0 }}>
              {listaNotas.map((nota, index) => {
                const esAntigua = typeof nota === 'string';
                const titulo = esAntigua ? nota : nota.titulo;
                const horaInicio = esAntigua ? "--:--" : nota.hora;
                const esDeporte = esEventoDeporte(nota);
                const esNatalia = !esAntigua && !esDeporte && (nota.tipo === 'natalia' || (nota.creador && nota.creador.toUpperCase() === 'N'));
                const esTrabajo = !esAntigua && !esDeporte && !esNatalia && nota.tipo === 'trabajo';
                const esGoogle = !esAntigua && (nota.esGoogleCalendar || nota.tipo === 'google');
                const esCondis = esTurnoTrabajoCondisJoel(nota);
                const esBiba = esTurnoTrabajoBibaAna(nota);
                // Para eventos de deporte o google: tratamiento específico
                const creador = (esDeporte || esGoogle) ? '' : (esNatalia ? 'N' : (!esAntigua && nota.creador ? nota.creador.toUpperCase() : (esTrabajo ? 'J' : '')));
                
                // Si es trabajo o Natalia y tiene hora fin, mostramos el rango (Ej: 08:00 - 15:00)
                let textoHora = horaInicio;
                if ((esTrabajo || esNatalia || esGoogle) && nota.horaFin) {
                    textoHora = `${horaInicio} - ${nota.horaFin}`;
                }

                let borderColor = '#9ca3af';
                let bgColor = '#f9fafb';
                if (esGoogle) {
                  borderColor = '#2563eb';
                  bgColor = '#eff6ff';
                } else if (esDeporte) {
                  borderColor = '#FACC15';
                  bgColor = '#fefce8';
                } else if (esNatalia) {
                  borderColor = '#7c3aed';
                  bgColor = '#f5f3ff';
                } else if (esTrabajo) {
                  borderColor = '#0070f3';
                  bgColor = '#eff6ff';
                }

                return (
                  <li 
                    key={index} 
                    onClick={() => abrirModalEdicion(nota, index)}
                    title="Haz clic para editar este evento"
                    style={{ 
                      marginBottom: "10px", padding: "12px", 
                      backgroundColor: bgColor, 
                      borderLeft: `4px solid ${borderColor}`,
                      borderRadius: "8px", 
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      border: "1px solid #e5e7eb",
                      borderLeftWidth: "4px",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = esDeporte ? '#fef9c3' : (esNatalia ? '#ede9fe' : (esTrabajo ? '#e0f2fe' : '#f3f4f6')); }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = bgColor; }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                        {esGoogle ? (
                          <span style={{
                            fontSize: "10px",
                            fontWeight: "800",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "#2563eb",
                            color: "#ffffff",
                            letterSpacing: "0.5px"
                          }}>
                            📅 Google
                          </span>
                        ) : esDeporte ? (
                          <span
                            title="Evento deportivo"
                            style={{
                              width: "11px",
                              height: "11px",
                              borderRadius: "50%",
                              backgroundColor: "#FACC15",
                              border: "1.5px solid #000000",
                              display: "inline-block",
                              flexShrink: 0
                            }}
                          />
                        ) : (
                          creador && (
                            <span style={{
                              fontSize: "10px",
                              fontWeight: "800",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              backgroundColor: esNatalia ? "#7c3aed" : (esTrabajo ? "#111827" : "#EF4444"),
                              color: "#ffffff",
                              letterSpacing: "0.5px"
                            }}>
                              {creador}
                            </span>
                          )
                        )}
                        <span style={{ 
                          fontSize: "12px", 
                          color: esGoogle ? "#1d4ed8" : (esDeporte ? "#a16207" : (esNatalia ? "#6d28d9" : (esTrabajo ? "#0070f3" : "#4b5563"))), 
                          fontWeight: "bold" 
                        }}>
                          {esGoogle ? "📅 " + textoHora : (esDeporte ? "🏆 " + textoHora : (esNatalia ? "👩 " + textoHora : (esTrabajo ? "💼 " + textoHora : "🕒 " + textoHora)))}
                        </span>
                      </div>
                      <span style={{ fontSize: "15px", fontWeight: (esTrabajo || esNatalia || esDeporte) ? "700" : "600", color: "#111827" }}>
                        {titulo}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "auto" }}>
                      {esBiba && (
                        <img
                          src="/biba.jpeg"
                          alt="Biblioteca pública d'Avinyó"
                          style={{ maxHeight: "24px", width: "auto", objectFit: "contain", display: "block" }}
                        />
                      )}
                      {esCondis && (
                        <img 
                          src="/condis.jpg" 
                          alt="Condis" 
                          style={{ maxHeight: "24px", width: "auto", objectFit: "contain", display: "block" }} 
                        />
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          borrarNota(index);
                        }}
                        style={{ marginLeft: "4px", color: "#dc2626", border: "none", background: "none", cursor: "pointer", fontSize: "16px", padding: "4px" }}
                        title={esGoogle ? "Eliminar de Google Calendar" : "Eliminar evento"}
                        aria-label="Borrar nota"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* MODAL PARA CREAR EVENTO (NORMAL, TRABAJO, NATALIA O REPETIR) */}
      {mostrarModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div 
            className="bg-white text-gray-900"
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
                Nuevo Evento
              </h3>
              <button 
                onClick={() => setMostrarModal(false)}
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
                <span style={{ fontWeight: 800 }}>Alarmas en el móvil (Google Calendar):</span>{' '}
                <span>Avisos nativos automáticos 30 min y 1 día antes.</span>
              </div>
            </div>
            
            {/* SELECTOR DE TIPO: NORMAL, TRABAJO, NATALIA O REPETIR */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button 
                    type="button"
                    onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'normal', titulo: ''})}
                    style={{ 
                        flex: 1, padding: '8px 4px', borderRadius: '8px', border: nuevoEvento.tipo === 'normal' ? '2px solid #ef4444' : '1px solid #d1d5db', cursor: 'pointer',
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
                    onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'trabajo', titulo: ''})}
                    style={{ 
                        flex: 1, padding: '8px 4px', borderRadius: '8px', border: nuevoEvento.tipo === 'trabajo' ? '2px solid #111827' : '1px solid #d1d5db', cursor: 'pointer',
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
                    onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'natalia', titulo: 'Natalia'})}
                    style={{ 
                        flex: 1, padding: '8px 4px', borderRadius: '8px', border: nuevoEvento.tipo === 'natalia' ? '2px solid #7c3aed' : '1px solid #d1d5db', cursor: 'pointer',
                        backgroundColor: nuevoEvento.tipo === 'natalia' ? '#f5f3ff' : '#ffffff',
                        color: nuevoEvento.tipo === 'natalia' ? '#6d28d9' : '#374151', 
                        fontWeight: nuevoEvento.tipo === 'natalia' ? '800' : '600',
                        fontSize: '12px'
                    }}
                >
                    👩 Natalia
                </button>
                <button 
                    type="button"
                    onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'repetir', titulo: ''})}
                    style={{ 
                        flex: 1, padding: '8px 4px', borderRadius: '8px', border: nuevoEvento.tipo === 'repetir' ? '2px solid #0047b3' : '1px solid #d1d5db', cursor: 'pointer',
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
                      onClick={() => {
                        setCategoriaRepeticion('normal');
                        if (nuevoEvento.titulo === 'Natalia') setNuevoEvento({ ...nuevoEvento, titulo: '' });
                      }}
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
                      onClick={() => {
                        setCategoriaRepeticion('trabajo');
                        if (nuevoEvento.titulo === 'Natalia') setNuevoEvento({ ...nuevoEvento, titulo: '' });
                      }}
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
                    <button
                      type="button"
                      onClick={() => {
                        setCategoriaRepeticion('natalia');
                        setNuevoEvento({ ...nuevoEvento, titulo: 'Natalia' });
                      }}
                      style={{
                        flex: 1, padding: '6px', borderRadius: '6px', cursor: 'pointer',
                        border: categoriaRepeticion === 'natalia' ? '2px solid #7c3aed' : '1px solid #d1d5db',
                        backgroundColor: categoriaRepeticion === 'natalia' ? '#f5f3ff' : '#ffffff',
                        color: categoriaRepeticion === 'natalia' ? '#6d28d9' : '#374151',
                        fontWeight: '700', fontSize: '11px'
                      }}
                    >
                      👩 Natalia
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

            {nuevoEvento.tipo === 'trabajo' ? (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                {['Mañana', 'Tarde'].map((turno) => (
                  <button
                    key={turno}
                    type="button"
                    aria-pressed={nuevoEvento.titulo === turno}
                    onClick={() => setNuevoEvento({ ...nuevoEvento, titulo: turno })}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: nuevoEvento.titulo === turno ? '2px solid #111827' : '1px solid #d1d5db', backgroundColor: nuevoEvento.titulo === turno ? '#f3f4f6' : '#ffffff', color: '#111827', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}
                  >
                    {turno}
                  </button>
                ))}
              </div>
            ) : (nuevoEvento.tipo === 'natalia' || (nuevoEvento.tipo === 'repetir' && categoriaRepeticion === 'natalia')) ? null : (
              <>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", color: "#374151", fontSize: "13px" }}>
                  Título:
                </label>
                <input
                  type="text"
                  placeholder={nuevoEvento.tipo === 'repetir' ? "Ej: Natación, Fútbol, Inglés..." : "Ej: Cena, Dentista..."}
                  value={nuevoEvento.titulo}
                  onChange={(e) => setNuevoEvento({...nuevoEvento, titulo: e.target.value})}
                  style={{
                    width: "100%", padding: "10px", marginBottom: "14px", borderRadius: "8px",
                    border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "14px", outline: "none"
                  }}
                />
              </>
            )}
            
            {/* INPUTS DE HORA SEGÚN TIPO */}
            {(nuevoEvento.tipo === 'normal' || (nuevoEvento.tipo === 'repetir' && categoriaRepeticion === 'normal')) ? (
                <>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", color: "#374151", fontSize: "13px" }}>Hora:</label>
                    <input 
                      type="time" value={nuevoEvento.hora}
                      onChange={(e) => setNuevoEvento({...nuevoEvento, hora: e.target.value})}
                      style={{ 
                        width: "100%", padding: "10px", marginBottom: "18px", borderRadius: "8px", 
                        border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "14px", outline: "none" 
                      }}
                    />
                </>
            ) : (
                /* MODO TRABAJO, NATALIA O REPETIR TRABAJO/NATALIA: ENTRADA Y SALIDA */
                <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", fontSize: "12px", color: "#374151" }}>Entrada ☀️</label>
                        <input 
                            type="time" value={nuevoEvento.hora}
                            onChange={(e) => setNuevoEvento({...nuevoEvento, hora: e.target.value})}
                            style={{ 
                              width: "100%", padding: "10px", borderRadius: "8px", 
                              border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "13px", outline: "none" 
                            }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", fontSize: "12px", color: "#374151" }}>Salida 🌙</label>
                        <input 
                            type="time" value={nuevoEvento.horaFin}
                            onChange={(e) => setNuevoEvento({...nuevoEvento, horaFin: e.target.value})}
                            style={{ 
                              width: "100%", padding: "10px", borderRadius: "8px", 
                              border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "13px", outline: "none" 
                            }}
                        />
                    </div>
                </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: '8px' }}>
              <button 
                type="button"
                onClick={() => setMostrarModal(false)} 
                style={{ padding: "8px 16px", backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={guardarNota} 
                style={{ padding: "8px 18px", backgroundColor: nuevoEvento.tipo === 'repetir' ? "#0047b3" : (nuevoEvento.tipo === 'natalia' ? "#7c3aed" : "#111827"), color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "13px" }}
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
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div 
            className="bg-white text-gray-900"
            style={{ 
              backgroundColor: "#ffffff", 
              color: "#111827",
              padding: "24px", 
              borderRadius: "14px", 
              width: "100%", 
              maxWidth: "380px", 
              boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
              border: "1px solid #e5e7eb"
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

            <p style={{ margin: "0 0 10px 0", color: "#0047b3", fontSize: "13px", fontWeight: "600" }}>
              📅 {eventoAEditar.fechaClave}
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
                <span style={{ fontWeight: 800 }}>Alarmas en el móvil:</span>{' '}
                <span>Se actualiza en Google Calendar (avisos 30 min y 1 día antes).</span>
              </div>
            </div>

            {/* SELECTOR DE CATEGORÍA */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <button 
                type="button"
                onClick={() => setEventoAEditar({...eventoAEditar, tipo: 'normal', titulo: eventoAEditar.titulo === 'Natalia' ? '' : eventoAEditar.titulo})}
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
                onClick={() => setEventoAEditar({...eventoAEditar, tipo: 'trabajo', titulo: ['Mañana', 'Tarde'].includes(eventoAEditar.titulo) ? eventoAEditar.titulo : ''})}
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
              <button 
                type="button"
                onClick={() => setEventoAEditar({...eventoAEditar, tipo: 'natalia', titulo: 'Natalia', creador: 'N'})}
                style={{ 
                  flex: 1, padding: '8px', borderRadius: '8px',
                  border: eventoAEditar.tipo === 'natalia' ? '2px solid #7c3aed' : '1px solid #d1d5db',
                  cursor: 'pointer',
                  backgroundColor: eventoAEditar.tipo === 'natalia' ? '#f5f3ff' : '#ffffff',
                  color: eventoAEditar.tipo === 'natalia' ? '#6d28d9' : '#111827', 
                  fontWeight: eventoAEditar.tipo === 'natalia' ? '800' : '600',
                  fontSize: '13px'
                }}
              >
                👩 Natalia
              </button>
            </div>

            {eventoAEditar.tipo === 'trabajo' ? (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                {['Mañana', 'Tarde'].map((turno) => (
                  <button
                    key={turno}
                    type="button"
                    aria-pressed={eventoAEditar.titulo === turno}
                    onClick={() => setEventoAEditar({ ...eventoAEditar, titulo: turno })}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: eventoAEditar.titulo === turno ? '2px solid #111827' : '1px solid #d1d5db', backgroundColor: eventoAEditar.titulo === turno ? '#f3f4f6' : '#ffffff', color: '#111827', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}
                  >
                    {turno}
                  </button>
                ))}
              </div>
            ) : eventoAEditar.tipo === 'natalia' ? null : (
              <>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", color: "#374151", fontSize: "13px" }}>
                  Título:
                </label>
                <input
                  type="text"
                  value={eventoAEditar.titulo}
                  onChange={(e) => setEventoAEditar({ ...eventoAEditar, titulo: e.target.value })}
                  style={{
                    width: "100%", padding: "10px", marginBottom: "14px", borderRadius: "8px",
                    border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "14px", outline: "none"
                  }}
                />
              </>
            )}
            
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
