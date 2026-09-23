"use client";
import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; 
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

interface Evento {
  titulo: string;
  hora: string;
  horaFin?: string;
  tipo?: 'normal' | 'trabajo' | string;
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

export default function CalendarioSemanal() {
  const [fechaReferencia, setFechaReferencia] = useState(new Date());
  const [eventos, setEventos] = useState<Record<string, (Evento | string)[]>>({});
  const [mostrarModal, setMostrarModal] = useState(false);
  const [fechaModal, setFechaModal] = useState<Date>(new Date());
  
  const [nuevoEvento, setNuevoEvento] = useState({ 
    titulo: "", 
    hora: "", 
    horaFin: "", 
    tipo: "normal" 
  });

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

  // Generar los 7 días de la semana
  const diasDeLaSemana = Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(lunesSemana);
    dia.setDate(lunesSemana.getDate() + i);
    return dia;
  });

  const cambiarSemana = (offsetDias: number) => {
    const nuevaFecha = new Date(fechaReferencia);
    nuevaFecha.setDate(nuevaFecha.getDate() + offsetDias);
    setFechaReferencia(nuevaFecha);
  };

  const irAHoy = () => {
    setFechaReferencia(new Date());
  };

  const abrirModalParaDia = (dia: Date) => {
    setFechaModal(dia);
    setNuevoEvento({ titulo: "", hora: "", horaFin: "", tipo: "normal" });
    setMostrarModal(true);
  };

  const guardarNota = async () => {
    if (!nuevoEvento.titulo) return;

    const fechaClave = fechaModal.toDateString();
    const notasDelDia = eventos[fechaClave] || [];
    
    const eventoAGuardar: Evento = {
      titulo: nuevoEvento.titulo,
      hora: nuevoEvento.hora || "--:--",
      horaFin: nuevoEvento.horaFin || "",
      tipo: nuevoEvento.tipo || "normal"
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
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar en la nube");
    }
  };

  const borrarNota = async (fechaClave: string, index: number) => {
    const notasActuales = eventos[fechaClave] || [];
    const nuevasNotas = notasActuales.filter((_, i) => i !== index);
    const nuevosEventos = { ...eventos, [fechaClave]: nuevasNotas };

    setEventos(nuevosEventos);
    await setDoc(doc(db, "agenda", "datos"), nuevosEventos);
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

      {/* LISTA DE LOS 7 DÍAS DE LA SEMANA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        {diasDeLaSemana.map((dia, idx) => {
          const claveDia = dia.toDateString();
          const esHoy = claveDia === hoyStr;
          const esFinDeSemana = dia.getDay() === 0 || dia.getDay() === 6;
          const notasDelDia = eventos[claveDia] || [];

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
                    const esTrabajo = !esAntigua && nota.tipo === 'trabajo';
                    const horaFin = !esAntigua ? nota.horaFin : "";

                    let textoHora = horaInicio;
                    if (esTrabajo && horaFin) {
                      textoHora = `${horaInicio} - ${horaFin}`;
                    }

                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          backgroundColor: esTrabajo ? '#eff6ff' : '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderLeft: esTrabajo ? '4px solid #0070f3' : '4px solid #9ca3af',
                          borderRadius: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: esTrabajo ? '#0070f3' : '#4b5563'
                          }}>
                            {esTrabajo ? `💼 ${textoHora}` : `🕒 ${textoHora}`}
                          </span>
                          <span style={{
                            fontSize: '13px',
                            fontWeight: esTrabajo ? 700 : 600,
                            color: '#111827'
                          }}>
                            {titulo}
                          </span>
                        </div>

                        <button
                          onClick={() => borrarNota(claveDia, i)}
                          title="Eliminar evento"
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

      {/* MODAL PARA CREAR EVENTO EN DÍA SELECCIONADO */}
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
            maxWidth: "360px", 
            boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
            border: "1px solid #e5e7eb"
          }}>
            <h3 style={{ margin: "0 0 6px 0", color: "#111827", fontSize: "18px", fontWeight: "800" }}>
              Nuevo Evento
            </h3>
            <p style={{ margin: "0 0 16px 0", color: "#0047b3", fontSize: "13px", fontWeight: "600" }}>
              📅 {fechaModal.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            
            {/* SELECTOR DE TIPO */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button 
                type="button"
                onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'normal', titulo: ''})}
                style={{ 
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  border: nuevoEvento.tipo === 'normal' ? '2px solid #111827' : '1px solid #d1d5db',
                  cursor: 'pointer',
                  backgroundColor: nuevoEvento.tipo === 'normal' ? '#f3f4f6' : '#ffffff',
                  color: '#111827',
                  fontWeight: nuevoEvento.tipo === 'normal' ? '800' : '600',
                  fontSize: '13px'
                }}
              >
                🎈 Normal
              </button>
              <button 
                type="button"
                onClick={() => setNuevoEvento({...nuevoEvento, tipo: 'trabajo', titulo: 'Turno de Trabajo'})}
                style={{ 
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  border: nuevoEvento.tipo === 'trabajo' ? '2px solid #0070f3' : '1px solid #d1d5db',
                  cursor: 'pointer',
                  backgroundColor: nuevoEvento.tipo === 'trabajo' ? '#eff6ff' : '#ffffff',
                  color: '#0070f3', 
                  fontWeight: nuevoEvento.tipo === 'trabajo' ? '800' : '600',
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
              placeholder="Ej: Cena familiar, Consulta médica..."
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
            
            {nuevoEvento.tipo === 'normal' ? (
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

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
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
                  backgroundColor: "#0047b3",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "700",
                  fontSize: "13px",
                  boxShadow: "0 2px 4px rgba(0, 71, 179, 0.3)"
                }}
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
