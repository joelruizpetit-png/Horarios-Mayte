"use client";

import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

type Pronostico = '1' | 'X' | '2';
type Resultado = 'pendiente' | 'acertado' | 'fallado';

interface PartidoQuiniela {
  id: string;
  local: string;
  visitante: string;
  pronostico: Pronostico[];
  resultado: Resultado;
}

interface BoletoQuiniela {
  id: string;
  nombre: string;
  fecha: string;
  importe: number;
  cuota: number;
  gananciaPotencial?: number;
  partidos: PartidoQuiniela[];
  creadoEn: string;
  archivado?: boolean;
  archivadoEn?: string;
}

interface QuinielasProps {
  vista: 'boletos' | 'estadisticas' | 'historial';
  usuario: { email?: string | null; displayName?: string | null } | null;
}

const COLECCION = 'quinielas';
const COLECCION_CONFIGURACION = 'quinielas_configuracion';
const hoy = () => new Date().toISOString().slice(0, 10);
const nuevoPartido = (local = '', visitante = ''): PartidoQuiniela => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  local,
  visitante,
  pronostico: [],
  resultado: 'pendiente',
});
const euros = (valor: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(valor);

function normalizarPronostico(valor: unknown): Pronostico[] {
  const opciones = Array.isArray(valor) ? valor : typeof valor === 'string' ? valor.split('') : [];
  return ['1', 'X', '2'].filter((opcion) => opciones.some((entrada) => String(entrada).toUpperCase() === opcion)) as Pronostico[];
}

function normalizarNombreEquipo(nombre: string): string {
  return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(fc|cf|ac|afc|sc|club|de|la|el|los|las|the)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function equipoMencionado(segmento: string, equipo: string): boolean {
  const fragmento = normalizarNombreEquipo(segmento);
  const nombre = normalizarNombreEquipo(equipo);
  if (!fragmento || !nombre) return false;
  if (fragmento.includes(nombre) || nombre.includes(fragmento)) return true;
  const palabras = nombre.split(' ').filter((palabra) => palabra.length > 3);
  return palabras.length > 0 && palabras.every((palabra) => fragmento.includes(palabra));
}

function leerSeleccionDoble(lineas: string[], indice: number, local: string, visitante: string): Pronostico[] {
  const contexto = lineas.slice(Math.max(0, indice - 3), indice)
    .map((linea) => linea.replace(/^[x×]\s*/i, '').replace(/\b\d+[.,]\d{1,3}\b/g, ' ').replace(/\bCantidad\b/gi, ' ').replace(/Doble oportunidad/gi, ' '))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const partes = contexto.match(/(.{2,90}?)\s+o\s+(.{2,90})$/i);
  if (partes && /empate|draw/i.test(contexto)) {
    const primeraEsEmpate = /empate|draw/i.test(partes[1]);
    const equipo = (primeraEsEmpate ? partes[2] : partes[1]).replace(/\b(doble oportunidad|mostrar opciones|selecciones|saldo)\b/gi, ' ').trim();
    if (equipoMencionado(equipo, local)) return ['1', 'X'];
    if (equipoMencionado(equipo, visitante)) return ['X', '2'];
  }
  return [];
}

function numeroOCR(valor: string | undefined): number | null {
  if (!valor) return null;
  const limpio = valor.replace(/\s/g, '');
  const normalizado = limpio.includes(',')
    ? limpio.replace(/\./g, '').replace(',', '.')
    : limpio;
  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function extraerDatosApuesta(texto: string): { importe: number | null; cuota: number | null; ganancia: number | null } {
  const importes = [...texto.matchAll(/apostar\s*[:\-]?\s*(\d+(?:[.,]\d{1,2})?)\s*€/gi)];
  const ganancias = [...texto.matchAll(/ganancias?\s+pot(?:encial(?:es)?)?\.?\s*[:\-]?\s*(\d+(?:[.,]\d{1,2})?)\s*€/gi)];
  const cuotas = [...texto.matchAll(/(?:cuota\s+combinada|combinada)\s*[:\-]?\s*(\d+(?:[.,]\d+)*)/gi)];
  const importe = numeroOCR(importes.at(-1)?.[1]);
  const ganancia = numeroOCR(ganancias.at(-1)?.[1]);
  const cuotaExplicita = numeroOCR(cuotas.at(-1)?.[1]);
  const cuota = cuotaExplicita ?? (importe && ganancia ? ganancia / importe : null);
  return { importe, cuota, ganancia: ganancia ?? (importe && cuota ? importe * cuota : null) };
}

function fusionarPartidos(unicos: PartidoQuiniela[], nuevos: PartidoQuiniela[]): PartidoQuiniela[] {
  const resultado: PartidoQuiniela[] = [];
  for (const candidato of [...unicos, ...nuevos]) {
    const local = normalizarNombreEquipo(candidato.local);
    const visitante = normalizarNombreEquipo(candidato.visitante);
    const duplicado = resultado.find((partido) => normalizarNombreEquipo(partido.local) === local && normalizarNombreEquipo(partido.visitante) === visitante);
    if (!duplicado) {
      resultado.push(candidato);
    } else {
      duplicado.pronostico = normalizarPronostico([...duplicado.pronostico, ...candidato.pronostico]);
    }
  }
  return resultado;
}

function extraerPartidos(texto: string): PartidoQuiniela[] {
  const encontrados: PartidoQuiniela[] = [];
  const lineas = texto.split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean);
  for (const [indice, lineaOriginal] of lineas.entries()) {
    const lineaSinNumero = lineaOriginal.trim().replace(/^\d{1,2}\s*[.)]\s*/, '');
    const marcador = lineaSinNumero.match(/\s+\(?([1xX2]{1,3})\)?\s*$/);
    const linea = marcador ? lineaSinNumero.slice(0, marcador.index).trim() : lineaSinNumero;
    const separada = linea.match(/^(.{3,55}?)\s+(?:vs\.?|v\.?|contra|[-–—])\s+(.{3,55}?)$/i);
    if (!separada) continue;
    const local = separada[1].replace(/[|•]+$/, '').trim();
    const visitante = separada[2].replace(/^[|•]+/, '').replace(/\s+[1xX2]$/, '').trim();
    if (local && visitante && !/^(partido|selección|seleccion|pronóstico|pronostico)$/i.test(local)) {
      const partido = nuevoPartido(local, visitante);
      partido.pronostico = marcador ? normalizarPronostico(marcador[1]) : leerSeleccionDoble(lineas, indice, local, visitante);
      encontrados.push(partido);
    }
  }
  return encontrados;
}

export default function Quinielas({ vista, usuario }: QuinielasProps) {
  const [boletos, setBoletos] = useState<BoletoQuiniela[]>([]);
  const [boletosArchivados, setBoletosArchivados] = useState<BoletoQuiniela[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [importe, setImporte] = useState('0.00');
  const [cuota, setCuota] = useState('0.00');
  const [gananciaPotencial, setGananciaPotencial] = useState('0.00');
  const [saldoInicial, setSaldoInicial] = useState('0.00');
  const [partidos, setPartidos] = useState<PartidoQuiniela[]>([]);
  const [textoOCR, setTextoOCR] = useState('');
  const entradaCamaraRef = useRef<HTMLInputElement>(null);
  const entradaCapturasRef = useRef<HTMLInputElement>(null);
  const [leyendoFoto, setLeyendoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => onSnapshot(collection(db, COLECCION), (snapshot) => {
    const filas = snapshot.docs.map((registro) => {
      const datos = registro.data();
      return { id: registro.id, ...datos, partidos: (datos.partidos || []).map((partido: PartidoQuiniela) => ({ ...partido, pronostico: normalizarPronostico(partido.pronostico) })) } as BoletoQuiniela;
    });
    filas.sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
    setBoletos(filas.filter((boleto) => !boleto.archivado));
    setBoletosArchivados(filas.filter((boleto) => boleto.archivado));
    setCargando(false);
  }, (error) => {
    console.error('No se pudieron cargar las quinielas:', error);
    setMensaje('No se pudieron cargar los boletos. Comprueba la conexión e inténtalo de nuevo.');
    setCargando(false);
  }), []);

  const boletosContabilizados = useMemo(() => {
    const unicos = new Map<string, BoletoQuiniela>();
    [...boletos, ...boletosArchivados].forEach((boleto) => unicos.set(boleto.id, boleto));
    return [...unicos.values()];
  }, [boletos, boletosArchivados]);

  useEffect(() => onSnapshot(doc(db, COLECCION_CONFIGURACION, 'saldo'), (snapshot) => {
    if (!snapshot.exists()) return;
    const guardado = Number(snapshot.data().saldoInicial);
    if (Number.isFinite(guardado) && guardado >= 0) setSaldoInicial(guardado.toFixed(2));
  }, (error) => {
    console.error('No se pudo cargar el saldo inicial:', error);
    setMensaje('No se pudo cargar el saldo inicial.');
  }), []);

  const saldoInicialNumero = Math.max(0, Number(saldoInicial.replace(',', '.')) || 0);
  const saldosPorBoleto = useMemo(() => {
    const calculados: Record<string, { inicial: number; acumulado: number }> = {};
    let balance = saldoInicialNumero;
    const ordenados = [...boletosContabilizados].sort((a, b) => (a.creadoEn || '').localeCompare(b.creadoEn || ''));
    for (const boleto of ordenados) {
      const apuesta = Number(boleto.importe) || 0;
      const cuotaBoleto = Number(boleto.cuota) || 0;
      const fallado = boleto.partidos.some((partido) => partido.resultado === 'fallado');
      const acertado = boleto.partidos.length > 0 && boleto.partidos.every((partido) => partido.resultado === 'acertado');
      const gananciaBruta = Number(boleto.gananciaPotencial) || apuesta * cuotaBoleto;
      const inicial = balance;
      balance = fallado ? balance - apuesta : acertado ? balance + gananciaBruta - apuesta : balance - apuesta;
      calculados[boleto.id] = { inicial, acumulado: balance };
    }
    return { porBoleto: calculados, actual: balance };
  }, [boletosContabilizados, saldoInicialNumero]);

  const guardarSaldoInicial = async () => {
    const valor = Number(saldoInicial.replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0) {
      setMensaje('El saldo inicial debe ser un número igual o mayor que cero.');
      return;
    }
    try {
      await setDoc(doc(db, COLECCION_CONFIGURACION, 'saldo'), { saldoInicial: valor, actualizadoEn: new Date().toISOString() }, { merge: true });
      setMensaje('Saldo inicial guardado.');
    } catch (error) {
      console.error('No se pudo guardar el saldo inicial:', error);
      setMensaje('No se pudo guardar el saldo inicial.');
    }
  };

  const resumen = useMemo(() => {
    const todosPartidos = boletosContabilizados.flatMap((boleto) => boleto.partidos || []);
    const cuotas = boletosContabilizados.filter((boleto) => Number(boleto.cuota) > 0);
    const apostado = boletosContabilizados.reduce((total, boleto) => total + (Number(boleto.importe) || 0), 0);
    const liquidados = boletosContabilizados.filter((boleto) => (boleto.partidos || []).length > 0 && (boleto.partidos.some((partido) => partido.resultado === 'fallado') || boleto.partidos.every((partido) => partido.resultado === 'acertado')));
    const beneficio = liquidados.reduce((total, boleto) => {
      const perdido = boleto.partidos.some((partido) => partido.resultado === 'fallado');
      return total + (perdido ? -(Number(boleto.importe) || 0) : (Number(boleto.importe) || 0) * ((Number(boleto.cuota) || 0) - 1));
    }, 0);
    return {
      total: todosPartidos.length,
      acertados: todosPartidos.filter((partido) => partido.resultado === 'acertado').length,
      fallados: todosPartidos.filter((partido) => partido.resultado === 'fallado').length,
      apostado,
      cuotaMedia: cuotas.length ? cuotas.reduce((total, boleto) => total + Number(boleto.cuota), 0) / cuotas.length : 0,
      beneficio,
      liquidados: liquidados.length,
    };
  }, [boletosContabilizados]);

  const procesarFoto = async (evento: ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(evento.target.files || []);
    if (!archivos.length) return;
    setMensaje('');
    setLeyendoFoto(true);
    try {
      const { createWorker } = await import('tesseract.js');
      const trabajador = await createWorker('spa');
      try {
        const textos: string[] = [];
        const detectados: PartidoQuiniela[] = [];
        for (const archivo of archivos) {
          const resultado = await trabajador.recognize(archivo);
          const texto = resultado.data.text || '';
          textos.push(texto);
          detectados.push(...extraerPartidos(texto));
        }
        const texto = textos.join('\n\n--- Siguiente imagen ---\n\n');
        setTextoOCR((anterior) => [anterior, texto].filter(Boolean).join('\n\n'));
        const datosApuesta = extraerDatosApuesta(texto);
        const importeFinal = datosApuesta.importe ?? numeroOCR(importe);
        const cuotaFinal = datosApuesta.cuota ?? numeroOCR(cuota);
        const gananciaFinal = datosApuesta.ganancia ?? numeroOCR(gananciaPotencial) ?? (importeFinal && cuotaFinal ? importeFinal * cuotaFinal : null);
        const resumenApuesta = importeFinal !== null && cuotaFinal !== null && gananciaFinal !== null
          ? ' También he detectado el importe, la cuota combinada y la ganancia potencial.'
          : ' Revisa las casillas de importe, cuota y ganancia potencial.';
        if (datosApuesta.importe !== null) setImporte(datosApuesta.importe.toFixed(2));
        if (cuotaFinal !== null && (datosApuesta.cuota !== null || datosApuesta.ganancia !== null)) setCuota(cuotaFinal.toFixed(2));
        if (gananciaFinal !== null) setGananciaPotencial(gananciaFinal.toFixed(2));
        if (detectados.length) {
          const anterioresUnicos = fusionarPartidos([], partidos);
          const combinados = fusionarPartidos(anterioresUnicos, detectados);
          const nuevos = combinados.length - anterioresUnicos.length;
          const repetidos = detectados.length - nuevos;
          setPartidos(combinados);
          setMensaje(`He leído ${detectados.length} partido${detectados.length === 1 ? '' : 's'}: ${nuevos} añadido${nuevos === 1 ? '' : 's'} y ${repetidos} repetido${repetidos === 1 ? '' : 's'} combinado${repetidos === 1 ? '' : 's'}. Revisa las selecciones antes de guardar.${resumenApuesta}`);
        } else {
          setPartidos((actuales) => actuales.length ? actuales : [nuevoPartido()]);
          setMensaje(`He leído el texto de la imagen, pero no he podido separar los partidos automáticamente. Puedes completar el boleto manualmente.${resumenApuesta}`);
        }
      } finally {
        await trabajador.terminate();
      }
    } catch (error) {
      console.error('No se pudo leer la imagen:', error);
      setMensaje('No se pudo reconocer el texto. Prueba con una imagen más nítida o añade los partidos manualmente.');
    } finally {
      setLeyendoFoto(false);
      evento.target.value = '';
    }
  };

  const guardarBoleto = async (evento: React.FormEvent) => {
    evento.preventDefault();
    const validos = partidos.filter((partido) => partido.local.trim() && partido.visitante.trim());
    if (!validos.length) {
      setMensaje('Añade al menos un partido con los dos equipos antes de guardar.');
      return;
    }
    const conSeleccionIncompleta = validos.find((partido) => {
      const cantidad = normalizarPronostico(partido.pronostico).length;
      return cantidad < 1 || cantidad > 2;
    });
    if (conSeleccionIncompleta) {
      setMensaje('Cada partido debe tener una o dos casillas seleccionadas entre 1, X y 2.');
      return;
    }
    const apuesta = Number(importe.replace(',', '.'));
    const cuotaCombinada = Number(cuota.replace(',', '.'));
    const posibleGanancia = Number(gananciaPotencial.replace(',', '.'));
    if (!Number.isFinite(apuesta) || apuesta <= 0 || !Number.isFinite(cuotaCombinada) || cuotaCombinada <= 0 || !Number.isFinite(posibleGanancia) || posibleGanancia <= 0) {
      setMensaje('Introduce la cantidad apostada, la cuota combinada y la ganancia potencial.');
      return;
    }
    setGuardando(true);
    try {
      await addDoc(collection(db, COLECCION), {
        nombre: nombre.trim() || `Boleto ${new Date(`${fecha}T12:00:00`).toLocaleDateString('es-ES')}`,
        fecha,
        importe: apuesta,
        cuota: cuotaCombinada,
        gananciaPotencial: posibleGanancia,
        partidos: validos,
        creadoEn: new Date().toISOString(),
        creadorEmail: usuario?.email || '',
      });
      setNombre(''); setFecha(hoy()); setImporte('0.00'); setCuota('0.00'); setGananciaPotencial('0.00'); setPartidos([]); setTextoOCR(''); setMensaje('Boleto guardado.');
    } catch (error) {
      console.error('No se pudo guardar el boleto:', error);
      setMensaje('No se pudo guardar el boleto. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarPartido = (partidoId: string) => {
    const restantes = partidos.filter((partido) => partido.id !== partidoId);
    setPartidos(restantes);
    if (!restantes.some((partido) => partido.local.trim() && partido.visitante.trim())) {
      setImporte('0.00');
      setCuota('0.00');
      setGananciaPotencial('0.00');
      setTextoOCR('');
      setMensaje('');
    }
  };

  const cambiarResultado = async (boleto: BoletoQuiniela, partidoId: string, resultado: Resultado) => {
    const actualizados = boleto.partidos.map((partido) => partido.id === partidoId ? { ...partido, resultado } : partido);
    try {
      await updateDoc(doc(db, COLECCION, boleto.id), { partidos: actualizados });
    } catch (error) {
      console.error('No se pudo actualizar el resultado:', error);
      setMensaje('No se pudo actualizar el resultado del partido.');
    }
  };

  const borrarBoleto = async (boleto: BoletoQuiniela) => {
    if (!window.confirm(`¿Eliminar el boleto «${boleto.nombre}»?`)) return;
    try {
      const referencia = doc(db, COLECCION, boleto.id);
      await runTransaction(db, async (transaccion) => {
        const registro = await transaccion.get(referencia);
        if (!registro.exists()) return;
        const datos = registro.data();
        const resultados = (datos.partidos || []) as PartidoQuiniela[];
        const resuelto = resultados.length > 0 && (resultados.some((partido) => partido.resultado === 'fallado') || resultados.every((partido) => partido.resultado === 'acertado'));
        if (resuelto) transaccion.update(referencia, { archivado: true, archivadoEn: new Date().toISOString() });
        else transaccion.delete(referencia);
      });
    } catch (error) {
      console.error('No se pudo eliminar el boleto:', error);
      setMensaje('No se pudo eliminar el boleto ni guardar su resultado en las estadísticas.');
    }
  };

  const tarjeta = (etiqueta: string, valor: string, color: string, fondo: string) => (
    <div key={etiqueta} style={{ background: fondo, border: `1px solid ${color}25`, borderRadius: 14, padding: '16px 18px', minWidth: 135, flex: '1 1 140px' }}>
      <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>{etiqueta}</div>
      <div style={{ color, fontSize: 23, fontWeight: 800, marginTop: 6 }}>{valor}</div>
    </div>
  );

  const importeNumero = Number(importe.replace(',', '.')) || 0;
  const gananciaNumero = Number(gananciaPotencial.replace(',', '.')) || 0;
  const hayPartidosActivos = partidos.some((partido) => partido.local.trim() && partido.visitante.trim());

  return (
    <section style={{ width: '100%', maxWidth: 760, margin: '24px auto 0', paddingBottom: 30 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ color: '#0047b3', fontSize: 24, fontWeight: 850 }}>🎟️ {vista === 'boletos' ? 'Quinielas' : vista === 'estadisticas' ? 'Estadísticas de quinielas' : 'Historial de quinielas'}</div>
        <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>{vista === 'boletos' ? 'Guarda tus combinaciones y sigue los resultados.' : vista === 'estadisticas' ? 'Resumen de partidos, apuestas y balance acumulado.' : 'Consulta los boletos concluidos que has eliminado de la lista.'}</div>
      </div>

      {vista === 'historial' ? (
        cargando ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>Cargando historial…</div>
        ) : boletosArchivados.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 28 }}>Todavía no hay boletos concluidos en el historial.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {boletosArchivados.map((boleto) => {
              const importeBoleto = Number(boleto.importe) || 0;
              const cuotaBoleto = Number(boleto.cuota) || 0;
              const fallado = boleto.partidos.some((partido) => partido.resultado === 'fallado');
              const estado = fallado ? 'Fallado' : 'Acertado';
              const beneficio = fallado ? -importeBoleto : (Number(boleto.gananciaPotencial) || importeBoleto * cuotaBoleto) - importeBoleto;
              return (
                <article key={boleto.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 15, padding: 15, boxShadow: '0 2px 8px rgba(15,23,42,.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>{boleto.nombre}</div>
                      <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{new Date(`${boleto.fecha}T12:00:00`).toLocaleDateString('es-ES')} · {boleto.partidos.length} partidos</div>
                    </div>
                    <span style={{ borderRadius: 20, padding: '5px 10px', background: fallado ? '#fef2f2' : '#f0fdf4', color: fallado ? '#b91c1c' : '#15803d', fontWeight: 800, fontSize: 12 }}>{estado}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, background: '#f8fafc', borderRadius: 10, padding: 10, marginTop: 12, fontSize: 12, color: '#475569' }}>
                    <span>Apostado: <strong>{euros(importeBoleto)}</strong></span>
                    <span>Cuota: <strong>{cuotaBoleto.toFixed(2)}</strong></span>
                    <span>Ganancia potencial: <strong>{euros(Number(boleto.gananciaPotencial) || importeBoleto * cuotaBoleto)}</strong></span>
                    <span>Balance: <strong style={{ color: beneficio >= 0 ? '#15803d' : '#b91c1c' }}>{euros(beneficio)}</strong></span>
                    {saldosPorBoleto.porBoleto[boleto.id] && <span>Saldo tras el boleto: <strong>{euros(saldosPorBoleto.porBoleto[boleto.id].acumulado)}</strong></span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                    {boleto.partidos.map((partido) => (
                      <div key={partido.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, background: partido.resultado === 'acertado' ? '#f0fdf4' : partido.resultado === 'fallado' ? '#fef2f2' : '#f8fafc' }}>
                        <span style={{ minWidth: 0, fontSize: 13, fontWeight: 700, color: '#1e293b', overflowWrap: 'anywhere' }}>{partido.local} – {partido.visitante}<span style={{ display: 'block', marginTop: 2, color: '#64748b', fontSize: 11 }}>Pronóstico: {normalizarPronostico(partido.pronostico).join(' + ') || 'Sin revisar'}</span></span>
                        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: partido.resultado === 'acertado' ? '#15803d' : partido.resultado === 'fallado' ? '#b91c1c' : '#64748b' }}>{partido.resultado === 'acertado' ? '✓ Acertado' : partido.resultado === 'fallado' ? '✕ Fallado' : 'Pendiente'}</span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : vista === 'estadisticas' ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
            {tarjeta('Partidos insertados', `${resumen.total}`, '#0047b3', '#eff6ff')}
            {tarjeta('Acertados', `${resumen.acertados}`, '#15803d', '#f0fdf4')}
            {tarjeta('Fallados', `${resumen.fallados}`, '#b91c1c', '#fef2f2')}
            {tarjeta('Total apostado', euros(resumen.apostado), '#7c3aed', '#f5f3ff')}
            {tarjeta('Cuota media', resumen.cuotaMedia ? resumen.cuotaMedia.toFixed(2) : '—', '#0369a1', '#f0f9ff')}
            {tarjeta('Beneficio / pérdida', euros(resumen.beneficio), resumen.beneficio >= 0 ? '#15803d' : '#b91c1c', resumen.beneficio >= 0 ? '#f0fdf4' : '#fef2f2')}
            {tarjeta('Saldo acumulado', euros(saldosPorBoleto.actual), saldosPorBoleto.actual >= saldoInicialNumero ? '#15803d' : '#b91c1c', saldosPorBoleto.actual >= saldoInicialNumero ? '#f0fdf4' : '#fef2f2')}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, color: '#64748b', fontSize: 13 }}>
            El balance incluye los boletos con algún partido fallado y los boletos con todos los partidos acertados ({resumen.liquidados} resueltos). Los boletos aún pendientes quedan fuera del beneficio o pérdida.
          </div>
        </>
      ) : (
        <>
          <form onSubmit={guardarBoleto} style={{ background: '#fff', border: '1px solid #dbeafe', borderRadius: 18, padding: 18, boxShadow: '0 4px 16px rgba(15,23,42,.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#0f172a', fontSize: 18, fontWeight: 800 }}>Añadir boleto</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>Puedes leer una captura o foto, y corregir los datos antes de guardar.</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <input ref={entradaCamaraRef} type="file" accept="image/*" capture="environment" onChange={procesarFoto} disabled={leyendoFoto} style={{ display: 'none' }} />
                <input ref={entradaCapturasRef} type="file" accept="image/*" multiple onChange={procesarFoto} disabled={leyendoFoto} style={{ display: 'none' }} />
                <button type="button" onClick={() => entradaCamaraRef.current?.click()} disabled={leyendoFoto} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', background: '#eff6ff', color: '#0047b3', fontWeight: 750, fontSize: 13, cursor: leyendoFoto ? 'wait' : 'pointer', opacity: leyendoFoto ? 0.65 : 1 }}>
                  {leyendoFoto ? 'Leyendo imagen…' : '📷 Hacer foto'}
                </button>
                <button type="button" onClick={() => entradaCapturasRef.current?.click()} disabled={leyendoFoto} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', background: '#eff6ff', color: '#0047b3', fontWeight: 750, fontSize: 13, cursor: leyendoFoto ? 'wait' : 'pointer', opacity: leyendoFoto ? 0.65 : 1 }}>
                  {leyendoFoto ? 'Leyendo imagen…' : '🖼️ Subir capturas'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10, marginTop: 16 }}>
              <label style={labelStyle}>Nombre del boleto<input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo: Jornada 12" style={inputStyle} /></label>
              <label style={labelStyle}>Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} /></label>
              <label style={labelStyle}>Cantidad apostada (€)<input inputMode="decimal" type="number" min="0.01" step="0.01" value={importe} onFocus={(e) => e.currentTarget.select()} onBlur={(e) => { if (!e.currentTarget.value) setImporte('0.00'); }} onChange={(e) => { const valor = e.target.value; setImporte(valor); const apuesta = numeroOCR(valor); const cuotaActual = numeroOCR(cuota); setGananciaPotencial(apuesta && cuotaActual ? (apuesta * cuotaActual).toFixed(2) : '0.00'); }} placeholder="0,00" style={inputStyle} required /></label>
              <label style={labelStyle}>Cuota combinada<input inputMode="decimal" type="number" min="0.01" step="0.01" value={cuota} onFocus={(e) => e.currentTarget.select()} onBlur={(e) => { if (!e.currentTarget.value) setCuota('0.00'); }} onChange={(e) => { const valor = e.target.value; setCuota(valor); const apuesta = numeroOCR(importe); const cuotaNueva = numeroOCR(valor); setGananciaPotencial(apuesta && cuotaNueva ? (apuesta * cuotaNueva).toFixed(2) : '0.00'); }} placeholder="0,00" style={inputStyle} required /></label>
              <label style={labelStyle}>Ganancia potencial (€)<input inputMode="decimal" type="number" min="0.01" step="0.01" value={gananciaPotencial} onFocus={(e) => e.currentTarget.select()} onBlur={(e) => { if (!e.currentTarget.value) setGananciaPotencial('0.00'); }} onChange={(e) => setGananciaPotencial(e.target.value)} placeholder="0,00" style={inputStyle} required /></label>
              <label style={labelStyle}>Saldo inicial (€)<input aria-label="Saldo inicial (€)" inputMode="decimal" type="number" min="0" step="0.01" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} onBlur={guardarSaldoInicial} placeholder="0,00" style={inputStyle} /></label>
              <label style={labelStyle}>Saldo acumulado (€)<input aria-label="Saldo acumulado (€)" type="text" inputMode="decimal" value={euros(saldosPorBoleto.actual)} readOnly style={{ ...inputStyle, background: '#f8fafc', color: saldosPorBoleto.actual >= saldoInicialNumero ? '#15803d' : '#b91c1c', fontWeight: 800 }} /></label>
            </div>

            <div style={{ marginTop: 14, background: '#f8fafc', borderRadius: 10, padding: '11px 13px', color: '#334155', fontSize: 13 }}>
              Beneficio neto estimado si aciertas: <strong style={{ color: '#047857' }}>{euros(Math.max(0, gananciaNumero - importeNumero))}</strong>
              <span style={{ color: '#64748b' }}> (la ganancia potencial indicada por el boleto incluye la apuesta)</span>
              <div style={{ color: '#64748b', marginTop: 5 }}>El saldo acumulado descuenta las apuestas pendientes; al marcar un boleto como acertado suma el premio neto, y si es fallado descuenta la apuesta.</div>
            </div>

            {textoOCR && <details style={{ marginTop: 12 }}><summary style={{ cursor: 'pointer', color: '#475569', fontSize: 13 }}>Ver texto leído de la imagen</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#475569', fontSize: 12, background: '#f8fafc', padding: 10, borderRadius: 8 }}>{textoOCR}</pre></details>}

            {partidos.length > 0 && (
              <>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 14 }}>Puedes dejar una o dos selecciones por partido. Revisa los signos reconocidos antes de guardar.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {partidos.map((partido, indice) => (
                  <div key={partido.id} style={{ border: '1px solid #e2e8f0', borderRadius: 11, padding: 9 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 36px', alignItems: 'center', gap: 7 }}>
                      <input aria-label={`Equipo local del partido ${indice + 1}`} value={partido.local} onChange={(e) => setPartidos((actuales) => actuales.map((item) => item.id === partido.id ? { ...item, local: e.target.value } : item))} placeholder="Equipo local" style={inputStyle} />
                      <input aria-label={`Equipo visitante del partido ${indice + 1}`} value={partido.visitante} onChange={(e) => setPartidos((actuales) => actuales.map((item) => item.id === partido.id ? { ...item, visitante: e.target.value } : item))} placeholder="Equipo visitante" style={inputStyle} />
                      <button type="button" aria-label={`Quitar partido ${indice + 1}`} onClick={() => eliminarPartido(partido.id)} style={{ border: 0, background: '#fef2f2', color: '#b91c1c', borderRadius: 8, height: 38, fontSize: 17, cursor: 'pointer' }}>×</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, flexWrap: 'wrap' }}>
                      {(['1', 'X', '2'] as Pronostico[]).map((opcion) => <label key={opcion} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: partido.pronostico.includes(opcion) ? '#eff6ff' : '#f8fafc', border: `1px solid ${partido.pronostico.includes(opcion) ? '#93c5fd' : '#e2e8f0'}`, borderRadius: 8, padding: '6px 10px', color: '#1e3a8a', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                        <input type="checkbox" aria-label={`Pronóstico ${opcion} del partido ${indice + 1}`} checked={partido.pronostico.includes(opcion)} onChange={(evento) => { const marcado = evento.currentTarget.checked; setPartidos((actuales) => actuales.map((item) => { if (item.id !== partido.id || (marcado && item.pronostico.length >= 2)) return item; return { ...item, pronostico: normalizarPronostico(marcado ? [...item.pronostico, opcion] : item.pronostico.filter((seleccion) => seleccion !== opcion)) }; })); }} />
                        {opcion}
                      </label>)}
                      <span style={{ color: partido.pronostico.length >= 1 && partido.pronostico.length <= 2 ? '#15803d' : '#a16207', fontSize: 11, fontWeight: 700 }}>{partido.pronostico.length} {partido.pronostico.length === 1 ? 'selección' : 'selecciones'}</span>
                    </div>
                  </div>
                ))}
              </div>
              </>
            )}

            {mensaje && <div role="status" style={{ marginTop: 12, color: mensaje.includes('no se pudo') || mensaje.includes('No se pudo') ? '#b91c1c' : '#1d4ed8', fontSize: 13 }}>{mensaje}</div>}
            <button type="submit" disabled={guardando || leyendoFoto || !hayPartidosActivos} style={{ ...primaryButtonStyle, marginTop: 16, opacity: guardando || leyendoFoto || !hayPartidosActivos ? 0.5 : 1, cursor: guardando || leyendoFoto || !hayPartidosActivos ? 'not-allowed' : 'pointer' }}>{guardando ? 'Guardando…' : 'Guardar boleto'}</button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 2px 10px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Mis boletos</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{boletos.length} boleto{boletos.length === 1 ? '' : 's'}</div>
          </div>
          {cargando ? <div style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>Cargando boletos…</div> : boletos.length === 0 ? <div style={{ textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: 14, padding: 28 }}>Todavía no hay boletos guardados.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {boletos.map((boleto) => {
                const importeBoleto = Number(boleto.importe) || 0;
                const cuotaBoleto = Number(boleto.cuota) || 0;
                const perdido = boleto.partidos.some((partido) => partido.resultado === 'fallado');
                const completado = boleto.partidos.length > 0 && (perdido || boleto.partidos.every((partido) => partido.resultado === 'acertado'));
                const estado = !completado ? 'Pendiente' : perdido ? 'Fallado' : 'Acertado';
                const beneficioBoleto = !completado ? null : perdido ? -importeBoleto : importeBoleto * (cuotaBoleto - 1);
                return <article key={boleto.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 15, padding: 15, boxShadow: '0 2px 8px rgba(15,23,42,.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div><div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>{boleto.nombre}</div><div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{new Date(`${boleto.fecha}T12:00:00`).toLocaleDateString('es-ES')} · {boleto.partidos.length} partidos</div></div>
                    <button type="button" onClick={() => borrarBoleto(boleto)} aria-label={`Eliminar ${boleto.nombre}`} style={{ border: 0, background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>Eliminar</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, background: '#f8fafc', borderRadius: 10, padding: 10, marginTop: 12, fontSize: 12, color: '#475569' }}>
                    <span>Apostado: <strong>{euros(importeBoleto)}</strong></span><span>Cuota: <strong>{cuotaBoleto.toFixed(2)}</strong></span><span>Ganancia potencial: <strong>{euros(Number(boleto.gananciaPotencial) || importeBoleto * cuotaBoleto)}</strong></span><span>Estado: <strong style={{ color: estado === 'Acertado' ? '#15803d' : estado === 'Fallado' ? '#b91c1c' : '#a16207' }}>{estado}</strong></span>{beneficioBoleto !== null && <span>Balance: <strong style={{ color: beneficioBoleto >= 0 ? '#15803d' : '#b91c1c' }}>{euros(beneficioBoleto)}</strong></span>}{saldosPorBoleto.porBoleto[boleto.id] && <><span>Saldo inicial: <strong>{euros(saldosPorBoleto.porBoleto[boleto.id].inicial)}</strong></span><span>Saldo acumulado: <strong>{euros(saldosPorBoleto.porBoleto[boleto.id].acumulado)}</strong></span></>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                    {boleto.partidos.map((partido) => <div key={partido.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9, background: partido.resultado === 'acertado' ? '#f0fdf4' : partido.resultado === 'fallado' ? '#fef2f2' : '#f8fafc' }}>
                      <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', overflowWrap: 'anywhere' }}>{partido.local} – {partido.visitante}</div><div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Pronóstico: <strong>{normalizarPronostico(partido.pronostico).join(' + ') || 'Sin revisar'}</strong></div></div>
                      <div role="group" aria-label={`Resultado ${partido.local} contra ${partido.visitante}`} style={{ display: 'flex', gap: 5 }}>
                        {(['acertado', 'fallado', 'pendiente'] as Resultado[]).map((resultado) => <button key={resultado} type="button" onClick={() => cambiarResultado(boleto, partido.id, resultado)} aria-pressed={partido.resultado === resultado} title={resultado === 'acertado' ? 'Acertado' : resultado === 'fallado' ? 'Fallado' : 'Pendiente'} style={{ width: 34, height: 32, borderRadius: 8, border: partido.resultado === resultado ? `2px solid ${resultado === 'acertado' ? '#16a34a' : resultado === 'fallado' ? '#dc2626' : '#94a3b8'}` : '1px solid #cbd5e1', background: partido.resultado === resultado ? resultado === 'acertado' ? '#dcfce7' : resultado === 'fallado' ? '#fee2e2' : '#e2e8f0' : '#fff', color: resultado === 'acertado' ? '#15803d' : resultado === 'fallado' ? '#b91c1c' : '#64748b', cursor: 'pointer', fontWeight: 900 }}>{resultado === 'acertado' ? '✓' : resultado === 'fallado' ? '✕' : '·'}</button>)}
                      </div>
                    </div>)}
                  </div>
                </article>;
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', color: '#475569', fontSize: 12, fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: '100%', minWidth: 0, boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 10px', marginTop: 5, background: '#fff', color: '#0f172a', fontSize: 13 };
const primaryButtonStyle: React.CSSProperties = { width: '100%', border: 0, background: 'linear-gradient(90deg,#0047b3,#0759c3)', color: '#fff', borderRadius: 10, padding: '12px 15px', fontSize: 14, fontWeight: 800, cursor: 'pointer' };
