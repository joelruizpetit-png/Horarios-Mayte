"use client";
import React, { useState, useEffect, useCallback } from 'react';
import {
  obtenerConfiguracionZonaPrivada,
  guardarPinZonaPrivada,
  verificarPinConHash,
  type ConfiguracionZonaPrivada
} from '../utils/bovedaSeguridad';

interface ModalPinPrivadoProps {
  abierto: boolean;
  modo?: 'desbloquear' | 'cambiar';
  onCerrar: () => void;
  onExito: () => void;
  usuario?: {
    email?: string | null;
    displayName?: string | null;
  } | null;
  destinoNombre?: string;
}

type EtapaFlujo =
  | 'cargando'
  | 'verificar_acceso'
  | 'crear_pin_1'
  | 'crear_pin_2'
  | 'cambiar_verificar_actual'
  | 'cambiar_nuevo_1'
  | 'cambiar_nuevo_2';

export default function ModalPinPrivado({
  abierto,
  modo = 'desbloquear',
  onCerrar,
  onExito,
  usuario,
  destinoNombre
}: ModalPinPrivadoProps) {
  const [etapa, setEtapa] = useState<EtapaFlujo>('cargando');
  const [configActual, setConfigActual] = useState<ConfiguracionZonaPrivada | null>(null);
  const [pinEntrada, setPinEntrada] = useState<string>('');
  const [pinTemporal, setPinTemporal] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [guardando, setGuardando] = useState<boolean>(false);
  const [exitoMensaje, setExitoMensaje] = useState<string>('');

  // Cargar configuración de Firestore al abrir el modal
  useEffect(() => {
    if (!abierto) {
      setPinEntrada('');
      setPinTemporal('');
      setErrorMsg('');
      setExitoMensaje('');
      return;
    }

    let cancelado = false;
    setEtapa('cargando');
    setPinEntrada('');
    setPinTemporal('');
    setErrorMsg('');
    setExitoMensaje('');

    obtenerConfiguracionZonaPrivada()
      .then((cfg) => {
        if (cancelado) return;
        setConfigActual(cfg);
        if (!cfg.configurado) {
          setEtapa('crear_pin_1');
        } else if (modo === 'cambiar') {
          setEtapa('cambiar_verificar_actual');
        } else {
          setEtapa('verificar_acceso');
        }
      })
      .catch(() => {
        if (cancelado) return;
        setErrorMsg('No se pudo conectar con Firebase. Revisa tu conexión.');
        setEtapa('verificar_acceso');
      });

    return () => {
      cancelado = true;
    };
  }, [abierto, modo]);

  const procesarPinCompleto = useCallback(
    async (pin4: string) => {
      setErrorMsg('');

      if (etapa === 'verificar_acceso') {
        if (!configActual?.pinHash || !configActual?.salt) {
          setErrorMsg('Error de configuración del PIN.');
          setPinEntrada('');
          return;
        }
        const valido = verificarPinConHash(pin4, configActual.pinHash, configActual.salt);
        if (valido) {
          onExito();
        } else {
          setErrorMsg('PIN incorrecto. Inténtalo de nuevo.');
          setPinEntrada('');
        }
        return;
      }

      if (etapa === 'crear_pin_1') {
        setPinTemporal(pin4);
        setPinEntrada('');
        setEtapa('crear_pin_2');
        return;
      }

      if (etapa === 'crear_pin_2') {
        if (pin4 !== pinTemporal) {
          setErrorMsg('Los PIN no coinciden. Empecemos de nuevo.');
          setPinTemporal('');
          setPinEntrada('');
          setEtapa('crear_pin_1');
          return;
        }
        try {
          setGuardando(true);
          await guardarPinZonaPrivada(pin4, usuario?.email, usuario?.displayName);
          setGuardando(false);
          onExito();
        } catch {
          setGuardando(false);
          setErrorMsg('Error al guardar el PIN en Firebase.');
          setPinEntrada('');
        }
        return;
      }

      if (etapa === 'cambiar_verificar_actual') {
        if (!configActual?.pinHash || !configActual?.salt) {
          setErrorMsg('Error al validar el PIN actual.');
          setPinEntrada('');
          return;
        }
        const valido = verificarPinConHash(pin4, configActual.pinHash, configActual.salt);
        if (valido) {
          setPinEntrada('');
          setEtapa('cambiar_nuevo_1');
        } else {
          setErrorMsg('El PIN actual no es correcto.');
          setPinEntrada('');
        }
        return;
      }

      if (etapa === 'cambiar_nuevo_1') {
        setPinTemporal(pin4);
        setPinEntrada('');
        setEtapa('cambiar_nuevo_2');
        return;
      }

      if (etapa === 'cambiar_nuevo_2') {
        if (pin4 !== pinTemporal) {
          setErrorMsg('La confirmación no coincide. Introduce el nuevo PIN otra vez.');
          setPinTemporal('');
          setPinEntrada('');
          setEtapa('cambiar_nuevo_1');
          return;
        }
        try {
          setGuardando(true);
          await guardarPinZonaPrivada(pin4, usuario?.email, usuario?.displayName);
          setGuardando(false);
          setExitoMensaje('¡PIN actualizado correctamente!');
          setTimeout(() => {
            onExito();
          }, 900);
        } catch {
          setGuardando(false);
          setErrorMsg('No se pudo actualizar el PIN.');
          setPinEntrada('');
        }
      }
    },
    [etapa, configActual, pinTemporal, usuario, onExito]
  );

  const agregarDigito = useCallback(
    (digito: string) => {
      if (guardando || etapa === 'cargando' || exitoMensaje) return;
      setErrorMsg('');
      setPinEntrada((prev) => {
        if (prev.length >= 4) return prev;
        const nuevo = prev + digito;
        if (nuevo.length === 4) {
          setTimeout(() => {
            procesarPinCompleto(nuevo);
          }, 120);
        }
        return nuevo;
      });
    },
    [guardando, etapa, exitoMensaje, procesarPinCompleto]
  );

  const borrarUltimoDigito = useCallback(() => {
    if (guardando || etapa === 'cargando') return;
    setErrorMsg('');
    setPinEntrada((prev) => prev.slice(0, -1));
  }, [guardando, etapa]);

  const limpiarPin = useCallback(() => {
    if (guardando || etapa === 'cargando') return;
    setErrorMsg('');
    setPinEntrada('');
  }, [guardando, etapa]);

  // Soporte de teclado físico (números, Backspace, Escape)
  useEffect(() => {
    if (!abierto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        agregarDigito(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        borrarUltimoDigito();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCerrar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abierto, agregarDigito, borrarUltimoDigito, onCerrar]);

  if (!abierto) return null;

  // Textos dinámicos según la etapa
  let iconoCabecera = '🔒';
  let titulo = 'Zona Privada';
  let subtitulo = destinoNombre
    ? `Introduce el PIN para acceder a ${destinoNombre}`
    : 'Introduce el PIN familiar de 4 dígitos';

  if (etapa === 'crear_pin_1') {
    iconoCabecera = '🛡️';
    titulo = 'Configurar PIN Familiar';
    subtitulo = 'Primera vez: Crea un PIN común de 4 dígitos para proteger Finanzas y el Bloc de Notas.';
  } else if (etapa === 'crear_pin_2') {
    iconoCabecera = '🔁';
    titulo = 'Confirmar PIN';
    subtitulo = 'Vuelve a introducir los 4 dígitos para confirmar el PIN.';
  } else if (etapa === 'cambiar_verificar_actual') {
    iconoCabecera = '🔑';
    titulo = 'Cambiar PIN';
    subtitulo = 'Primero introduce el PIN actual de 4 dígitos.';
  } else if (etapa === 'cambiar_nuevo_1') {
    iconoCabecera = '✨';
    titulo = 'Nuevo PIN';
    subtitulo = 'Introduce el nuevo PIN de 4 dígitos que queréis usar.';
  } else if (etapa === 'cambiar_nuevo_2') {
    iconoCabecera = '✅';
    titulo = 'Confirmar Nuevo PIN';
    subtitulo = 'Repite el nuevo PIN de 4 dígitos para guardarlo.';
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-pin-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(6px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '360px',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0'
        }}
      >
        {/* CABECERA */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            padding: '22px 20px 18px 20px',
            textAlign: 'center',
            position: 'relative'
          }}
        >
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar ventana de PIN"
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>

          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              margin: '0 auto 10px auto'
            }}
          >
            {iconoCabecera}
          </div>

          <h2
            id="modal-pin-titulo"
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '-0.3px'
            }}
          >
            {titulo}
          </h2>
          <p
            style={{
              margin: '6px 0 0 0',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.78)',
              lineHeight: 1.4,
              fontWeight: 500
            }}
          >
            {subtitulo}
          </p>
        </div>

        {/* CUERPO DEL MODAL */}
        <div style={{ padding: '22px 24px 24px 24px' }}>
          {etapa === 'cargando' ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
              Verificando seguridad...
            </div>
          ) : (
            <>
              {/* INDICADORES DE LOS 4 DÍGITOS */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '14px',
                  marginBottom: '16px'
                }}
              >
                {[0, 1, 2, 3].map((idx) => {
                  const relleno = idx < pinEntrada.length;
                  return (
                    <div
                      key={idx}
                      style={{
                        width: '50px',
                        height: '56px',
                        borderRadius: '14px',
                        border: errorMsg
                          ? '2px solid #ef4444'
                          : relleno
                          ? '2px solid #0047b3'
                          : '2px solid #cbd5e1',
                        backgroundColor: errorMsg
                          ? '#fef2f2'
                          : relleno
                          ? '#eff6ff'
                          : '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                        boxShadow: relleno ? '0 4px 10px rgba(0, 71, 179, 0.12)' : 'none'
                      }}
                    >
                      <div
                        style={{
                          width: relleno ? '14px' : '8px',
                          height: relleno ? '14px' : '8px',
                          borderRadius: '50%',
                          backgroundColor: errorMsg
                            ? '#ef4444'
                            : relleno
                            ? '#0047b3'
                            : '#cbd5e1',
                          transition: 'all 0.15s ease'
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* MENSAJE DE ERROR O ÉXITO */}
              <div style={{ minHeight: '24px', textAlign: 'center', marginBottom: '12px' }}>
                {errorMsg && (
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626' }}>
                    ⚠️ {errorMsg}
                  </span>
                )}
                {exitoMensaje && (
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#059669' }}>
                    {exitoMensaje}
                  </span>
                )}
                {guardando && (
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0047b3' }}>
                    Guardando PIN de forma segura...
                  </span>
                )}
              </div>

              {/* TECLADO NUMÉRICO TÁCTIL */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px'
                }}
              >
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => agregarDigito(num)}
                    disabled={guardando}
                    style={{
                      height: '54px',
                      borderRadius: '14px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      color: '#0f172a',
                      fontSize: '20px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                      e.currentTarget.style.borderColor = '#bfdbfe';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                  >
                    {num}
                  </button>
                ))}

                {/* BOTÓN LIMPIAR */}
                <button
                  type="button"
                  onClick={limpiarPin}
                  disabled={guardando || pinEntrada.length === 0}
                  title="Borrar todo"
                  style={{
                    height: '54px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: pinEntrada.length === 0 ? 'default' : 'pointer',
                    opacity: pinEntrada.length === 0 ? 0.5 : 1
                  }}
                >
                  Borrar
                </button>

                {/* DÍGITO 0 */}
                <button
                  type="button"
                  onClick={() => agregarDigito('0')}
                  disabled={guardando}
                  style={{
                    height: '54px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '20px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#eff6ff';
                    e.currentTarget.style.borderColor = '#bfdbfe';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  0
                </button>

                {/* RETROCESO (⌫) */}
                <button
                  type="button"
                  onClick={borrarUltimoDigito}
                  disabled={guardando || pinEntrada.length === 0}
                  aria-label="Borrar último dígito"
                  style={{
                    height: '54px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: '18px',
                    fontWeight: 700,
                    cursor: pinEntrada.length === 0 ? 'default' : 'pointer',
                    opacity: pinEntrada.length === 0 ? 0.5 : 1
                  }}
                >
                  ⌫
                </button>
              </div>

              {/* NOTA DE SEGURIDAD AL PIE */}
              <div
                style={{
                  marginTop: '16px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: '#94a3b8',
                  fontWeight: 500
                }}
              >
                🔐 Protegido con hash criptográfico en Firebase
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
