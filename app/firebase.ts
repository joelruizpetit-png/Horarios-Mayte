// app/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBXvQPqJDXZohK03S2CeXt8ULkyAYbHiD4",
  authDomain: "planificador-familiar.firebaseapp.com",
  projectId: "planificador-familiar",
  storageBucket: "planificador-familiar.firebasestorage.app",
  messagingSenderId: "979162382340",
  appId: "1:979162382340:web:927953ddc760881a3cb551"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Alcance de Google Calendar API para sincronización de eventos y alertas/alarmas nativas
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export const googleCalendarProvider = new GoogleAuthProvider();
googleCalendarProvider.addScope(GOOGLE_CALENDAR_SCOPE);
googleCalendarProvider.setCustomParameters({ prompt: "select_account" });
