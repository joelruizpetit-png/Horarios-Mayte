// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // <--- 1. NUEVA IMPORTACIÓN

const firebaseConfig = {
  // TUS DATOS (Déjalos tal cual los tenías, no cambian)
  apiKey: "AIzaSyBXvQPqJDXZohK03S2CeXt8ULkyAYbHiD4",
  authDomain: "planificador-familiar.firebaseapp.com",
  projectId: "planificador-familiar",
  storageBucket: "planificador-familiar.firebasestorage.app",
  messagingSenderId: "979162382340",
  appId: "1:979162382340:web:927953ddc760881a3cb551"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); // <--- 2. EXPORTAMOS LA AUTH