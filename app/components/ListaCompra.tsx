"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot
} from 'firebase/firestore';

export interface ArticuloCompra {
  id?: string;
  nombre: string;
  comprado: boolean;
  cantidad?: string;
  categoria?: string;
  creadorEmail?: string;
  creadoPor?: string;
  creadoEn: string;
  compradoEn?: string;
}

interface ListaCompraProps {
  usuario?: { email?: string | null; displayName?: string | null } | null;
  onIrAFinanzas?: () => void;
}

const CATEGORIAS_COMPRA = [
  { nombre: 'Supermercado', icono: '🛒', color: '#0284c7', bg: '#e0f2fe' },
  { nombre: 'Frutería / Verdulería', icono: '🥬', color: '#16a34a', bg: '#dcfce7' },
  { nombre: 'Carnicería / Pescadería', icono: '🥩', color: '#dc2626', bg: '#fee2e2' },
  { nombre: 'Panadería', icono: '🥖', color: '#d97706', bg: '#fef3c7' },
  { nombre: 'Limpieza / Hogar', icono: '🧼', color: '#6366f1', bg: '#e0e7ff' },
  { nombre: 'Farmacia / Bebé', icono: '🍼', color: '#ec4899', bg: '#fce7f3' },
  { nombre: 'Otro', icono: '📦', color: '#64748b', bg: '#f1f5f9' },
];

const CATEGORIAS_FINANZAS = [
  { valor: 'Alimentación', label: 'Supermercado / Alimentación', icono: '🛒' },
  { valor: 'Hogar', label: 'Hogar / Limpieza', icono: '🏠' },
  { valor: 'Salud', label: 'Salud / Farmacia', icono: '💊' },
  { valor: 'Ocio', label: 'Ocio', icono: '🎉' },
  { valor: 'Varios', label: 'Varios', icono: '📦' },
];

export default function ListaCompra({ usuario, onIrAFinanzas }: ListaCompraProps) {
  const [articulos, setArticulos] = useState<ArticuloCompra[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  // Formulario rápido para añadir artículo
  const [nuevoNombre, setNuevoNombre] = useState<string>('');
  const [nuevaCantidad, setNuevaCantidad] = useState<string>('');
  const [nuevaCategoria, setNuevaCategoria] = useState<string>('Supermercado');
  const [guardandoNuevo, setGuardandoNuevo] = useState<boolean>(false);

  // Filtro o búsqueda rápida
  const [busqueda, setBusqueda] = useState<string>('');

  // Control de sección de comprados (mostrar/ocultar)
  const [mostrarComprados, setMostrarComprados] = useState<boolean>(true);

  // Modal "Finalizar Compra / Registrar Gasto"
  const [mostrarModalGasto, setMostrarModalGasto] = useState<boolean>(false);
  const [importeGasto, setImporteGasto] = useState<string>('');
  const [conceptoGasto, setConceptoGasto] = useState<string>('');
  const [categoriaGasto, setCategoriaGasto] = useState<string>('Alimentación');
  const [fechaGasto, setFechaGasto] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  });
  const [guardandoGasto, setGuardandoGasto] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Nombre amigable del usuario
  const emailUsuario = usuario?.email?.toLowerCase() || '';
  const nombreAutor = usuario?.displayName || (emailUsuario.includes('joel') ? 'Joel' : (emailUsuario.includes('aijg') ? 'Arantxa' : (emailUsuario.split('@')[0] || 'Familia')));

  // Sincronización en tiempo real con Firestore (colección 'lista_compra')
  useEffect(() => {
    const coleccionRef = collection(db, 'lista_compra');

    const unsubscribe = onSnapshot(coleccionRef, (snapshot) => {
      const lista: ArticuloCompra[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ArticuloCompra;
        lista.push({
          ...data,
          id: docSnap.id
        });
      });

      // Ordenar: primero los pendientes (más recientes arriba), luego los comprados
      lista.sort((a, b) => {
        if (a.comprado !== b.comprado) {
          return a.comprado ? 1 : -1;
        }
        return (b.creadoEn || '').localeCompare(a.creadoEn || '');
      });

      setArticulos(lista);
      setCargando(false);
    }, (error) => {
      console.error('Error al escuchar lista_compra en Firestore:', error);
      setCargando(false);
    });

    return () => unsubscribe();
  }, []);

  // Separación entre pendientes y comprados
  const articulosPendientes = useMemo(() => {
    return articulos.filter(a => !a.comprado && (!busqueda || a.nombre.toLowerCase().includes(busqueda.toLowerCase())));
  }, [articulos, busqueda]);

  const articulosComprados = useMemo(() => {
    return articulos.filter(a => a.comprado);
  }, [articulos]);

  // Añadir artículo rápidamente
  const agregarArticulo = async (e: React.FormEvent) => {
    e.preventDefault();
    const texto = nuevoNombre.trim();
    if (!texto) return;

    setGuardandoNuevo(true);
    try {
      await addDoc(collection(db, 'lista_compra'), {
        nombre: texto,
        cantidad: nuevaCantidad.trim() || '',
        categoria: nuevaCategoria,
        comprado: false,
        creadorEmail: usuario?.email || 'desconocido',
        creadoPor: nombreAutor,
        creadoEn: new Date().toISOString()
      });

      setNuevoNombre('');
      setNuevaCantidad('');
    } catch (error) {
      console.error('Error al añadir artículo a la lista:', error);
      alert('Error al añadir el artículo. Inténtalo de nuevo.');
    } finally {
      setGuardandoNuevo(false);
    }
  };

  // Alternar checkbox de comprado
  const toggleComprado = async (articulo: ArticuloCompra) => {
    if (!articulo.id) return;
    const nuevoEstado = !articulo.comprado;

    try {
      await updateDoc(doc(db, 'lista_compra', articulo.id), {
        comprado: nuevoEstado,
        compradoEn: nuevoEstado ? new Date().toISOString() : null
      });
    } catch (error) {
      console.error('Error al actualizar estado del artículo:', error);
    }
  };

  // Eliminar artículo individual
  const eliminarArticulo = async (id?: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'lista_compra', id));
    } catch (error) {
      console.error('Error al eliminar artículo:', error);
    }
  };

  // Abrir modal de finalizar compra
  const abrirModalFinalizarCompra = () => {
    const totalComprados = articulosComprados.length;
    const descDefecto = totalComprados > 0
      ? `Compra supermercado (${totalComprados} artículos)`
      : 'Compra supermercado';

    setConceptoGasto(descDefecto);
    setImporteGasto('');
    setCategoriaGasto('Alimentación');
    setMostrarModalGasto(true);
  };

  // Guardar gasto en finanzas_familiares y limpiar lista_compra
  const confirmarFinalizarCompra = async (e: React.FormEvent) => {
    e.preventDefault();
    const impNum = parseFloat(importeGasto.replace(',', '.'));

    if (isNaN(impNum) || impNum <= 0) {
      alert('Por favor, introduce un importe total válido mayor que 0.');
      return;
    }

    if (!conceptoGasto.trim()) {
      alert('Por favor, indica un concepto o descripción para el gasto.');
      return;
    }

    setGuardandoGasto(true);
    try {
      const mesAnoMov = fechaGasto.substring(0, 7);
      const nombresComprados = articulosComprados.map(a => a.nombre);

      // 1. Guardar gasto en la colección finanzas_familiares
      await addDoc(collection(db, 'finanzas_familiares'), {
        importe: Math.round(impNum * 100) / 100,
        concepto: conceptoGasto.trim(),
        fecha: fechaGasto,
        mesAno: mesAnoMov,
        categoria: categoriaGasto,
        tipo: 'gasto',
        creadorEmail: usuario?.email || 'desconocido',
        creadoEn: new Date().toISOString(),
        origen: 'lista_compra',
        articulosComprados: nombresComprados
      });

      // 2. Eliminar artículos comprados de la colección lista_compra
      const eliminaciones = articulosComprados.map(item => {
        if (item.id) {
          return deleteDoc(doc(db, 'lista_compra', item.id));
        }
        return Promise.resolve();
      });
      await Promise.all(eliminaciones);

      // 3. Cerrar modal y mostrar confirmación
      setMostrarModalGasto(false);
      setMensajeExito(`¡Compra de ${impNum.toFixed(2)} € registrada en Finanzas y productos comprados archivados!`);
      setTimeout(() => setMensajeExito(null), 6000);
    } catch (error) {
      console.error('Error al finalizar compra y registrar gasto:', error);
      alert('Ocurrió un error al registrar el gasto en Finanzas.');
    } finally {
      setGuardandoGasto(false);
    }
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
      {/* MENSAJE DE ÉXITO TRAS FINALIZAR COMPRA */}
      {mensajeExito && (
        <div style={{
          backgroundColor: '#ecfdf5',
          border: '1px solid #10b981',
          color: '#065f46',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>✅</span>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>{mensajeExito}</span>
          </div>
          {onIrAFinanzas && (
            <button
              onClick={onIrAFinanzas}
              style={{
                backgroundColor: '#059669',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              Ver Finanzas
            </button>
          )}
        </div>
      )}

      {/* CABECERA Y BOTÓN FINALIZAR COMPRA */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🛒</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                Lista de la Compra
              </h2>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginTop: '2px', display: 'block' }}>
              {articulosPendientes.length} pendientes • {articulosComprados.length} en el carro
            </span>
          </div>

          {/* BOTÓN FINALIZAR COMPRA / REGISTRAR GASTO */}
          <button
            onClick={abrirModalFinalizarCompra}
            className="w-full sm:w-auto"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 14px',
              backgroundColor: articulosComprados.length > 0 ? '#059669' : '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '13px',
              boxShadow: articulosComprados.length > 0 ? '0 3px 10px rgba(5, 150, 105, 0.35)' : '0 2px 6px rgba(2, 132, 199, 0.25)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <span>💳</span>
            <span>Finalizar Compra</span>
            {articulosComprados.length > 0 && (
              <span style={{
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                padding: '1px 6px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 900
              }}>
                {articulosComprados.length}
              </span>
            )}
          </button>
        </div>

        {/* FORMULARIO RÁPIDO PARA AÑADIR ARTÍCULO (100% RESPONSIVE EN MÓVIL Y ESCRITORIO) */}
        <form onSubmit={agregarArticulo} className="flex flex-col gap-2 mt-1 w-full" style={{ width: '100%', boxSizing: 'border-box' }}>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 w-full" style={{ width: '100%' }}>
            {/* CAMPO NOMBRE DEL ARTÍCULO */}
            <div className="sm:col-span-7 w-full">
              <input
                type="text"
                placeholder="Añadir artículo (ej: Leche, Fruta, Pan...)"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  outline: 'none',
                  backgroundColor: '#f8fafc',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* CONTENEDOR FLEX/GRID DE CANTIDAD Y BOTÓN */}
            <div className="grid grid-cols-12 gap-2 sm:contents w-full">
              <div className="col-span-4 sm:col-span-2 w-full">
                <input
                  type="text"
                  placeholder="Cant. (ej: 2)"
                  value={nuevaCantidad}
                  onChange={(e) => setNuevaCantidad(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    textAlign: 'center',
                    backgroundColor: '#f8fafc',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div className="col-span-8 sm:col-span-3 w-full">
                <button
                  type="submit"
                  disabled={guardandoNuevo || !nuevoNombre.trim()}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#0047b3',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: !nuevoNombre.trim() ? 'not-allowed' : 'pointer',
                    opacity: !nuevoNombre.trim() ? 0.6 : 1,
                    transition: 'background-color 0.15s ease',
                    boxSizing: 'border-box',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  + Añadir
                </button>
              </div>
            </div>
          </div>

          {/* SELECTOR RÁPIDO DE CATEGORÍA */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%', scrollbarWidth: 'none' }}>
            {CATEGORIAS_COMPRA.map(cat => {
              const activa = nuevaCategoria === cat.nombre;
              return (
                <button
                  key={cat.nombre}
                  type="button"
                  onClick={() => setNuevaCategoria(cat.nombre)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '8px',
                    border: activa ? `1px solid ${cat.color}` : '1px solid #e2e8f0',
                    backgroundColor: activa ? cat.bg : '#ffffff',
                    color: activa ? cat.color : '#64748b',
                    fontSize: '11px',
                    fontWeight: activa ? 800 : 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  <span>{cat.icono}</span>
                  <span>{cat.nombre}</span>
                </button>
              );
            })}
          </div>
        </form>
      </div>

      {/* BUSCADOR RÁPIDO (si hay más de 4 artículos) */}
      {articulos.length > 4 && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          padding: '8px 12px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '14px', color: '#94a3b8' }}>🔍</span>
          <input
            type="text"
            placeholder="Filtrar artículos de la lista..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              color: '#0f172a',
              width: '100%',
              backgroundColor: 'transparent'
            }}
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* LISTADO DE ARTÍCULOS PENDIENTES */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#334155' }}>
            Por Comprar ({articulosPendientes.length})
          </span>
          {cargando && (
            <span style={{ fontSize: '11px', color: '#64748b' }}>Sincronizando...</span>
          )}
        </div>

        {articulosPendientes.length === 0 ? (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            padding: '30px 16px',
            textAlign: 'center',
            border: '1px dashed #cbd5e1'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛒</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
              {articulos.length === 0
                ? 'La lista de la compra está vacía'
                : '¡Todo comprado! No quedan artículos pendientes'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              {articulosComprados.length > 0
                ? 'Pulsa "Finalizar Compra" para registrar el gasto en Finanzas.'
                : 'Escribe arriba para añadir lo que haga falta en casa.'}
            </div>
          </div>
        ) : (
          articulosPendientes.map((art) => {
            const catInfo = CATEGORIAS_COMPRA.find(c => c.nombre === art.categoria) || { icono: '📦', color: '#64748b', bg: '#f1f5f9' };

            return (
              <div
                key={art.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'background-color 0.15s ease'
                }}
              >
                {/* CHECKBOX Y NOMBRE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => toggleComprado(art)}
                    aria-label={`Marcar ${art.nombre} como comprado`}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      border: '2px solid #94a3b8',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.borderColor = '#059669')}
                    onMouseOut={(e) => (e.currentTarget.style.borderColor = '#94a3b8')}
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden'
                      }}>
                        {art.nombre}
                      </span>
                      {art.cantidad && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          padding: '1px 6px',
                          borderRadius: '6px'
                        }}>
                          {art.cantidad}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: catInfo.color,
                        backgroundColor: catInfo.bg,
                        padding: '1px 6px',
                        borderRadius: '4px'
                      }}>
                        {catInfo.icono} {art.categoria || 'Supermercado'}
                      </span>
                      {art.creadoPor && (
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          por {art.creadoPor}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* BOTÓN ELIMINAR */}
                <button
                  onClick={() => eliminarArticulo(art.id)}
                  title="Eliminar artículo"
                  aria-label="Eliminar artículo"
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
            );
          })
        )}
      </div>

      {/* SECCIÓN DE ARTÍCULOS COMPRADOS (EN EL CARRO) */}
      {articulosComprados.length > 0 && (
        <div style={{
          backgroundColor: '#f8fafc',
          borderRadius: '14px',
          padding: '12px 14px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer'
          }}
          onClick={() => setMostrarComprados(!mostrarComprados)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>🛒</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#059669' }}>
                En el Carrito / Comprados ({articulosComprados.length})
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {mostrarComprados ? '▲ Ocultar' : '▼ Ver'}
            </span>
          </div>

          {mostrarComprados && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              {articulosComprados.map((art) => (
                <div
                  key={art.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    opacity: 0.75
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                    {/* CHECKBOX MARCADO */}
                    <button
                      type="button"
                      onClick={() => toggleComprado(art)}
                      aria-label={`Desmarcar ${art.nombre}`}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#059669',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        fontSize: '13px',
                        fontWeight: 900
                      }}
                    >
                      ✓
                    </button>

                    <span style={{
                      fontSize: '13px',
                      textDecoration: 'line-through',
                      color: '#64748b',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden'
                    }}>
                      {art.nombre} {art.cantidad ? `(${art.cantidad})` : ''}
                    </span>
                  </div>

                  <button
                    onClick={() => eliminarArticulo(art.id)}
                    title="Eliminar de la lista"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#cbd5e1',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '2px'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseOut={(e) => (e.currentTarget.style.color = '#cbd5e1')}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
                <button
                  onClick={abrirModalFinalizarCompra}
                  style={{
                    width: '100%',
                    padding: '9px',
                    backgroundColor: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#d1fae5')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#ecfdf5')}
                >
                  <span>💳 Finalizar compra y registrar {articulosComprados.length} artículos en Finanzas</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: FINALIZAR COMPRA / REGISTRAR GASTO EN FINANZAS */}
      {mostrarModalGasto && (
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
            maxWidth: '390px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            maxHeight: '92vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px', fontWeight: 800 }}>
                  💳 Registrar Gasto de Compra
                </h3>
                <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                  Finanzas Familiares
                </span>
              </div>
              <button
                onClick={() => setMostrarModalGasto(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={confirmarFinalizarCompra}>
              {/* RESUMEN DE ARTÍCULOS A ARCHIVAR */}
              {articulosComprados.length > 0 && (
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  marginBottom: '16px'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Artículos en el carro a registrar y limpiar ({articulosComprados.length}):
                  </span>
                  <div style={{
                    fontSize: '12px',
                    color: '#0f172a',
                    fontWeight: 600,
                    lineHeight: 1.4,
                    maxHeight: '60px',
                    overflowY: 'auto'
                  }}>
                    {articulosComprados.map(a => a.nombre).join(', ')}
                  </div>
                </div>
              )}

              {/* IMPORTE TOTAL PAGADO */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 700, fontSize: '12px', color: '#334155' }}>
                  Importe Total Pagado (€):
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    required
                    autoFocus
                    value={importeGasto}
                    onChange={(e) => setImporteGasto(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 38px 10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '18px',
                      fontWeight: 800,
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                  <span style={{ position: 'absolute', right: '14px', fontWeight: 800, color: '#64748b', fontSize: '16px' }}>
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
                  required
                  value={conceptoGasto}
                  onChange={(e) => setConceptoGasto(e.target.value)}
                  placeholder="Ej: Compra Mercadona / Alimentación"
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

              {/* CATEGORÍA EN FINANZAS */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '12px', color: '#334155' }}>
                  Categoría en Finanzas:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {CATEGORIAS_FINANZAS.map(cat => {
                    const sel = categoriaGasto === cat.valor;
                    return (
                      <button
                        key={cat.valor}
                        type="button"
                        onClick={() => setCategoriaGasto(cat.valor)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: sel ? '2px solid #059669' : '1px solid #e2e8f0',
                          backgroundColor: sel ? '#ecfdf5' : '#ffffff',
                          color: sel ? '#047857' : '#475569',
                          fontWeight: sel ? 800 : 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ fontSize: '15px' }}>{cat.icono}</span>
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* FECHA */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 700, fontSize: '12px', color: '#334155' }}>
                  Fecha de la compra:
                </label>
                <input
                  type="date"
                  required
                  value={fechaGasto}
                  onChange={(e) => setFechaGasto(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                />
              </div>

              {/* BOTONES */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setMostrarModalGasto(false)}
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
                  disabled={guardandoGasto}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: guardandoGasto ? 'not-allowed' : 'pointer',
                    fontWeight: 800,
                    fontSize: '13px',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
                    opacity: guardandoGasto ? 0.7 : 1
                  }}
                >
                  {guardandoGasto ? 'Guardando...' : 'Confirmar y Guardar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
