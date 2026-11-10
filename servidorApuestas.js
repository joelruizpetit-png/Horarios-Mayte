require('dotenv').config({ quiet: true });
const tls = require('tls');
if (
  typeof tls.getCACertificates === 'function' &&
  typeof tls.setDefaultCACertificates === 'function'
) {
  tls.setDefaultCACertificates([
    ...tls.getCACertificates('default'),
    ...tls.getCACertificates('system'),
  ]);
}
const axios = require('axios');
const http = require('http');

const API_KEY = process.env.FOOTBALL_DATA_KEY;
const BASE_URL = 'https://api.football-data.org/v4';
const PORT = process.env.PORT || 3001;

// Parámetros configurables de estrategia y filtrado de cuotas
const LIMITE_TOP_PARTIDOS = 5;
const CUOTA_MIN = Number(process.env.CUOTA_MIN) || 1.25;
const CUOTA_MAX = Number(process.env.CUOTA_MAX) || 1.45;

// Las 5 grandes ligas europeas incluidas en el plan gratuito (5 ligas x 2 llamadas = 10 llamadas/min)
const LEAGUES = [
  { code: 'PD', name: 'LaLiga (Primera División)' },
  { code: 'PL', name: 'Premier League' },
  { code: 'BL1', name: 'Bundesliga' },
  { code: 'SA', name: 'Serie A' },
  { code: 'FL1', name: 'Ligue 1' },
];

if (!API_KEY && require.main === module) {
  console.error('❌ Error: No se encontró FOOTBALL_DATA_KEY en el archivo .env');
  process.exit(1);
}

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-Auth-Token': API_KEY || '',
  },
});

/**
 * Obtiene la fecha en formato YYYY-MM-DD
 */
function formatearFechaISO(fecha) {
  return fecha.toISOString().split('T')[0];
}

/**
 * Redondea un número a 2 decimales
 */
function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

/**
 * Obtiene la clasificación de una liga y extrae:
 * - El Top 5 de la tabla general (TOTAL)
 * - Mapas de estadísticas TOTAL, HOME y AWAY de todos los equipos para el cálculo de xG
 */
async function obtenerDatosClasificacion(leagueCode) {
  const response = await apiClient.get(`/competitions/${leagueCode}/standings`);

  const standingsList = response.data?.standings || [];
  const tablaTotal =
    standingsList.find((s) => s.type === 'TOTAL')?.table ||
    standingsList[0]?.table ||
    [];
  const tablaHome = standingsList.find((s) => s.type === 'HOME')?.table || [];
  const tablaAway = standingsList.find((s) => s.type === 'AWAY')?.table || [];

  const top5Map = new Map();
  const totalStatsMap = new Map();
  const homeStatsMap = new Map();
  const awayStatsMap = new Map();

  tablaTotal.forEach((item) => {
    const info = {
      id: item.team.id,
      name: item.team.name,
      shortName: item.team.shortName || item.team.name,
      crest: item.team.crest || null,
      position: item.position,
      points: item.points,
      playedGames: item.playedGames,
      goalsFor: item.goalsFor,
      goalsAgainst: item.goalsAgainst,
    };
    totalStatsMap.set(item.team.id, info);

    if (item.position <= 5) {
      top5Map.set(item.team.id, info);
    }
  });

  tablaHome.forEach((item) => {
    homeStatsMap.set(item.team.id, {
      playedGames: item.playedGames,
      goalsFor: item.goalsFor,
      goalsAgainst: item.goalsAgainst,
    });
  });

  tablaAway.forEach((item) => {
    awayStatsMap.set(item.team.id, {
      playedGames: item.playedGames,
      goalsFor: item.goalsFor,
      goalsAgainst: item.goalsAgainst,
    });
  });

  const startDate = response.data?.season?.startDate || '';
  const seasonYear = startDate ? Number(startDate.split('-')[0]) : 2026;
  const currentMatchday = response.data?.season?.currentMatchday || null;

  return {
    seasonYear,
    currentMatchday,
    top5Map,
    statsContext: {
      totalStatsMap,
      homeStatsMap,
      awayStatsMap,
    },
  };
}

/**
 * Calcula las métricas de xG (Goles Esperados) para el equipo local, visitante y total del partido.
 * Usa un modelo ponderado de rendimiento ofensivo/defensivo (65% rendimiento específico Local/Visitante
 * + 35% rendimiento general en la temporada). Envuelto en try/catch por si algún dato avanzado
 * no está disponible en el plan gratuito.
 */
function calcularMetricasXG(homeTeamId, awayTeamId, statsContext) {
  try {
    const { totalStatsMap, homeStatsMap, awayStatsMap } = statsContext || {};
    const homeTotal = totalStatsMap?.get(homeTeamId);
    const awayTotal = totalStatsMap?.get(awayTeamId);

    if (
      !homeTotal ||
      !awayTotal ||
      !homeTotal.playedGames ||
      !awayTotal.playedGames
    ) {
      return {
        disponible: false,
        xGLocal: null,
        xGVisitante: null,
        xGTotalPartido: null,
        aviso:
          'Datos estadísticos insuficientes en el plan gratuito para calcular xG en este encuentro.',
      };
    }

    const homeSpecific = homeStatsMap?.get(homeTeamId);
    const awaySpecific = awayStatsMap?.get(awayTeamId);

    // Promedios generales (TOTAL) por partido
    const homeGFGeneral = homeTotal.goalsFor / homeTotal.playedGames;
    const homeGAGeneral = homeTotal.goalsAgainst / homeTotal.playedGames;
    const awayGFGeneral = awayTotal.goalsFor / awayTotal.playedGames;
    const awayGAGeneral = awayTotal.goalsAgainst / awayTotal.playedGames;

    let homeAttackRate;
    let homeDefenseRate;
    let awayAttackRate;
    let awayDefenseRate;
    let metodo;

    if (
      homeSpecific?.playedGames > 0 &&
      awaySpecific?.playedGames > 0
    ) {
      const homeGFHome = homeSpecific.goalsFor / homeSpecific.playedGames;
      const homeGAHome = homeSpecific.goalsAgainst / homeSpecific.playedGames;
      const awayGFAway = awaySpecific.goalsFor / awaySpecific.playedGames;
      const awayGAAway = awaySpecific.goalsAgainst / awaySpecific.playedGames;

      homeAttackRate = 0.65 * homeGFHome + 0.35 * homeGFGeneral;
      homeDefenseRate = 0.65 * homeGAHome + 0.35 * homeGAGeneral;
      awayAttackRate = 0.65 * awayGFAway + 0.35 * awayGFGeneral;
      awayDefenseRate = 0.65 * awayGAAway + 0.35 * awayGAGeneral;
      metodo =
        'Promedio ponderado ofensivo/defensivo (65% rendimiento Local/Visitante + 35% tabla general)';
    } else {
      homeAttackRate = homeGFGeneral * 1.08;
      homeDefenseRate = homeGAGeneral * 0.92;
      awayAttackRate = awayGFGeneral * 0.92;
      awayDefenseRate = awayGAGeneral * 1.08;
      metodo =
        'Promedio ponderado ofensivo/defensivo sobre tabla general con ajuste de factor campo';
    }

    const xGLocal = redondear((homeAttackRate * 0.55) + (awayDefenseRate * 0.45));
    const xGVisitante = redondear((awayAttackRate * 0.55) + (homeDefenseRate * 0.45));
    const xGTotalPartido = redondear(xGLocal + xGVisitante);

    return {
      disponible: true,
      xGLocal,
      xGVisitante,
      xGTotalPartido,
      detalleRendimiento: {
        localGolesFavorPorPartido: redondear(homeGFGeneral),
        localGolesContraPorPartido: redondear(homeGAGeneral),
        visitanteGolesFavorPorPartido: redondear(awayGFGeneral),
        visitanteGolesContraPorPartido: redondear(awayGAGeneral),
      },
      metodo,
    };
  } catch (error) {
    return {
      disponible: false,
      xGLocal: null,
      xGVisitante: null,
      xGTotalPartido: null,
      aviso: `No fue posible calcular xG: ${error.message}`,
    };
  }
}

/**
 * 1. Modelo de Cuota Teórica Estimada para Doble Oportunidad (1X o X2).
 * Calcula la probabilidad implícita y la cuota teórica (aplicando margen de casa ~4.5%)
 * basándose en:
 *  - Factor campo (el favorito jugando de local en 1X parte de una probabilidad base mayor que jugando fuera en X2)
 *  - Brecha de puntos en la tabla (diferenciaPuntos)
 *  - Diferencia de Goles Esperados (diferenciaXG = xGFavorito - xGRival)
 *  - Zona de la tabla del rival (zona media vs colista)
 */
function calcularCuotaTeoricaDobleOportunidad({
  esFavoritoVisitante,
  diferenciaPuntos,
  diferenciaXG,
  posicionRival,
}) {
  // Probabilidad base de Doble Oportunidad para un equipo Top 5:
  // En casa (1X) es naturalmente más alta (~74.5%), como visitante (X2) baja (~68.5%)
  let probabilidad = esFavoritoVisitante ? 0.685 : 0.745;

  // Impacto de la brecha de puntos (+0.45% por punto de ventaja)
  probabilidad += diferenciaPuntos * 0.0045;

  // Impacto de la diferencia de xG (+4.5% por cada gol esperado de ventaja)
  probabilidad += diferenciaXG * 0.045;

  // Ajuste por dureza del rival según su posición en la tabla:
  // - Rival en zona media (puestos 8 a 12): resta 1.5% de probabilidad (eleva la cuota a zona de valor)
  // - Rival colista (puestos 18 a 20): suma 2.5% de probabilidad (hunde la cuota hacia 1.08-1.15)
  if (posicionRival >= 8 && posicionRival <= 12) {
    probabilidad -= 0.015;
  } else if (posicionRival >= 18) {
    probabilidad += 0.025;
  }

  // Acotamos la probabilidad teórica entre 58% y 92%
  const probAcotada = Math.min(0.92, Math.max(0.58, probabilidad));

  // Aplicamos el margen típico de casa de apuestas (overround ~95.5%)
  const MARGEN_CASA = 0.955;
  const cuotaEstimada = redondear(MARGEN_CASA / probAcotada);

  return {
    cuotaEstimada,
    probabilidadEstimadaPct: redondear(probAcotada * 100),
    enRangoObjetivo: cuotaEstimada >= CUOTA_MIN && cuotaEstimada <= CUOTA_MAX,
    rangoObjetivo: { min: CUOTA_MIN, max: CUOTA_MAX },
  };
}

/**
 * 3. Puntuación estratégica de valor para ordenar los partidos:
 * Prioriza:
 *  - Equipos Top 5 jugando como VISITANTES (X2) -> encarece sanamente la cuota
 *  - Rivales de ZONA MEDIA (puestos 8 a 12) frente a colistas desahuciados (18 a 20)
 *  - Ventaja ofensiva real en xG del equipo Top 5 y cercanía al centro del rango de cuota ideal (1.35)
 */
function calcularPuntuacionEstrategica({
  esFavoritoVisitante,
  posicionRival,
  diferenciaPuntos,
  diferenciaXG,
  cuotaEstimada,
}) {
  let score = 0;

  // 1) Gran prioridad si el favorito Top 5 juega como visitante (X2)
  if (esFavoritoVisitante) {
    score += 40;
  } else {
    score += 10;
  }

  // 2) Prioridad según la zona de la tabla del rival
  let clasificacionZonaRival = 'Zona Baja (13-17)';
  if (posicionRival >= 8 && posicionRival <= 12) {
    score += 45; // Rival ideal de zona media (8º a 12º)
    clasificacionZonaRival = 'Zona Media Ideal (8-12)';
  } else if (posicionRival >= 6 && posicionRival <= 7) {
    score += 25; // Zona media-alta (6º a 7º)
    clasificacionZonaRival = 'Zona Media-Alta (6-7)';
  } else if (posicionRival >= 13 && posicionRival <= 17) {
    score += 15; // Zona media-baja (13º a 17º)
  } else if (posicionRival >= 18) {
    score -= 30; // Penalización a colistas desahuciados (18º a 20º)
    clasificacionZonaRival = 'Colista Desahuciado (18-20)';
  }

  // 3) Bonificación por ventaja en xG del favorito y cercanía a la cuota óptima (1.35)
  score += Math.max(0, diferenciaXG * 12);
  const distanciaCentroCuota = Math.abs(cuotaEstimada - 1.35);
  score += Math.max(0, (0.15 - distanciaCentroCuota) * 100);

  // Pequeño ajuste por solidez en puntos sin premiar abusos contra colistas
  score += Math.min(diferenciaPuntos, 12) * 0.8;

  return {
    scoreValor: redondear(score),
    clasificacionZonaRival,
  };
}

/**
 * Obtiene los partidos de la temporada de una liga en una única llamada para:
 * 1) Filtrar los próximos partidos dentro de los próximos 14 días ('SCHEDULED' o 'TIMED')
 * 2) Conservar los partidos ya jugados ('FINISHED') y extraer los últimos 5 de cada equipo
 *    sin consumir llamadas adicionales del límite gratuito de football-data.org (10 req/min).
 */
async function obtenerPartidosLiga(leagueCode) {
  const hoy = new Date();
  const fechaHoy = formatearFechaISO(hoy);

  const fechaLimite = new Date(hoy);
  fechaLimite.setDate(hoy.getDate() + 14);
  const fechaHasta = formatearFechaISO(fechaLimite);

  const response = await apiClient.get(`/competitions/${leagueCode}/matches`);
  const allMatches = response.data?.matches || [];

  const proximosPartidos = allMatches.filter((match) => {
    if (match.status !== 'SCHEDULED' && match.status !== 'TIMED') return false;
    const fechaPartido = (match.utcDate || '').slice(0, 10);
    return fechaPartido >= fechaHoy && fechaPartido <= fechaHasta;
  });

  const partidosFinalizados = allMatches.filter(
    (match) =>
      match.status === 'FINISHED' &&
      match.score?.fullTime?.home != null &&
      match.score?.fullTime?.away != null
  );

  return {
    proximosPartidos,
    partidosFinalizados,
  };
}

/**
 * Extrae los últimos 5 partidos finalizados de un equipo ordenados del más reciente al más antiguo.
 * Cada elemento incluye:
 * - resultado: 'Victoria' | 'Empate' | 'Derrota'
 * - marcador: ej. "2-0", "1-1"
 * - escudoRival: URL del escudo ('crest') del rival
 * - condicion: 'LOCAL' | 'VISITANTE' (y booleano esLocal)
 */
function extraerUltimos5PartidosEquipo(teamId, partidosFinalizados, totalStatsMap) {
  if (!teamId || !Array.isArray(partidosFinalizados)) return [];

  const jugadosPorEquipo = partidosFinalizados
    .filter(
      (match) =>
        match.homeTeam?.id === teamId || match.awayTeam?.id === teamId
    )
    .sort(
      (a, b) =>
        new Date(b.utcDate || 0).getTime() - new Date(a.utcDate || 0).getTime()
    )
    .slice(0, 5);

  return jugadosPorEquipo.map((match) => {
    const esLocal = match.homeTeam?.id === teamId;
    const condicion = esLocal ? 'LOCAL' : 'VISITANTE';
    const equipoRival = esLocal ? match.awayTeam : match.homeTeam;
    const rivalStats = totalStatsMap?.get(equipoRival?.id);

    const golesLocal = Number(match.score?.fullTime?.home ?? 0);
    const golesVisitante = Number(match.score?.fullTime?.away ?? 0);
    const marcador = `${golesLocal}-${golesVisitante}`;

    const golesFavor = esLocal ? golesLocal : golesVisitante;
    const golesContra = esLocal ? golesVisitante : golesLocal;

    let resultado = 'Empate';
    if (golesFavor > golesContra) {
      resultado = 'Victoria';
    } else if (golesFavor < golesContra) {
      resultado = 'Derrota';
    }

    const escudoRival =
      equipoRival?.crest ||
      (rivalStats ? rivalStats.crest : null) ||
      '/placeholder.png';

    return {
      matchId: match.id,
      fechaUTC: match.utcDate,
      jornada: match.matchday || null,
      resultado,
      marcador,
      condicion,
      esLocal,
      escudoRival,
      rival: {
        id: equipoRival?.id || null,
        nombre: equipoRival?.name || 'Rival',
        nombreCorto: equipoRival?.shortName || equipoRival?.name || 'Rival',
        escudo: escudoRival,
      },
    };
  });
}

/**
 * Calcula la propuesta automática de Doble Oportunidad (1X o X2)
 * incluyendo la cuota teórica estimada y el análisis de zona del rival.
 */
function generarPropuestaDobleOportunidad({
  homeTeam,
  awayTeam,
  top5Map,
  totalStatsMap,
  metricasXG,
  diferenciaPuntos,
  diferenciaPosiciones,
  modeloCuota,
  evaluacionEstrategica,
}) {
  const homeTop = top5Map.get(homeTeam.id);
  const awayTop = top5Map.get(awayTeam.id);
  const homeGeneral = totalStatsMap.get(homeTeam.id);
  const awayGeneral = totalStatsMap.get(awayTeam.id);

  const textoXG = metricasXG?.disponible
    ? ` | xG: ${metricasXG.xGLocal} vs ${metricasXG.xGVisitante}`
    : '';

  if (homeTop && !awayTop) {
    const posVisitante = awayGeneral
      ? `#${awayGeneral.position} (${awayGeneral.points} pts, ${evaluacionEstrategica.clasificacionZonaRival})`
      : 'fuera del Top 5';
    return {
      mercado: 'Doble Oportunidad (1X)',
      seleccion: '1X',
      condicionFavorito: 'LOCAL',
      favorito: homeTeam.name,
      cuotaEstimada: modeloCuota.cuotaEstimada,
      probabilidadEstimadaPct: modeloCuota.probabilidadEstimadaPct,
      diferenciaPuntos,
      diferenciaPosiciones,
      motivo: `Cuota estimada ${modeloCuota.cuotaEstimada} (${modeloCuota.probabilidadEstimadaPct}% prob.): ${homeTeam.name} (#${homeTop.position}, ${homeTop.points} pts) juega en casa ante ${awayTeam.name} ${posVisitante}.${textoXG}`,
    };
  }

  if (!homeTop && awayTop) {
    const posLocal = homeGeneral
      ? `#${homeGeneral.position} (${homeGeneral.points} pts, ${evaluacionEstrategica.clasificacionZonaRival})`
      : 'fuera del Top 5';
    return {
      mercado: 'Doble Oportunidad (X2)',
      seleccion: 'X2',
      condicionFavorito: 'VISITANTE',
      favorito: awayTeam.name,
      cuotaEstimada: modeloCuota.cuotaEstimada,
      probabilidadEstimadaPct: modeloCuota.probabilidadEstimadaPct,
      diferenciaPuntos,
      diferenciaPosiciones,
      motivo: `Valor Visitante X2 con cuota estimada ${modeloCuota.cuotaEstimada} (${modeloCuota.probabilidadEstimadaPct}% prob.): ${awayTeam.name} (#${awayTop.position}, ${awayTop.points} pts) visita a ${homeTeam.name} ${posLocal}.${textoXG}`,
    };
  }

  return null;
}

// Caché en memoria (60s) para respetar el límite de 10 peticiones/minuto del plan gratuito
let cacheDatos = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000;

/**
 * Consulta clasificaciones y próximos partidos de las ligas configuradas,
 * filtra por Top 5 (sin duelos directos), calcula xG y Cuota Teórica Estimada,
 * filtra por el rango de cuota [CUOTA_MIN, CUOTA_MAX], prioriza visitantes ante rivales
 * de zona media (8-12) y devuelve el Top 5 de partidos más rentables.
 */
async function obtenerPropuestasPartidos() {
  const apiKeyActual = process.env.FOOTBALL_DATA_KEY || API_KEY;
  if (!apiKeyActual) {
    throw new Error(
      'Falta configurar la variable de entorno FOOTBALL_DATA_KEY en el servidor (Vercel > Settings > Environment Variables).'
    );
  }
  apiClient.defaults.headers['X-Auth-Token'] = apiKeyActual;

  const ahora = Date.now();
  if (cacheDatos && ahora - cacheTimestamp < CACHE_TTL_MS) {
    return cacheDatos;
  }

  const candidatosEnRango = [];
  const resumenLigas = [];
  const fechaHoy = formatearFechaISO(new Date());
  let temporadaDetectada = 2026;
  let duelosDirectosTop5Descartados = 0;
  let descartadosPorCuotaFueraDeRango = 0;

  for (const league of LEAGUES) {
    try {
      const {
        seasonYear,
        currentMatchday,
        top5Map,
        statsContext,
      } = await obtenerDatosClasificacion(league.code);

      if (seasonYear) temporadaDetectada = seasonYear;

      const {
        proximosPartidos: matches,
        partidosFinalizados,
      } = await obtenerPartidosLiga(league.code);
      let descartadosDueloDirectoLiga = 0;
      let descartadosPorCuotaLiga = 0;

      const partidosEvaluados = matches
        .filter((match) => {
          const homeId = match.homeTeam?.id;
          const awayId = match.awayTeam?.id;
          const homeInTop5 = top5Map.has(homeId);
          const awayInTop5 = top5Map.has(awayId);

          if (homeInTop5 && awayInTop5) {
            descartadosDueloDirectoLiga++;
            duelosDirectosTop5Descartados++;
            return false;
          }

          return homeInTop5 !== awayInTop5;
        })
        .map((match) => {
          const home = match.homeTeam;
          const away = match.awayTeam;
          const homeTop = top5Map.get(home.id);
          const awayTop = top5Map.get(away.id);
          const homeGeneral = statsContext.totalStatsMap.get(home.id);
          const awayGeneral = statsContext.totalStatsMap.get(away.id);

          const esFavoritoVisitante = Boolean(awayTop);
          const equipoFavoritoStats = homeTop ? homeGeneral : awayGeneral;
          const equipoRivalStats = homeTop ? awayGeneral : homeGeneral;

          const puntosFavorito = equipoFavoritoStats?.points ?? 0;
          const puntosRival = equipoRivalStats?.points ?? 0;
          const diferenciaPuntos = puntosFavorito - puntosRival;

          const posFavorito = equipoFavoritoStats?.position ?? 0;
          const posRival = equipoRivalStats?.position ?? 15;
          const diferenciaPosiciones = posRival - posFavorito;

          const metricasXG = calcularMetricasXG(home.id, away.id, statsContext);
          const xGFavorito = homeTop
            ? (metricasXG.xGLocal ?? 1.5)
            : (metricasXG.xGVisitante ?? 1.5);
          const xGRival = homeTop
            ? (metricasXG.xGVisitante ?? 1.1)
            : (metricasXG.xGLocal ?? 1.1);
          const diferenciaXG = redondear(xGFavorito - xGRival);

          // 1. Cálculo de la Cuota Teórica Estimada (1X o X2)
          const modeloCuota = calcularCuotaTeoricaDobleOportunidad({
            esFavoritoVisitante,
            diferenciaPuntos,
            diferenciaXG,
            posicionRival: posRival,
          });

          // 3. Puntuación estratégica (priorizando Visitantes X2 + Rival de Zona Media 8-12)
          const evaluacionEstrategica = calcularPuntuacionEstrategica({
            esFavoritoVisitante,
            posicionRival: posRival,
            diferenciaPuntos,
            diferenciaXG,
            cuotaEstimada: modeloCuota.cuotaEstimada,
          });

          const propuesta = generarPropuestaDobleOportunidad({
            homeTeam: home,
            awayTeam: away,
            top5Map,
            totalStatsMap: statsContext.totalStatsMap,
            metricasXG,
            diferenciaPuntos,
            diferenciaPosiciones,
            modeloCuota,
            evaluacionEstrategica,
          });

          const rachaLocal = extraerUltimos5PartidosEquipo(
            home.id,
            partidosFinalizados,
            statsContext.totalStatsMap
          );
          const rachaVisitante = extraerUltimos5PartidosEquipo(
            away.id,
            partidosFinalizados,
            statsContext.totalStatsMap
          );

          return {
            matchId: match.id,
            liga: {
              codigo: league.code,
              nombre: league.name,
              jornada: match.matchday || currentMatchday,
            },
            fechaUTC: match.utcDate,
            estado: match.status,
            partido: `${home.name} vs ${away.name}`,
            cuotaEstimada: modeloCuota.cuotaEstimada,
            modeloCuota,
            analisisValor: {
              scoreValor: evaluacionEstrategica.scoreValor,
              esFavoritoVisitante,
              posicionRival: posRival,
              clasificacionZonaRival: evaluacionEstrategica.clasificacionZonaRival,
              diferenciaPuntos,
              diferenciaPosiciones,
              diferenciaXG,
            },
            equipos: {
              local: {
                id: home.id,
                nombre: home.name,
                escudo: home.crest || (homeGeneral ? homeGeneral.crest : null) || 'placeholder.png',
                esTop5: Boolean(homeTop),
                posicionTabla: homeGeneral ? homeGeneral.position : null,
                puntos: homeGeneral ? homeGeneral.points : null,
                xG: metricasXG.xGLocal,
                ultimos5Partidos: rachaLocal,
              },
              visitante: {
                id: away.id,
                nombre: away.name,
                escudo: away.crest || (awayGeneral ? awayGeneral.crest : null) || 'placeholder.png',
                esTop5: Boolean(awayTop),
                posicionTabla: awayGeneral ? awayGeneral.position : null,
                puntos: awayGeneral ? awayGeneral.points : null,
                xG: metricasXG.xGVisitante,
                ultimos5Partidos: rachaVisitante,
              },
            },
            rachaUltimos5: {
              local: rachaLocal,
              visitante: rachaVisitante,
            },
            metricasXG,
            propuestaApuesta: propuesta,
          };
        });

      // 2. Filtro por Rango de Cuota Deseado [CUOTA_MIN, CUOTA_MAX]
      const partidosEnRangoLiga = partidosEvaluados.filter((p) => {
        if (!p.modeloCuota.enRangoObjetivo) {
          descartadosPorCuotaLiga++;
          descartadosPorCuotaFueraDeRango++;
          return false;
        }
        return true;
      });

      resumenLigas.push({
        codigo: league.code,
        nombre: league.name,
        disponibleEnPlanActual: true,
        jornadaActual: currentMatchday,
        top5: Array.from(top5Map.values()),
        duelosDirectosTop5Excluidos: descartadosDueloDirectoLiga,
        descartadosPorCuotaFueraDeRango: descartadosPorCuotaLiga,
        partidosEnRangoCuota: partidosEnRangoLiga.length,
      });

      candidatosEnRango.push(...partidosEnRangoLiga);
    } catch (error) {
      const status = error.response?.status;
      const apiMsg = error.response?.data?.message || error.message;
      const aviso =
        status === 403
          ? `Competición restringida en el plan gratuito de football-data.org (${apiMsg})`
          : `Error al consultar la competición (${apiMsg})`;

      console.warn(`⚠️ Aviso en ${league.name} (${league.code}): ${aviso}`);

      resumenLigas.push({
        codigo: league.code,
        nombre: league.name,
        disponibleEnPlanActual: false,
        aviso,
        top5: [],
        partidosEnRangoCuota: 0,
      });
    }

    // Pausa ligera anti-bloqueo (300ms) para no superar el timeout de 10s en Vercel
    await new Promise((r) => setTimeout(r, 300));
  }

  const ligasDisponibles = resumenLigas.filter((l) => l.disponibleEnPlanActual);
  if (ligasDisponibles.length === 0 && resumenLigas.length > 0) {
    const primerAviso = resumenLigas[0]?.aviso || 'No se pudo conectar con football-data.org';
    throw new Error(primerAviso);
  }

  // 3. Ordenación por puntuación estratégica (Visitante X2 + Rival Zona Media 8-12 + Valor de Cuota)
  const candidatosOrdenados = candidatosEnRango.sort(
    (a, b) => b.analisisValor.scoreValor - a.analisisValor.scoreValor
  );

  // Cortar la lista estrictamente a los 5 mejores partidos
  const top5Partidos = candidatosOrdenados
    .slice(0, LIMITE_TOP_PARTIDOS)
    .map((partido, index) => ({
      rankingValor: index + 1,
      ...partido,
    }));

  const respuesta = {
    proveedor: 'football-data.org (v4)',
    generadoEn: new Date().toISOString(),
    desdeFecha: fechaHoy,
    temporada: temporadaDetectada,
    parametrosEstrategia: {
      rangoCuotaObjetivo: { min: CUOTA_MIN, max: CUOTA_MAX },
      prioridad:
        'Equipos Top 5 como visitantes (X2) enfrentando a rivales de Zona Media (puestos 8 a 12)',
      limiteResultados: LIMITE_TOP_PARTIDOS,
    },
    resumenFiltrado: {
      duelosDirectosTop5Descartados,
      descartadosPorCuotaFueraDeRango,
      candidatosDentroDeRangoCuota: candidatosEnRango.length,
      totalPartidosPropuestos: top5Partidos.length,
    },
    ligasConsultadas: resumenLigas,
    partidos: top5Partidos,
  };

  if (top5Partidos.length > 0) {
    cacheDatos = respuesta;
    cacheTimestamp = Date.now();
  }

  return respuesta;
}

// Ejecución por consola y servidor HTTP opcional con --serve en el puerto 3001
if (require.main === module) {
  (async () => {
    console.log(
      `⚽ Consultando football-data.org v4 (Filtro Cuota [${CUOTA_MIN} - ${CUOTA_MAX}] + Prioridad Visitante/Zona Media)...\n`
    );

    const data = await obtenerPropuestasPartidos();
    console.log(JSON.stringify(data, null, 2));

    if (process.argv.includes('--serve')) {
      const server = http.createServer(async (req, res) => {
        if (req.url === '/api/apuestas' && req.method === 'GET') {
          try {
            const resultado = await obtenerPropuestasPartidos();
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(JSON.stringify(resultado, null, 2));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(
              JSON.stringify({
                error: 'Error al consultar football-data.org',
                detalle: err.message,
              })
            );
          }
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({ error: 'Ruta no encontrada. Usa GET /api/apuestas' })
          );
        }
      });

      server.listen(PORT, () => {
        console.log(`\n🚀 Servidor activo en http://localhost:${PORT}/api/apuestas`);
      });
    }
  })();
}

module.exports = { obtenerPropuestasPartidos };
