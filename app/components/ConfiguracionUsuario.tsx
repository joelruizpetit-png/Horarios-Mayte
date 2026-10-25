"use client";
import React, { useState, useEffect } from 'react';
import { formatearNombreFamiliar } from '../utils/actividad';
import {
  SONIDOS_ALARMA_DISPONIBLES,
  obtenerPreferenciasAlarma,
  guardarPreferenciasAlarma,
  obtenerSonidoAlarmaPorId,
  reproducirSonidoAlarma,
  detenerSonidoAlarma,
  obtenerClaveStorageAlarma,
  type PreferenciasAlarmaUsuario
} from '../utils/sonidosAlarma';

interface ConfiguracionUsuarioProps {
  usuario?: {
    email?: string | null;
    displayName?: string | null;
  } | null;
  onSimularAlarmaCalendario?: () => void;
}

export default function ConfiguracionUsuario({
  usuario,
  onSimularAlarmaCalendario
}: ConfiguracionUsuarioProps) {
  const emailActivo = usuario?.email || '';
  const nombreFamiliar = formatearNombreFamiliar(usuario?.displayName, emailActivo);
  const esJoel = nombreFamiliar === 'Joel';

  const [prefs, setPrefs] = useState<PreferenciasAlarmaUsuario>(() =>
    obtenerPreferenciasAlarma(emailActivo, usuario?.displayName)
  );
  const [reproduciendo, setReproduciendo] = useState<boolean>(false);
  const [mensajeGuardado, setMensajeGuardado] = useState<string>('');

  // Cargar preferencias cuando cambie el usuario activo
  useEffect(() => {
    setPrefs(obtenerPreferenciasAlarma(emailActivo, usuario?.displayName));
    return () => {
      detenerSonidoAlarma();
    };
  }, [emailActivo, usuario?.displayName]);

  const mostrarFeedbackGuardado = (texto = 'Preferencia guardada automáticamente') => {
    setMensajeGuardado(texto);
    setTimeout(() => {
      setMensajeGuardado((actual) => (actual === texto ? '' : actual));
    }, 2400);
  };

  const cambiarSonido = (nuevoSonidoId: string) => {
    detenerSonidoAlarma();
    setReproduciendo(false);
    const nuevas = guardarPreferenciasAlarma(
      { sonidoId: nuevoSonidoId },
      emailActivo,
      usuario?.displayName
    );
    setPrefs(nuevas);
    const info = obtenerSonidoAlarmaPorId(nuevoSonidoId);
    mostrarFeedbackGuardado(`Tono "${info.nombre}" guardado para ${nombreFamiliar}`);
  };

  const cambiarVolumen = (nuevoVolumen: number) => {
    const nuevas = guardarPreferenciasAlarma(
      { volumen: nuevoVolumen },
      emailActivo,
      usuario?.displayName
    );
    setPrefs(nuevas);
  };

  const cambiarAntelacion = (minutos: number) => {
    const nuevas = guardarPreferenciasAlarma(
      { minutosAntelacion: minutos },
      emailActivo,
      usuario?.displayName
    );
    setPrefs(nuevas);
    mostrarFeedbackGuardado(
      minutos === 0
        ? 'Alarma configurada a la hora exacta del evento'
        : `Alarma configurada ${minutos} min antes del evento`
    );
  };

  const toggleAlarmaActiva = () => {
    const nuevoEstado = !prefs.activa;
    if (!nuevoEstado) {
      detenerSonidoAlarma();
      setReproduciendo(false);
    }
    const nuevas = guardarPreferenciasAlarma(
      { activa: nuevoEstado },
      emailActivo,
      usuario?.displayName
    );
    setPrefs(nuevas);
    mostrarFeedbackGuardado(
      nuevoEstado
        ? `Alarmas sonoras activadas para ${nombreFamiliar}`
        : `Alarmas sonoras silenciadas para ${nombreFamiliar}`
    );
  };

  const probarSonidoSeleccionado = (idEspecifico?: string) => {
    const idAProbar = idEspecifico || prefs.sonidoId;

    if (reproduciendo && !idEspecifico) {
      detenerSonidoAlarma();
      setReproduciendo(false);
      return;
    }

    setReproduciendo(true);
    reproducirSonidoAlarma({
      sonidoId: idAProbar,
      volumen: prefs.volumen,
      email: emailActivo,
      displayName: usuario?.displayName,
      onEnded: () => {
        setReproduciendo(false);
      }
    });
  };

  const sonidoActualMeta = obtenerSonidoAlarmaPorId(prefs.sonidoId);
  const claveStorage = obtenerClaveStorageAlarma(emailActivo, usuario?.displayName);

  return (
    <div style={{ width: '100%', maxWidth: '500px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* TARJETA DE CABECERA DEL PERFIL DE USUARIO */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          borderRadius: '18px',
          padding: '18px',
          boxShadow: '0 8px 20px rgba(15, 23, 42, 0.16)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: esJoel ? '#2563eb' : '#ef4444',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 800,
              border: '2px solid rgba(255, 255, 255, 0.7)',
              flexShrink: 0
            }}
          >
            {esJoel ? 'J' : 'A'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
                Preferencias de {nombreFamiliar}
              </h2>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  color: '#e2e8f0'
                }}
              >
                Activo
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.72)' }}>
              {emailActivo || 'Configuración personal del dispositivo'}
            </p>
          </div>
        </div>
        <div style={{ fontSize: '26px' }}>⚙️</div>
      </div>

      {/* NOTIFICACIÓN DE GUARDADO AUTOMÁTICO */}
      {mensajeGuardado && (
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '12.5px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.08)'
          }}
        >
          <span>✅</span>
          <span>{mensajeGuardado}</span>
        </div>
      )}

      {/* SECCIÓN PRINCIPAL: SONIDO DE ALARMA */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          padding: '18px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: '#eff6ff',
                color: '#0047b3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0
              }}
            >
              🔔
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                Sonido de Alarma
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
                Elige el tono que sonará en tus avisos del calendario
              </p>
            </div>
          </div>

          {/* INTERRUPTOR ACTIVAR / SILENCIAR */}
          <button
            type="button"
            onClick={toggleAlarmaActiva}
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: 800,
              border: prefs.activa ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
              backgroundColor: prefs.activa ? '#ecfdf5' : '#f1f5f9',
              color: prefs.activa ? '#047857' : '#64748b',
              cursor: 'pointer'
            }}
          >
            {prefs.activa ? '🔊 Activadas' : '🔇 Silenciadas'}
          </button>
        </div>

        {/* SELECTOR DESPLEGABLE + BOTÓN PROBAR SONIDO */}
        <div>
          <label
            htmlFor="selector-sonido-alarma"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155',
              marginBottom: '6px'
            }}
          >
            Tono seleccionado para {nombreFamiliar}:
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
            <select
              id="selector-sonido-alarma"
              value={prefs.sonidoId}
              onChange={(e) => cambiarSonido(e.target.value)}
              style={{
                flex: 1,
                padding: '11px 12px',
                borderRadius: '12px',
                border: '2px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {SONIDOS_ALARMA_DISPONIBLES.map((sonido) => (
                <option key={sonido.id} value={sonido.id}>
                  {sonido.icono} {sonido.nombre}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => probarSonidoSeleccionado()}
              style={{
                padding: '0 16px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: reproduciendo ? '#dc2626' : '#0047b3',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                boxShadow: reproduciendo
                  ? '0 4px 12px rgba(220, 38, 38, 0.25)'
                  : '0 4px 12px rgba(0, 71, 179, 0.22)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{reproduciendo ? '⏹️' : '▶️'}</span>
              <span>{reproduciendo ? 'Detener' : 'Probar Sonido'}</span>
            </button>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
            {sonidoActualMeta.descripcion} • Archivo: <code>{sonidoActualMeta.archivo}</code>
          </p>
        </div>

        {/* TARJETAS RÁPIDAS DE TONOS DISPONIBLES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Catálogo de tonos disponibles
          </span>
          {SONIDOS_ALARMA_DISPONIBLES.map((item) => {
            const seleccionado = prefs.sonidoId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => cambiarSonido(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: seleccionado ? '2px solid #0047b3' : '1px solid #e2e8f0',
                  backgroundColor: seleccionado ? '#eff6ff' : '#f8fafc',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>{item.icono}</span>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: seleccionado ? 800 : 700, color: seleccionado ? '#0047b3' : '#1e293b' }}>
                      {item.nombre}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {item.descripcion}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    probarSonidoSeleccionado(item.id);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  🔊 Escuchar
                </button>
              </div>
            );
          })}
        </div>

        {/* CONTROL DE VOLUMEN */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            padding: '12px 14px',
            border: '1px solid #e2e8f0'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label htmlFor="slider-volumen-alarma" style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
              🔉 Volumen de reproducción
            </label>
            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0047b3' }}>
              {Math.round(prefs.volumen * 100)}%
            </span>
          </div>
          <input
            id="slider-volumen-alarma"
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={prefs.volumen}
            onChange={(e) => cambiarVolumen( parseFloat(e.target.value) )}
            style={{ width: '100%', cursor: 'pointer', accentColor: '#0047b3' }}
          />
        </div>

        {/* MOMENTO DE DISPARO DE LA ALARMA EN EL CALENDARIO */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            padding: '12px 14px',
            border: '1px solid #e2e8f0'
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: '12.5px',
              fontWeight: 700,
              color: '#334155',
              marginBottom: '8px'
            }}
          >
            ⏰ ¿Cuándo hacer sonar la alarma del evento?
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {[
              { min: 0, texto: 'A la hora en punto' },
              { min: 5, texto: '5 minutos antes' },
              { min: 15, texto: '15 minutos antes' },
              { min: 30, texto: '30 minutos antes' }
            ].map((op) => {
              const activo = prefs.minutosAntelacion === op.min;
              return (
                <button
                  key={op.min}
                  type="button"
                  onClick={() => cambiarAntelacion(op.min)}
                  style={{
                    padding: '9px 10px',
                    borderRadius: '10px',
                    border: activo ? '2px solid #0047b3' : '1px solid #cbd5e1',
                    backgroundColor: activo ? '#eff6ff' : '#ffffff',
                    color: activo ? '#0047b3' : '#475569',
                    fontSize: '12px',
                    fontWeight: activo ? 800 : 600,
                    cursor: 'pointer'
                  }}
                >
                  {op.texto}
                </button>
              );
            })}
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
            Nota: Si eliges antelación (ej. 15 min antes), la alarma sonará tanto en el aviso previo como a la hora exacta del evento.
          </p>
        </div>

        {/* BOTÓN PARA PROBAR UNA ALARMA REAL DEL CALENDARIO */}
        {onSimularAlarmaCalendario && (
          <button
            type="button"
            onClick={onSimularAlarmaCalendario}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid #bfdbfe',
              backgroundColor: '#eff6ff',
              color: '#0047b3',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>🔔</span>
            <span>Simular aviso de Alarma del Calendario ahora</span>
          </button>
        )}
      </div>

      {/* INFORMACIÓN DE PERSISTENCIA */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          borderRadius: '14px',
          padding: '12px 16px',
          border: '1px solid #e2e8f0',
          fontSize: '11.5px',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}
      >
        <span>💾 Preferencia vinculada a <strong>{nombreFamiliar}</strong> en este navegador</span>
        <code style={{ fontSize: '10.5px', color: '#475569', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '6px' }}>
          {claveStorage}
        </code>
      </div>
    </div>
  );
}
