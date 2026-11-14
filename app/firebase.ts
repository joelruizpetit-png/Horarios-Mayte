// app/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyApjxoDTix4TVtOBlaHOIS_UzmPNCw8hNQ",
  authDomain: "horarios-mayte.firebaseapp.com",
  projectId: "horarios-mayte",
  storageBucket: "horarios-mayte.firebasestorage.app",
  messagingSenderId: "1005767774849",
  appId: "1:1005767774849:web:501494f2c61ca012743380",
  measurementId: "G-Q21RZBJNDT"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);


