"use client";
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { formatearNombreFamiliar } from '../utils/actividad';
import { APP_VERSION } from '../data/version';

export type SeccionPrincipal = 'planificador' | 'finanzas' | 'bloc-notas' | 'lista-compra' | 'horas-trabajadas' | 'quinielas' | 'quinielas-estadisticas' | 'quinielas-historial';

interface MenuLateralProps {
  abierto: boolean;
  onCerrar: () => void;
  seccionActiva: SeccionPrincipal;
  onCambiarSeccion: (seccion: SeccionPrincipal) => void;
  usuario: {
    displayName?: string | null;
    email?: string | null;
  } | null;
  onCerrarSesion: () => void;
  onAbrirNovedadesVersion?: () => void;
  zonaPrivadaDesbloqueada?: boolean;
  onBloquearZonaPrivada?: () => void;
  onCambiarPinZonaPrivada?: () => void;
}

export default function MenuLateral({
  abierto,
  onCerrar,
  seccionActiva,
  onCambiarSeccion,
  usuario,
  onCerrarSesion,
  onAbrirNovedadesVersion,
  zonaPrivadaDesbloqueada = false,
  onBloquearZonaPrivada,
  onCambiarPinZonaPrivada
}: MenuLateralProps) {
  const esSeccionPrivada = seccionActiva === 'finanzas' || seccionActiva === 'bloc-notas';
  const [zonaPrivadaAbierta, setZonaPrivadaAbierta] = useState(esSeccionPrivada);
  const [quinielasAbierto, setQuinielasAbierto] = useState(seccionActiva.startsWith('quinielas'));

  useEffect(() => {
    if (seccionActiva.startsWith('quinielas')) setQuinielasAbierto(true);
    if (seccionActiva === 'finanzas' || seccionActiva === 'bloc-notas') setZonaPrivadaAbierta(true);
  }, [seccionActiva]);

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
  const nombreMostrado = formatearNombreFamiliar(usuario?.displayName, email);
  const esJoel = nombreMostrado === 'Joel';
  const inicial = esJoel ? 'J' : 'A';

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
            <Image
              src="/icon.png"
              alt="Logo de Planificador Familiar"
              width={38}
              height={38}
              style={{
                width: '38px',
                height: '38px',
                objectFit: 'contain',
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}
            />
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

          {/* OPCIÓN 2: ZONA PRIVADA (FINANZAS FAMILIARES + BLOC DE NOTAS) */}
          <div
            style={{
              border:
                zonaPrivadaAbierta || esSeccionPrivada
                  ? zonaPrivadaDesbloqueada
                    ? '2px solid #a7f3d0'
                    : '2px solid #c7d2fe'
                  : '1px solid #f1f5f9',
              borderRadius: '12px',
              background:
                zonaPrivadaAbierta || esSeccionPrivada
                  ? zonaPrivadaDesbloqueada
                    ? '#f0fdf4'
                    : '#f8fafc'
                  : '#ffffff',
              overflow: 'hidden',
              transition: 'all 0.15s ease'
            }}
          >
            <button
              type="button"
              onClick={() => setZonaPrivadaAbierta((abiertoActual) => !abiertoActual)}
              aria-expanded={zonaPrivadaAbierta}
              aria-controls="submenu-zona-privada"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                width: '100%',
                border: 0,
                background: 'transparent',
                color: esSeccionPrivada ? '#0f172a' : '#334155',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: zonaPrivadaDesbloqueada ? '#d1fae5' : '#e0e7ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0
                }}
              >
                {zonaPrivadaDesbloqueada ? '🔓' : '🔒'}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800 }}>Zona Privada</span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '999px',
                      backgroundColor: zonaPrivadaDesbloqueada ? '#dcfce7' : '#e0e7ff',
                      color: zonaPrivadaDesbloqueada ? '#15803d' : '#3730a3'
                    }}
                  >
                    {zonaPrivadaDesbloqueada ? 'Abierta' : 'PIN'}
                  </span>
                </span>
                <span style={{ display: 'block', marginTop: '2px', color: '#64748b', fontSize: '11px', fontWeight: 500 }}>
                  Finanzas y Bloc de Notas
                </span>
              </span>
              <span aria-hidden="true" style={{ fontSize: '14px', color: '#64748b' }}>
                {zonaPrivadaAbierta ? '⌄' : '›'}
              </span>
            </button>

            {zonaPrivadaAbierta && (
              <div
                id="submenu-zona-privada"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '0 10px 10px 16px'
                }}
              >
                {/* SUB-OPCIÓN 2.1: FINANZAS FAMILIARES */}
                <button
                  type="button"
                  onClick={() => {
                    onCambiarSeccion('finanzas');
                    onCerrar();
                  }}
                  aria-current={seccionActiva === 'finanzas' ? 'page' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    border: seccionActiva === 'finanzas' ? '1px solid #a7f3d0' : '1px solid transparent',
                    borderRadius: '10px',
                    padding: '9px 11px',
                    background: seccionActiva === 'finanzas' ? '#ecfdf5' : '#ffffff',
                    color: seccionActiva === 'finanzas' ? '#047857' : '#334155',
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>💰</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: seccionActiva === 'finanzas' ? 800 : 700 }}>
                      Finanzas Familiares
                    </span>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b' }}>
                      Gastos, Ingresos y Balance
                    </span>
                  </span>
                  {!zonaPrivadaDesbloqueada && (
                    <span style={{ fontSize: '12px', opacity: 0.7 }} title="Requiere PIN">
                      🔒
                    </span>
                  )}
                </button>

                {/* SUB-OPCIÓN 2.2: BLOC DE NOTAS Y CONTRASEÑAS */}
                <button
                  type="button"
                  onClick={() => {
                    onCambiarSeccion('bloc-notas');
                    onCerrar();
                  }}
                  aria-current={seccionActiva === 'bloc-notas' ? 'page' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    border: seccionActiva === 'bloc-notas' ? '1px solid #c4b5fd' : '1px solid transparent',
                    borderRadius: '10px',
                    padding: '9px 11px',
                    background: seccionActiva === 'bloc-notas' ? '#f5f3ff' : '#ffffff',
                    color: seccionActiva === 'bloc-notas' ? '#5b21b6' : '#334155',
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>🔐</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: seccionActiva === 'bloc-notas' ? 800 : 700 }}>
                      Bloc de Notas
                    </span>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b' }}>
                      Contraseñas y Datos Confidenciales
                    </span>
                  </span>
                  {!zonaPrivadaDesbloqueada && (
                    <span style={{ fontSize: '12px', opacity: 0.7 }} title="Requiere PIN">
                      🔒
                    </span>
                  )}
                </button>

                {/* CONTROLES DE SEGURIDAD RÁPIDOS CUANDO ESTÁ DESBLOQUEADA */}
                {zonaPrivadaDesbloqueada && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      marginTop: '2px',
                      paddingTop: '6px',
                      borderTop: '1px dashed #cbd5e1'
                    }}
                  >
                    {onCambiarPinZonaPrivada && (
                      <button
                        type="button"
                        onClick={() => {
                          onCambiarPinZonaPrivada();
                          onCerrar();
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#475569',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        ⚙️ Cambiar PIN
                      </button>
                    )}
                    {onBloquearZonaPrivada && (
                      <button
                        type="button"
                        onClick={() => {
                          onBloquearZonaPrivada();
                          onCerrar();
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: '1px solid #fecaca',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        🔒 Bloquear
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

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

          {/* OPCIÓN 4: HORAS TRABAJADAS */}
          <button
            onClick={() => {
              onCambiarSeccion('horas-trabajadas');
              onCerrar();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '12px',
              border: seccionActiva === 'horas-trabajadas' ? '2px solid #c7d2fe' : '1px solid #f1f5f9',
              backgroundColor: seccionActiva === 'horas-trabajadas' ? '#eef2ff' : '#ffffff',
              color: seccionActiva === 'horas-trabajadas' ? '#4338ca' : '#334155',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              width: '100%',
              boxShadow: seccionActiva === 'horas-trabajadas' ? '0 2px 8px rgba(67, 56, 202, 0.08)' : 'none'
            }}
            onMouseOver={(e) => {
              if (seccionActiva !== 'horas-trabajadas') {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }
            }}
            onMouseOut={(e) => {
              if (seccionActiva !== 'horas-trabajadas') {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#f1f5f9';
              }
            }}
          >
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: seccionActiva === 'horas-trabajadas' ? '#e0e7ff' : '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0
            }}>
              ⏱️
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 800 }}>
                Horas Trabajadas
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                Cómputo Semanal de Joel y Ana
              </div>
            </div>
            {seccionActiva === 'horas-trabajadas' && (
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#4338ca',
                flexShrink: 0
              }} />
            )}
          </button>

          {/* OPCIÓN 5: QUINIELAS Y SU SUBMENÚ */}
          <div style={{ border: quinielasAbierto || seccionActiva.startsWith('quinielas') ? '2px solid #fde68a' : '1px solid #f1f5f9', borderRadius: 12, background: quinielasAbierto || seccionActiva.startsWith('quinielas') ? '#fffbeb' : '#fff', overflow: 'hidden' }}>
            <button
              onClick={() => setQuinielasAbierto((abierto) => !abierto)}
              aria-expanded={quinielasAbierto}
              aria-controls="submenu-quinielas"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', width: '100%', border: 0, background: 'transparent', color: quinielasAbierto || seccionActiva.startsWith('quinielas') ? '#92400e' : '#334155', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ width: 38, height: 38, borderRadius: 10, background: quinielasAbierto || seccionActiva.startsWith('quinielas') ? '#fef3c7' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎟️</span>
              <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>Quinielas</span><span style={{ display: 'block', marginTop: 2, color: '#64748b', fontSize: 11 }}>Boletos, estadísticas e historial</span></span>
              <span aria-hidden="true" style={{ fontSize: 14 }}>{quinielasAbierto ? '⌄' : '›'}</span>
            </button>
            {quinielasAbierto && (
              <div id="submenu-quinielas" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 10px 10px 60px' }}>
                {([
                  ['quinielas', 'Mis boletos'],
                  ['quinielas-estadisticas', 'Estadísticas'],
                  ['quinielas-historial', 'Historial'],
                ] as const).map(([seccion, titulo]) => (
                  <button key={seccion} onClick={() => { onCambiarSeccion(seccion); onCerrar(); }} aria-current={seccionActiva === seccion ? 'page' : undefined} style={{ border: 0, borderRadius: 8, padding: '9px 10px', background: seccionActiva === seccion ? '#fef3c7' : 'transparent', color: seccionActiva === seccion ? '#92400e' : '#475569', textAlign: 'left', fontWeight: seccionActiva === seccion ? 800 : 600, fontSize: 13, cursor: 'pointer' }}>
                    {titulo}
                  </button>
                ))}
              </div>
            )}
          </div>
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

          <button
            type="button"
            onClick={() => {
              if (onAbrirNovedadesVersion) {
                onAbrirNovedadesVersion();
                onCerrar();
              }
            }}
            title="Ver novedades de la versión"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'center',
              fontSize: '11px',
              color: '#64748b',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              padding: '6px',
              borderRadius: '8px',
              transition: 'all 0.15s ease',
              width: '100%'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#0047b3';
              e.currentTarget.style.backgroundColor = '#f1f5f9';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#64748b';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>Planificador Familiar • v{APP_VERSION}</span>
            <span style={{ fontSize: '13px' }}>✨</span>
          </button>
        </div>
      </aside>
    </>
  );
}
