"use client";
import React from 'react';

interface TabPlaceholderProps {
  nombre: string;
  descripcion?: string;
  icono?: string;
}

export default function TabPlaceholder({
  nombre,
  descripcion = "Esta sección está creada de forma temporal. Su contenido y funcionalidades se definirán más adelante.",
  icono = "📌"
}: TabPlaceholderProps) {
  return (
    <div style={{
      width: '100%',
      maxWidth: '450px',
      marginTop: '20px',
      padding: '24px 20px',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      color: '#111827'
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        marginBottom: '16px'
      }}>
        {icono}
      </div>

      <div style={{
        display: 'inline-block',
        padding: '3px 10px',
        backgroundColor: '#dbeafe',
        color: '#1d4ed8',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '10px'
      }}>
        Próximamente
      </div>

      <h2 style={{
        margin: '0 0 8px 0',
        fontSize: '18px',
        fontWeight: 700,
        color: '#111827'
      }}>
        {nombre}
      </h2>

      <p style={{
        margin: 0,
        fontSize: '14px',
        color: '#6b7280',
        lineHeight: 1.5,
        maxWidth: '320px'
      }}>
        {descripcion}
      </p>

      <div style={{
        marginTop: '20px',
        padding: '12px 16px',
        backgroundColor: '#f8fafc',
        border: '1px dashed #cbd5e1',
        borderRadius: '10px',
        fontSize: '12px',
        color: '#475569',
        width: '100%'
      }}>
        💡 Estructura lista para integrar módulos personalizados (gastos, listas, notas compartidas o estadísticas).
      </div>
    </div>
  );
}
