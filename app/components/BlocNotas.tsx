"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { formatearNombreFamiliar } from '../utils/actividad';
import {
  cifrarTextoConfidencial,
  descifrarTextoConfidencial
} from '../utils/bovedaSeguridad';

export interface NotaConfidencial {
  id: string;
  titulo: string;
  categoria: 'Contraseñas' | 'Bancos' | 'Documentos' | 'Hogar' | 'Notas' | string;
  usuarioCuenta?: string;
  claveSecreta?: string;
  urlWeb?: string;
  contenido?: string;
  fijada?: boolean;
  creadorNombre?: string;
  creadorEmail?: string;
  actualizadoEn: string;
}

interface BlocNotasProps {
  usuario?: {
    email?: string | null;
    displayName?: string | null;
  } | null;
  onBloquearZona?: () => void;
  onCambiarPin?: () => void;
}

const CATEGORIAS_BLOC = [
  { id: 'Contraseñas', label: 'Contraseñas', icono: '🔑', color: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe' },
  { id: 'Bancos', label: 'Bancos y Tarjetas', icono: '🏦', color: '#047857', bg: '#d1fae5', border: '#a7f3d0' },
  { id: 'Documentos', label: 'Documentos / DNI', icono: '🪪', color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' },
  { id: 'Hogar', label: 'WiFi y Hogar', icono: '🏠', color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  { id: 'Notas', label: 'Notas Secretas', icono: '📝', color: '#334155', bg: '#f1f5f9', border: '#cbd5e1' },
];

function obtenerMetaCategoria(catId: string) {
  return CATEGORIAS_BLOC.find((c) => c.id === catId) || CATEGORIAS_BLOC[4];
}

export default function BlocNotas({
  usuario,
  onBloquearZona,
  onCambiarPin
}: BlocNotasProps) {
  const [notas, setNotas] = useState<NotaConfidencial[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');

  // Visibilidad de contraseñas por ID de nota
  const [clavesVisibles, setClavesVisibles] = useState<Record<string, boolean>>({});
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Estado del modal Crear / Editar
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);
  const [notaEditando, setNotaEditando] = useState<NotaConfidencial | null>(null);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [mostrarClaveForm, setMostrarClaveForm] = useState<boolean>(false);

  const [formTitulo, setFormTitulo] = useState<string>('');
  const [formCategoria, setFormCategoria] = useState<string>('Contraseñas');
  const [formUsuarioCuenta, setFormUsuarioCuenta] = useState<string>('');
  const [formClaveSecreta, setFormClaveSecreta] = useState<string>('');
  const [formUrlWeb, setFormUrlWeb] = useState<string>('');
  const [formContenido, setFormContenido] = useState<string>('');
  const [formFijada, setFormFijada] = useState<boolean>(false);

  // Suscripción en tiempo real a Firestore
  useEffect(() => {
    const q = query(collection(db, 'bloc_notas_privado'), orderBy('actualizadoEn', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const lista: NotaConfidencial[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          lista.push({
            id: docSnap.id,
            titulo: data.titulo || 'Sin título',
            categoria: data.categoria || 'Contraseñas',
            usuarioCuenta: data.usuarioCuenta ? descifrarTextoConfidencial(data.usuarioCuenta) : '',
            claveSecreta: data.claveSecreta ? descifrarTextoConfidencial(data.claveSecreta) : '',
            urlWeb: data.urlWeb || '',
            contenido: data.contenido ? descifrarTextoConfidencial(data.contenido) : '',
            fijada: Boolean(data.fijada),
            creadorNombre: data.creadorNombre || 'Familiar',
            creadorEmail: data.creadorEmail || '',
            actualizadoEn: data.actualizadoEn || new Date().toISOString()
          });
        });
        setNotas(lista);
        setCargando(false);
      },
      (error) => {
        console.error('Error al escuchar bloc_notas_privado:', error);
        setCargando(false);
      }
    );

    return () => unsub();
  }, []);

  const abrirModalNueva = () => {
    setNotaEditando(null);
    setFormTitulo('');
    setFormCategoria('Contraseñas');
    setFormUsuarioCuenta('');
    setFormClaveSecreta('');
    setFormUrlWeb('');
    setFormContenido('');
    setFormFijada(false);
    setMostrarClaveForm(false);
    setModalAbierto(true);
  };

  const abrirModalEditar = (nota: NotaConfidencial) => {
    setNotaEditando(nota);
    setFormTitulo(nota.titulo);
    setFormCategoria(nota.categoria);
    setFormUsuarioCuenta(nota.usuarioCuenta || '');
    setFormClaveSecreta(nota.claveSecreta || '');
    setFormUrlWeb(nota.urlWeb || '');
    setFormContenido(nota.contenido || '');
    setFormFijada(Boolean(nota.fijada));
    setMostrarClaveForm(false);
    setModalAbierto(true);
  };

  const generarClaveAleatoria = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 14; i++) {
      pass += chars[Math.floor(Math.random() * chars.length)];
    }
    setFormClaveSecreta(pass);
    setMostrarClaveForm(true);
  };

  const guardarNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim()) return;

    setGuardando(true);
    const autorNombre = formatearNombreFamiliar(usuario?.displayName, usuario?.email);
    const ahora = new Date().toISOString();

    const payload = {
      titulo: formTitulo.trim(),
      categoria: formCategoria,
      usuarioCuenta: formUsuarioCuenta.trim()
        ? cifrarTextoConfidencial(formUsuarioCuenta.trim())
        : '',
      claveSecreta: formClaveSecreta
        ? cifrarTextoConfidencial(formClaveSecreta)
        : '',
      urlWeb: formUrlWeb.trim(),
      contenido: formContenido.trim()
        ? cifrarTextoConfidencial(formContenido.trim())
        : '',
      fijada: formFijada,
      creadorNombre: autorNombre,
      creadorEmail: usuario?.email || '',
      actualizadoEn: ahora
    };

    try {
      if (notaEditando) {
        await updateDoc(doc(db, 'bloc_notas_privado', notaEditando.id), payload);
      } else {
        await addDoc(collection(db, 'bloc_notas_privado'), payload);
      }
      setModalAbierto(false);
    } catch (error) {
      console.error('Error al guardar en el bloc de notas:', error);
      window.alert('No se pudo guardar la nota. Revisa tu conexión.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarNota = async (nota: NotaConfidencial) => {
    const confirmar = window.confirm(`¿Seguro que quieres eliminar "${nota.titulo}" de la bóveda?`);
    if (!confirmar) return;
    try {
      await deleteDoc(doc(db, 'bloc_notas_privado', nota.id));
    } catch (error) {
      console.error('Error al eliminar nota:', error);
    }
  };

  const alternarFijada = async (nota: NotaConfidencial) => {
    try {
      await updateDoc(doc(db, 'bloc_notas_privado', nota.id), {
        fijada: !nota.fijada
      });
    } catch (error) {
      console.error('Error al fijar/desfijar nota:', error);
    }
  };

  const copiarAlPortapapeles = async (texto: string, identificadorFeedback: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(identificadorFeedback);
      setTimeout(() => {
        setCopiadoId((actual) => (actual === identificadorFeedback ? null : actual));
      }, 1800);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = texto;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiadoId(identificadorFeedback);
      setTimeout(() => setCopiadoId(null), 1800);
    }
  };

  const notasFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return notas
      .filter((n) => {
        if (filtroCategoria !== 'todas' && n.categoria !== filtroCategoria) return false;
        if (!q) return true;
        return (
          n.titulo.toLowerCase().includes(q) ||
          (n.usuarioCuenta || '').toLowerCase().includes(q) ||
          (n.contenido || '').toLowerCase().includes(q) ||
          n.categoria.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (Boolean(a.fijada) !== Boolean(b.fijada)) {
          return a.fijada ? -1 : 1;
        }
        return b.actualizadoEn.localeCompare(a.actualizadoEn);
      });
  }, [notas, busqueda, filtroCategoria]);

  const formatearFechaCorta = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '500px', marginTop: '14px' }}>
      {/* BARRA DE SEGURIDAD Y ACCIONES RÁPIDAS */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          color: '#ffffff',
          borderRadius: '18px',
          padding: '16px 18px',
          marginBottom: '14px',
          boxShadow: '0 8px 20px rgba(30, 27, 75, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0
              }}
            >
              🔐
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, letterSpacing: '-0.2px' }}>
                Bloc de Notas y Contraseñas
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'rgba(255, 255, 255, 0.75)' }}>
                Datos cifrados en vuestra Zona Privada
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={abrirModalNueva}
            style={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            + Añadir
          </button>
        </div>

        {/* BOTONES DE CONTROL DE SEGURIDAD (CAMBIAR PIN / BLOQUEAR) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255, 255, 255, 0.14)',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: 600 }}>
            🛡️ {notas.length} {notas.length === 1 ? 'registro guardado' : 'registros guardados'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {onCambiarPin && (
              <button
                type="button"
                onClick={onCambiarPin}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ⚙️ Cambiar PIN
              </button>
            )}
            {onBloquearZona && (
              <button
                type="button"
                onClick={onBloquearZona}
                style={{
                  background: 'rgba(239, 68, 68, 0.25)',
                  color: '#fecaca',
                  border: '1px solid rgba(254, 202, 202, 0.35)',
                  borderRadius: '8px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🔒 Bloquear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BUSCADOR Y FILTROS POR CATEGORÍA */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '14px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
        }}
      >
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="🔍 Buscar contraseña, banco, DNI, nota..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 34px 10px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              fontSize: '13px',
              color: '#0f172a',
              outline: 'none'
            }}
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              aria-label="Limpiar búsqueda"
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* CHIPS DE CATEGORÍA */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '2px',
            scrollbarWidth: 'none'
          }}
        >
          <button
            type="button"
            onClick={() => setFiltroCategoria('todas')}
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 700,
              border: filtroCategoria === 'todas' ? '1px solid #312e81' : '1px solid #e2e8f0',
              backgroundColor: filtroCategoria === 'todas' ? '#312e81' : '#f8fafc',
              color: filtroCategoria === 'todas' ? '#ffffff' : '#475569',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Todas ({notas.length})
          </button>
          {CATEGORIAS_BLOC.map((cat) => {
            const activa = filtroCategoria === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFiltroCategoria(cat.id)}
                style={{
                  padding: '6px 11px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: activa ? `1px solid ${cat.color}` : '1px solid #e2e8f0',
                  backgroundColor: activa ? cat.bg : '#f8fafc',
                  color: activa ? cat.color : '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>{cat.icono}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* LISTADO DE NOTAS Y CONTRASEÑAS */}
      {cargando ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '14px',
            border: '1px solid #e2e8f0'
          }}
        >
          Cargando bóveda privada...
        </div>
      ) : notasFiltradas.length === 0 ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            padding: '36px 20px',
            textAlign: 'center',
            border: '1px dashed #cbd5e1'
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔐</div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
            {busqueda || filtroCategoria !== 'todas'
              ? 'No hay resultados con ese filtro'
              : 'Tu Bloc de Notas Confidencial está vacío'}
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
            Guarda aquí vuestras contraseñas familiares, claves bancarias, códigos WiFi, números de póliza o apuntes privados.
          </p>
          <button
            type="button"
            onClick={abrirModalNueva}
            style={{
              backgroundColor: '#312e81',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            + Crear primera clave o nota
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notasFiltradas.map((nota) => {
            const meta = obtenerMetaCategoria(nota.categoria);
            const claveVisible = Boolean(clavesVisibles[nota.id]);

            return (
              <div
                key={nota.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: nota.fijada ? '2px solid #a5b4fc' : '1px solid #e2e8f0',
                  padding: '14px 16px',
                  boxShadow: nota.fijada
                    ? '0 4px 14px rgba(79, 70, 229, 0.08)'
                    : '0 2px 6px rgba(0, 0, 0, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {/* CABECERA DE LA TARJETA */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        backgroundColor: meta.bg,
                        border: `1px solid ${meta.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        flexShrink: 0
                      }}
                    >
                      {meta.icono}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                          {nota.titulo}
                        </h3>
                        {nota.fijada && (
                          <span
                            title="Fijada arriba"
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              backgroundColor: '#eef2ff',
                              color: '#4338ca',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              border: '1px solid #c7d2fe'
                            }}
                          >
                            📌 Fijada
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: meta.color
                          }}
                        >
                          {meta.label}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>•</span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Por {nota.creadorNombre} ({formatearFechaCorta(nota.actualizadoEn)})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BOTONES ACCIÓN TARJETA */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => alternarFijada(nota)}
                      title={nota.fijada ? 'Quitar fijado' : 'Fijar arriba'}
                      style={{
                        border: 'none',
                        background: nota.fijada ? '#eef2ff' : '#f8fafc',
                        borderRadius: '8px',
                        width: '30px',
                        height: '30px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      📌
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirModalEditar(nota)}
                      title="Editar"
                      style={{
                        border: 'none',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        width: '30px',
                        height: '30px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarNota(nota)}
                      title="Eliminar"
                      style={{
                        border: 'none',
                        background: '#fef2f2',
                        color: '#dc2626',
                        borderRadius: '8px',
                        width: '30px',
                        height: '30px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* CAMPO USUARIO / CUENTA / IDENTIFICADOR */}
                {nota.usuarioCuenta && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      gap: '8px'
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Usuario / Cuenta / ID
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#1e293b',
                          wordBreak: 'break-all'
                        }}
                      >
                        {nota.usuarioCuenta}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copiarAlPortapapeles(nota.usuarioCuenta!, `user-${nota.id}`)}
                      style={{
                        border: '1px solid #cbd5e1',
                        backgroundColor: copiadoId === `user-${nota.id}` ? '#dcfce7' : '#ffffff',
                        color: copiadoId === `user-${nota.id}` ? '#166534' : '#334155',
                        borderRadius: '8px',
                        padding: '5px 9px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      {copiadoId === `user-${nota.id}` ? '✓ Copiado' : '📋 Copiar'}
                    </button>
                  </div>
                )}

                {/* CAMPO CONTRASEÑA / CLAVE SECRETA */}
                {nota.claveSecreta && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#f5f3ff',
                      border: '1px solid #ddd6fe',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      gap: '8px'
                    }}
                  >
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase' }}>
                        Contraseña / Clave / PIN
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '14px',
                          fontWeight: 800,
                          fontFamily: claveVisible ? 'monospace' : 'inherit',
                          letterSpacing: claveVisible ? '0.4px' : '2px',
                          color: '#2e1065',
                          wordBreak: 'break-all'
                        }}
                      >
                        {claveVisible ? nota.claveSecreta : '••••••••••••'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() =>
                          setClavesVisibles((prev) => ({ ...prev, [nota.id]: !prev[nota.id] }))
                        }
                        style={{
                          border: '1px solid #c4b5fd',
                          backgroundColor: '#ffffff',
                          color: '#5b21b6',
                          borderRadius: '8px',
                          padding: '5px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {claveVisible ? '🙈 Ocultar' : '👁️ Ver'}
                      </button>
                      <button
                        type="button"
                        onClick={() => copiarAlPortapapeles(nota.claveSecreta!, `pass-${nota.id}`)}
                        style={{
                          border: '1px solid #c4b5fd',
                          backgroundColor: copiadoId === `pass-${nota.id}` ? '#dcfce7' : '#6d28d9',
                          color: copiadoId === `pass-${nota.id}` ? '#166534' : '#ffffff',
                          borderRadius: '8px',
                          padding: '5px 9px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {copiadoId === `pass-${nota.id}` ? '✓ Copiada' : '📋 Copiar'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ENLACE WEB OPCIONAL */}
                {nota.urlWeb && (
                  <div style={{ fontSize: '12px', color: '#0284c7', wordBreak: 'break-all' }}>
                    🌐{' '}
                    <a
                      href={nota.urlWeb.startsWith('http') ? nota.urlWeb : `https://${nota.urlWeb}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      {nota.urlWeb}
                    </a>
                  </div>
                )}

                {/* CONTENIDO / NOTAS ADICIONALES */}
                {nota.contenido && (
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: '10px',
                      padding: '9px 11px',
                      fontSize: '12.5px',
                      color: '#334155',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.45,
                      borderLeft: `3px solid ${meta.color}`
                    }}
                  >
                    {nota.contenido}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL PARA CREAR / EDITAR NOTA O CONTRASEÑA */}
      {modalAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setModalAbierto(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '20px',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.25)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                {notaEditando ? '✏️ Editar registro privado' : '🔐 Nuevo registro privado'}
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={guardarNota} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Título *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Netflix Familiar, Tarjeta Hipoteca, Clave WiFi..."
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Categoría
                </label>
                <select
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {CATEGORIAS_BLOC.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icono} {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Usuario / Correo / Número de Cuenta o DNI (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: joelruizpetit@gmail.com o ES91 2100..."
                  value={formUsuarioCuenta}
                  onChange={(e) => setFormUsuarioCuenta(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    color: '#0f172a'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Contraseña / PIN / Clave secreta (opcional)
                  </label>
                  <button
                    type="button"
                    onClick={generarClaveAleatoria}
                    style={{
                      border: 'none',
                      background: '#ede9fe',
                      color: '#6d28d9',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    🎲 Generar clave
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type={mostrarClaveForm ? 'text' : 'password'}
                    placeholder="Introduce la contraseña o código secreto..."
                    value={formClaveSecreta}
                    onChange={(e) => setFormClaveSecreta(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      color: '#0f172a'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarClaveForm((v) => !v)}
                    style={{
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      borderRadius: '10px',
                      padding: '0 12px',
                      cursor: 'pointer',
                      fontSize: '15px'
                    }}
                  >
                    {mostrarClaveForm ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Web o Enlace (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: netflix.com"
                  value={formUrlWeb}
                  onChange={(e) => setFormUrlWeb(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Notas o detalles confidenciales (opcional)
                </label>
                <textarea
                  rows={4}
                  placeholder="Apunta aquí preguntas de seguridad, códigos de recuperación, condiciones o cualquier dato privado..."
                  value={formContenido}
                  onChange={(e) => setFormContenido(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    resize: 'vertical'
                  }}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={formFijada}
                  onChange={(e) => setFormFijada(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>📌 Fijar este registro en la parte superior</span>
              </label>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#312e81',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {guardando ? 'Guardando...' : '💾 Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
