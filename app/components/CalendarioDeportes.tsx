"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  fetchCarrerasF1, 
  fetchPartidosBarca, 
  EventoBarca, 
  EventoF1,
  EventoDeportivo 
} from '../data/eventosDeportivos';

type CategoriaFiltro = 'todos' | 'barca' | 'f1';

interface EventoAgenda {
  titulo: string;
  hora: string;
  horaFin?: string;
  tipo?: string;
  categoria?: string;
  creador?: string;
}

export default function CalendarioDeportes() {
  const [categoria, setCategoria] = useState<CategoriaFiltro>('todos');
  const [carrerasF1, setCarrerasF1] = useState<EventoF1[]>([]);
  const [partidosBarca, setPartidosBarca] = useState<EventoBarca[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorF1, setErrorF1] = useState<string | null>(null);
  const [errorBarca, setErrorBarca] = useState<string | null>(null);

  const [eventosAgenda, setEventosAgenda] = useState<Record<string, (EventoAgenda | string)[]>>({});
  const [mensajeToast, setMensajeToast] = useState<string | null>(null);

  // Carga inicial al montar el componente
  useEffect(() => {
    let cancelado = false;

    async function ejecutarCarga() {
      const [resF1, resBarca] = await Promise.allSettled([
        fetchCarrerasF1(),
        fetchPartidosBarca()
      ]);

      if (cancelado) return;

      if (resF1.status === 'fulfilled') {
        setCarrerasF1(resF1.value);
      } else {
        console.error("Error al obtener carreras F1:", resF1.reason);
        setErrorF1("No se pudo conectar con la API de Fórmula 1 en este momento.");
      }

      if (resBarca.status === 'fulfilled') {
        setPartidosBarca(resBarca.value);
      } else {
        console.error("Error al obtener partidos del Barça:", resBarca.reason);
        setErrorBarca("No se pudo conectar con la API del FC Barcelona en este momento.");
      }

      setCargando(false);
    }

    ejecutarCarga();

    return () => {
      cancelado = true;
    };
  }, []);

  // Función para recargar manualmente desde el botón
  const recargarManual = useCallback(async () => {
    setCargando(true);
    setErrorF1(null);
    setErrorBarca(null);

    const [resF1, resBarca] = await Promise.allSettled([
      fetchCarrerasF1(),
      fetchPartidosBarca()
    ]);

    if (resF1.status === 'fulfilled') {
      setCarrerasF1(resF1.value);
    } else {
      console.error("Error al obtener carreras F1:", resF1.reason);
      setErrorF1("No se pudo conectar con la API de Fórmula 1 en este momento.");
    }

    if (resBarca.status === 'fulfilled') {
      setPartidosBarca(resBarca.value);
    } else {
      console.error("Error al obtener partidos del Barça:", resBarca.reason);
      setErrorBarca("No se pudo conectar con la API del FC Barcelona en este momento.");
    }

    setCargando(false);
  }, []);

  // Escuchar la base de datos de Firebase en tiempo real
  useEffect(() => {
    const docRef = doc(db, "agenda", "datos");
    const cancelarSuscripcion = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setEventosAgenda(docSnap.data() as Record<string, (EventoAgenda | string)[]>);
      }
    });
    return () => cancelarSuscripcion();
  }, []);

  // Comprobar si un evento ya está en la agenda familiar usando la fechaClave
  const estaEnAgenda = (fechaClave: string, tituloBuscado: string): boolean => {
    const eventosDelDia = eventosAgenda[fechaClave] || [];
    return eventosDelDia.some((e) => {
      const tit = typeof e === 'string' ? e : e.titulo;
      return tit.toLowerCase().includes(tituloBuscado.toLowerCase());
    });
  };

  // Guardar en la agenda de Firebase
  const agregarAAgenda = async (
    fechaClave: string,
    titulo: string,
    hora: string,
    etiquetaNotif: string
  ) => {
    const notasDelDia = eventosAgenda[fechaClave] || [];

    const yaExiste = notasDelDia.some((e) => {
      const tit = typeof e === 'string' ? e : e.titulo;
      return tit === titulo;
    });

    if (yaExiste) {
      mostrarNotificacion(`"${titulo}" ya está en tu agenda.`);
      return;
    }

    const nuevoEvento: EventoAgenda = {
      titulo,
      hora: hora || "--:--",
      horaFin: "",
      tipo: "deporte",
      categoria: "Deportes",
      creador: ""
    };

    const nuevosEventos = {
      ...eventosAgenda,
      [fechaClave]: [...notasDelDia, nuevoEvento]
    };

    setEventosAgenda(nuevosEventos);

    try {
      await setDoc(doc(db, "agenda", "datos"), nuevosEventos);
      mostrarNotificacion(`✓ ${etiquetaNotif} añadido a la agenda familiar`);
    } catch (error) {
      console.error("Error al guardar en Firebase:", error);
      alert("No se pudo guardar el evento deportivo en la base de datos.");
    }
  };

  const mostrarNotificacion = (texto: string) => {
    setMensajeToast(texto);
    setTimeout(() => {
      setMensajeToast(null);
    }, 3500);
  };

  // Combinación y filtrado según pestaña seleccionada
  let eventosAMostrar: EventoDeportivo[] = [];
  if (categoria === 'todos') {
    const unificados: EventoDeportivo[] = [...carrerasF1, ...partidosBarca];
    unificados.sort((a, b) => a.timestampMs - b.timestampMs);
    eventosAMostrar = unificados.slice(0, 5);
  } else if (categoria === 'barca') {
    eventosAMostrar = partidosBarca;
  } else if (categoria === 'f1') {
    eventosAMostrar = carrerasF1;
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '460px',
      marginTop: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      color: '#111827'
    }}>
      {/* NOTIFICACIÓN TOAST FLOTANTE */}
      {mensajeToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: '30px',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid #334155'
        }}>
          <span>{mensajeToast}</span>
        </div>
      )}

      {/* SELECTOR DE CATEGORÍA / SUB-PESTAÑAS ESTILO SOFASCORE */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '6px',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        display: 'flex',
        gap: '6px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
      }}>
        <button
          onClick={() => setCategoria('todos')}
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: categoria === 'todos' ? 700 : 600,
            backgroundColor: categoria === 'todos' ? '#0047b3' : 'transparent',
            color: categoria === 'todos' ? '#ffffff' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <span>📅</span>
          <span>Todos</span>
        </button>

        <button
          onClick={() => setCategoria('barca')}
          style={{
            flex: 1.2,
            padding: '8px 10px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: categoria === 'barca' ? 700 : 600,
            backgroundColor: categoria === 'barca' ? '#a50044' : 'transparent',
            color: categoria === 'barca' ? '#ffffff' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <span>🔵🔴</span>
          <span>FC Barcelona</span>
        </button>

        <button
          onClick={() => setCategoria('f1')}
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: categoria === 'f1' ? 700 : 600,
            backgroundColor: categoria === 'f1' ? '#e10600' : 'transparent',
            color: categoria === 'f1' ? '#ffffff' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <span>🏎️</span>
          <span>Fórmula 1</span>
        </button>
      </div>

      {/* ENCABEZADO DE SECCIÓN CON BOTÓN DE RECARGA */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>⚡</span>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
            Próximos Eventos Oficiales
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={recargarManual}
            disabled={cargando}
            title="Actualizar datos en vivo"
            style={{
              padding: '4px 8px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#334155',
              cursor: cargando ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>{cargando ? '⏳' : '🔄'}</span>
            <span>{cargando ? 'Cargando' : 'Actualizar'}</span>
          </button>

          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#0047b3',
            backgroundColor: '#eff6ff',
            padding: '3px 8px',
            borderRadius: '12px',
            border: '1px solid #bfdbfe'
          }}>
            Hora España (CEST)
          </span>
        </div>
      </div>

      {/* ESTADO DE CARGA */}
      {cargando && (
        <div style={{
          backgroundColor: '#121824',
          borderRadius: '14px',
          padding: '32px 20px',
          textAlign: 'center',
          color: '#94a3b8',
          border: '1px solid #1f2937'
        }}>
          <div style={{ fontSize: '26px', marginBottom: '8px' }}>⏳</div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
            Consultando calendarios oficiales en vivo...
          </span>
          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            Sincronizando horarios con Jolpi F1 y TheSportsDB
          </p>
        </div>
      )}

      {/* ESTADO: LISTA VACÍA PARA FC BARCELONA */}
      {!cargando && categoria === 'barca' && partidosBarca.length === 0 && (
        <div style={{
          backgroundColor: '#121824',
          borderRadius: '14px',
          border: '1px solid #1f2937',
          padding: '24px 20px',
          textAlign: 'center',
          color: '#f8fafc'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔵🔴</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 800 }}>
            Sin partidos confirmados próximamente
          </h3>
          <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
            No se han encontrado partidos programados en la API oficial para el FC Barcelona. Esto suele ocurrir durante parones de selecciones nacionales, descanso de competición o fin de temporada.
          </p>
          {errorBarca && (
            <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#f87171' }}>
              ℹ️ {errorBarca}
            </p>
          )}
          <button
            onClick={recargarManual}
            style={{
              padding: '8px 16px',
              backgroundColor: '#a50044',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Reintentar consulta 🔄
          </button>
        </div>
      )}

      {/* ESTADO: LISTA VACÍA PARA F1 */}
      {!cargando && categoria === 'f1' && carrerasF1.length === 0 && (
        <div style={{
          backgroundColor: '#121824',
          borderRadius: '14px',
          border: '1px solid #1f2937',
          padding: '24px 20px',
          textAlign: 'center',
          color: '#f8fafc'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>🏎️</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 800 }}>
            Sin carreras pendientes en el calendario actual
          </h3>
          <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
            No hay más Grandes Premios programados para las fechas venideras en la temporada en curso de Fórmula 1.
          </p>
          {errorF1 && (
            <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#f87171' }}>
              ℹ️ {errorF1}
            </p>
          )}
          <button
            onClick={recargarManual}
            style={{
              padding: '8px 16px',
              backgroundColor: '#e10600',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Reintentar consulta 🔄
          </button>
        </div>
      )}

      {/* ESTADO: LISTA VACÍA EN "TODOS" */}
      {!cargando && categoria === 'todos' && eventosAMostrar.length === 0 && (
        <div style={{
          backgroundColor: '#121824',
          borderRadius: '14px',
          border: '1px solid #1f2937',
          padding: '24px 20px',
          textAlign: 'center',
          color: '#f8fafc'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>🏆</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 800 }}>
            No hay eventos deportivos próximos
          </h3>
          <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
            No se han registrado eventos inmediatos ni del FC Barcelona ni de Fórmula 1 en las APIs oficiales.
          </p>
          <button
            onClick={recargarManual}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0047b3',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Actualizar datos 🔄
          </button>
        </div>
      )}

      {/* LISTA DE TARJETAS ESTILO OSCURO SOFASCORE */}
      {!cargando && eventosAMostrar.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
          {eventosAMostrar.map((evento) => {
            if (evento.tipo === 'barca') {
              return (
                <TarjetaBarca
                  key={evento.id}
                  evento={evento}
                  estaEnAgenda={estaEnAgenda(evento.fechaClave, evento.rival)}
                  onAgregar={() => agregarAAgenda(
                    evento.fechaClave,
                    `⚽ Barça vs ${evento.rival} (${evento.competicion})`,
                    evento.hora,
                    `Barça vs ${evento.rival}`
                  )}
                />
              );
            }

            if (evento.tipo === 'f1') {
              return (
                <TarjetaF1
                  key={evento.id}
                  evento={evento}
                  carreraEnAgenda={estaEnAgenda(evento.carrera.fechaClave, `Carrera ${evento.granPremio}`)}
                  clasiEnAgenda={evento.clasificacion ? estaEnAgenda(evento.clasificacion.fechaClave, `Clasificación ${evento.granPremio}`) : false}
                  onAgregarCarrera={() => agregarAAgenda(
                    evento.carrera.fechaClave,
                    `🏎️ F1: Carrera ${evento.granPremio}`,
                    evento.carrera.hora,
                    `Carrera F1 (${evento.pais})`
                  )}
                  onAgregarClasi={() => {
                    if (evento.clasificacion) {
                      agregarAAgenda(
                        evento.clasificacion.fechaClave,
                        `⏱️ F1: Clasificación ${evento.granPremio}`,
                        evento.clasificacion.hora,
                        `Clasificación F1 (${evento.pais})`
                      );
                    }
                  }}
                />
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// TARJETA FC BARCELONA (ESTÉTICA OSCURA SOFASCORE)
// -------------------------------------------------------------
function TarjetaBarca({
  evento,
  estaEnAgenda,
  onAgregar
}: {
  evento: EventoBarca;
  estaEnAgenda: boolean;
  onAgregar: () => void;
}) {
  const esCasa = evento.condicion === 'casa';

  return (
    <div style={{
      backgroundColor: '#121824',
      borderRadius: '14px',
      border: '1px solid #1f2937',
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.16)',
      overflow: 'hidden',
      color: '#f8fafc'
    }}>
      {/* CABECERA DE LA TARJETA */}
      <div style={{
        padding: '10px 14px',
        backgroundColor: '#182030',
        borderBottom: '1px solid #242e42',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 800, color: '#38bdf8' }}>
            {evento.competicion}
          </span>
          <span style={{ color: '#64748b' }}>•</span>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>
            {evento.fechaTexto}
          </span>
        </div>

        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '4px',
          backgroundColor: esCasa ? 'rgba(56, 189, 248, 0.15)' : 'rgba(251, 146, 60, 0.15)',
          color: esCasa ? '#38bdf8' : '#fb923c',
          border: `1px solid ${esCasa ? 'rgba(56, 189, 248, 0.3)' : 'rgba(251, 146, 60, 0.3)'}`
        }}>
          {esCasa ? 'CASA 🏠' : 'FUERA ✈️'}
        </span>
      </div>

      {/* CUERPO DEL PARTIDO */}
      <div style={{ padding: '16px 14px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px'
        }}>
          {/* FC BARCELONA */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flex: 1
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #004d98 0%, #a50044 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 800,
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              border: '2px solid #ffffff'
            }}>
              ⚽
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                FC Barcelona
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {esCasa ? 'Local' : 'Visitante'}
              </span>
            </div>
          </div>

          {/* HORA / ESTADO ESTILO SOFASCORE */}
          <div style={{
            padding: '6px 12px',
            backgroundColor: '#0a0d14',
            borderRadius: '8px',
            border: '1px solid #232c3d',
            textAlign: 'center'
          }}>
            <span style={{ display: 'block', fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>
              {evento.hora}
            </span>
            <span style={{ fontSize: '10px', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700 }}>
              Hora ESP
            </span>
          </div>

          {/* RIVAL */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            flex: 1,
            textAlign: 'right'
          }}>
            <div>
              <span style={{ display: 'block', fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                {evento.rival}
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {!esCasa ? 'Local' : 'Visitante'}
              </span>
            </div>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              border: '1px solid #334155',
              overflow: 'hidden'
            }}>
              {evento.escudoRival ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={evento.escudoRival} 
                  alt={evento.rival} 
                  style={{ width: '28px', height: '28px', objectFit: 'contain' }}
                />
              ) : (
                '🛡️'
              )}
            </div>
          </div>
        </div>

        {/* ESTADIO */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: '#94a3b8',
          borderTop: '1px solid #1a2232',
          paddingTop: '10px',
          marginBottom: '14px'
        }}>
          <span>🏟️</span>
          <span>{evento.estadio}</span>
        </div>

        {/* BOTÓN AÑADIR A LA AGENDA */}
        <button
          onClick={onAgregar}
          disabled={estaEnAgenda}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            cursor: estaEnAgenda ? 'default' : 'pointer',
            fontWeight: 700,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: estaEnAgenda ? '#1e293b' : '#0047b3',
            color: estaEnAgenda ? '#10b981' : '#ffffff',
            boxShadow: estaEnAgenda ? 'none' : '0 3px 8px rgba(0, 71, 179, 0.4)',
            transition: 'all 0.15s ease'
          }}
          onMouseOver={(e) => {
            if (!estaEnAgenda) {
              e.currentTarget.style.backgroundColor = '#0258b8';
            }
          }}
          onMouseOut={(e) => {
            if (!estaEnAgenda) {
              e.currentTarget.style.backgroundColor = '#0047b3';
            }
          }}
        >
          {estaEnAgenda ? (
            <>
              <span>✓</span>
              <span>En la agenda familiar</span>
            </>
          ) : (
            <>
              <span>+</span>
              <span>Añadir a la agenda familiar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// TARJETA FÓRMULA 1 (ESTÉTICA OSCURA SOFASCORE)
// -------------------------------------------------------------
function TarjetaF1({
  evento,
  carreraEnAgenda,
  clasiEnAgenda,
  onAgregarCarrera,
  onAgregarClasi
}: {
  evento: EventoF1;
  carreraEnAgenda: boolean;
  clasiEnAgenda: boolean;
  onAgregarCarrera: () => void;
  onAgregarClasi: () => void;
}) {
  return (
    <div style={{
      backgroundColor: '#121824',
      borderRadius: '14px',
      border: '1px solid #1f2937',
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.16)',
      overflow: 'hidden',
      color: '#f8fafc'
    }}>
      {/* CABECERA F1 */}
      <div style={{
        padding: '10px 14px',
        backgroundColor: '#182030',
        borderBottom: '1px solid #242e42',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{evento.bandera}</span>
          <span style={{ fontWeight: 800, fontSize: '13px', color: '#ffffff' }}>
            {evento.granPremio}
          </span>
        </div>

        <span style={{
          fontSize: '11px',
          fontWeight: 800,
          color: '#e10600',
          backgroundColor: 'rgba(225, 6, 0, 0.15)',
          padding: '2px 8px',
          borderRadius: '4px',
          border: '1px solid rgba(225, 6, 0, 0.3)'
        }}>
          F1 🏎️
        </span>
      </div>

      <div style={{ padding: '16px 14px' }}>
        {/* CIRCUITO */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: '#94a3b8',
          marginBottom: '14px'
        }}>
          <span>📍</span>
          <span>{evento.circuito}</span>
        </div>

        {/* DESGLOSE CLASIFICACIÓN Y CARRERA */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          marginBottom: '14px'
        }}>
          {/* SESIÓN CLASIFICACIÓN (SI EXISTE) */}
          {evento.clasificacion ? (
            <div style={{
              backgroundColor: '#0a0d14',
              borderRadius: '10px',
              padding: '10px 12px',
              border: '1px solid #232c3d',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#f59e0b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  marginBottom: '4px'
                }}>
                  ⏱️ Clasificación
                </span>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#f1f5f9' }}>
                  {evento.clasificacion.fechaTexto}
                </span>
                <span style={{ display: 'block', fontSize: '14px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                  {evento.clasificacion.hora} ESP
                </span>
              </div>

              <button
                onClick={onAgregarClasi}
                disabled={clasiEnAgenda}
                style={{
                  marginTop: '10px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: clasiEnAgenda ? 'default' : 'pointer',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: clasiEnAgenda ? '#1e293b' : 'rgba(245, 158, 11, 0.2)',
                  color: clasiEnAgenda ? '#10b981' : '#f59e0b',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: clasiEnAgenda ? '#334155' : 'rgba(245, 158, 11, 0.4)'
                }}
              >
                {clasiEnAgenda ? '✓ En agenda' : '+ Añadir Clasi'}
              </button>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#0a0d14',
              borderRadius: '10px',
              padding: '10px 12px',
              border: '1px solid #232c3d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontSize: '12px'
            }}>
              <span>Clasificación por confirmar</span>
            </div>
          )}

          {/* CARRERA PRINCIPAL */}
          <div style={{
            backgroundColor: '#0a0d14',
            borderRadius: '10px',
            padding: '10px 12px',
            border: '1px solid #232c3d',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: '#e10600',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                marginBottom: '4px'
              }}>
                🏁 Carrera
              </span>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#f1f5f9' }}>
                {evento.carrera.fechaTexto}
              </span>
              <span style={{ display: 'block', fontSize: '14px', fontWeight: 800, color: '#e10600', marginTop: '2px' }}>
                {evento.carrera.hora} ESP
              </span>
            </div>

            <button
              onClick={onAgregarCarrera}
              disabled={carreraEnAgenda}
              style={{
                marginTop: '10px',
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                cursor: carreraEnAgenda ? 'default' : 'pointer',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: carreraEnAgenda ? '#1e293b' : '#e10600',
                color: carreraEnAgenda ? '#10b981' : '#ffffff'
              }}
            >
              {carreraEnAgenda ? '✓ En agenda' : '+ Añadir Carrera'}
            </button>
          </div>
        </div>

        {/* BOTÓN GENERAL PARA AÑADIR A LA AGENDA */}
        <button
          onClick={onAgregarCarrera}
          disabled={carreraEnAgenda}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            cursor: carreraEnAgenda ? 'default' : 'pointer',
            fontWeight: 700,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: carreraEnAgenda ? '#1e293b' : '#0047b3',
            color: carreraEnAgenda ? '#10b981' : '#ffffff',
            boxShadow: carreraEnAgenda ? 'none' : '0 3px 8px rgba(0, 71, 179, 0.4)',
            transition: 'all 0.15s ease'
          }}
          onMouseOver={(e) => {
            if (!carreraEnAgenda) {
              e.currentTarget.style.backgroundColor = '#0258b8';
            }
          }}
          onMouseOut={(e) => {
            if (!carreraEnAgenda) {
              e.currentTarget.style.backgroundColor = '#0047b3';
            }
          }}
        >
          {carreraEnAgenda ? (
            <>
              <span>✓</span>
              <span>Carrera en la agenda familiar</span>
            </>
          ) : (
            <>
              <span>+</span>
              <span>Añadir a la agenda familiar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
