"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { APP_VERSION, NOVEDADES_VERSION } from '../data/version';

interface ModalVersionProps {
  abiertoManual?: boolean;
  onCerrarManual?: () => void;
}

export default function ModalVersion({ abiertoManual, onCerrarManual }: ModalVersionProps) {
  const [abierto, setAbierto] = useState<boolean>(false);

  // Comprobar si la versión actual es nueva o no ha sido vista
  const verificarVersion = useCallback(() => {
    if (typeof window === 'undefined') return;
    const ultimaVista = localStorage.getItem('ultima_version_vista');

    // Si es diferente o menor a APP_VERSION, se debe mostrar
    if (!ultimaVista || ultimaVista !== APP_VERSION) {
      setAbierto(true);
    }
  }, []);

  // Comprobación al montar componente
  useEffect(() => {
    verificarVersion();
  }, [verificarVersion]);

  // Si se abre de forma manual (desde el menú de opciones)
  useEffect(() => {
    if (abiertoManual !== undefined) {
      setAbierto(abiertoManual);
    }
  }, [abiertoManual]);

  // Listener para cuando se vuelve de segundo plano (desbloqueo de móvil)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        verificarVersion();
      }
    };

    const handleFocus = () => {
      verificarVersion();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [verificarVersion]);

  // Guardar confirmación en localStorage y cerrar
  const handleEntendido = () => {
    try {
      localStorage.setItem('ultima_version_vista', APP_VERSION);
    } catch (err) {
      console.warn('Error al guardar en localStorage:', err);
    }
    setAbierto(false);
    if (onCerrarManual) {
      onCerrarManual();
    }
  };

  if (!abierto) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-version"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2100, // Por encima de los otros modales
        padding: '16px',
        animation: 'fadeIn 0.22s ease-out'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          color: '#111827',
          borderRadius: '22px',
          width: '100%',
          maxWidth: '430px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}
      >
        {/* CABECERA ESTILIZADA CON DEGRADADO */}
        <div style={{
          background: 'linear-gradient(135deg, #0047b3 0%, #002e73 100%)',
          color: '#ffffff',
          padding: '22px 20px 20px 20px',
          position: 'relative'
        }}>
          {/* BOTÓN CERRAR (✕) */}
          <button
            onClick={handleEntendido}
            aria-label="Cerrar ventana de novedades de la versión"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.16)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '17px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)')}
          >
            ✕
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.12) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
              🚀
            </div>

            <div style={{ flex: 1, paddingRight: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  backgroundColor: '#f59e0b',
                  color: '#ffffff',
                  boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)'
                }}>
                  v{APP_VERSION}
                </span>
                <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 600 }}>
                  {NOVEDADES_VERSION.fecha}
                </span>
              </div>

              <h2
                id="titulo-modal-version"
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 800,
                  letterSpacing: '-0.3px',
                  lineHeight: 1.2,
                  color: '#ffffff'
                }}
              >
                Novedades de la Versión
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.82)', fontWeight: 500 }}>
                {NOVEDADES_VERSION.lema}
              </p>
            </div>
          </div>
        </div>

        {/* LISTADO DE NOVEDADES SCROLLABLE */}
        <div style={{
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flex: 1
        }}>
          {NOVEDADES_VERSION.items.map((item, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
            >
              {/* ICONO */}
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: item.badgeBg || '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0,
                border: `1px solid ${item.badgeColor ? `${item.badgeColor}33` : '#bfdbfe'}`
              }}>
                {item.icono}
              </div>

              {/* CONTENIDO */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#0f172a',
                    lineHeight: 1.25
                  }}>
                    {item.titulo}
                  </span>
                  {item.badge && (
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: item.badgeBg || '#eff6ff',
                      color: item.badgeColor || '#0047b3',
                      letterSpacing: '0.4px',
                      flexShrink: 0
                    }}>
                      {item.badge}
                    </span>
                  )}
                </div>

                <p style={{
                  margin: 0,
                  fontSize: '12px',
                  color: '#475569',
                  lineHeight: 1.4,
                  fontWeight: 500
                }}>
                  {item.descripcion}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* PIE DEL MODAL CON BOTÓN DE CONFIRMACIÓN */}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid #f1f5f9',
          backgroundColor: '#ffffff'
        }}>
          <button
            id="btn-confirmar-version"
            onClick={handleEntendido}
            style={{
              width: '100%',
              padding: '13px 20px',
              background: 'linear-gradient(135deg, #0047b3 0%, #002e73 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 71, 179, 0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.filter = 'brightness(1.08)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.filter = 'brightness(1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span>✓</span>
            <span>¡Entendido! Continuar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
