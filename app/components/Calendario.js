"use client";
import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { db } from '../firebase'; 
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

export default function Calendario() {
  const [date, setDate] = useState(new Date());
  const [eventos, setEventos] = useState({});
  const [mostrarModal, setMostrarModal] = useState(false);
  
  // AÑADIDO: 'horaFin' para saber cuándo sales de trabajar
  const [nuevoEvento, setNuevoEvento] = useState({ 
    titulo: "", 
    hora: "", 
    horaFin: "", 
    tipo: "normal" 
  });

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
      tipo: nuevoEvento.tipo || "normal"
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

  // --- LÓGICA DE PUNTITOS DE COLORES ---
  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const fechaClave = date.toDateString();
      const eventosDelDia = eventos[fechaClave] || [];

      if (eventosDelDia.length > 0) {
        const hayTrabajo = eventosDelDia.some(e => e.tipo === 'trabajo');
        const hayNormal = eventosDelDia.some(e => !e.tipo || e.tipo === 'normal');

        return (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '3px', marginTop: '2px' }}>
            {hayNormal && (
              <div style={{ height: '6px', width: '6px', backgroundColor: '#ff4d4d', borderRadius: '50%' }}></div>
            )}
            {hayTrabajo && (
              <div style={{ height: '6px', width: '6px', backgroundColor: '#0070f3', borderRadius: '50%' }}></div>
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
          onChange={setDate} 
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
                const esTrabajo = !esAntigua && nota.tipo === 'trabajo';
                
                // Si es trabajo y tiene hora fin, mostramos el rango (Ej: 08:00 - 15:00)
                let textoHora = horaInicio;
                if (esTrabajo && nota.horaFin) {
                    textoHora = `${horaInicio} - ${nota.horaFin}`;
                }

                return (
                  <li key={index} style={{ 
                    marginBottom: "10px", padding: "12px", 
                    backgroundColor: esTrabajo ? "#eff6ff" : "#f9fafb", 
                    borderLeft: esTrabajo ? "4px solid #0070f3" : "4px solid #9ca3af",
                    borderRadius: "8px", 
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    border: "1px solid #e5e7eb",
                    borderLeftWidth: "4px",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <span style={{ display: "block", fontSize: "12px", color: esTrabajo ? "#0070f3" : "#4b5563", fontWeight: "bold" }}>
                        {esTrabajo ? "💼 " + textoHora : "🕒 " + textoHora}
                      </span>
                      <span style={{ fontSize: "15px", fontWeight: esTrabajo ? "700" : "600", color: "#111827" }}>
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