"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  getDoc,
  getDocs,
  setDoc
} from 'firebase/firestore';

export interface MovimientoFinanciero {
  id?: string;
  importe: number;
  concepto: string;
  fecha: string; // formato "YYYY-MM-DD"
  mesAno: string; // formato "YYYY-MM" (asociado al mes/año)
  categoria: 'Alimentación' | 'Hogar' | 'Trabajo' | 'Ocio' | 'Cole' | 'Vehículo' | 'Salud' | 'Varios' | string;
  tipo: 'gasto' | 'ingreso';
  creadorEmail?: string;
  creadoEn?: string;
}

interface FinanzasFamiliaresProps {
  usuario?: { email?: string | null; displayName?: string | null } | null;
}

const CATEGORIAS = [
  { nombre: 'Alimentación', icono: '🛒', color: '#0284c7', bg: '#e0f2fe' },
  { nombre: 'Hogar', icono: '🏠', color: '#d97706', bg: '#fef3c7' },
  { nombre: 'Trabajo', icono: '💼', color: '#0d9488', bg: '#ccfbf1' },
  { nombre: 'Ocio', icono: '🎉', color: '#8b5cf6', bg: '#ede9fe' },
  { nombre: 'Cole', icono: '🎒', color: '#10b981', bg: '#d1fae5' },
  { nombre: 'Vehículo', icono: '🚗', color: '#6366f1', bg: '#e0e7ff' },
  { nombre: 'Salud', icono: '💊', color: '#ec4899', bg: '#fce7f3' },
  { nombre: 'Varios', icono: '📦', color: '#64748b', bg: '#f1f5f9' },
];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function obtenerMesAnteriorClave(mesAno: string): string {
  const [y, m] = mesAno.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevY = prevDate.getFullYear();
  const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
  return `${prevY}-${prevM}`;
}

async function calcularSaldoFinalMesAnterior(mesAnteriorClave: string): Promise<number> {
  try {
    const saldoPrevDocRef = doc(db, 'finanzas_saldos', mesAnteriorClave);
    const saldoPrevDocSnap = await getDoc(saldoPrevDocRef);
    const saldoAnteriorPrevio = saldoPrevDocSnap.exists()
      ? (Number(saldoPrevDocSnap.data()?.saldoAnterior) || 0)
      : 0;

    const movsPrevQuery = query(
      collection(db, 'finanzas_familiares'),
      where('mesAno', '==', mesAnteriorClave)
    );
    const movsSnapshot = await getDocs(movsPrevQuery);
    let ingresosPrev = 0;
    let gastosPrev = 0;

    movsSnapshot.forEach((d) => {
      const data = d.data();
      const imp = Number(data.importe) || 0;
      if (data.tipo === 'ingreso') {
        ingresosPrev += imp;
      } else {
        gastosPrev += imp;
      }
    });

    return Math.round((saldoAnteriorPrevio + ingresosPrev - gastosPrev) * 100) / 100;
  } catch (error) {
    console.error('Error al calcular saldo del mes anterior:', error);
    return 0;
  }
}

export default function FinanzasFamiliares({ usuario }: FinanzasFamiliaresProps) {
  // Fecha activa para el mes y año consultado
  const [fechaMesActivo, setFechaMesActivo] = useState<Date>(() => new Date());
  const [movimientos, setMovimientos] = useState<MovimientoFinanciero[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  // Estados de filtros
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'gasto' | 'ingreso'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');

  // Estado del modal de registro
  const [mostrarModal, setMostrarModal] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);

  // Estados para Saldo Anterior / Ahorro Acumulado
  const [saldoAnterior, setSaldoAnterior] = useState<number>(0);
  const [cargandoSaldo, setCargandoSaldo] = useState<boolean>(true);
  const [mostrarModalSaldo, setMostrarModalSaldo] = useState<boolean>(false);
  const [inputSaldoAnterior, setInputSaldoAnterior] = useState<string>('0');
  const [guardandoSaldo, setGuardandoSaldo] = useState<boolean>(false);

  // Formulario nuevo movimiento
  const hoyStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  }, []);

  const [formulario, setFormulario] = useState({
    importe: '',
    concepto: '',
    fecha: hoyStr,
    categoria: 'Alimentación',
    tipo: 'gasto' as 'gasto' | 'ingreso'
  });

  // Clave del mes actual en formato "YYYY-MM"
  const anoActivo = fechaMesActivo.getFullYear();
  const mesActivoNum = fechaMesActivo.getMonth() + 1;
  const mesAnoClave = `${anoActivo}-${String(mesActivoNum).padStart(2, '0')}`;
  const nombreMesAno = `${MESES[fechaMesActivo.getMonth()]} ${anoActivo}`;

  // Sincronización en tiempo real con Firestore de los movimientos asociados al mes/año
  useEffect(() => {
    const coleccionRef = collection(db, 'finanzas_familiares');
    const consultaMes = query(coleccionRef, where('mesAno', '==', mesAnoClave));

    const unsuscribe = onSnapshot(consultaMes, (snapshot) => {
      const lista: MovimientoFinanciero[] = [];
      snapshot.forEach((docSnapshot) => {
        const datos = docSnapshot.data() as MovimientoFinanciero;
        lista.push({
          ...datos,
          id: docSnapshot.id
        });
      });

      // Ordenar cronológicamente descendente (más reciente primero)
      lista.sort((a, b) => {
        if (b.fecha !== a.fecha) {
          return b.fecha.localeCompare(a.fecha);
        }
        return (b.creadoEn || '').localeCompare(a.creadoEn || '');
      });

      setMovimientos(lista);
      setCargando(false);
    }, (error) => {
      console.error('Error al escuchar finanzas en Firestore:', error);
      setCargando(false);
    });

    return () => unsuscribe();
  }, [mesAnoClave]);

  // Sincronización y cálculo automático de Saldo Anterior / Ahorro Acumulado
  useEffect(() => {
    setCargandoSaldo(true);
    const saldoDocRef = doc(db, 'finanzas_saldos', mesAnoClave);

    const unsubSaldo = onSnapshot(saldoDocRef, async (docSnap) => {
      if (docSnap.exists() && docSnap.data()?.saldoAnterior !== undefined) {
        setSaldoAnterior(Number(docSnap.data().saldoAnterior) || 0);
        setCargandoSaldo(false);
      } else {
        // No existe saldo previo para este mes: auto-calcular con el saldo final del mes anterior
        try {
          const mesAntClave = obtenerMesAnteriorClave(mesAnoClave);
          const saldoFinalAnt = await calcularSaldoFinalMesAnterior(mesAntClave);

          await setDoc(saldoDocRef, {
            mesAno: mesAnoClave,
            saldoAnterior: saldoFinalAnt,
            autoCalculado: true,
            actualizadoEn: new Date().toISOString(),
            actualizadoPor: usuario?.email || 'sistema'
          }, { merge: true });

          setSaldoAnterior(saldoFinalAnt);
        } catch (err) {
          console.error('Error al inicializar saldo anterior automático:', err);
          setSaldoAnterior(0);
        } finally {
          setCargandoSaldo(false);
        }
      }
    }, (err) => {
      console.error('Error al escuchar saldo anterior:', err);
      setCargandoSaldo(false);
    });

    return () => unsubSaldo();
  }, [mesAnoClave, usuario?.email]);

  // Navegación de mes
  const cambiarMes = (offset: number) => {
    setCargando(true);
    setFechaMesActivo(prev => {
      const nueva = new Date(prev.getFullYear(), prev.getMonth() + offset, 1);
      return nueva;
    });
  };

  const irAMesActual = () => {
    setCargando(true);
    setFechaMesActivo(new Date());
  };

  // Cálculos de totales del mes y Saldo Total Disponible
  const totales = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;

    movimientos.forEach(m => {
      const imp = Number(m.importe) || 0;
      if (m.tipo === 'ingreso') {
        ingresos += imp;
      } else {
        gastos += imp;
      }
    });

    const balanceNeto = ingresos - gastos;
    const saldoTotalDisponible = Math.round((saldoAnterior + ingresos - gastos) * 100) / 100;

    return {
      ingresos,
      gastos,
      balanceNeto,
      saldoTotalDisponible
    };
  }, [movimientos, saldoAnterior]);

  // Abrir modal para editar saldo anterior
  const abrirModalSaldoAnterior = () => {
    setInputSaldoAnterior(String(saldoAnterior));
    setMostrarModalSaldo(true);
  };

  // Guardar edición manual de saldo anterior
  const guardarSaldoAnteriorManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(inputSaldoAnterior.replace(',', '.'));
    if (isNaN(num)) {
      alert('Por favor, introduce un importe numérico válido.');
      return;
    }

    setGuardandoSaldo(true);
    try {
      const valorRedondeado = Math.round(num * 100) / 100;
      await setDoc(doc(db, 'finanzas_saldos', mesAnoClave), {
        mesAno: mesAnoClave,
        saldoAnterior: valorRedondeado,
        editadoManualmente: true,
        actualizadoEn: new Date().toISOString(),
        actualizadoPor: usuario?.email || 'usuario'
      }, { merge: true });

      setMostrarModalSaldo(false);
    } catch (error) {
      console.error('Error al guardar saldo anterior:', error);
      alert('Error al guardar el saldo anterior.');
    } finally {
      setGuardandoSaldo(false);
    }
  };

  // Recalcular saldo anterior desde el mes previo
  const recalcularDesdeMesAnterior = async () => {
    if (!window.confirm('¿Deseas recalcular automáticamente el saldo anterior tomando el saldo final del mes anterior?')) {
      return;
    }

    setGuardandoSaldo(true);
    try {
      const mesAntClave = obtenerMesAnteriorClave(mesAnoClave);
      const saldoFinalAnt = await calcularSaldoFinalMesAnterior(mesAntClave);
      setInputSaldoAnterior(String(saldoFinalAnt));

      await setDoc(doc(db, 'finanzas_saldos', mesAnoClave), {
        mesAno: mesAnoClave,
        saldoAnterior: saldoFinalAnt,
        autoCalculado: true,
        actualizadoEn: new Date().toISOString(),
        actualizadoPor: usuario?.email || 'usuario'
      }, { merge: true });

      setMostrarModalSaldo(false);
    } catch (error) {
      console.error('Error al recalcular saldo anterior:', error);
      alert('Error al recalcular el saldo anterior.');
    } finally {
      setGuardandoSaldo(false);
    }
  };

  // Desglose de gastos por categoría (Cálculo de porcentajes)
  const desgloseCategorias = useMemo(() => {
    const acumulado: Record<string, number> = {};
    let totalGastos = 0;

    movimientos.forEach(m => {
      if (m.tipo === 'gasto') {
        const imp = Number(m.importe) || 0;
        acumulado[m.categoria] = (acumulado[m.categoria] || 0) + imp;
        totalGastos += imp;
      }
    });

    const lista = CATEGORIAS.map(cat => {
      const gastado = acumulado[cat.nombre] || 0;
      const porcentaje = totalGastos > 0 ? (gastado / totalGastos) * 100 : 0;
      return {
        ...cat,
        gastado,
        porcentaje: Math.round(porcentaje * 10) / 10
      };
    })
    .filter(item => item.gastado > 0)
    .sort((a, b) => b.gastado - a.gastado);

    return { lista, totalGastos };
  }, [movimientos]);

  // Movimientos filtrados
  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter(m => {
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;
      if (filtroCategoria !== 'todas' && m.categoria !== filtroCategoria) return false;
      return true;
    });
  }, [movimientos, filtroTipo, filtroCategoria]);

  // Manejo de apertura de modal
  const abrirModalNuevo = () => {
    setFormulario({
      importe: '',
      concepto: '',
      fecha: hoyStr,
      categoria: 'Alimentación',
      tipo: 'gasto'
    });
    setMostrarModal(true);
  };

  // Guardar movimiento en Firestore (Cuenta Común)
  const guardarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    const importeNum = parseFloat(formulario.importe.replace(',', '.'));

    if (isNaN(importeNum) || importeNum <= 0) {
      alert('Por favor, introduce un importe válido mayor que 0.');
      return;
    }

    if (!formulario.concepto.trim()) {
      alert('Por favor, indica un concepto o descripción del movimiento.');
      return;
    }

    if (!formulario.fecha) {
      alert('Por favor, selecciona una fecha.');
      return;
    }

    // Extraer mesAno del movimiento ("YYYY-MM")
    const mesAnoMov = formulario.fecha.substring(0, 7);

    setGuardando(true);
    try {
      await addDoc(collection(db, 'finanzas_familiares'), {
        importe: Math.round(importeNum * 100) / 100,
        concepto: formulario.concepto.trim(),
        fecha: formulario.fecha,
        mesAno: mesAnoMov,
        categoria: formulario.categoria,
        tipo: formulario.tipo,
        creadorEmail: usuario?.email || 'desconocido',
        creadoEn: new Date().toISOString()
      });

      setMostrarModal(false);
      // Si el movimiento se registró en otro mes al visualizado, navegar a ese mes
      if (mesAnoMov !== mesAnoClave) {
        const [y, m] = mesAnoMov.split('-').map(Number);
        setFechaMesActivo(new Date(y, m - 1, 1));
      }
    } catch (error) {
      console.error('Error al guardar movimiento:', error);
      alert('Hubo un error al guardar el movimiento en la nube.');
    } finally {
      setGuardando(false);
    }
  };

  // Eliminar movimiento
  const eliminarMovimiento = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('¿Estás seguro de que deseas eliminar este movimiento?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'finanzas_familiares', id));
    } catch (error) {
      console.error('Error al eliminar movimiento:', error);
      alert('Hubo un error al eliminar el movimiento de la nube.');
    }
  };

  const formatearMoneda = (val: number) => {
    return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '480px',
      marginTop: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      color: '#111827'
    }}>
      {/* BARRA DE NAVEGACIÓN MENSUAL Y ACCIÓN PRINCIPAL */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        padding: '14px 16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={() => cambiarMes(-1)}
            aria-label="Mes anterior"
            style={{
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 700,
              color: '#1e293b',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          >
            ◀
          </button>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 800, color: '#059669', letterSpacing: '0.6px', display: 'block' }}>
              Cuenta Común
            </span>
            <span style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
              {nombreMesAno}
            </span>
          </div>

          <button
            onClick={() => cambiarMes(1)}
            aria-label="Mes siguiente"
            style={{
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 700,
              color: '#1e293b',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          >
            ▶
          </button>
        </div>

        {/* BOTONES DE ACCIÓN RÁPIDA */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={irAMesActual}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: '#f8fafc',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
          >
            Mes Actual
          </button>

          <button
            onClick={abrirModalNuevo}
            style={{
              flex: 1,
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 800,
              backgroundColor: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#047857')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
          >
            <span>+ Registrar Movimiento</span>
          </button>
        </div>
      </div>

      {/* TARJETA DESTACADA: SALDO TOTAL DISPONIBLE */}
      <div style={{
        background: totales.saldoTotalDisponible >= 0
          ? 'linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%)'
          : 'linear-gradient(135deg, #991b1b 0%, #b91c1c 50%, #dc2626 100%)',
        borderRadius: '16px',
        padding: '18px 20px',
        color: '#ffffff',
        boxShadow: '0 4px 16px rgba(5, 150, 105, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255, 255, 255, 0.9)' }}>
            💰 Saldo Total Disponible
          </span>
          <span style={{
            fontSize: '11px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: 700
          }}>
            {cargandoSaldo ? 'Calculando...' : 'Mes en curso'}
          </span>
        </div>

        <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
          {formatearMoneda(totales.saldoTotalDisponible)}
        </div>

        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.92)', fontWeight: 500, marginTop: '2px' }}>
          Saldo Anterior ({formatearMoneda(saldoAnterior)}) + Ingresos ({formatearMoneda(totales.ingresos)}) − Gastos ({formatearMoneda(totales.gastos)})
        </div>
      </div>

      {/* TARJETAS DE RESUMEN Y BALANCE MENSUAL */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px'
      }}>
        {/* SALDO ANTERIOR / AHORRO ACUMULADO */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '12px 10px',
          border: '1px solid #bfdbfe',
          boxShadow: '0 2px 5px rgba(37, 99, 235, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span>🏦</span> Saldo Anterior
            </span>
            <button
              onClick={abrirModalSaldoAnterior}
              title="Editar Saldo Anterior"
              aria-label="Editar Saldo Anterior"
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '1px 5px',
                fontSize: '10px',
                fontWeight: 800,
                color: '#1d4ed8',
                cursor: 'pointer'
              }}
            >
              ✏️
            </button>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a8a' }}>
            {formatearMoneda(saldoAnterior)}
          </span>
        </div>

        {/* TOTAL INGRESADO */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '12px 10px',
          border: '1px solid #a7f3d0',
          boxShadow: '0 2px 5px rgba(5, 150, 105, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#065f46', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>🟢</span> Ingresos
          </span>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#047857' }}>
            {formatearMoneda(totales.ingresos)}
          </span>
        </div>

        {/* TOTAL GASTADO */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '12px 10px',
          border: '1px solid #fecdd3',
          boxShadow: '0 2px 5px rgba(225, 29, 72, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#9f1239', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>🔴</span> Gastos
          </span>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#be123c' }}>
            {formatearMoneda(totales.gastos)}
          </span>
        </div>
      </div>

      {/* BALANCE NETO DEL MES */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        padding: '9px 14px',
        border: '1px solid #e2e8f0',
        fontSize: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
      }}>
        <span style={{ color: '#64748b', fontWeight: 600 }}>Balance neto de este mes:</span>
        <span style={{ fontWeight: 800, color: totales.balanceNeto >= 0 ? '#15803d' : '#dc2626' }}>
          {totales.balanceNeto >= 0 ? '+' : ''}{formatearMoneda(totales.balanceNeto)}
        </span>
      </div>

      {/* DESGLOSE DE GASTOS POR CATEGORÍA CON BARRAS DE PORCENTAJE */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        padding: '14px 16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '15px' }}>📊</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
              Gastos por Categoría
            </span>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
            Total: {formatearMoneda(desgloseCategorias.totalGastos)}
          </span>
        </div>

        {desgloseCategorias.lista.length === 0 ? (
          <div style={{
            padding: '12px 8px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '12px',
            fontStyle: 'italic'
          }}>
            Aún no hay gastos registrados en este mes para mostrar el desglose.
          </div>
        ) : (
          <>
            {/* BARRA HORIZONTAL MULTICOLOR APILADA */}
            <div style={{
              width: '100%',
              height: '10px',
              backgroundColor: '#f1f5f9',
              borderRadius: '999px',
              overflow: 'hidden',
              display: 'flex'
            }}>
              {desgloseCategorias.lista.map((item) => (
                <div
                  key={item.nombre}
                  title={`${item.nombre}: ${formatearMoneda(item.gastado)} (${item.porcentaje}%)`}
                  style={{
                    height: '100%',
                    width: `${item.porcentaje}%`,
                    backgroundColor: item.color,
                    transition: 'width 0.4s ease'
                  }}
                />
              ))}
            </div>

            {/* LISTA INDIVIDUAL DE CATEGORÍAS CON BARRAS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '2px' }}>
              {desgloseCategorias.lista.map((item) => (
                <div key={item.nombre} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px' }}>{item.icono}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                        {item.nombre}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b' }}>
                        {item.porcentaje}%
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                        {formatearMoneda(item.gastado)}
                      </span>
                    </div>
                  </div>

                  {/* Barra de progreso de la categoría */}
                  <div style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '999px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${item.porcentaje}%`,
                      backgroundColor: item.color,
                      borderRadius: '999px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* BARRA DE FILTROS DE MOVIMIENTOS */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '10px 12px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        {/* FILTRO POR TIPO */}
        <div style={{ display: 'flex', gap: '4px', flex: 1.2 }}>
          {(['todos', 'gasto', 'ingreso'] as const).map(tipo => (
            <button
              key={tipo}
              onClick={() => setFiltroTipo(tipo)}
              style={{
                flex: 1,
                padding: '6px 4px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                border: filtroTipo === tipo ? '2px solid #059669' : '1px solid #cbd5e1',
                backgroundColor: filtroTipo === tipo ? '#ecfdf5' : '#ffffff',
                color: filtroTipo === tipo ? '#047857' : '#475569',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {tipo === 'todos' ? 'Todos' : (tipo === 'gasto' ? '🔴 Gastos' : '🟢 Ingresos')}
            </button>
          ))}
        </div>

        {/* FILTRO POR CATEGORÍA */}
        <div style={{ flex: 1 }}>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              fontSize: '12px',
              fontWeight: 600,
              color: '#334155',
              outline: 'none'
            }}
          >
            <option value="todas">Todas las categorías</option>
            {CATEGORIAS.map(cat => (
              <option key={cat.nombre} value={cat.nombre}>
                {cat.icono} {cat.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* LISTADO DE MOVIMIENTOS DEL MES */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#334155' }}>
            Movimientos ({movimientosFiltrados.length})
          </span>
          {cargando && (
            <span style={{ fontSize: '11px', color: '#64748b' }}>Sincronizando...</span>
          )}
        </div>

        {movimientosFiltrados.length === 0 ? (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '30px 16px',
            textAlign: 'center',
            border: '1px dashed #cbd5e1'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💳</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
              No hay movimientos registrados
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              Usa el botón superior para añadir el primer gasto o ingreso de este mes.
            </div>
          </div>
        ) : (
          movimientosFiltrados.map((mov) => {
            const esGasto = mov.tipo === 'gasto';
            const catInfo = CATEGORIAS.find(c => c.nombre === mov.categoria) || { icono: '📦', color: '#64748b', bg: '#f1f5f9' };

            // Fecha formateada (ej: 24 Sep)
            let fechaCorta = mov.fecha;
            if (mov.fecha) {
              const [, mStr, dStr] = mov.fecha.split('-');
              const mIdx = parseInt(mStr, 10) - 1;
              if (mIdx >= 0 && mIdx < 12) {
                fechaCorta = `${parseInt(dStr, 10)} ${MESES[mIdx].substring(0, 3)}`;
              }
            }

            return (
              <div
                key={mov.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  border: '1px solid #e2e8f0',
                  borderLeft: `4px solid ${esGasto ? '#ef4444' : '#10b981'}`,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                {/* ICONO Y DETALLE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: catInfo.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0
                  }}>
                    {catInfo.icono}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden'
                    }}>
                      {mov.concepto}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                        {fechaCorta}
                      </span>
                      <span style={{ color: '#cbd5e1', fontSize: '10px' }}>•</span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: catInfo.bg,
                        color: catInfo.color
                      }}>
                        {mov.categoria}
                      </span>
                    </div>
                  </div>
                </div>

                {/* IMPORTE Y BOTÓN BORRAR */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    color: esGasto ? '#dc2626' : '#059669'
                  }}>
                    {esGasto ? '-' : '+'}{formatearMoneda(mov.importe)}
                  </span>

                  <button
                    onClick={() => eliminarMovimiento(mov.id)}
                    title="Eliminar movimiento"
                    aria-label="Borrar movimiento"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '15px',
                      padding: '4px',
                      lineHeight: 1,
                      transition: 'color 0.15s ease'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseOut={(e) => (e.currentTarget.style.color = '#94a3b8')}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL FORMULARIO "+ REGISTRAR MOVIMIENTO" (CUENTA COMÚN) */}
      {mostrarModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
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
            maxWidth: '380px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            maxHeight: '92vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px', fontWeight: 800 }}>
                  💳 Registrar Movimiento
                </h3>
                <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                  Cuenta Común
                </span>
              </div>
              <button
                onClick={() => setMostrarModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={guardarMovimiento}>
              {/* SELECTOR DE TIPO (GASTO O INGRESO) */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setFormulario(prev => ({
                    ...prev,
                    tipo: 'gasto',
                    categoria: prev.categoria === 'Trabajo' ? 'Alimentación' : prev.categoria
                  }))}
                  style={{
                    flex: 1,
                    padding: '9px',
                    borderRadius: '8px',
                    border: formulario.tipo === 'gasto' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                    backgroundColor: formulario.tipo === 'gasto' ? '#fef2f2' : '#ffffff',
                    color: formulario.tipo === 'gasto' ? '#dc2626' : '#475569',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  🔴 Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setFormulario(prev => ({
                    ...prev,
                    tipo: 'ingreso',
                    categoria: prev.categoria === 'Alimentación' ? 'Trabajo' : prev.categoria
                  }))}
                  style={{
                    flex: 1,
                    padding: '9px',
                    borderRadius: '8px',
                    border: formulario.tipo === 'ingreso' ? '2px solid #10b981' : '1px solid #cbd5e1',
                    backgroundColor: formulario.tipo === 'ingreso' ? '#ecfdf5' : '#ffffff',
                    color: formulario.tipo === 'ingreso' ? '#047857' : '#475569',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  🟢 Ingreso
                </button>
              </div>

              {/* IMPORTE (€) */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 700, fontSize: '12px', color: '#334155' }}>
                  Importe (€):
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    required
                    value={formulario.importe}
                    onChange={(e) => setFormulario({ ...formulario, importe: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 38px 10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                  <span style={{ position: 'absolute', right: '14px', fontWeight: 700, color: '#64748b', fontSize: '15px' }}>
                    €
                  </span>
                </div>
              </div>

              {/* CONCEPTO */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 700, fontSize: '12px', color: '#334155' }}>
                  Concepto:
                </label>
                <input
                  type="text"
                  placeholder={formulario.tipo === 'gasto' ? 'Ej: Compra Mercadona, Gasolina, Libros...' : 'Ej: Nómina, Devolución, Ingreso...'}
                  required
                  value={formulario.concepto}
                  onChange={(e) => setFormulario({ ...formulario, concepto: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                />
              </div>

              {/* FECHA */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 700, fontSize: '12px', color: '#334155' }}>
                  Fecha:
                </label>
                <input
                  type="date"
                  required
                  value={formulario.fecha}
                  onChange={(e) => setFormulario({ ...formulario, fecha: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                />
              </div>

              {/* CATEGORÍA */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '12px', color: '#334155' }}>
                  Categoría:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {CATEGORIAS.map((cat) => {
                    const sel = formulario.categoria === cat.nombre;
                    return (
                      <button
                        key={cat.nombre}
                        type="button"
                        onClick={() => setFormulario({ ...formulario, categoria: cat.nombre })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 8px',
                          borderRadius: '8px',
                          border: sel ? `2px solid ${cat.color}` : '1px solid #e2e8f0',
                          backgroundColor: sel ? cat.bg : '#ffffff',
                          color: sel ? cat.color : '#475569',
                          fontWeight: sel ? 800 : 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span>{cat.icono}</span>
                        <span>{cat.nombre}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BOTONES ACCIÓN */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  style={{
                    padding: '9px 16px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: guardando ? 'not-allowed' : 'pointer',
                    fontWeight: 800,
                    fontSize: '13px',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
                    opacity: guardando ? 0.7 : 1
                  }}
                >
                  {guardando ? 'Guardando...' : 'Guardar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR / CONFIGURAR SALDO ANTERIOR */}
      {mostrarModalSaldo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
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
            maxWidth: '380px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px', fontWeight: 800 }}>
                  🏦 Saldo Anterior
                </h3>
                <span style={{ fontSize: '11px', color: '#0047b3', fontWeight: 700 }}>
                  {nombreMesAno}
                </span>
              </div>
              <button
                onClick={() => setMostrarModalSaldo(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={guardarSaldoAnteriorManual}>
              <p style={{ fontSize: '12px', color: '#475569', marginBottom: '14px', lineHeight: 1.4 }}>
                Introduce o ajusta el <strong>Saldo Anterior / Ahorro Acumulado</strong> al inicio de este mes.
              </p>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '12px', color: '#334155' }}>
                  Importe del Saldo Anterior (€):
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={inputSaldoAnterior}
                    onChange={(e) => setInputSaldoAnterior(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 38px 10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '17px',
                      fontWeight: 800,
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                  <span style={{ position: 'absolute', right: '14px', fontWeight: 700, color: '#64748b', fontSize: '16px' }}>
                    €
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <button
                  type="button"
                  onClick={recalcularDesdeMesAnterior}
                  disabled={guardandoSaldo}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    cursor: guardandoSaldo ? 'not-allowed' : 'pointer'
                  }}
                >
                  🔄 Recalcular desde mes anterior
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setMostrarModalSaldo(false)}
                  style={{
                    padding: '9px 14px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoSaldo}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: '#0047b3',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: guardandoSaldo ? 'not-allowed' : 'pointer',
                    fontWeight: 800,
                    fontSize: '13px',
                    boxShadow: '0 2px 6px rgba(0, 71, 179, 0.3)',
                    opacity: guardandoSaldo ? 0.7 : 1
                  }}
                >
                  {guardandoSaldo ? 'Guardando...' : 'Guardar Saldo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
