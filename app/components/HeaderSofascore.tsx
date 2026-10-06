"use client";
import React from 'react';
import { formatearNombreFamiliar } from '../utils/actividad';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
}

interface HeaderSofascoreProps {
  usuario: {
    displayName?: string | null;
    email?: string | null;
  } | null;
  onCerrarSesion: () => void;
  tabActiva: string;
  onTabChange: (tabId: string) => void;
  tabs?: TabItem[];
  onAbrirMenuLateral?: () => void;
  seccionActiva?: 'planificador' | 'finanzas' | 'lista-compra';
  onCambiarSeccion?: (seccion: 'planificador' | 'finanzas' | 'lista-compra') => void;
}

const DEFAULT_TABS: TabItem[] = [
  { id: 'general', label: 'General' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'deportes', label: 'Deportes', icon: '🏆' },
  { id: 'menu-alma', label: 'Menú Alma', icon: '🍴' },
];

export default function HeaderSofascore({
  usuario,
  onCerrarSesion,
  tabActiva,
  onTabChange,
  tabs = DEFAULT_TABS,
  onAbrirMenuLateral,
  seccionActiva = 'planificador',
  onCambiarSeccion
}: HeaderSofascoreProps) {
  const nombreUsuario = formatearNombreFamiliar(usuario?.displayName, usuario?.email);

  return (
    <header style={{
      width: '100%',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backgroundColor: '#ffffff',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
    }}>
      {/* BARRA PRINCIPAL SUPERIOR ESTILO SOFASCORE (AZUL ICÓNICO) */}
      <div style={{
        background: 'linear-gradient(90deg, #0047b3 0%, #0258b8 50%, #003a94 100%)',
        color: '#ffffff',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '500px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* LOGO / TÍTULO DE LA APLICACIÓN Y BOTÓN MENÚ HAMBURGUESA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* BOTÓN MENÚ HAMBURGUESA */}
            {onAbrirMenuLateral && (
              <button
                onClick={onAbrirMenuLateral}
                aria-label="Abrir menú lateral de navegación"
                title="Abrir menú"
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#ffffff',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.28)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}

            <div style={{
              width: '34px',
              height: '34px',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              fontWeight: 800,
              fontSize: '18px',
              color: '#0047b3',
              flexShrink: 0
            }}>
              PF
            </div>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 800,
                letterSpacing: '-0.3px',
                lineHeight: 1.1,
                color: '#ffffff'
              }}>
                Planificador Familiar
              </h1>
              <span style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.8)',
                fontWeight: 500
              }}>
                Hola, {nombreUsuario}
              </span>
            </div>
          </div>

          {/* BOTÓN CERRAR SESIÓN */}
          <button
            onClick={onCerrarSesion}
            title="Cerrar sesión"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              border: '1px solid rgba(255, 255, 255, 0.35)',
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(4px)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
          >
            <span>Salir</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* SUB-HEADER: SI ESTAMOS EN FINANZAS O EN EL PLANIFICADOR */}
      {seccionActiva === 'finanzas' ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          padding: '10px 16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '500px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>💰</span>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#047857' }}>
                  Finanzas Familiares
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 500 }}>
                  Control de Gastos e Ingresos
                </span>
              </div>
            </div>
            {onCambiarSeccion && (
              <button
                onClick={() => onCambiarSeccion('planificador')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
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
                <span>📅 Ver Agenda</span>
              </button>
            )}
          </div>
        </div>
      ) : seccionActiva === 'lista-compra' ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          padding: '10px 16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '500px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🛒</span>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0284c7' }}>
                  Lista de la Compra
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 500 }}>
                  Artículos del Hogar & Supermercado
                </span>
              </div>
            </div>
            {onCambiarSeccion && (
              <button
                onClick={() => onCambiarSeccion('planificador')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
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
                <span>📅 Ver Agenda</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* BARRA DE PESTAÑAS SUB-HEADER ESTILO SOFASCORE */
        <nav 
          aria-label="Pestañas de navegación"
          style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'center',
            width: '100%'
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: '500px',
            display: 'flex',
            alignItems: 'stretch',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {tabs.map((tab) => {
              const esActiva = tabActiva === tab.id || 
                (tab.id === 'menu-alma' && tabActiva === 'tab4') || 
                (tab.id === 'tab4' && tabActiva === 'menu-alma');

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  role="tab"
                  aria-selected={esActiva}
                  style={{
                    flex: '1 0 auto',
                    minWidth: '75px',
                    padding: '13px 12px 11px 12px',
                    background: esActiva ? '#ffffff' : 'transparent',
                    border: 'none',
                    outline: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: esActiva ? 700 : 600,
                    color: esActiva ? '#0047b3' : '#64748b',
                    letterSpacing: '-0.2px',
                    textTransform: 'none',
                    transition: 'color 0.15s ease, background-color 0.15s ease',
                    userSelect: 'none'
                  }}
                  onMouseOver={(e) => {
                    if (!esActiva) {
                      e.currentTarget.style.color = '#0f172a';
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!esActiva) {
                      e.currentTarget.style.color = '#64748b';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {tab.icon && <span style={{ fontSize: '14px', lineHeight: 1 }}>{tab.icon}</span>}
                    <span>{tab.label}</span>
                  </span>

                  {/* LÍNEA INDICADORA INFERIOR ESTILO SOFASCORE */}
                  {esActiva && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: '12%',
                        right: '12%',
                        height: '3px',
                        backgroundColor: '#0047b3',
                        borderRadius: '3px 3px 0 0',
                        boxShadow: '0 -1px 3px rgba(0, 71, 179, 0.3)'
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
