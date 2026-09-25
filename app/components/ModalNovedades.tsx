"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { RegistroActividad } from '../utils/actividad';

interface ModalNovedadesProps {
  usuario: {
    email?: string | null;
    displayName?: string | null;
  } | null;
}

export default function ModalNovedades({ usuario }: ModalNovedadesProps) {
  const [abierto, setAbierto] = useState<boolean>(false);
  const [novedades, setNovedades] = useState<RegistroActividad[]>([]);
  const [verificando, setVerificando] = useState<boolean>(false);

  const miEmail = (usuario?.email || '').toLowerCase().trim();

  const comprobarNovedades = useCallback(async () => {
    if (!miEmail) return;

    try {
      setVerificando(true);
      const coleccionRef = collection(db, 'actividad_reciente');
      const consulta = query(coleccionRef, orderBy('timestamp', 'desc'), limit(30));
      const snapshot = await getDocs(consulta);

      const todas: RegistroActividad[] = [];
      snapshot.forEach((docSnap) => {
        todas.push({
          ...docSnap.data() as RegistroActividad,
          id: docSnap.id
        });
      });

      // Obtener timestamp de última conexión (o hace 24h si nunca se guardó)
      const ultimaConexionGuardada = localStorage.getItem('pf_ultima_conexion');
      const referenciaTiempo = ultimaConexionGuardada || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Filtrar registros posteriores a la última conexión y creados por el otro usuario
      const cambiosNuevos = todas.filter((item) => {
        const esPosterior = item.timestamp > referenciaTiempo;
        const esOtroUsuario = item.usuarioEmail
          ? item.usuarioEmail.toLowerCase() !== miEmail
          : true;
        return esPosterior && esOtroUsuario;
      });

      if (cambiosNuevos.length > 0) {
        setNovedades(cambiosNuevos);
        setAbierto(true);
      } else if (!ultimaConexionGuardada) {
        // Inicializar si no existía marca previa
        localStorage.setItem('pf_ultima_conexion', new Date().toISOString());
      }
    } catch (error) {
      console.error('Error al comprobar novedades recientes:', error);
    } finally {
      setVerificando(false);
    }
  }, [miEmail]);

  // Comprobar al iniciar sesión / montar componente
  useEffect(() => {
    comprobarNovedades();
  }, [comprobarNovedades]);

  // Listener del evento 'visibilitychange' (vuelta de segundo plano al desbloquear el móvil)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        comprobarNovedades();
      }
    };

    const handleFocus = () => {
      comprobarNovedades();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [comprobarNovedades]);

  // Marcar como visto y cerrar modal
  const handleEntendido = () => {
    localStorage.setItem('pf_ultima_conexion', new Date().toISOString());
    setAbierto(false);
    setNovedades([]);
  };

  if (!abierto || novedades.length === 0) {
    return null;
  }

  // Formato legible de fecha y hora
  const formatearFechaHora = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const ahora = new Date();
      const esHoy = d.toDateString() === ahora.toDateString();
      const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      if (esHoy) {
        return `Hoy, ${hora}`;
      }

      const ayer = new Date(ahora);
      ayer.setDate(ayer.getDate() - 1);
      if (d.toDateString() === ayer.toDateString()) {
        return `Ayer, ${hora}`;
      }

      const dia = d.getDate();
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      return `${dia} ${meses[d.getMonth()]}, ${hora}`;
    } catch {
      return isoStr;
    }
  };

  const obtenerInfoSeccion = (seccion: string) => {
    switch (seccion) {
      case 'agenda':
        return { nombre: 'Agenda', icono: '📅', color: '#0047b3', bg: '#eff6ff', border: '#bfdbfe' };
      case 'finanzas':
        return { nombre: 'Finanzas', icono: '💰', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' };
      case 'lista_compra':
        return { nombre: 'Lista Compra', icono: '🛒', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' };
      default:
        return { nombre: 'General', icono: '✨', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' };
    }
  };

  // Nombre de quien hizo los cambios
  const autorNovedades = novedades[0]?.usuario || 'Tu familia';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-novedades"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          color: '#111827',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '420px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}
      >
        {/* CABECERA ESTILIZADA */}
        <div style={{
          background: 'linear-gradient(135deg, #0047b3 0%, #003380 100%)',
          color: '#ffffff',
          padding: '20px 20px 18px 20px',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>
              🔔
            </div>
            <div>
              <h2
                id="titulo-modal-novedades"
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: 800,
                  letterSpacing: '-0.3px',
                  color: '#ffffff'
                }}
              >
                Novedades y Cambios
              </h2>
              <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.82)', fontWeight: 500 }}>
                {novedades.length === 1
                  ? `1 cambio nuevo realizado por ${autorNovedades}`
                  : `${novedades.length} cambios realizados mientras no estabas`}
              </span>
            </div>
          </div>
        </div>

        {/* LISTADO DE NOVEDADES SCROLLABLE */}
        <div style={{
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flex: 1
        }}>
          {novedades.map((item) => {
            const secInfo = obtenerInfoSeccion(item.seccion);

            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: '#f8fafc',
                  border: `1px solid ${secInfo.border}`,
                  borderLeft: `4px solid ${secInfo.color}`,
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'background-color 0.15s ease'
                }}
              >
                {/* FILA SUPERIOR: SECCIÓN + AUTOR + FECHA */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: secInfo.color,
                    backgroundColor: secInfo.bg,
                    padding: '2px 7px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>{secInfo.icono}</span>
                    <span>{secInfo.nombre}</span>
                  </span>

                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    {formatearFechaHora(item.timestamp)}
                  </span>
                </div>

                {/* DESCRIPCIÓN DEL CAMBIO */}
                <div style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#0f172a',
                  lineHeight: 1.35
                }}>
                  {item.descripcion}
                </div>

                {/* AUTOR */}
                {item.usuario && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Realizado por:</span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      padding: '1px 6px',
                      borderRadius: '4px'
                    }}>
                      👤 {item.usuario}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* PIE DEL MODAL CON BOTÓN DE CONFIRMACIÓN */}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid #f1f5f9',
          backgroundColor: '#ffffff'
        }}>
          <button
            onClick={handleEntendido}
            style={{
              width: '100%',
              padding: '12px 18px',
              background: 'linear-gradient(135deg, #0047b3 0%, #003380 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 71, 179, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.filter = 'brightness(1.08)')}
            onMouseOut={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
          >
            <span>✓</span>
            <span>¡Entendido! Marcar como visto</span>
          </button>
        </div>
      </div>
    </div>
  );
}
