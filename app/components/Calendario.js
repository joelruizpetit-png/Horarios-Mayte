"use client";
import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { db, auth } from '../firebase'; 
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

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
    if (!nuevoEvento.titulo) return;

    const fechaClave = date.toDateString();
    const notasDelDia = eventos[fechaClave] || [];
    
    const eventoAGuardar = {
      titulo: nuevoEvento.titulo,
      hora: nuevoEvento.hora || "--:--",
      horaFin: nuevoEvento.horaFin || "", // Guardamos la hora de salida si existe
      tipo: nuevoEvento.tipo || "normal",
      creador: obtenerInicialCreador()
    };

    const nuevosEventos = {
      ...eventos,
      [fechaClave]: [...notasDelDia, eventoAGuardar]
    };

    setEventos(nuevosEventos);
    setMostrarModal(false);
    // Reseteamos el formulario
    setNuevoEvento({ titulo: "", hora: "", horaFin: "", tipo: "normal" });

    try {
      await setDoc(doc(db, "agenda", "datos"), nuevosEventos);
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar en la nube");
    }
  };

  const borrarNota = async (index) => {
    const fechaClave = date.toDateString();
    const nuevasNotas = eventos[fechaClave].filter((_, i) => i !== index);
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
            onClick={() => setMostrarModal(true)}
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
                  <li key={index} style={{ 
                    marginBottom: "10px", padding: "12px", 
                    backgroundColor: bgColor, 
                    borderLeft: `4px solid ${borderColor}`,
                    borderRadius: "8px", 
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    border: "1px solid #e5e7eb",
                    borderLeftWidth: "4px",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
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
                      onClick={() => borrarNota(index)}
                      style={{ marginLeft: "10px", color: "#dc2626", border: "none", background: "none", cursor: "pointer", fontSize: "16px" }}
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

      {/* MODAL PARA CREAR EVENTO */}
      {mostrarModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 1000
        }}>
          <div 
            className="bg-white text-gray-900"
            style={{ 
              backgroundColor: "#ffffff", 
              color: "#111827",
              padding: "24px", 
              borderRadius: "12px", 
              width: "90%", 
              maxWidth: "350px", 
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              border: "1px solid #e5e7eb"
            }}
          >
            <h3 style={{ margin: "0 0 15px 0", color: "#111827", fontSize: "18px", fontWeight: "700" }}>Nuevo Evento</h3>
            
            {/* SELECTOR DE TIPO */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <button 
                    type="button"
                    onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'normal', titulo: ''})}
                    style={{ 
                        flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', cursor: 'pointer',
                        backgroundColor: nuevoEvento.tipo === 'normal' ? '#f3f4f6' : '#ffffff',
                        color: '#111827',
                        fontWeight: nuevoEvento.tipo === 'normal' ? '700' : '500'
                    }}
                >
                    🎈 Normal
                </button>
                <button 
                    type="button"
                    onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'trabajo', titulo: 'Turno de Trabajo'})}
                    style={{ 
                        flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #0070f3', cursor: 'pointer',
                        backgroundColor: nuevoEvento.tipo === 'trabajo' ? '#eff6ff' : '#ffffff',
                        color: '#0070f3', 
                        fontWeight: '700'
                    }}
                >
                    💼 Trabajo
                </button>
            </div>

            <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", color: "#374151", fontSize: "14px" }}>Título:</label>
            <input 
              type="text" placeholder="Ej: Cena, Dentista..." value={nuevoEvento.titulo}
              onChange={(e) => setNuevoEvento({...nuevoEvento, titulo: e.target.value})}
              style={{ 
                width: "100%", padding: "10px", marginBottom: "15px", borderRadius: "6px", 
                border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "15px", outline: "none" 
              }}
            />
            
            {/* INPUTS DE HORA: CAMBIAN SEGÚN EL TIPO */}
            {nuevoEvento.tipo === 'normal' ? (
                <>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", color: "#374151", fontSize: "14px" }}>Hora:</label>
                    <input 
                      type="time" value={nuevoEvento.hora}
                      onChange={(e) => setNuevoEvento({...nuevoEvento, hora: e.target.value})}
                      style={{ 
                        width: "100%", padding: "10px", marginBottom: "20px", borderRadius: "6px", 
                        border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "15px", outline: "none" 
                      }}
                    />
                </>
            ) : (
                /* MODO TRABAJO: DOS INPUTS JUNTOS */
                <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", fontSize: "12px", color: "#374151" }}>Entrada ☀️</label>
                        <input 
                            type="time" value={nuevoEvento.hora}
                            onChange={(e) => setNuevoEvento({...nuevoEvento, hora: e.target.value})}
                            style={{ 
                              width: "100%", padding: "10px", borderRadius: "6px", 
                              border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "14px", outline: "none" 
                            }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: "block", marginBottom: "5px", fontWeight: "700", fontSize: "12px", color: "#374151" }}>Salida 🌙</label>
                        <input 
                            type="time" value={nuevoEvento.horaFin}
                            onChange={(e) => setNuevoEvento({...nuevoEvento, horaFin: e.target.value})}
                            style={{ 
                              width: "100%", padding: "10px", borderRadius: "6px", 
                              border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#111827", fontSize: "14px", outline: "none" 
                            }}
                        />
                    </div>
                </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: '10px' }}>
              <button 
                type="button"
                onClick={() => setMostrarModal(false)} 
                style={{ padding: "8px 16px", backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={guardarNota} 
                style={{ padding: "8px 16px", backgroundColor: "#111827", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "700" }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}