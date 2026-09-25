"use client";
import React, { useEffect } from 'react';

interface MenuLateralProps {
  abierto: boolean;
  onCerrar: () => void;
  seccionActiva: 'planificador' | 'finanzas' | 'lista-compra';
  onCambiarSeccion: (seccion: 'planificador' | 'finanzas' | 'lista-compra') => void;
  usuario: {
    displayName?: string | null;
    email?: string | null;
  } | null;
  onCerrarSesion: () => void;
}

export default function MenuLateral({
  abierto,
  onCerrar,
  seccionActiva,
  onCambiarSeccion,
  usuario,
  onCerrarSesion
}: MenuLateralProps) {
  // Prevenir scroll de fondo al estar el menú abierto
  useEffect(() => {
    if (abierto) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [abierto]);

  const email = usuario?.email?.toLowerCase() || '';
  const esJoel = email.includes('joel');
  const nombreMostrado = usuario?.displayName || (esJoel ? 'Joel Ruiz' : (email.includes('aijg') ? 'Arantxa' : (email ? email.split('@')[0] : 'Usuario')));
  const inicial = esJoel ? 'J' : (email.includes('aijg') ? 'A' : (nombreMostrado.charAt(0).toUpperCase() || 'U'));

  return (
    <>
      {/* OVERLAY OSCURO DE FONDO */}
      <div
        onClick={onCerrar}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 998,
          opacity: abierto ? 1 : 0,
          pointerEvents: abierto ? 'auto' : 'none',
          transition: 'opacity 0.25s ease'
        }}
      />

      {/* PANEL LATERAL (DRAWER) */}
      <aside
        aria-label="Menú de navegación lateral"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '84%',
          maxWidth: '320px',
          height: '100vh',
          backgroundColor: '#ffffff',
          color: '#111827',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.2)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          transform: abierto ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          overflowY: 'auto'
        }}
      >
        {/* CABECERA DEL MENÚ LATERAL */}
        <div style={{
          background: 'linear-gradient(135deg, #0047b3 0%, #003380 100%)',
          color: '#ffffff',
          padding: '20px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          position: 'relative'
        }}>
          {/* BOTÓN CERRAR (✕) */}
          <button
            onClick={onCerrar}
            aria-label="Cerrar menú"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '18px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)')}
          >
            ✕
          </button>

          {/* LOGO Y TÍTULO */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '18px',
              color: '#0047b3',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            }}>
              PF
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.2px', lineHeight: 1.2 }}>
                Planificador Familiar
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 500 }}>
                Hogar & Agenda
              </div>
            </div>
          </div>

          {/* PERFIL DEL USUARIO ACTIVO */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            padding: '8px 12px',
            borderRadius: '10px',
            backdropFilter: 'blur(4px)',
            marginTop: '2px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: esJoel ? '#111827' : '#ef4444',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '14px',
              border: '2px solid rgba(255, 255, 255, 0.6)',
              flexShrink: 0
            }}>
              {inicial}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {nombreMostrado}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {email || 'Sesión iniciada'}
              </div>
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN PRINCIPAL */}
        <div style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: '#94a3b8',
            letterSpacing: '0.8px',
            padding: '4px 10px 8px 10px'
          }}>
            Navegación
          </div>

          {/* OPCIÓN 1: INICIO / PLANIFICADOR */}
          <button
            onClick={() => {
              onCambiarSeccion('planificador');
              onCerrar();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '12px',
              border: seccionActiva === 'planificador' ? '2px solid #bfdbfe' : '1px solid #f1f5f9',
              backgroundColor: seccionActiva === 'planificador' ? '#eff6ff' : '#ffffff',
              color: seccionActiva === 'planificador' ? '#0047b3' : '#334155',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              width: '100%',
              boxShadow: seccionActiva === 'planificador' ? '0 2px 8px rgba(0, 71, 179, 0.08)' : 'none'
            }}
            onMouseOver={(e) => {
              if (seccionActiva !== 'planificador') {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }
            }}
            onMouseOut={(e) => {
              if (seccionActiva !== 'planificador') {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#f1f5f9';
              }
            }}
          >
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: seccionActiva === 'planificador' ? '#dbeafe' : '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0
            }}>
              📅
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 800 }}>
                Inicio / Planificador
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                General, Semanal, Deportes, Menú
              </div>
            </div>
            {seccionActiva === 'planificador' && (
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#0047b3',
                flexShrink: 0
              }} />
            )}
          </button>

          {/* OPCIÓN 2: FINANZAS FAMILIARES */}
          <button
            onClick={() => {
              onCambiarSeccion('finanzas');
              onCerrar();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '12px',
              border: seccionActiva === 'finanzas' ? '2px solid #a7f3d0' : '1px solid #f1f5f9',
              backgroundColor: seccionActiva === 'finanzas' ? '#ecfdf5' : '#ffffff',
              color: seccionActiva === 'finanzas' ? '#047857' : '#334155',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              width: '100%',
              boxShadow: seccionActiva === 'finanzas' ? '0 2px 8px rgba(4, 120, 87, 0.08)' : 'none'
            }}
            onMouseOver={(e) => {
              if (seccionActiva !== 'finanzas') {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }
            }}
            onMouseOut={(e) => {
              if (seccionActiva !== 'finanzas') {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#f1f5f9';
              }
            }}
          >
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: seccionActiva === 'finanzas' ? '#d1fae5' : '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0
            }}>
              💰
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 800 }}>
                Finanzas Familiares
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                Gastos, Ingresos y Balance
              </div>
            </div>
            {seccionActiva === 'finanzas' && (
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#047857',
                flexShrink: 0
              }} />
            )}
          </button>

          {/* OPCIÓN 3: LISTA DE LA COMPRA */}
          <button
            onClick={() => {
              onCambiarSeccion('lista-compra');
              onCerrar();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '12px',
              border: seccionActiva === 'lista-compra' ? '2px solid #bae6fd' : '1px solid #f1f5f9',
              backgroundColor: seccionActiva === 'lista-compra' ? '#f0f9ff' : '#ffffff',
              color: seccionActiva === 'lista-compra' ? '#0284c7' : '#334155',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              width: '100%',
              boxShadow: seccionActiva === 'lista-compra' ? '0 2px 8px rgba(2, 132, 199, 0.08)' : 'none'
            }}
            onMouseOver={(e) => {
              if (seccionActiva !== 'lista-compra') {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }
            }}
            onMouseOut={(e) => {
              if (seccionActiva !== 'lista-compra') {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#f1f5f9';
              }
            }}
          >
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: seccionActiva === 'lista-compra' ? '#e0f2fe' : '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0
            }}>
              🛒
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 800 }}>
                Lista de la Compra
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                Artículos, Carrito y Finanzas
              </div>
            </div>
            {seccionActiva === 'lista-compra' && (
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#0284c7',
                flexShrink: 0
              }} />
            )}
          </button>
        </div>

        {/* PIE DEL MENÚ LATERAL */}
        <div style={{
          padding: '16px 14px',
          borderTop: '1px solid #f1f5f9',
          backgroundColor: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <button
            onClick={onCerrarSesion}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px 14px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              transition: 'background-color 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#fecaca')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#fee2e2')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Cerrar Sesión</span>
          </button>

          <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
            Planificador Familiar • v1.2
          </div>
        </div>
      </aside>
    </>
  );
}
