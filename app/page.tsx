"use client";
import { useState, useEffect } from 'react';
import Calendario from './components/Calendario';
import CalendarioSemanal from './components/CalendarioSemanal';
import HeaderSofascore from './components/HeaderSofascore';
import CalendarioDeportes from './components/CalendarioDeportes';
import MenuEscolarAlma from './components/MenuEscolarAlma';
import MenuLateral from './components/MenuLateral';
import FinanzasFamiliares from './components/FinanzasFamiliares';
import ListaCompra from './components/ListaCompra';
import ModalNovedades from './components/ModalNovedades';
import { auth } from './firebase';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  User
} from 'firebase/auth';

const CORREOS_AUTORIZADOS = [
  "joelruizpetit@gmail.com",
  "aijg1985@gmail.com"
];

export default function Home() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [seccionPrincipal, setSeccionPrincipal] = useState<'planificador' | 'finanzas' | 'lista-compra'>('planificador');
  const [menuLateralAbierto, setMenuLateralAbierto] = useState<boolean>(false);
  const [tabActiva, setTabActiva] = useState<string>('general');
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date>(new Date());

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const cancelarSuscripcion = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userEmail = user.email?.toLowerCase();
        if (!userEmail || !CORREOS_AUTORIZADOS.includes(userEmail)) {
          await signOut(auth);
          setUsuario(null);
          setError(`Acceso denegado: El correo "${user.email || 'desconocido'}" no está autorizado.`);
          setLoading(false);
          return;
        }
        setTabActiva('general'); // Pestaña 'General' activa por defecto al iniciar sesión
      }
      setUsuario(user);
      setLoading(false);
    });
    return () => cancelarSuscripcion();
  }, []);

  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      setError("Usuario o contraseña incorrectos");
    }
  };

  const iniciarSesionConGoogle = async () => {
    setError("");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const userEmail = result.user?.email?.toLowerCase();
      if (!userEmail || !CORREOS_AUTORIZADOS.includes(userEmail)) {
        await signOut(auth);
        setUsuario(null);
        setError(`Acceso denegado: El correo "${result.user?.email || ''}" no está autorizado.`);
      }
    } catch (err: unknown) {
      console.error(err);
      const authError = err as { code?: string };
      if (authError.code === "auth/popup-closed-by-user") {
        return;
      }
      if (authError.code === "auth/popup-blocked") {
        setError("El navegador bloqueó la ventana emergente. Por favor, habilita los popups.");
        return;
      }
      setError("Error al iniciar sesión con Google.");
    }
  };

  const cerrarSesion = () => {
    signOut(auth);
  };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Cargando...</div>;

  // --- SI YA ESTÁS DENTRO: MUESTRA LA CABECERA SOFASCORE Y LA SECCIÓN ACTIVA ---
  if (usuario) {
    return (
      <div
        className="bg-white text-gray-900"
        style={{
          minHeight: "100vh",
          background: "linear-gradient(to bottom, #f3f6fa 0%, #ffffff 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          color: "#111827"
        }}
      >
        {/* MENÚ LATERAL (NAVIGATION DRAWER) */}
        <MenuLateral
          abierto={menuLateralAbierto}
          onCerrar={() => setMenuLateralAbierto(false)}
          seccionActiva={seccionPrincipal}
          onCambiarSeccion={(seccion) => {
            setSeccionPrincipal(seccion);
          }}
          usuario={usuario}
          onCerrarSesion={cerrarSesion}
        />

        {/* MODAL DE NOVEDADES Y CAMBIOS RECIENTES */}
        <ModalNovedades usuario={usuario} />

        {/* CABECERA SUPERIOR ESTILO SOFASCORE */}
        <HeaderSofascore
          usuario={usuario}
          onCerrarSesion={cerrarSesion}
          tabActiva={tabActiva}
          onTabChange={setTabActiva}
          onAbrirMenuLateral={() => setMenuLateralAbierto(true)}
          seccionActiva={seccionPrincipal}
          onCambiarSeccion={setSeccionPrincipal}
        />

        {/* CONTENEDOR PRINCIPAL SEGÚN LA SECCIÓN ACTIVA */}
        <main
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0 16px 40px 16px"
          }}
        >
          {seccionPrincipal === 'finanzas' ? (
            <FinanzasFamiliares usuario={usuario} />
          ) : seccionPrincipal === 'lista-compra' ? (
            <ListaCompra 
              usuario={usuario} 
              onIrAFinanzas={() => setSeccionPrincipal('finanzas')} 
            />
          ) : (
            <>
              {tabActiva === 'general' && (
                <Calendario 
                  usuario={usuario} 
                  fechaSeleccionada={fechaSeleccionada}
                  onFechaChange={setFechaSeleccionada}
                />
              )}
              {tabActiva === 'semanal' && (
                <CalendarioSemanal 
                  usuario={usuario} 
                  fechaSeleccionada={fechaSeleccionada}
                  onFechaChange={setFechaSeleccionada}
                />
              )}
              {(tabActiva === 'deportes' || tabActiva === 'tab3') && <CalendarioDeportes />}
              {(tabActiva === 'menu-alma' || tabActiva === 'tab4') && (
                <MenuEscolarAlma 
                  usuario={usuario}
                  fechaSeleccionada={fechaSeleccionada}
                  onFechaChange={setFechaSeleccionada}
                />
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  // --- SI NO ESTÁS DENTRO: MUESTRA EL LOGIN ---
  return (
    <div style={{
      height: "100vh",
      width: "100vw",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        backgroundColor: "#f0f2f5",
        padding: "40px", borderRadius: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
        width: "90%", maxWidth: "350px", textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center"
      }}>

        {/* --- CONTENEDOR BLANCO PARA EL LOGO --- */}
        <div style={{
          backgroundColor: "white",
          padding: "15px",
          borderRadius: "15px",
          marginBottom: "25px",
          boxShadow: "inset 0 2px 5px rgba(0,0,0,0.05)"
        }}>
          <img
            src="/logo.png"
            alt="Planificador Familiar"
            style={{
              width: "200px",
              height: "auto",
              display: "block"
            }}
          />
        </div>

        {/* BOTÓN DE GOOGLE */}
        <button
          type="button"
          onClick={iniciarSesionConGoogle}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #dadce0",
            backgroundColor: "white",
            color: "#3c4043",
            fontSize: "15px",
            fontWeight: "600",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            transition: "all 0.2s ease"
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f8f9fa")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "white")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>Iniciar sesión con Google</span>
        </button>

        {/* SEPARADOR */}
        <div style={{ display: "flex", alignItems: "center", width: "100%", margin: "18px 0" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#d1d5db" }} />
          <span style={{ padding: "0 10px", color: "#6b7280", fontSize: "13px" }}>o con correo</span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#d1d5db" }} />
        </div>

        <form onSubmit={iniciarSesion} style={{ display: "flex", flexDirection: "column", gap: "15px", width: "100%" }}>
          <input
            type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "16px", outline: "none", backgroundColor: "white", color: "#111827" }}
          />
          <input
            type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "16px", outline: "none", backgroundColor: "white", color: "#111827" }}
          />
          <button
            type="submit"
            style={{
              padding: "12px", borderRadius: "8px", border: "none",
              background: "linear-gradient(to right, #667eea, #764ba2)",
              color: "white", fontSize: "16px", fontWeight: "bold", cursor: "pointer", marginTop: "10px"
            }}
          >
            Entrar
          </button>
        </form>

        {error && (
          <div style={{
            width: "100%",
            backgroundColor: "#fee2e2",
            border: "1px solid #f87171",
            color: "#991b1b",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "13px",
            textAlign: "center",
            marginTop: "15px",
            lineHeight: "1.4"
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
} 
