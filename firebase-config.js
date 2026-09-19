/* =========================================================
   firebase-config.js
   Konfigurasi Firebase Realtime Database (Vanilla JS Compat)
   Kompatibel dengan Netlify static hosting & semua browser (iOS/Android/Desktop).
   ========================================================= */

(function () {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyDJX0DwSr1XZ0j03VyMNA0JKrasV4J0gV0",
    authDomain: "game-website-pembelajaran.firebaseapp.com",
    databaseURL: "https://game-website-pembelajaran-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "game-website-pembelajaran",
    storageBucket: "game-website-pembelajaran.firebasestorage.app",
    messagingSenderId: "574744726596",
    appId: "1:574744726596:web:59949c5291b3929ade8011",
    measurementId: "G-11TF0KK9P0"
  };

  window.FIREBASE_CONFIG = firebaseConfig;

  function initFirebase() {
    if (typeof window.firebase === "undefined") {
      console.warn("[Firebase] SDK Firebase compat belum dimuat di index.html!");
      return null;
    }

    try {
      if (!window.firebase.apps || !window.firebase.apps.length) {
        window.firebase.initializeApp(firebaseConfig);
        console.log("[Firebase] ✅ Firebase App berhasil diinisialisasi.");
      }

      if (typeof window.firebase.database === "function") {
        const db = window.firebase.database();
        window._firebaseDb = db;
        console.log("[Firebase] ✅ Firebase Realtime Database terhubung:", firebaseConfig.databaseURL);
        return db;
      } else {
        console.warn("[Firebase] Pustaka firebase-database-compat belum tersedia.");
        return null;
      }
    } catch (err) {
      console.error("[Firebase] ❌ Gagal inisialisasi Firebase:", err);
      return null;
    }
  }

  // Inisialisasi awal
  initFirebase();

  // Helper global untuk mengambil instance database
  window.getFirebaseDb = function () {
    if (window._firebaseDb) return window._firebaseDb;
    return initFirebase();
  };
})();