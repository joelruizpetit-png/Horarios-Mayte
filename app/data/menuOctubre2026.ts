// app/data/menuOctubre2026.ts
import { doc, setDoc, Firestore } from 'firebase/firestore';

export interface MenuDiaEscolar {
  fecha: string; // Formato YYYY-MM-DD
  primerPlato: string;
  segundoPlato: string;
  postre: string;
  observaciones?: string;
  actualizadoPor?: string;
  actualizadoEl?: string;
}

export const MENU_OCTUBRE_2026: MenuDiaEscolar[] = [
  {
    fecha: "2026-10-01",
    primerPlato: "Crema de blat de moro i porro",
    segundoPlato: "Pollastre al forn amb salsa barbacoa casolana i arròs saltat",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 10-12, 1-3T-6-7T-8T-10T-11T | Kcal: 602, Lip: 18.34, Prot: 25.73, HC: 81.10"
  },
  {
    fecha: "2026-10-02",
    primerPlato: "Sopa de brou amb arròs",
    segundoPlato: "Lluç amorosit amb salsa de tomàquet, albergínia, pastanaga, ceba i patata dau",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 4-9T, 1-3T-6-7T-8T-10T-11T | Kcal: 522, Lip: 19.89, Prot: 23.91, HC: 62.63"
  },
  {
    fecha: "2026-10-05",
    primerPlato: "Llenties estofades amb verdures (tomàquet, pastanaga, ceba)",
    segundoPlato: "Truita de tonyina casolana amb amanida d'enciam i olives",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1T, 3-4, 1-3T-6-7T-8T-10T-11T | Kcal: 772, Lip: 34.90, Prot: 35.86, HC: 81.89"
  },
  {
    fecha: "2026-10-06",
    primerPlato: "Risotto de carabassa i tomàquet",
    segundoPlato: "Estofat de carn magra a la jardinera amb patata dau",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6-7T-8T-10T-11T | Kcal: 783, Lip: 21.68, Prot: 31.35, HC: 115.89"
  },
  {
    fecha: "2026-10-07",
    primerPlato: "Crema de carabassó, patata i ceba",
    segundoPlato: "Cigrons amb cuscús i verdures amb amanida d'enciam i blat de moro",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-6T-10T, 1-3T-6-7T-8T-10T-11T | Kcal: 768, Lip: 21.41, Prot: 26.52, HC: 116.54"
  },
  {
    fecha: "2026-10-08",
    primerPlato: "Espirals integrals amb salsa d'espinacs (espinacs, ceba, nata)",
    segundoPlato: "Palometa a l'andalusa amb amanida d'enciam i pastanaga",
    postre: "Iogurt i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6T-7-10T, 2T-4-14T, 1-3T-6-7-8T-10T-11T | Kcal: 806, Lip: 30.40, Prot: 40.09, HC: 90.99"
  },
  {
    fecha: "2026-10-09",
    primerPlato: "Patates estofades amb verdures (pebrot, ceba, pèsols)",
    segundoPlato: "Contracuixa de pollastre amb cítrics i arròs saltat",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6-7T-8T-10T-11T | Kcal: 778, Lip: 17.62, Prot: 38.88, HC: 100.01"
  },
  {
    fecha: "2026-10-12",
    primerPlato: "Festiu escolar (Día de la Hispanitat / Festa Nacional)",
    segundoPlato: "Sense servei de menjador",
    postre: "Festiu",
    observaciones: "Dia no lectiu - Festiu escolar"
  },
  {
    fecha: "2026-10-13",
    primerPlato: "Crema de carabassa",
    segundoPlato: "Macarrons integrals amb bolonyesa de llenties i amanida d'enciam i pastanaga",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6T-10T, 1-3T-6-7T-8T-10T-11T | Kcal: 754, Lip: 21.01, Prot: 28.91, HC: 116.13"
  },
  {
    fecha: "2026-10-14",
    primerPlato: "Arròs napolitana",
    segundoPlato: "Truita de patates casolana amb amanida d'enciam i olives",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 3, 1-3T-6-7T-8T-10T-11T | Kcal: 800, Lip: 32.89, Prot: 21.68, HC: 104.18"
  },
  {
    fecha: "2026-10-15",
    primerPlato: "Mongetes blanques estofades amb verdures (tomàquet, pastanaga, ceba)",
    segundoPlato: "Lluç al forn amb salsa de mel i mostassa amb llit de patata panadera i amanida d'enciam i tomàquet",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 12, 2T-4-10-12-14T, 1-3T-6-7T-8T-10T-11T | Kcal: 668, Lip: 22.94, Prot: 27.78, HC: 83.67"
  },
  {
    fecha: "2026-10-16",
    primerPlato: "Coliflor cruixent i patata al forn",
    segundoPlato: "Estofat de gall dindi a la jardinera i arròs saltat",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-6T-7-10T, 1-3T-6-7T-8T-10T-11T | Kcal: 810, Lip: 19.60, Prot: 42.75, HC: 116.79"
  },
  {
    fecha: "2026-10-19",
    primerPlato: "Arròs integral amb salsa de carabassa, ceba, porro i tomàquet",
    segundoPlato: "Truita de pernil dolç casolana amb amanida d'enciam i sèsam",
    postre: "Iogurt i Pa Integral",
    observaciones: "Alérgenos: 3-6T-7T, 11 (sèsam), 1-3T-6-7-8T-10T-11T | Kcal: 765, Lip: 33.98, Prot: 29.15, HC: 80.98"
  },
  {
    fecha: "2026-10-20",
    primerPlato: "Vichyssoise (porro, ceba, patata)",
    segundoPlato: "Cigrons saltats amb verdures (ceba, pastanaga, tomàquet) i amanida d'enciam i olives",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 7, 1-3T-6-7T-8T-10T-11T | Kcal: 769, Lip: 28.05, Prot: 24.73, HC: 105.05"
  },
  {
    fecha: "2026-10-21",
    primerPlato: "Sopa de brou amb pistons",
    segundoPlato: "Pollastre al forn amb poma i arròs saltat",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6T-10T, 1-3T-6-7T-8T-10T-11T | Kcal: 705, Lip: 17.81, Prot: 40.08, HC: 95.30"
  },
  {
    fecha: "2026-10-22",
    primerPlato: "Mongeta verda amb patata",
    segundoPlato: "Fideus a la cassola amb magra",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6T-10T, 1-3T-6-7T-8T-10T-11T | Kcal: 792, Lip: 14.89, Prot: 27.41, HC: 136.44"
  },
  {
    fecha: "2026-10-23",
    primerPlato: "Llenties estofades amb verdures (tomàquet, pastanaga, ceba)",
    segundoPlato: "Rap a l'andalusa casolà amb amanida d'enciam i remolatxa",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1T, 1-4-6T-10T, 1-3T-6-7T-8T-10T-11T | Kcal: 752, Lip: 24.67, Prot: 38.40, HC: 96.18"
  },
  {
    fecha: "2026-10-26",
    primerPlato: "Arròs integral amb sofregit de pastanaga, porro i all",
    segundoPlato: "Truita de carabassa i ceba casolana amb amanida d'enciam i olives",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 3, 1-3T-6-7T-8T-10T-11T | Kcal: 767, Lip: 30.71, Prot: 20.92, HC: 97.72"
  },
  {
    fecha: "2026-10-27",
    primerPlato: "Trinxat de bròquil i patata amb allet",
    segundoPlato: "Pollastre al curri amb arròs saltat",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6-7T-8T-10T-11T | Kcal: 746, Lip: 23.32, Prot: 40.16, HC: 101.82"
  },
  {
    fecha: "2026-10-28",
    primerPlato: "Sopa d'au amb pasta fina",
    segundoPlato: "Truita vegana de cigró i patata amb amanida d'enciam i pastanaga",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6T-10T, 1T-6T-8T-11T, 1-3T-6-7T-8T-10T-11T | Kcal: 689, Lip: 26.29, Prot: 19.18, HC: 92.44"
  },
  {
    fecha: "2026-10-29",
    primerPlato: "Llenties estofades amb verdures (tomàquet, pastanaga, ceba)",
    segundoPlato: "Lluç al forn amb amanida d'enciam i pastanaga",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1T, 4, 1-3T-6-7T-8T-10T-11T | Kcal: 636, Lip: 20.43, Prot: 33.78, HC: 81.51"
  },
  {
    fecha: "2026-10-30",
    primerPlato: "Crema de carabassa, moniato i patata",
    segundoPlato: "Mandonguilles amb sépia i amanida d'enciam i remolatxa",
    postre: "Natilles de xocolata i castanya casolanes",
    observaciones: "Menú especial de la Castanyada. Alérgenos: 6T-7T-12-14, 7 | Kcal: 755, Lip: 43.58, Prot: 25.18, HC: 64.20"
  }
];

export const MENU_NOVIEMBRE_2026: MenuDiaEscolar[] = [
  {
    fecha: "2026-11-02",
    primerPlato: "Festiu escolar",
    segundoPlato: "Sense servei de menjador",
    postre: "Festiu",
    observaciones: "Dia no lectiu - Festiu escolar"
  },
  {
    fecha: "2026-11-03",
    primerPlato: "Espaguetis integrals amb sofregit de tomàquet i orenga",
    segundoPlato: "Truita de carabassó i ceba casolana amb amanida d'enciam i olives",
    postre: "Iogurt i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6T-10T, 3, 1-3T-6-7-8T-10T-11T | Kcal: 741, Lip: 36.88, Prot: 26.57, HC: 71.81"
  },
  {
    fecha: "2026-11-04",
    primerPlato: "Crema de blat de moro i porro",
    segundoPlato: "Pollastre al forn amb salsa barbacoa casolana i amanida d'enciam i brots de soja",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 10-12, 1-3T-6-7T-8T-10T-11T | Kcal: 568, Lip: 23.29, Prot: 25.03, HC: 63.03"
  },
  {
    fecha: "2026-11-05",
    primerPlato: "Cigrons estofats amb verdures",
    segundoPlato: "Capçada de porc rostida amb amanida d'enciam i remolatxa",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6-7T-8T-10T-11T | Kcal: 709, Lip: 25.31, Prot: 39.92, HC: 79.90"
  },
  {
    fecha: "2026-11-06",
    primerPlato: "Sopa de brou amb arròs",
    segundoPlato: "Lluç amorosit amb salsa de tomàquet, albergínia, pastanaga, ceba i patata dau",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 4-9T, 1-3T-6-7T-8T-10T-11T | Kcal: 522, Lip: 19.89, Prot: 23.91, HC: 62.63"
  },
  {
    fecha: "2026-11-09",
    primerPlato: "Llenties estofades amb verdures (tomàquet, pastanaga, ceba)",
    segundoPlato: "Truita de patates casolana amb amanida d'enciam i olives",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1T, 3, 1-3T-6-7T-8T-10T-11T | Kcal: 765, Lip: 31.98, Prot: 31.55, HC: 90.23"
  },
  {
    fecha: "2026-11-10",
    primerPlato: "Risotto de carabassa i tomàquet",
    segundoPlato: "Estofat de carn magra a la jardinera amb patata dau",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6-7T-8T-10T-11T | Kcal: 783, Lip: 21.63, Prot: 31.35, HC: 115.89"
  },
  {
    fecha: "2026-11-11",
    primerPlato: "Crema de carabassó, patata i ceba",
    segundoPlato: "Cigrons amb cuscús i verdures amb amanida d'enciam i blat de moro",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-6T-10T, 1-3T-6-7T-8T-10T-11T | Kcal: 763, Lip: 21.41, Prot: 26.52, HC: 116.54"
  },
  {
    fecha: "2026-11-12",
    primerPlato: "Espirals integrals amb salsa d'espinacs (espinacs, ceba, nata)",
    segundoPlato: "Seitó a l'andalusa casolà amb amanida d'enciam i pastanaga",
    postre: "Iogurt i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6T-7-10T, 1-2T-4-6T-10T-14T, 1-3T-6-7-8T-10T-11T | Kcal: 965, Lip: 32.83, Prot: 46.68, HC: 118.04"
  },
  {
    fecha: "2026-11-13",
    primerPlato: "Patates estofades amb verdures (pebrot, ceba, pèsols)",
    segundoPlato: "Contracuixa de pollastre amb cítrics i arròs saltat",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6-7T-8T-10T-11T | Kcal: 778, Lip: 17.62, Prot: 38.88, HC: 100.01"
  },
  {
    fecha: "2026-11-16",
    primerPlato: "Crema de carabassa",
    segundoPlato: "Macarrons integrals amb bolonyesa de llenties",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6T-10T, 1-3T-6-7T-8T-10T-11T | Kcal: 697, Lip: 15.78, Prot: 22.76, HC: 114.31"
  },
  {
    fecha: "2026-11-17",
    primerPlato: "Sopa d'au amb pasta fina",
    segundoPlato: "Lluç al forn amb salsa de mel i mostassa amb llit de patata panadera i amanida d'enciam i pastanaga",
    postre: "Iogurt i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6T-10T, 2T-4-10-12-14T, 1-3T-6-7-8T-10T-11T | Kcal: 686, Lip: 26.84, Prot: 31.26, HC: 77.98"
  },
  {
    fecha: "2026-11-18",
    primerPlato: "Arròs napolitana",
    segundoPlato: "Truita de tonyina casolana amb amanida d'enciam i olives",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 3-4, 1-3T-6-7T-8T-10T-11T | Kcal: 807, Lip: 35.30, Prot: 25.69, HC: 95.29"
  },
  {
    fecha: "2026-11-19",
    primerPlato: "Mongetes blanques estofades amb verdures (tomàquet, pastanaga, ceba)",
    segundoPlato: "Botifarra al forn amb amanida d'enciam i tomàquet",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 12, 7T-12, 1-3T-6-7T-8T-10T-11T | Kcal: 694, Lip: 33.12, Prot: 30.25, HC: 65.73"
  },
  {
    fecha: "2026-11-20",
    primerPlato: "Coliflor cruixent i patata al forn",
    segundoPlato: "Estofat de gall dindi a la jardinera i arròs saltat",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-6T-7-10T, 1-3T-6-7T-8T-10T-11T | Kcal: 810, Lip: 19.60, Prot: 42.75, HC: 116.79"
  },
  {
    fecha: "2026-11-23",
    primerPlato: "Arròs integral amb salsa de carabassa, ceba, porro i tomàquet",
    segundoPlato: "Truita de pernil dolç casolana amb amanida d'enciam i sèsam",
    postre: "Iogurt i Pa Integral",
    observaciones: "Alérgenos: 3, 11, 1-3T-6-7-8T-10T-11T | Kcal: 764, Lip: 33.78, Prot: 29.35, HC: 80.98"
  },
  {
    fecha: "2026-11-24",
    primerPlato: "Vichyssoise (porro, ceba, patata)",
    segundoPlato: "Cigrons saltats amb verdures (ceba, pastanaga, tomàquet) i amanida d'enciam i olives",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 7, 1-3T-6-7T-8T-10T-11T | Kcal: 769, Lip: 28.05, Prot: 24.73, HC: 105.05"
  },
  {
    fecha: "2026-11-25",
    primerPlato: "Sopa de brou amb pistons",
    segundoPlato: "Pollastre al forn amb poma i arròs saltat",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6T-10T, 1-3T-6-7T-8T-10T-11T | Kcal: 705, Lip: 17.81, Prot: 40.08, HC: 95.30"
  },
  {
    fecha: "2026-11-26",
    primerPlato: "Mongeta verda amb patata",
    segundoPlato: "Fideus a la cassola amb magra",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6T-10T, 1-3T-6-7T-8T-10T-11T | Kcal: 792, Lip: 14.89, Prot: 27.41, HC: 136.44"
  },
  {
    fecha: "2026-11-27",
    primerPlato: "Llenties estofades amb verdures (tomàquet, pastanaga, ceba)",
    segundoPlato: "Rap a l'andalusa casolà amb amanida d'enciam i remolatxa",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1T, 1-4-6T-10T, 1-3T-6-7T-8T-10T-11T | Kcal: 752, Lip: 24.67, Prot: 38.40, HC: 96.18"
  },
  {
    fecha: "2026-11-30",
    primerPlato: "Crema de carabassó, patata i ceba",
    segundoPlato: "Macarrons integrals a la bolonyesa i formatge ratllat",
    postre: "Fruita variada i Pa Integral",
    observaciones: "Alérgenos: 1-3T-6T-7-10T-12, 1-3T-6-7T-8T-10T-11T | Kcal: 723, Lip: 21.44, Prot: 28.87, HC: 103.39"
  }
];

export const MENU_ESCOLAR_2026: MenuDiaEscolar[] = [
  ...MENU_OCTUBRE_2026,
  ...MENU_NOVIEMBRE_2026
];

/**
 * Inserta todos los menús de octubre y noviembre 2026 en Firestore.
 * Escribe tanto en 'menu_escolar' como en 'menu_escolar_alma' para máxima compatibilidad.
 */
export async function sincronizarMenuOctubreFirestore(
  db: Firestore,
  usuarioEmail: string = 'sistema@planificador'
): Promise<{ total: number; exito: boolean }> {
  try {
    const timestamp = new Date().toISOString();
    let contador = 0;

    for (const menu of MENU_ESCOLAR_2026) {
      const docData: MenuDiaEscolar = {
        ...menu,
        actualizadoPor: usuarioEmail,
        actualizadoEl: timestamp
      };

      // 1. Guardar en 'menu_escolar' (solicitado explícitamente en el requerimiento)
      await setDoc(doc(db, "menu_escolar", menu.fecha), docData);

      // 2. Guardar en 'menu_escolar_alma' (colección activa de la interfaz de la app)
      await setDoc(doc(db, "menu_escolar_alma", menu.fecha), docData);

      contador++;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('menu_noviembre_2026_sincronizado', 'true');
    }

    return { total: contador, exito: true };
  } catch (error) {
    console.error("Error al sincronizar menú escolar en Firestore:", error);
    return { total: 0, exito: false };
  }
}
