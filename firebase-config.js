import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Konfigurasi dari proyek Firebase Anda
const firebaseConfig = {
  apiKey: "AIzaSyAPmhZseW57vkHqFT3V5I6xDLqFhibLjFU",
  authDomain: "jadwal-peserta-app.firebaseapp.com",
  projectId: "jadwal-peserta-app",
  storageBucket: "jadwal-peserta-app.firebasestorage.app",
  messagingSenderId: "319991114245",
  appId: "1:319991114245:web:beca5ff5bce1cd266d4a6c"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);