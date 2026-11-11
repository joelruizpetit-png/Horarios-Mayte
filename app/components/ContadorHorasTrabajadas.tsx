"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export interface EventoTurno {
  titulo: string;
  hora?: string;
  horaFin?: string;
  tipo?: string;
  categoria?: string;
  creador?: string;
  googleCalendarEventId?: string;
  esGoogleCalendar?: boolean;
}

interface TurnoDetallado {
  id: string;
  diaSemana: string;
  diaNumero: number;
  mesNombre: string;
  fechaISO: string;
  titulo: string;
  horaInicio: string;
  horaFin: string;
  horas: number;
  creador: 'J' | 'A' | 'N';
  esCondis: boolean;
}

interface ContadorHorasTrabajadasProps {
  usuario?: {
    email?: string | null;
    displayName?: string | null;
  } | null;
  onIrAPlanificador?: () => void;
}

const DIAS_SEMANA_NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const PRECIO_HORA_NATALIA = 10; // 10€ por hora
const STORAGE_KEY_PAGOS_NATALIA = 'planificador_pagos_natalia_v1';

/**
 * Calcula la diferencia en horas decimales entre hora inicio y hora fin (formato HH:mm).
 * Maneja adecuadamente turnos nocturnos que cruzan la medianoche (ej. 22:00 a 06:00).
 */
export function calcularDiferenciaHoras(horaInicioStr?: string, horaFinStr?: string): number {
  if (!horaInicioStr || !horaFinStr) return 0;
  const matchInicio = horaInicioStr.match(/(\d{1,2}):(\d{2})/);
  const matchFin = horaFinStr.match(/(\d{1,2}):(\d{2})/);
  if (!matchInicio || !matchFin) return 0;

  const hIni = parseInt(matchInicio[1], 10);
  const mIni = parseInt(matchInicio[2], 10);
  const hFin = parseInt(matchFin[1], 10);
  const mFin = parseInt(matchFin[2], 10);

  const minInicio = hIni * 60 + mIni;
  let minFin = hFin * 60 + mFin;

  // Turno nocturno que cruza medianoche (ej. 22:00 a 06:00)
  if (minFin < minInicio) {
    minFin += 24 * 60;
  }

  const diffMin = minFin - minInicio;
  if (diffMin <= 0) return 0;

  return Math.round((diffMin / 60) * 100) / 100;
}

/**
 * Formatea horas decimales a formato legible "Xh Ym" y decimal (ej. 7.5 -> "7h 30m").
 */
export function formatearHorasYMinutos(horasDecimales: number): { texto: string; decimal: string } {
  if (horasDecimales <= 0) {
    return { texto: "0h", decimal: "0.0 h" };
  }

  const totalMinutos = Math.round(horasDecimales * 60);
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;

  let texto = `${h}h`;
  if (m > 0) {
    texto = `${h}h ${m}m`;
  }

  return {
    texto,
    decimal: `${horasDecimales.toFixed(1)} h`
  };
}

/**
 * Obtiene el Lunes de la semana que contiene a la fecha dada.
 */
export function obtenerLunesSemana(fecha: Date): Date {
  const d = new Date(fecha);
  const diaSemana = d.getDay(); // 0 es Domingo, 1 es Lunes
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Extrae horario de inicio y fin desde un evento (objeto o cadena de texto).
 */
function extraerHorarioTurno(evento: unknown): { inicio: string; fin: string; horas: number } | null {
  let inicio = '';
  let fin = '';

  if (typeof evento === 'string') {
    const match = evento.match(/(\d{1,2}:\d{2})\s*(?:-|–|a|hasta)\s*(\d{1,2}:\d{2})/i);
    if (match) {
      inicio = match[1];
      fin = match[2];
    }
  } else if (evento && typeof evento === 'object') {
    const ev = evento as EventoTurno;
    if (ev.hora && ev.hora !== '--:--' && ev.horaFin && ev.horaFin !== '--:--') {
      inicio = ev.hora;
      fin = ev.horaFin;
    } else {
      const texto = `${ev.titulo || ''} ${ev.hora || ''}`;
      const match = texto.match(/(\d{1,2}:\d{2})\s*(?:-|–|a|hasta)\s*(\d{1,2}:\d{2})/i);
      if (match) {
        inicio = match[1];
        fin = match[2];
      }
    }
  }

  if (!inicio || !fin) return null;

  const horas = calcularDiferenciaHoras(inicio, fin);
  if (horas <= 0) return null;

  return { inicio, fin, horas };
}

/**
 * Comprueba si un evento corresponde a trabajo, turno laboral o evento de Natalia.
 */
function esEventoDeTrabajo(evento: unknown): boolean {
  if (!evento) return false;
  if (typeof evento === 'string') {
    return /turno|trabajo|condis|biba|natalia/i.test(evento);
  }

  const ev = evento as EventoTurno;
  if (ev.tipo === 'deporte' || ev.categoria === 'Deportes') return false;

  const tit = (ev.titulo || '').toLowerCase();
  const coincideTitulo = /turno|trabajo|condis|biba|natalia/i.test(tit);
  const coincideTipo =
    ev.tipo === 'trabajo' ||
    ev.tipo === 'natalia' ||
    ev.categoria === 'trabajo' ||
    ev.categoria === 'laboral' ||
    ev.categoria === 'natalia';
  const tieneRangoFin = Boolean(ev.hora && ev.hora !== '--:--' && ev.horaFin && ev.horaFin !== '--:--');

  return coincideTipo || coincideTitulo || tieneRangoFin;
}

/**
 * Determina el creador asignado al turno ('J' para Joel, 'A' para Ana, 'N' para Natalia).
 */
function determinarCreadorTurno(evento: unknown): 'J' | 'A' | 'N' {
  if (typeof evento === 'string') {
    const s = evento.toLowerCase();
    if (s.includes('natalia') || s.startsWith('n:')) return 'N';
    if (s.includes('ana') || s.startsWith('a:')) return 'A';
    return 'J';
  }

  const ev = evento as EventoTurno;
  const tipo = (ev.tipo || '').toLowerCase().trim();
  const categoria = (ev.categoria || '').toLowerCase().trim();
  const creador = (ev.creador || '').toUpperCase().trim();
  const tit = (ev.titulo || '').toLowerCase().trim();

  if (
    tipo === 'natalia' ||
    categoria === 'natalia' ||
    creador === 'N' ||
    creador === 'NATALIA' ||
    tit.includes('natalia') ||
    tit.startsWith('n:')
  ) {
    return 'N';
  }
  if (creador === 'A' || creador === 'ANA') return 'A';
  if (creador === 'J' || creador === 'JOEL') return 'J';

  if (tit.includes('ana') || tit.startsWith('a:')) return 'A';
  if (tit.includes('joel') || tit.startsWith('j:')) return 'J';

  // Por defecto en el planificador familiar, los turnos pertenecen a Joel
  return 'J';
}

// ─── Agrupación por día ───────────────────────────────────────────────────────
interface GrupoDia {
  fechaKey: string;          // YYYY-MM-DD (clave de orden)
  etiqueta: string;          // ej. "Miércoles 14 Oct"
  totalHoras: number;
  turnos: TurnoDetallado[];
}

function agruparPorDia(lista: TurnoDetallado[]): GrupoDia[] {
  const mapa = new Map<string, GrupoDia>();
  for (const t of lista) {
    const key = t.fechaISO;
    if (!mapa.has(key)) {
      mapa.set(key, {
        fechaKey: key,
        etiqueta: `${t.diaSemana} ${t.diaNumero} ${t.mesNombre}`,
        totalHoras: 0,
        turnos: []
      });
    }
    const g = mapa.get(key)!;
    g.turnos.push(t);
    g.totalHoras = Math.round((g.totalHoras + t.horas) * 100) / 100;
  }
  // Ordenar cronológicamente
  return Array.from(mapa.values()).sort((a, b) => a.fechaKey.localeCompare(b.fechaKey));
}

export default function ContadorHorasTrabajadas({ onIrAPlanificador }: ContadorHorasTrabajadasProps) {
  const [fechaReferencia, setFechaReferencia] = useState<Date>(new Date());
  const [personaActiva, setPersonaActiva] = useState<'joel' | 'ana' | 'natalia'>('joel');
  const [eventos, setEventos] = useState<Record<string, unknown[]>>({});
  const [cargando, setCargando] = useState<boolean>(true);

  // Estados para el modal de Resumen mensual de Natalia
  const [mostrarResumenNatalia, setMostrarResumenNatalia] = useState<boolean>(false);
  const [mesResumenNatalia, setMesResumenNatalia] = useState<Date>(() => {
    const ahora = new Date();
    return new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  });
  const [pagosNataliaPorMes, setPagosNataliaPorMes] = useState<Record<string, number>>({});
  const [abonoAdicionalInput, setAbonoAdicionalInput] = useState<string>('');

  // Cargar y sincronizar pagos de Natalia (localStorage + Firestore)
  useEffect(() => {
    try {
      const guardadoLocal = localStorage.getItem(STORAGE_KEY_PAGOS_NATALIA);
      if (guardadoLocal) {
        const parsed = JSON.parse(guardadoLocal);
        if (parsed && typeof parsed === 'object') {
          setPagosNataliaPorMes(parsed);
        }
      }
    } catch (e) {
      console.error("Error leyendo pagos de Natalia en localStorage:", e);
    }

    const docPagosRef = doc(db, "configuracion", "pagos_natalia");
    const cancelarPagos = onSnapshot(
      docPagosRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          const limpios: Record<string, number> = {};
          Object.entries(data).forEach(([k, v]) => {
            const num = typeof v === 'number' ? v : parseFloat(String(v));
            if (!isNaN(num) && num >= 0) {
              limpios[k] = Math.round(num * 100) / 100;
            }
          });
          setPagosNataliaPorMes(limpios);
          try {
            localStorage.setItem(STORAGE_KEY_PAGOS_NATALIA, JSON.stringify(limpios));
          } catch {
            // Ignorar error de almacenamiento local
          }
        }
      },
      (err) => {
        console.error("Error sincronizando pagos de Natalia:", err);
      }
    );

    return () => cancelarPagos();
  }, []);

  const guardarCantidadPagadaMes = async (claveMes: string, nuevaCantidad: number) => {
    const valorSeguro = Math.max(0, Math.round((isNaN(nuevaCantidad) ? 0 : nuevaCantidad) * 100) / 100);
    const actualizado = {
      ...pagosNataliaPorMes,
      [claveMes]: valorSeguro
    };
    setPagosNataliaPorMes(actualizado);
    try {
      localStorage.setItem(STORAGE_KEY_PAGOS_NATALIA, JSON.stringify(actualizado));
    } catch {
      // Ignorar error local
    }
    try {
      await setDoc(doc(db, "configuracion", "pagos_natalia"), { [claveMes]: valorSeguro }, { merge: true });
    } catch (err) {
      console.error("Error guardando pago de Natalia en Firestore:", err);
    }
  };

  // 4. REACTIVIDAD EN TIEMPO REAL: Suscripción a Firestore (doc "agenda/datos")
  useEffect(() => {
    const docRef = doc(db, "agenda", "datos");
    const cancelarSuscripcion = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setEventos(docSnap.data() as Record<string, unknown[]>);
        }
        setCargando(false);
      },
      (error) => {
        console.error("Error al escuchar cambios en agenda:", error);
        setCargando(false);
      }
    );

    return () => cancelarSuscripcion();
  }, []);

  // Lunes y Domingo de la semana activa
  const lunesSemana = useMemo(() => obtenerLunesSemana(fechaReferencia), [fechaReferencia]);
  const domingoSemana = useMemo(() => {
    const d = new Date(lunesSemana);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [lunesSemana]);

  // Generar los 7 días de la semana (Lunes a Domingo)
  const diasDeLaSemana = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunesSemana);
      d.setDate(lunesSemana.getDate() + i);
      return d;
    });
  }, [lunesSemana]);

  // Comprobar si la semana actual del sistema es la que está seleccionada
  const esSemanaActual = useMemo(() => {
    const hoy = new Date();
    return hoy >= lunesSemana && hoy <= domingoSemana;
  }, [lunesSemana, domingoSemana]);

  // Navegación semanal
  const cambiarSemana = (diasOffset: number) => {
    const nueva = new Date(fechaReferencia);
    nueva.setDate(nueva.getDate() + diasOffset);
    setFechaReferencia(nueva);
  };

  const irASemanaActual = () => {
    setFechaReferencia(new Date());
  };

  // 2. CÁLCULO DE HORAS SEMANALES EN TIEMPO REAL:
  // Filtra los turnos de la semana y los separa por creador (Joel vs Ana vs Natalia)
  const { turnosJoel, turnosAna, turnosNatalia, totalHorasJoel, totalHorasAna, totalHorasNatalia } = useMemo(() => {
    const jList: TurnoDetallado[] = [];
    const aList: TurnoDetallado[] = [];
    const nList: TurnoDetallado[] = [];
    let jTotal = 0;
    let aTotal = 0;
    let nTotal = 0;

    diasDeLaSemana.forEach((dia, idx) => {
      const claveDateString = dia.toDateString(); // Ej: "Mon Oct 12 2026"
      const y = dia.getFullYear();
      const m = String(dia.getMonth() + 1).padStart(2, '0');
      const dNum = String(dia.getDate()).padStart(2, '0');
      const claveISO = `${y}-${m}-${dNum}`;

      // Comprobar eventos almacenados bajo toDateString() o YYYY-MM-DD
      const listaDia = [
        ...(eventos[claveDateString] || []),
        ...(eventos[claveISO] || [])
      ];

      listaDia.forEach((ev, evIdx) => {
        if (!esEventoDeTrabajo(ev)) return;

        const infoHorario = extraerHorarioTurno(ev);
        if (!infoHorario) return;

        const creador = determinarCreadorTurno(ev);
        const tituloTexto = typeof ev === 'string'
          ? ev
          : ((ev as EventoTurno).titulo?.trim() || (creador === 'N' ? 'Natalia' : 'Turno de trabajo'));

        const esCondis = creador === 'J';

        const item: TurnoDetallado = {
          id: `${claveDateString}-${evIdx}`,
          diaSemana: DIAS_SEMANA_NOMBRES[idx],
          diaNumero: dia.getDate(),
          mesNombre: MESES_CORTOS[dia.getMonth()],
          fechaISO: claveISO,
          titulo: tituloTexto,
          horaInicio: infoHorario.inicio,
          horaFin: infoHorario.fin,
          horas: infoHorario.horas,
          creador,
          esCondis
        };

        if (creador === 'J') {
          jList.push(item);
          jTotal += infoHorario.horas;
        } else if (creador === 'A') {
          aList.push(item);
          aTotal += infoHorario.horas;
        } else if (creador === 'N') {
          nList.push(item);
          nTotal += infoHorario.horas;
        }
      });
    });

    return {
      turnosJoel: jList,
      turnosAna: aList,
      turnosNatalia: nList,
      totalHorasJoel: Math.round(jTotal * 100) / 100,
      totalHorasAna: Math.round(aTotal * 100) / 100,
      totalHorasNatalia: Math.round(nTotal * 100) / 100
    };
  }, [diasDeLaSemana, eventos]);

  const horasJoelFmt = formatearHorasYMinutos(totalHorasJoel);
  const horasAnaFmt = formatearHorasYMinutos(totalHorasAna);
  const horasNataliaFmt = formatearHorasYMinutos(totalHorasNatalia);

  // Cálculo del Resumen Mensual de Natalia (10€ / hora)
  const resumenMensualNatalia = useMemo(() => {
    const anio = mesResumenNatalia.getFullYear();
    const mes = mesResumenNatalia.getMonth();
    const claveMes = `${anio}-${String(mes + 1).padStart(2, '0')}`;
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();

    let horasAcumuladasMes = 0;
    let totalTurnosMes = 0;

    for (let d = 1; d <= diasEnMes; d++) {
      const fechaDia = new Date(anio, mes, d);
      const claveDateString = fechaDia.toDateString();
      const claveISO = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const listaDia = [
        ...(eventos[claveDateString] || []),
        ...(eventos[claveISO] || [])
      ];

      listaDia.forEach((ev) => {
        if (!esEventoDeTrabajo(ev)) return;
        const creador = determinarCreadorTurno(ev);
        if (creador !== 'N') return;
        const infoHorario = extraerHorarioTurno(ev);
        if (!infoHorario) return;

        horasAcumuladasMes += infoHorario.horas;
        totalTurnosMes += 1;
      });
    }

    horasAcumuladasMes = Math.round(horasAcumuladasMes * 100) / 100;
    const importeTotalGenerado = Math.round(horasAcumuladasMes * PRECIO_HORA_NATALIA * 100) / 100;
    const cantidadPagada = Math.round((pagosNataliaPorMes[claveMes] || 0) * 100) / 100;
    const horasPagadas = Math.round((cantidadPagada / PRECIO_HORA_NATALIA) * 100) / 100;
    const horasPendientes = Math.max(0, Math.round((horasAcumuladasMes - horasPagadas) * 100) / 100);
    const importePendienteAPagar = Math.max(0, Math.round((importeTotalGenerado - cantidadPagada) * 100) / 100);

    return {
      claveMes,
      nombreMesAnio: `${MESES_LARGOS[mes]} ${anio}`,
      horasAcumuladasMes,
      horasAcumuladasFmt: formatearHorasYMinutos(horasAcumuladasMes),
      totalTurnosMes,
      importeTotalGenerado,
      cantidadPagada,
      horasPagadas,
      horasPagadasFmt: formatearHorasYMinutos(horasPagadas),
      horasPendientes,
      horasPendientesFmt: formatearHorasYMinutos(horasPendientes),
      importePendienteAPagar
    };
  }, [mesResumenNatalia, eventos, pagosNataliaPorMes]);

  const cambiarMesResumen = (offsetMeses: number) => {
    setMesResumenNatalia((prev) => new Date(prev.getFullYear(), prev.getMonth() + offsetMeses, 1));
    setAbonoAdicionalInput('');
  };

  // Formato del rango de fechas de la cabecera: ej. "12 oct - 18 oct 2026"
  const textoRangoSemana = `${lunesSemana.getDate()} ${MESES_CORTOS[lunesSemana.getMonth()]} - ${domingoSemana.getDate()} ${MESES_CORTOS[domingoSemana.getMonth()]} ${domingoSemana.getFullYear()}`;

  return (
    <div style={{
      width: '100%',
      maxWidth: '520px',
      margin: '0 auto',
      padding: '16px 12px 40px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* SELECTOR DE SEMANA CON FLECHAS */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '12px 14px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => cambiarSemana(-7)}
            aria-label="Semana anterior"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          >
            <span>←</span>
            <span>Ant.</span>
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '15px',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <span>⏱️</span>
              <span>{textoRangoSemana}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '2px' }}>
              {esSemanaActual ? (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Semana Actual
                </span>
              ) : (
                <button
                  onClick={irASemanaActual}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0047b3',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '0'
                  }}
                >
                  Volver a esta semana
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => cambiarSemana(7)}
            aria-label="Semana siguiente"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          >
            <span>Sig.</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* 3. CASILLAS Y TARJETAS SEPARADAS PARA JOEL, ANA Y NATALIA */}

      <div role="tablist" aria-label="Persona" style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
        {(['joel', 'ana', 'natalia'] as const).map((persona) => {
          const activa = personaActiva === persona;
          const estilosPersona = {
            joel: {
              nombre: 'Joel',
              border: '#bfdbfe',
              bg: '#eff6ff',
              color: '#0047b3'
            },
            ana: {
              nombre: 'Ana',
              border: '#fecaca',
              bg: '#fff1f2',
              color: '#b91c1c'
            },
            natalia: {
              nombre: 'Natalia',
              border: '#ddd6fe',
              bg: '#f5f3ff',
              color: '#6d28d9'
            }
          }[persona];
          return (
            <button
              key={persona}
              id={`pestana-horas-${persona}`}
              type="button"
              role="tab"
              aria-selected={activa}
              aria-controls="panel-horas-trabajadas"
              onClick={() => setPersonaActiva(persona)}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: `1px solid ${activa ? estilosPersona.border : '#e2e8f0'}`,
                borderRadius: '10px 10px 0 0',
                backgroundColor: activa ? estilosPersona.bg : '#ffffff',
                color: activa ? estilosPersona.color : '#64748b',
                fontSize: '14px',
                fontWeight: activa ? 800 : 700,
                cursor: 'pointer'
              }}
            >
              {estilosPersona.nombre}
            </button>
          );
        })}
      </div>

      {/* TARJETA 1: CASILLA DE JOEL ("J") */}
      {personaActiva === 'joel' && (
      <div role="tabpanel" id="panel-horas-trabajadas" aria-labelledby="pestana-horas-joel" style={{
        backgroundColor: '#ffffff',
        borderRadius: '18px',
        border: '1px solid #bfdbfe',
        boxShadow: '0 4px 14px rgba(0, 71, 179, 0.08)',
        overflow: 'hidden',
        transition: 'all 0.15s ease'
      }}>
        {/* CABECERA CASILLA JOEL */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              backgroundColor: '#0047b3',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '18px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)'
            }}>
              J
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.2 }}>
                Joel
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                Usuario Principal
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Logo de Condis representativo para los turnos de Joel */}
            <img
              src="/condis.jpg"
              alt="Condis"
              style={{
                maxHeight: '22px',
                width: 'auto',
                objectFit: 'contain',
                borderRadius: '4px',
                backgroundColor: '#ffffff',
                padding: '2px 4px'
              }}
            />
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: '#93c5fd'
            }}>
              {turnosJoel.length} {turnosJoel.length === 1 ? 'turno' : 'turnos'}
            </span>
          </div>
        </div>

        {/* CONTADOR PROMINENTE DE HORAS DE JOEL */}
        <div style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Horas Semanales
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#0047b3', lineHeight: 1.1, marginTop: '2px' }}>
              {horasJoelFmt.texto}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 800,
              backgroundColor: '#dbeafe',
              color: '#0047b3',
              padding: '4px 10px',
              borderRadius: '8px',
              display: 'inline-block'
            }}>
              {horasJoelFmt.decimal}
            </span>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
              {turnosJoel.length > 0
                ? `Promedio: ${(totalHorasJoel / turnosJoel.length).toFixed(1)} h/turno`
                : 'Sin actividad'}
            </div>
          </div>
        </div>

        {/* DESGLOSE DE TURNOS DE JOEL - AGRUPADO POR DÍA */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Desglose de turnos ({turnosJoel.length})
          </div>

          {turnosJoel.length === 0 ? (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px dashed #cbd5e1',
              color: '#64748b',
              fontSize: '13px',
              fontStyle: 'italic'
            }}>
              No hay turnos de trabajo registrados para Joel en esta semana.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {agruparPorDia(turnosJoel).map((grupo) => (
                <div
                  key={grupo.fechaKey}
                  style={{
                    border: '1px solid #bfdbfe',
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}
                >
                  {/* Encabezado del día */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '9px 12px',
                    backgroundColor: '#dbeafe',
                    borderBottom: grupo.turnos.length > 0 ? '1px solid #bfdbfe' : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#0047b3' }}>
                        {grupo.etiqueta}
                      </span>
                      {grupo.turnos.some(t => t.esCondis) && (
                        <img src="/condis.jpg" alt="Condis" style={{ maxHeight: '14px', width: 'auto', objectFit: 'contain', borderRadius: '3px', backgroundColor: '#fff', padding: '1px 3px' }} />
                      )}
                    </div>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 900,
                      color: '#0047b3',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      padding: '3px 9px',
                      borderRadius: '20px'
                    }}>
                      +{grupo.totalHoras} h
                    </span>
                  </div>

                  {/* Filas de turnos de ese día */}
                  <div style={{ backgroundColor: '#eff6ff' }}>
                    {grupo.turnos.map((t, idx) => (
                      <div
                        key={t.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderTop: idx > 0 ? '1px solid #bfdbfe' : 'none',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.titulo}
                          </span>
                          <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                            🕒 {t.horaInicio} - {t.horaFin}
                          </span>
                        </div>
                        <div style={{
                          backgroundColor: '#0047b3',
                          color: '#ffffff',
                          padding: '4px 9px',
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: 800,
                          flexShrink: 0
                        }}>
                          +{t.horas} h
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* TARJETA 2: CASILLA DE ANA ("A") */}
      {personaActiva === 'ana' && (
      <div role="tabpanel" id="panel-horas-trabajadas" aria-labelledby="pestana-horas-ana" style={{
        backgroundColor: '#ffffff',
        borderRadius: '18px',
        border: '1px solid #fecaca',
        boxShadow: '0 4px 14px rgba(220, 38, 38, 0.08)',
        overflow: 'hidden',
        transition: 'all 0.15s ease'
      }}>
        {/* CABECERA CASILLA ANA */}
        <div style={{
          background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
          color: '#ffffff',
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '18px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)'
            }}>
              A
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.2 }}>
                Ana
              </div>
              <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 600 }}>
                Familiar
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Logo de Biba representativo para los turnos de Ana */}
            <img
              src="/biba.jpeg"
              alt="Biba"
              style={{
                maxHeight: '22px',
                width: 'auto',
                objectFit: 'contain',
                borderRadius: '4px',
                backgroundColor: '#ffffff',
                padding: '2px 4px'
              }}
            />
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
              color: '#fee2e2'
            }}>
              {turnosAna.length} {turnosAna.length === 1 ? 'turno' : 'turnos'}
            </span>
          </div>
        </div>

        {/* CONTADOR PROMINENTE DE HORAS DE ANA */}
        <div style={{
          padding: '16px',
          backgroundColor: '#fff5f5',
          borderBottom: '1px solid #fee2e2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Horas Semanales
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#dc2626', lineHeight: 1.1, marginTop: '2px' }}>
              {horasAnaFmt.texto}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 800,
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              padding: '4px 10px',
              borderRadius: '8px',
              display: 'inline-block'
            }}>
              {horasAnaFmt.decimal}
            </span>
            <div style={{ fontSize: '11px', color: '#7f1d1d', fontWeight: 600, marginTop: '4px' }}>
              {turnosAna.length > 0
                ? `Promedio: ${(totalHorasAna / turnosAna.length).toFixed(1)} h/turno`
                : 'Sin actividad'}
            </div>
          </div>
        </div>

        {/* DESGLOSE DE TURNOS DE ANA - AGRUPADO POR DÍA */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Desglose de turnos ({turnosAna.length})
          </div>

          {turnosAna.length === 0 ? (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px dashed #cbd5e1',
              color: '#64748b',
              fontSize: '13px',
              fontStyle: 'italic'
            }}>
              No hay turnos de trabajo registrados para Ana en esta semana.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {agruparPorDia(turnosAna).map((grupo) => (
                <div
                  key={grupo.fechaKey}
                  style={{
                    border: '1px solid #fecdd3',
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}
                >
                  {/* Encabezado del día */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '9px 12px',
                    backgroundColor: '#fee2e2',
                    borderBottom: grupo.turnos.length > 0 ? '1px solid #fecdd3' : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#b91c1c' }}>
                        {grupo.etiqueta}
                      </span>
                      <img src="/biba.jpeg" alt="Biba" style={{ maxHeight: '14px', width: 'auto', objectFit: 'contain', borderRadius: '3px', backgroundColor: '#fff', padding: '1px 3px' }} />
                    </div>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 900,
                      color: '#b91c1c',
                      backgroundColor: '#fff1f2',
                      border: '1px solid #fecdd3',
                      padding: '3px 9px',
                      borderRadius: '20px'
                    }}>
                      +{grupo.totalHoras} h
                    </span>
                  </div>

                  {/* Filas de turnos de ese día */}
                  <div style={{ backgroundColor: '#fff1f2' }}>
                    {grupo.turnos.map((t, idx) => (
                      <div
                        key={t.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderTop: idx > 0 ? '1px solid #fecdd3' : 'none',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.titulo}
                          </span>
                          <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                            🕒 {t.horaInicio} - {t.horaFin}
                          </span>
                        </div>
                        <div style={{
                          backgroundColor: '#dc2626',
                          color: '#ffffff',
                          padding: '4px 9px',
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: 800,
                          flexShrink: 0
                        }}>
                          +{t.horas} h
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* TARJETA 3: CASILLA DE NATALIA ("N") */}
      {personaActiva === 'natalia' && (
      <div role="tabpanel" id="panel-horas-trabajadas" aria-labelledby="pestana-horas-natalia" style={{
        backgroundColor: '#ffffff',
        borderRadius: '18px',
        border: '1px solid #ddd6fe',
        boxShadow: '0 4px 14px rgba(109, 40, 217, 0.08)',
        overflow: 'hidden',
        transition: 'all 0.15s ease'
      }}>
        {/* CABECERA CASILLA NATALIA */}
        <div style={{
          background: 'linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)',
          color: '#ffffff',
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              backgroundColor: '#8b5cf6',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '18px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)'
            }}>
              N
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.2 }}>
                Natalia
              </div>
              <div style={{ fontSize: '11px', color: '#ddd6fe', fontWeight: 600 }}>
                Registro de Horas
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setMesResumenNatalia(new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), 1));
                setAbonoAdicionalInput('');
                setMostrarResumenNatalia(true);
              }}
              style={{
                fontSize: '12px',
                fontWeight: 800,
                padding: '6px 12px',
                borderRadius: '20px',
                backgroundColor: '#ffffff',
                color: '#5b21b6',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>📊</span>
              <span>Resumen</span>
            </button>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
              color: '#ede9fe'
            }}>
              {turnosNatalia.length} {turnosNatalia.length === 1 ? 'turno' : 'turnos'}
            </span>
          </div>
        </div>

        {/* CONTADOR PROMINENTE DE HORAS DE NATALIA */}
        <div style={{
          padding: '16px',
          backgroundColor: '#f5f3ff',
          borderBottom: '1px solid #ede9fe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Horas Semanales
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#6d28d9', lineHeight: 1.1, marginTop: '2px' }}>
              {horasNataliaFmt.texto}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 800,
              backgroundColor: '#ede9fe',
              color: '#6d28d9',
              padding: '4px 10px',
              borderRadius: '8px',
              display: 'inline-block'
            }}>
              {horasNataliaFmt.decimal}
            </span>
            <div style={{ fontSize: '11px', color: '#4c1d95', fontWeight: 600, marginTop: '4px' }}>
              {turnosNatalia.length > 0
                ? `Promedio: ${(totalHorasNatalia / turnosNatalia.length).toFixed(1)} h/turno`
                : 'Sin actividad'}
            </div>
          </div>
        </div>

        {/* DESGLOSE DE TURNOS DE NATALIA - AGRUPADO POR DÍA */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Desglose de turnos ({turnosNatalia.length})
          </div>

          {turnosNatalia.length === 0 ? (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px dashed #cbd5e1',
              color: '#64748b',
              fontSize: '13px',
              fontStyle: 'italic'
            }}>
              No hay turnos de trabajo registrados para Natalia en esta semana.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {agruparPorDia(turnosNatalia).map((grupo) => (
                <div
                  key={grupo.fechaKey}
                  style={{
                    border: '1px solid #ddd6fe',
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}
                >
                  {/* Encabezado del día */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '9px 12px',
                    backgroundColor: '#ede9fe',
                    borderBottom: grupo.turnos.length > 0 ? '1px solid #ddd6fe' : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#6d28d9' }}>
                        {grupo.etiqueta}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 900,
                      color: '#6d28d9',
                      backgroundColor: '#f5f3ff',
                      border: '1px solid #ddd6fe',
                      padding: '3px 9px',
                      borderRadius: '20px'
                    }}>
                      +{grupo.totalHoras} h
                    </span>
                  </div>

                  {/* Filas de turnos de ese día */}
                  <div style={{ backgroundColor: '#f5f3ff' }}>
                    {grupo.turnos.map((t, idx) => (
                      <div
                        key={t.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderTop: idx > 0 ? '1px solid #ddd6fe' : 'none',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.titulo}
                          </span>
                          <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                            🕒 {t.horaInicio} - {t.horaFin}
                          </span>
                        </div>
                        <div style={{
                          backgroundColor: '#7c3aed',
                          color: '#ffffff',
                          padding: '4px 9px',
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: 800,
                          flexShrink: 0
                        }}>
                          +{t.horas} h
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* MODAL DE RESUMEN MENSUAL DE NATALIA */}
      {mostrarResumenNatalia && (
        <div
          onClick={() => setMostrarResumenNatalia(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '430px',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.28)',
              border: '1px solid #ddd6fe',
              overflow: 'hidden',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Cabecera del Modal */}
            <div style={{
              background: 'linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)',
              color: '#ffffff',
              padding: '16px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 900
                }}>
                  📊
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 900, lineHeight: 1.2 }}>
                    Resumen de Natalia
                  </div>
                  <div style={{ fontSize: '11px', color: '#ddd6fe', fontWeight: 600 }}>
                    Tarifa: {PRECIO_HORA_NATALIA}€ / hora
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarResumenNatalia(false)}
                aria-label="Cerrar resumen"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Selector de Mes */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              backgroundColor: '#f5f3ff',
              borderBottom: '1px solid #ede9fe'
            }}>
              <button
                type="button"
                onClick={() => cambiarMesResumen(-1)}
                style={{
                  padding: '6px 11px',
                  borderRadius: '8px',
                  border: '1px solid #ddd6fe',
                  backgroundColor: '#ffffff',
                  color: '#5b21b6',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                ◀ Ant.
              </button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#4c1d95' }}>
                  {resumenMensualNatalia.nombreMesAnio}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6d28d9' }}>
                  {resumenMensualNatalia.totalTurnosMes} {resumenMensualNatalia.totalTurnosMes === 1 ? 'turno registrado' : 'turnos registrados'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => cambiarMesResumen(1)}
                style={{
                  padding: '6px 11px',
                  borderRadius: '8px',
                  border: '1px solid #ddd6fe',
                  backgroundColor: '#ffffff',
                  color: '#5b21b6',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Sig. ▶
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overflowY: 'auto'
            }}>
              {/* 3 Tarjetas de Horas: Acumuladas, Pagadas, Pendientes */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px'
              }}>
                {/* Horas acumuladas mensuales */}
                <div style={{
                  backgroundColor: '#f5f3ff',
                  border: '1px solid #ddd6fe',
                  borderRadius: '12px',
                  padding: '10px 8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#5b21b6', textTransform: 'uppercase', lineHeight: 1.2 }}>
                    Horas acumuladas mensuales
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#4c1d95', marginTop: '6px' }}>
                    {resumenMensualNatalia.horasAcumuladasFmt.texto}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6d28d9', marginTop: '2px' }}>
                    ({resumenMensualNatalia.horasAcumuladasFmt.decimal})
                  </div>
                </div>

                {/* Horas pagadas */}
                <div style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '12px',
                  padding: '10px 8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#065f46', textTransform: 'uppercase', lineHeight: 1.2 }}>
                    Horas pagadas
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#047857', marginTop: '6px' }}>
                    {resumenMensualNatalia.horasPagadasFmt.texto}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                    ({resumenMensualNatalia.horasPagadasFmt.decimal})
                  </div>
                </div>

                {/* Horas pendientes de pagar */}
                <div style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '12px',
                  padding: '10px 8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', lineHeight: 1.2 }}>
                    Horas pendientes de pagar
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#b45309', marginTop: '6px' }}>
                    {resumenMensualNatalia.horasPendientesFmt.texto}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', marginTop: '2px' }}>
                    ({resumenMensualNatalia.horasPendientesFmt.decimal})
                  </div>
                </div>
              </div>

              {/* Bloque de Importes (10€/h) */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#475569', fontWeight: 700 }}>
                  <span>Importe acumulado ({resumenMensualNatalia.horasAcumuladasMes}h × {PRECIO_HORA_NATALIA}€):</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{resumenMensualNatalia.importeTotalGenerado.toFixed(2)} €</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#047857', fontWeight: 700 }}>
                  <span>Cantidad pagada:</span>
                  <span style={{ fontWeight: 800 }}>- {resumenMensualNatalia.cantidadPagada.toFixed(2)} €</span>
                </div>
                <div style={{
                  borderTop: '1px dashed #cbd5e1',
                  paddingTop: '10px',
                  marginTop: '2px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#4c1d95', textTransform: 'uppercase' }}>
                    Importe total a pagar:
                  </span>
                  <span style={{
                    fontSize: '22px',
                    fontWeight: 900,
                    color: resumenMensualNatalia.importePendienteAPagar > 0 ? '#6d28d9' : '#047857',
                    backgroundColor: resumenMensualNatalia.importePendienteAPagar > 0 ? '#ede9fe' : '#d1fae5',
                    padding: '4px 12px',
                    borderRadius: '10px'
                  }}>
                    {resumenMensualNatalia.importePendienteAPagar.toFixed(2)} €
                  </span>
                </div>
              </div>

              {/* Introducir / editar cantidad pagada */}
              <div style={{
                backgroundColor: '#f5f3ff',
                border: '1px solid #ddd6fe',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#4c1d95' }}>
                  💶 Cantidad total pagada este mes (€):
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={resumenMensualNatalia.cantidadPagada === 0 ? '' : resumenMensualNatalia.cantidadPagada}
                    placeholder="0.00"
                    onChange={(e) => {
                      const val = e.target.value;
                      const numero = val === '' ? 0 : parseFloat(val);
                      guardarCantidadPagadaMes(resumenMensualNatalia.claveMes, isNaN(numero) ? 0 : numero);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid #8b5cf6',
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => guardarCantidadPagadaMes(resumenMensualNatalia.claveMes, 0)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Poner a 0€
                  </button>
                </div>

                {/* Sumar un pago puntual al total ya pagado */}
                <div style={{
                  borderTop: '1px solid #ddd6fe',
                  paddingTop: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#5b21b6' }}>
                    ➕ O añadir un nuevo pago para restarlo del pendiente:
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={abonoAdicionalInput}
                      placeholder="Ej: 30 (€)"
                      onChange={(e) => setAbonoAdicionalInput(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: '1px solid #c4b5fd',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#0f172a',
                        backgroundColor: '#ffffff',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const monto = parseFloat(abonoAdicionalInput);
                        if (!isNaN(monto) && monto > 0) {
                          guardarCantidadPagadaMes(
                            resumenMensualNatalia.claveMes,
                            resumenMensualNatalia.cantidadPagada + monto
                          );
                          setAbonoAdicionalInput('');
                        }
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: '#6d28d9',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Restar pago
                    </button>
                  </div>
                </div>
              </div>

              {/* Botón Cerrar */}
              <button
                type="button"
                onClick={() => setMostrarResumenNatalia(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#4c1d95',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  marginTop: '2px'
                }}
              >
                Cerrar Resumen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTÓN RÁPIDO PARA IR A LA AGENDA */}
      {onIrAPlanificador && (
        <button
          onClick={onIrAPlanificador}
          style={{
            width: '100%',
            padding: '13px',
            backgroundColor: '#ffffff',
            border: '1.5px solid #0047b3',
            color: '#0047b3',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 6px rgba(0, 71, 179, 0.06)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#eff6ff';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <span>📅</span>
          <span>Ir a la Agenda para Añadir o Editar Turnos</span>
        </button>
      )}
    </div>
  );
}
