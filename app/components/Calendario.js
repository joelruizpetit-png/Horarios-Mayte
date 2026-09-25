"use client";
import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { db, auth } from '../firebase'; 
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { registrarActividad } from '../utils/actividad';

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
    creador: 'J'
  });

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

  const abrirModalCrear = () => {
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

  // Obtener la inicial del creador según la sesión activa de Google
  const obtenerInicialCreador = () => {
    const email = usuario?.email || auth?.currentUser?.email || '';
    const emailLimpio = email.toLowerCase().trim();
    if (emailLimpio === 'joelruizpetit@gmail.com') return 'J';
    if (emailLimpio === 'aijg1985@gmail.com') return 'A';
    return emailLimpio ? emailLimpio.charAt(0).toUpperCase() : 'J';
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
    if (!nuevoEvento.titulo.trim()) {
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
            titulo: nuevoEvento.titulo.trim(),
            hora: nuevoEvento.hora || "--:--",
            horaFin: categoriaRepeticion === 'trabajo' ? (nuevoEvento.horaFin || "") : "",
            tipo: categoriaRepeticion,
            creador: obtenerInicialCreador()
          };

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

    // MODO NORMAL O TRABAJO (DÍA ÚNICO)
    const fechaClave = date.toDateString();
    const notasDelDia = eventos[fechaClave] || [];
    
    const eventoAGuardar = {
      titulo: nuevoEvento.titulo.trim(),
      hora: nuevoEvento.hora || "--:--",
      horaFin: nuevoEvento.tipo === 'trabajo' ? (nuevoEvento.horaFin || "") : "",
      tipo: nuevoEvento.tipo || "normal",
      creador: obtenerInicialCreador()
    };

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
        descripcion: `Nuevo evento: "${nuevoEvento.titulo.trim()}" (${nuevoEvento.hora || 'Todo el día'}) para el ${fechaFormato}`,
        usuarioEmail: usuario?.email || auth?.currentUser?.email || '',
      });
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
      creador: (!esAntigua && nota.creador) ? nota.creador : 'J'
    });
    setMostrarModalEdicion(true);
  };

  const guardarEdicion = async () => {
    if (!eventoAEditar.titulo.trim()) {
      alert("Por favor, introduce un título para el evento.");
      return;
    }

    const fechaClave = eventoAEditar.fechaClave;
    const notasDelDia = [...(eventos[fechaClave] || [])];
    if (eventoAEditar.index < 0 || eventoAEditar.index >= notasDelDia.length) return;

    notasDelDia[eventoAEditar.index] = {
      titulo: eventoAEditar.titulo.trim(),
      hora: eventoAEditar.hora || "--:--",
      horaFin: eventoAEditar.tipo === 'trabajo' ? (eventoAEditar.horaFin || '') : '',
      tipo: eventoAEditar.tipo,
      creador: eventoAEditar.creador || obtenerInicialCreador()
    };

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
    if (!window.confirm("¿Estás seguro de que deseas eliminar este evento?")) {
      return;
    }
    const fechaClave = date.toDateString();
    const nuevasNotas = (eventos[fechaClave] || []).filter((_, i) => i !== index);
    const nuevosEventos = { ...eventos, [fechaClave]: nuevasNotas };

    setEventos(nuevosEventos);
    await setDoc(doc(db, "agenda", "datos"), nuevosEventos);
  };

  // --- LÓGICA DE MARCADORES CON INICIALES DEL CREADOR (J y A) Y DEPORTES ---
  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const fechaClave = date.toDateString();
      const eventosDelDia = eventos[fechaClave] || [];

      if (eventosDelDia.length > 0) {
        let hayDeportes = false;
        // Mapear combinaciones únicas de creador y tipo para eventos no deportivos
        const marcadoresMap = new Map();

        eventosDelDia.forEach((e) => {
          // Identificar si es un evento de deportes
          if (esEventoDeporte(e)) {
            hayDeportes = true;
            return; // NO mostrar ni 'J' ni 'A'
          }

          const esAntigua = typeof e === 'string';
          const esTrabajo = !esAntigua && e.tipo === 'trabajo';
          const tipo = esTrabajo ? 'trabajo' : 'normal';

          // Asignar creador ('J' o 'A')
          let creador = 'J';
          if (!esAntigua && e.creador) {
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

        if (marcadores.length === 0 && !hayDeportes) {
          return null;
        }

        return (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '4px',
            marginTop: '3px',
            lineHeight: 1
          }}>
            {marcadores.map((m, idx) => {
              const esTrabajo = m.tipo === 'trabajo';
              return (
                <span
                  key={idx}
                  className={esTrabajo ? "marcador-inicial-trabajo" : "marcador-inicial-normal"}
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: esTrabajo ? '#111827' : '#EF4444',
                    letterSpacing: '0.2px'
                  }}
                >
                  {m.creador}
                </span>
              );
            })}
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
  const listaNotas = eventos[fechaActual] || [];

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
                const esTrabajo = !esAntigua && !esDeporte && nota.tipo === 'trabajo';
                // Para eventos de deporte: NO mostrar creador ni 'J' ni 'A'
                const creador = esDeporte ? '' : (!esAntigua && nota.creador ? nota.creador.toUpperCase() : (esTrabajo ? 'J' : ''));
                
                // Si es trabajo y tiene hora fin, mostramos el rango (Ej: 08:00 - 15:00)
                let textoHora = horaInicio;
                if (esTrabajo && nota.horaFin) {
                    textoHora = `${horaInicio} - ${nota.horaFin}`;
                }

                let borderColor = '#9ca3af';
                let bgColor = '#f9fafb';
                if (esDeporte) {
                  borderColor = '#FACC15';
                  bgColor = '#fefce8';
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
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = esDeporte ? '#fef9c3' : (esTrabajo ? '#e0f2fe' : '#f3f4f6'); }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = bgColor; }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                        {esDeporte ? (
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
                              backgroundColor: esTrabajo ? "#111827" : "#EF4444",
                              color: "#ffffff",
                              letterSpacing: "0.5px"
                            }}>
                              {creador}
                            </span>
                          )
                        )}
                        <span style={{ 
                          fontSize: "12px", 
                          color: esDeporte ? "#a16207" : (esTrabajo ? "#0070f3" : "#4b5563"), 
                          fontWeight: "bold" 
                        }}>
                          {esDeporte ? "🏆 " + textoHora : (esTrabajo ? "💼 " + textoHora : "🕒 " + textoHora)}
                        </span>
                      </div>
                      <span style={{ fontSize: "15px", fontWeight: (esTrabajo || esDeporte) ? "700" : "600", color: "#111827" }}>
                        {titulo}
                      </span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        borrarNota(index);
                      }}
                      style={{ marginLeft: "10px", color: "#dc2626", border: "none", background: "none", cursor: "pointer", fontSize: "16px", padding: "4px" }}
                      title="Eliminar evento"
                      aria-label="Borrar nota"
                    >
                      🗑️
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* MODAL PARA CREAR EVENTO (NORMAL, TRABAJO O REPETIR) */}
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
            
            {/* SELECTOR DE TIPO: NORMAL, TRABAJO O REPETIR */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                <button 
                    type="button"
                    onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'normal'})}
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
                    onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'trabajo', titulo: nuevoEvento.titulo || 'Turno de Trabajo'})}
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
                    onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'repetir'})}
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
              placeholder={nuevoEvento.tipo === 'repetir' ? "Ej: Natación, Fútbol, Inglés..." : "Ej: Cena, Dentista..."} 
              value={nuevoEvento.titulo}
              onChange={(e) => setNuevoEvento({...nuevoEvento, titulo: e.target.value})}
              style={{ 
                width: "100%", padding: "10px", marginBottom: "14px", borderRadius: "8px", 
                border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "14px", outline: "none" 
              }}
            />
            
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
                /* MODO TRABAJO O REPETIR TRABAJO: ENTRADA Y SALIDA */
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
                style={{ padding: "8px 18px", backgroundColor: nuevoEvento.tipo === 'repetir' ? "#0047b3" : "#111827", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "13px" }}
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