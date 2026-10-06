"use client";
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  MENU_OCTUBRE_2026, 
  sincronizarMenuOctubreFirestore 
} from '../data/menuOctubre2026';

export interface MenuDia {
  fecha: string; // Formato YYYY-MM-DD
  primerPlato: string;
  segundoPlato: string;
  postre: string;
  observaciones?: string;
  actualizadoPor?: string;
  actualizadoEl?: string;
}

const MAPA_MENU_OCTUBRE = MENU_OCTUBRE_2026.reduce((acc, item) => {
  acc[item.fecha] = item;
  return acc;
}, {} as Record<string, MenuDia>);

interface MenuEscolarAlmaProps {
  usuario?: { email?: string | null } | null;
  fechaSeleccionada?: Date;
  onFechaChange?: (fecha: Date) => void;
}

const DIAS_SEMANA_LABORALES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes'
];

const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

// Helper para convertir una fecha a formato YYYY-MM-DD local
export const formatearFechaISO = (d: Date): string => {
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

// Helper para obtener el lunes de la semana a la que pertenece una fecha
export const obtenerLunes = (d: Date): Date => {
  const fecha = new Date(d);
  const dia = fecha.getDay(); // 0: Domingo, 1: Lunes, ..., 6: Sábado
  const diff = dia === 0 ? -6 : 1 - dia;
  fecha.setDate(fecha.getDate() + diff);
  fecha.setHours(0, 0, 0, 0);
  return fecha;
};

export default function MenuEscolarAlma({
  usuario,
  fechaSeleccionada,
  onFechaChange
}: MenuEscolarAlmaProps) {
  // Sincronización con la fecha seleccionada activa
  const [fechaInterna, setFechaInterna] = useState<Date>(new Date());
  const fechaReferencia = fechaSeleccionada || fechaInterna;

  const [menus, setMenus] = useState<Record<string, MenuDia>>({});
  const [cargando, setCargando] = useState<boolean>(true);

  // Estado del modal de creación/edición
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);
  const [diaModal, setDiaModal] = useState<Date | null>(null);
  const [primerPlato, setPrimerPlato] = useState<string>('');
  const [segundoPlato, setSegundoPlato] = useState<string>('');
  const [postre, setPostre] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [guardando, setGuardando] = useState<boolean>(false);
  const [mensajeToast, setMensajeToast] = useState<string | null>(null);
  const [sincronizandoOctubre, setSincronizandoOctubre] = useState<boolean>(false);

  // Sincronización automática de octubre 2026 en Firestore al iniciar sesión
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const yaSincronizado = localStorage.getItem('menu_octubre_2026_sincronizado_v1_3_0');
    if (!yaSincronizado && usuario?.email) {
      sincronizarMenuOctubreFirestore(db, usuario.email).then((res) => {
        if (res.exito) {
          localStorage.setItem('menu_octubre_2026_sincronizado_v1_3_0', 'true');
          mostrarNotificacion(`✓ ${res.total} menús de octubre sincronizados en Firestore`);
        }
      });
    }
  }, [usuario?.email]);

  const manejarSincronizarOctubre = async () => {
    setSincronizandoOctubre(true);
    try {
      const email = usuario?.email || 'admin@planificador';
      const res = await sincronizarMenuOctubreFirestore(db, email);
      if (res.exito) {
        localStorage.setItem('menu_octubre_2026_sincronizado_v1_3_0', 'true');
        mostrarNotificacion(`✓ ${res.total} menús escolares de octubre cargados en Firestore`);
      } else {
        alert("Hubo un error al guardar los menús en Firestore.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al sincronizar el menú de octubre.");
    } finally {
      setSincronizandoOctubre(false);
    }
  };

  // Suscripción en tiempo real a la colección aislada en Firestore: 'menu_escolar_alma'
  useEffect(() => {
    const colRef = collection(db, "menu_escolar_alma");
    const cancelarSuscripcion = onSnapshot(colRef, (snapshot) => {
      const datos: Record<string, MenuDia> = {};
      snapshot.forEach((docSnap) => {
        datos[docSnap.id] = docSnap.data() as MenuDia;
      });
      setMenus(datos);
      setCargando(false);
    }, (error) => {
      console.error("Error al cargar menús escolares:", error);
      setCargando(false);
    });

    return () => cancelarSuscripcion();
  }, []);

  const lunesSemana = obtenerLunes(fechaReferencia);

  // Generar los 5 días lectivos de lunes a viernes
  const diasLaborales = Array.from({ length: 5 }, (_, i) => {
    const dia = new Date(lunesSemana);
    dia.setDate(lunesSemana.getDate() + i);
    return dia;
  });

  const viernesSemana = diasLaborales[4];
  const rangoTexto = `${lunesSemana.getDate()} ${MESES[lunesSemana.getMonth()]} - ${viernesSemana.getDate()} ${MESES[viernesSemana.getMonth()]} ${viernesSemana.getFullYear()}`;

  const hoy = new Date();
  const hoyISO = formatearFechaISO(hoy);

  const cambiarSemana = (offsetDias: number) => {
    const nuevaFecha = new Date(fechaReferencia);
    nuevaFecha.setDate(nuevaFecha.getDate() + offsetDias);
    setFechaInterna(nuevaFecha);
    if (onFechaChange) {
      onFechaChange(nuevaFecha);
    }
  };

  const irAHoy = () => {
    const hoyActual = new Date();
    setFechaInterna(hoyActual);
    if (onFechaChange) {
      onFechaChange(hoyActual);
    }
  };

  const mostrarNotificacion = (texto: string) => {
    setMensajeToast(texto);
    setTimeout(() => {
      setMensajeToast(null);
    }, 3200);
  };

  // Abrir modal para crear o editar
  const abrirModalParaDia = (dia: Date) => {
    setDiaModal(dia);
    const iso = formatearFechaISO(dia);
    const menuExistente = menus[iso] || MAPA_MENU_OCTUBRE[iso];

    if (menuExistente) {
      setPrimerPlato(menuExistente.primerPlato || '');
      setSegundoPlato(menuExistente.segundoPlato || '');
      setPostre(menuExistente.postre || '');
      setObservaciones(menuExistente.observaciones || '');
    } else {
      setPrimerPlato('');
      setSegundoPlato('');
      setPostre('');
      setObservaciones('');
    }

    setModalAbierto(true);
  };

  // Guardar menú en Firestore (en ambas colecciones: 'menu_escolar' y 'menu_escolar_alma')
  const guardarMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diaModal) return;

    if (!primerPlato.trim() && !segundoPlato.trim() && !postre.trim()) {
      alert("Por favor, rellena al menos uno de los platos del menú.");
      return;
    }

    const iso = formatearFechaISO(diaModal);
    setGuardando(true);

    try {
      const docRefAlma = doc(db, "menu_escolar_alma", iso);
      const docRefEscolar = doc(db, "menu_escolar", iso);
      const datosAGuardar: MenuDia = {
        fecha: iso,
        primerPlato: primerPlato.trim(),
        segundoPlato: segundoPlato.trim(),
        postre: postre.trim(),
        observaciones: observaciones.trim(),
        actualizadoPor: usuario?.email || 'desconocido',
        actualizadoEl: new Date().toISOString()
      };

      await Promise.all([
        setDoc(docRefAlma, datosAGuardar),
        setDoc(docRefEscolar, datosAGuardar)
      ]);
      setModalAbierto(false);
      mostrarNotificacion("✓ Menú escolar guardado con éxito");
    } catch (error) {
      console.error("Error al guardar el menú escolar:", error);
      alert("Hubo un error al guardar el menú en la base de datos.");
    } finally {
      setGuardando(false);
    }
  };

  // Eliminar menú de un día (en ambas colecciones)
  const eliminarMenu = async (iso: string) => {
    if (!confirm("¿Deseas eliminar el menú escolar de este día?")) {
      return;
    }

    try {
      await Promise.all([
        deleteDoc(doc(db, "menu_escolar_alma", iso)),
        deleteDoc(doc(db, "menu_escolar", iso))
      ]);
      if (modalAbierto) {
        setModalAbierto(false);
      }
      mostrarNotificacion("✓ Menú escolar eliminado");
    } catch (error) {
      console.error("Error al eliminar menú escolar:", error);
      alert("No se pudo eliminar el menú.");
    }
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '460px',
      marginTop: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
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

      {/* ENCABEZADO SOFASCORE: TÍTULO Y DESCRIPCIÓN */}
      <div style={{
        background: 'linear-gradient(135deg, #0047b3 0%, #0258b8 100%)',
        borderRadius: '14px',
        padding: '16px',
        color: '#ffffff',
        boxShadow: '0 4px 12px rgba(0, 71, 179, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px'
          }}>
            🍴
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px' }}>
              Menú Escolar de Alma
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', opacity: 0.85 }}>
              Institut Escola Castellterçol • Octubre 2026
            </p>
          </div>
        </div>

        <button
          onClick={manejarSincronizarOctubre}
          disabled={sincronizandoOctubre}
          title="Sincronizar los 22 días lectivos de octubre de Alma en Firestore (menu_escolar y menu_escolar_alma)"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '8px',
            padding: '7px 12px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
        >
          {sincronizandoOctubre ? '⏳ Guardando...' : '📥 Guardar en Firestore'}
        </button>
      </div>

      {/* BARRA DE NAVEGACIÓN SEMANAL (LUNES A VIERNES) */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '10px 14px',
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

        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#111827' }}>
            {rangoTexto}
          </span>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
            Semana escolar
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={irAHoy}
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

      {/* LISTA DE LOS 5 DÍAS LECTIVOS (LUNES A VIERNES) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
        {cargando ? (
          <div style={{
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '13px'
          }}>
            Cargando menú escolar...
          </div>
        ) : (
          diasLaborales.map((dia, idx) => {
            const iso = formatearFechaISO(dia);
            const esHoy = iso === hoyISO;
            const menuDelDia = menus[iso] || MAPA_MENU_OCTUBRE[iso];
            const tieneMenu = Boolean(menuDelDia && (menuDelDia.primerPlato || menuDelDia.segundoPlato || menuDelDia.postre));

            return (
              <div
                key={iso}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: esHoy ? '2px solid #0047b3' : '1px solid #e5e7eb',
                  boxShadow: esHoy ? '0 4px 12px rgba(0, 71, 179, 0.1)' : '0 2px 4px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* CABECERA DE LA TARJETA DEL DÍA */}
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: esHoy ? '#f0f7ff' : '#f8fafc',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontWeight: 800,
                      fontSize: '14px',
                      color: esHoy ? '#0047b3' : '#111827'
                    }}>
                      {DIAS_SEMANA_LABORALES[idx]}
                    </span>
                    <span style={{
                      fontSize: '13px',
                      color: '#64748b',
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {tieneMenu && (
                      <button
                        onClick={() => eliminarMenu(iso)}
                        title="Eliminar menú"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        🗑️
                      </button>
                    )}

                    <button
                      onClick={() => abrirModalParaDia(dia)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: 700,
                        backgroundColor: tieneMenu ? '#eff6ff' : '#0047b3',
                        color: tieneMenu ? '#0047b3' : '#ffffff',
                        border: tieneMenu ? '1px solid #bfdbfe' : 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {tieneMenu ? '✏️ Editar' : '+ Añadir Menú'}
                    </button>
                  </div>
                </div>

                {/* CONTENIDO DEL MENÚ */}
                <div style={{ padding: '14px' }}>
                  {tieneMenu ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* 1º PLATO */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '6px 8px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #f1f5f9'
                      }}>
                        <span style={{ fontSize: '15px' }}>🥣</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7' }}>
                            1º Primer plato
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                            {menuDelDia?.primerPlato || '—'}
                          </span>
                        </div>
                      </div>

                      {/* 2º PLATO */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '6px 8px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #f1f5f9'
                      }}>
                        <span style={{ fontSize: '15px' }}>🍗</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#d97706' }}>
                            2º Segundo plato
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                            {menuDelDia?.segundoPlato || '—'}
                          </span>
                        </div>
                      </div>

                      {/* POSTRE */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '6px 8px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #f1f5f9'
                      }}>
                        <span style={{ fontSize: '15px' }}>🍏</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>
                            Postre
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                            {menuDelDia?.postre || '—'}
                          </span>
                        </div>
                      </div>

                      {/* OBSERVACIONES / NOTAS (SI EXISTEN) */}
                      {menuDelDia?.observaciones && (
                        <div style={{
                          marginTop: '2px',
                          padding: '6px 10px',
                          backgroundColor: '#fefce8',
                          border: '1px solid #fef08a',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#854d0e',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span>📝</span>
                          <span><strong>Nota:</strong> {menuDelDia.observaciones}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      padding: '16px 8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      color: '#94a3b8'
                    }}>
                      <span style={{ fontSize: '24px', opacity: 0.6 }}>🍽️</span>
                      <span style={{ fontSize: '12px', fontStyle: 'italic' }}>
                        Sin menú escolar registrado
                      </span>
                      <button
                        onClick={() => abrirModalParaDia(dia)}
                        style={{
                          marginTop: '4px',
                          padding: '6px 12px',
                          backgroundColor: '#f8fafc',
                          color: '#0047b3',
                          border: '1px dashed #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        + Registrar platos
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL EMERGENTE DE CREACIÓN Y EDICIÓN */}
      {modalAbierto && diaModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            color: '#111827',
            padding: '24px',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '430px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e5e7eb'
          }}>
            {/* CABECERA DEL MODAL */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '18px',
              borderBottom: '1px solid #f1f5f9',
              paddingBottom: '12px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111827' }}>
                  🥣 Menú Escolar - Alma
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  {DIAS_SEMANA_LABORALES[diaModal.getDay() === 0 ? 4 : diaModal.getDay() - 1]}, {diaModal.getDate()} de {MESES[diaModal.getMonth()]} de {diaModal.getFullYear()}
                </p>
              </div>

              <button
                onClick={() => setModalAbierto(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '2px 6px'
                }}
              >
                ✕
              </button>
            </div>

            {/* FORMULARIO DE PLATOS */}
            <form onSubmit={guardarMenu} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 1º PLATO */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: '#0369a1' }}>
                  🥣 1º Primer plato
                </label>
                <input
                  type="text"
                  placeholder="Ej: Puré de calabacín con picatostes"
                  value={primerPlato}
                  onChange={(e) => setPrimerPlato(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    color: '#111827',
                    backgroundColor: '#ffffff'
                  }}
                  autoFocus
                />
              </div>

              {/* 2º PLATO */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: '#b45309' }}>
                  🍗 2º Segundo plato
                </label>
                <input
                  type="text"
                  placeholder="Ej: Pechuga de pollo con patatas"
                  value={segundoPlato}
                  onChange={(e) => setSegundoPlato(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    color: '#111827',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              {/* POSTRE */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: '#15803d' }}>
                  🍏 Postre
                </label>
                <input
                  type="text"
                  placeholder="Ej: Manzana de temporada / Yogur"
                  value={postre}
                  onChange={(e) => setPostre(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    color: '#111827',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              {/* OBSERVACIONES */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: '#4b5563' }}>
                  📝 Observaciones / Notas (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Traer servilleta / Celebración cumpleaños..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    color: '#111827',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '8px',
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9'
              }}>
                <div>
                  {menus[formatearFechaISO(diaModal)] && (
                    <button
                      type="button"
                      onClick={() => eliminarMenu(formatearFechaISO(diaModal))}
                      style={{
                        padding: '9px 12px',
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setModalAbierto(false)}
                    style={{
                      padding: '9px 14px',
                      backgroundColor: '#f3f4f6',
                      color: '#4b5563',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={guardando}
                    style={{
                      padding: '9px 18px',
                      backgroundColor: guardando ? '#93c5fd' : '#0047b3',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: guardando ? 'default' : 'pointer',
                      boxShadow: '0 2px 4px rgba(0, 71, 179, 0.2)'
                    }}
                  >
                    {guardando ? 'Guardando...' : 'Guardar Menú'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
