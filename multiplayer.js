/* =========================================================
   multiplayer.js
   Sistem Sinkronisasi Kelas & Papan Peringkat Real-time
   Menggunakan Firebase Realtime Database:
   - 100% kompatibel dengan hosting statis Netlify (tanpa server khusus).
   - Sinkronisasi instan bank soal dari Guru ke Murid lintas perangkat (iOS/Android/PC).
   - Live Leaderboard Guru auto-update saat murid menjawab soal.
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "psk_islam_classroom_v1";
  const LIVE_MONITOR_KEY = "GAME_LIVE_MONITOR";
  const CHANNEL_NAME = "psk_islam_classroom_channel";

  let channel = null;
  let currentRole = "student"; // 'teacher' | 'student'
  let studentId = null;
  let studentName = null;
  let studentKey = null;
  let classPin = null;
  try {
    const savedClass = readClassroomData();
    if (savedClass && savedClass.pin) {
      classPin = savedClass.pin;
    }
  } catch (e) {}
  let onLeaderboardUpdate = null;

  // Firebase References
  let teacherRoomRef = null;
  let studentsListenerRef = null;
  let studentProgressRef = null;

  function getDb() {
    if (window._firebaseDb) return window._firebaseDb;
    if (typeof window.getFirebaseDb === "function") {
      return window.getFirebaseDb();
    }
    if (typeof window.firebase !== "undefined" && typeof window.firebase.database === "function") {
      window._firebaseDb = window.firebase.database();
      return window._firebaseDb;
    }
    return null;
  }

  function sanitizeKey(str) {
    return String(str || "student")
      .replace(/[.#$\[\]\/]/g, "_")
      .replace(/\s+/g, "_")
      .trim()
      .slice(0, 32);
  }

  function hasBroadcastChannel() {
    return typeof BroadcastChannel !== "undefined";
  }

  function initChannel() {
    if (hasBroadcastChannel() && !channel) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data && event.data.type === "leaderboard-update") {
          notifyLeaderboardUpdate();
        }
      };
    }
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY || e.key === LIVE_MONITOR_KEY) {
        notifyLeaderboardUpdate();
      }
    });
  }

  function readClassroomData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { pin: null, students: {} };
      return JSON.parse(raw);
    } catch (e) {
      return { pin: null, students: {} };
    }
  }

  function writeClassroomData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      if (channel) {
        channel.postMessage({ type: "leaderboard-update" });
      }
    } catch (e) {}
  }

  function readLiveMonitorData() {
    try {
      const raw = localStorage.getItem(LIVE_MONITOR_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeLiveMonitorData(data) {
    try {
      localStorage.setItem(LIVE_MONITOR_KEY, JSON.stringify(data));
      if (channel) {
        channel.postMessage({ type: "leaderboard-update" });
      }
    } catch (e) {}
  }

  function notifyLeaderboardUpdate(list) {
    if (typeof onLeaderboardUpdate === "function") {
      onLeaderboardUpdate(list || getLiveMonitorList());
    }
  }

  function generatePin() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // -------------------- Guru (Teacher) Session --------------------
  function startTeacherSession(customQuestions) {
    initChannel();
    currentRole = "teacher";

    // Bersihkan listener lama jika ada
    cleanupTeacherListeners();

    classPin = generatePin();
    console.log("[Firebase Guru] Membuka sesi kelas dengan PIN:", classPin);

    // Ambil bank soal terkini
    let questions = [];
    if (Array.isArray(customQuestions) && customQuestions.length > 0) {
      questions = customQuestions;
    } else if (window.QuestionsModule && typeof window.QuestionsModule.getQuestions === "function") {
      questions = window.QuestionsModule.getQuestions();
    }
    if ((!questions || questions.length === 0)) {
      try {
        questions = JSON.parse(localStorage.getItem("GAME_QUIZ_DATA") || "[]");
      } catch (e) {
        questions = [];
      }
    }

    // Simpan ke storage lokal
    const classroomData = readClassroomData();
    classroomData.pin = classPin;
    classroomData.students = {};
    writeClassroomData(classroomData);
    clearLiveMonitor();

    // Simpan ke Firebase Realtime Database
    const db = getDb();
    if (db) {
      teacherRoomRef = db.ref("rooms/" + classPin);
      
      const roomPayload = {
        pin: classPin,
        active: true,
        createdAt: Date.now(),
        questionCount: questions.length,
        questions: questions
      };

      teacherRoomRef.set(roomPayload)
        .then(() => {
          console.log("[Firebase Guru] ✅ Berhasil mengunggah", questions.length, "soal ke Firebase Room:", classPin);
        })
        .catch((err) => {
          console.error("[Firebase Guru] ❌ Gagal mengunggah soal ke Firebase:", err);
          if (err.code === "PERMISSION_DENIED" || (err.message && err.message.toLowerCase().includes("permission_denied"))) {
            console.warn("[Firebase Guru] ⚠️ PERMISSION DENIED: Pastikan Rules di Firebase Console sudah diatur ke { \".read\": true, \".write\": true }");
          }
        });

      // Pasang listener realtime untuk daftar & progres murid
      studentsListenerRef = db.ref("rooms/" + classPin + "/students");
      studentsListenerRef.on("value", (snapshot) => {
        const val = snapshot.val() || {};
        const studentList = Object.values(val).sort((a, b) => (b.score || 0) - (a.score || 0));
        console.log("[Firebase Guru] 📡 Update progres murid diterima:", studentList.length, "murid");
        writeLiveMonitorData(val);
        notifyLeaderboardUpdate(studentList);
      }, (err) => {
        console.warn("[Firebase Guru] Listener murid error:", err);
      });
    } else {
      console.warn("[Firebase Guru] Firebase DB tidak tersedia, fallback ke mode lokal.");
    }

    return classPin;
  }

  function regeneratePin(customQuestions) {
    cleanupTeacherListeners();
    return startTeacherSession(customQuestions);
  }

  function resumeTeacherSession() {
    if (!classPin) {
      const saved = readClassroomData();
      classPin = saved ? saved.pin : null;
    }
    if (!classPin) return null;

    initChannel();
    currentRole = "teacher";

    const db = getDb();
    if (db && !studentsListenerRef) {
      teacherRoomRef = db.ref("rooms/" + classPin);
      studentsListenerRef = db.ref("rooms/" + classPin + "/students");
      studentsListenerRef.on("value", (snapshot) => {
        const val = snapshot.val() || {};
        const studentList = Object.values(val).sort((a, b) => (b.score || 0) - (a.score || 0));
        console.log("[Firebase Guru] 📡 Resume progres murid:", studentList.length, "murid");
        writeLiveMonitorData(val);
        notifyLeaderboardUpdate(studentList);
      }, (err) => {
        console.warn("[Firebase Guru] Listener murid error:", err);
      });
    }

    notifyLeaderboardUpdate();
    return classPin;
  }

  function cleanupTeacherListeners() {
    if (studentsListenerRef) {
      try {
        studentsListenerRef.off();
      } catch (e) {}
      studentsListenerRef = null;
    }
    if (teacherRoomRef) {
      try {
        teacherRoomRef.child("active").set(false);
      } catch (e) {}
      teacherRoomRef = null;
    }
  }

  function resetLeaderboard() {
    clearLiveMonitor();
    const data = readClassroomData();
    data.students = {};
    writeClassroomData(data);

    const db = getDb();
    if (db && classPin) {
      db.ref("rooms/" + classPin + "/students").remove()
        .then(() => console.log("[Firebase] ✅ Riwayat murid di PIN", classPin, "berhasil dihapus."))
        .catch(err => console.warn("[Firebase] Gagal menghapus node murid:", err));
    }

    notifyLeaderboardUpdate([]);
    return true;
  }

  // -------------------- Murid (Student) Session --------------------
  function joinAsStudent(name, pin) {
    initChannel();
    currentRole = "student";
    studentName = (name || "Murid").trim().slice(0, 16) || "Murid";
    studentId = "s_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    studentKey = sanitizeKey(studentName) + "_" + studentId.slice(-4);
    classPin = (pin || "").trim();

    const data = readClassroomData();
    if (!data.students) data.students = {};
    data.students[studentId] = {
      id: studentId,
      name: studentName,
      score: 0,
      coins: 0,
      joinedAt: Date.now()
    };
    writeClassroomData(data);
    return studentId;
  }

  /**
   * Menghubungkan Murid ke Ruang Kelas via Firebase Realtime Database
   * Mengunduh bank soal secara instan dari Firebase /rooms/{PIN}/questions.
   */
  function connectAndJoin(name, pin, callback) {
    initChannel();
    currentRole = "student";
    studentName = (name || "Murid").trim().slice(0, 16) || "Murid";
    studentId = "s_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    studentKey = sanitizeKey(studentName) + "_" + studentId.slice(-4);
    classPin = (pin || "").trim();

    // 1. Jika TIDAK ada PIN diisi -> Fallback ke mode lokal/offline
    if (!classPin) {
      console.log("[Multiplayer Murid] Bergabung tanpa PIN (Mode Offline/Lokal).");
      let localQuiz = [];
      try {
        localQuiz = JSON.parse(localStorage.getItem("GAME_QUIZ_DATA") || "[]");
      } catch (e) {
        localQuiz = [];
      }

      if (localQuiz.length > 0) {
        if (window.QuestionsModule && typeof window.QuestionsModule.setQuestionsFromPDF === "function") {
          window.QuestionsModule.setQuestionsFromPDF(localQuiz);
        }
        if (typeof callback === "function") {
          callback({ success: true, count: localQuiz.length, questions: localQuiz });
        }
      } else {
        if (typeof callback === "function") {
          callback({ success: false, message: "Silakan masukkan PIN Kelas dari Guru untuk mengunduh soal." });
        }
      }
      return;
    }

    // 2. Jika ada PIN diisi -> Ambil dari Firebase Realtime Database
    const db = getDb();
    if (!db) {
      console.warn("[Firebase Murid] Firebase DB tidak terdeteksi. Mencoba fallback ke cache lokal.");
      let localQuiz = [];
      try {
        localQuiz = JSON.parse(localStorage.getItem("GAME_QUIZ_DATA") || "[]");
      } catch (e) {}

      if (localQuiz.length > 0) {
        if (window.QuestionsModule) window.QuestionsModule.setQuestionsFromPDF(localQuiz);
        if (typeof callback === "function") {
          callback({ success: true, count: localQuiz.length, questions: localQuiz, warning: "Firebase offline. Menggunakan soal lokal." });
        }
      } else {
        if (typeof callback === "function") {
          callback({ success: false, message: "Pustaka Firebase belum siap dan tidak ada soal di cache lokal." });
        }
      }
      return;
    }

    console.log("[Firebase Murid] Menghubungkan ke PIN Kelas:", classPin);

    // Timeout proteksi 10 detik jika jaringan sangat lambat
    let isHandled = false;
    const timeoutTimer = setTimeout(() => {
      if (!isHandled) {
        isHandled = true;
        console.warn("[Firebase Murid] Batas waktu permintaan soal habis (10s).");
        if (typeof callback === "function") {
          callback({
            success: false,
            message: "Koneksi ke Firebase batas waktu (10 detik). Periksa koneksi internet atau pastikan Rules Firebase sudah diizinkan (read/write: true)."
          });
        }
      }
    }, 10000);

    const roomRef = db.ref("rooms/" + classPin);

    roomRef.once("value")
      .then((snapshot) => {
        if (isHandled) return;
        isHandled = true;
        clearTimeout(timeoutTimer);

        if (!snapshot.exists()) {
          console.warn("[Firebase Murid] PIN tidak ditemukan di Firebase:", classPin);
          if (typeof callback === "function") {
            callback({
              success: false,
              message: "PIN Kelas (" + classPin + ") tidak ditemukan! Pastikan Guru sudah menekan 'Mulai Game / Buat Kode'."
            });
          }
          return;
        }

        const roomData = snapshot.val() || {};
        const questions = roomData.questions;

        if (!Array.isArray(questions) || questions.length === 0) {
          console.warn("[Firebase Murid] Room ada tetapi questions kosong:", classPin);
          if (typeof callback === "function") {
            callback({
              success: false,
              message: "Guru di PIN " + classPin + " belum selesai mengunggah soal kuis. Silakan coba sesaat lagi."
            });
          }
          return;
        }

        console.log("[Firebase Murid] ✅ Berhasil mengunduh", questions.length, "soal dari Guru di PIN:", classPin);

        // Simpan soal ke localStorage & modul pertanyaan
        try {
          localStorage.setItem("GAME_QUIZ_DATA", JSON.stringify(questions));
        } catch (e) {}

        if (window.QuestionsModule && typeof window.QuestionsModule.setQuestionsFromPDF === "function") {
          window.QuestionsModule.setQuestionsFromPDF(questions);
        }

        // Daftarkan murid ke Firebase /rooms/{PIN}/students/{studentKey}
        studentProgressRef = db.ref("rooms/" + classPin + "/students/" + studentKey);
        studentProgressRef.set({
          name: studentName,
          currentQuestion: 0,
          totalQuestions: questions.length,
          correct: 0,
          wrong: 0,
          status: "Mulai Bergabung",
          score: 0,
          lastUpdated: Date.now()
        }).catch((err) => {
          console.warn("[Firebase Murid] Gagal mendaftarkan murid ke Firebase:", err);
        });

        // Set onDisconnect untuk menandai status jika murid menutup tab
        try {
          studentProgressRef.onDisconnect().update({
            status: "Terputus",
            lastUpdated: Date.now()
          });
        } catch (e) {}

        if (typeof callback === "function") {
          callback({ success: true, count: questions.length, questions: questions });
        }
      })
      .catch((err) => {
        if (isHandled) return;
        isHandled = true;
        clearTimeout(timeoutTimer);

        console.error("[Firebase Murid] ❌ Error saat mengambil data PIN:", err);
        let errorMsg = "Gagal terhubung ke ruang kelas: " + (err.message || "Unknown error");
        if (err.code === "PERMISSION_DENIED" || (err.message && err.message.toLowerCase().includes("permission_denied"))) {
          errorMsg = "Akses Firebase Ditolak (Permission Denied). Pastikan Guru sudah mengatur Rules Realtime Database menjadi { \".read\": true, \".write\": true }.";
        }

        if (typeof callback === "function") {
          callback({ success: false, message: errorMsg });
        }
      });
  }

  // -------------------- Live Progress Update --------------------
  function updateLiveProgress(correctCount, wrongCount, currentQ, totalQ, isFinished, score) {
    if (currentRole !== "student" || !studentName) return;

    const progressObj = {
      name: studentName,
      currentQuestion: currentQ,
      totalQuestions: totalQ,
      correct: correctCount,
      wrong: wrongCount,
      status: isFinished ? "Selesai" : "Sedang Mengerjakan",
      score: score || 0,
      lastUpdated: Date.now()
    };

    // Update cache lokal
    const localData = readLiveMonitorData();
    localData[studentName] = progressObj;
    writeLiveMonitorData(localData);

    // Kirim real-time ke Firebase jika terhubung dengan PIN
    const db = getDb();
    if (db && classPin && studentKey) {
      const ref = studentProgressRef || db.ref("rooms/" + classPin + "/students/" + studentKey);
      ref.update(progressObj).catch((err) => {
        console.warn("[Firebase Murid] Gagal mengirim progress realtime:", err);
      });
    }
  }

  function updateStudentScore(score, coins) {
    if (currentRole !== "student" || !studentId) return;
    const data = readClassroomData();
    if (!data.students) data.students = {};
    if (!data.students[studentId]) {
      data.students[studentId] = { id: studentId, name: studentName, score: 0, coins: 0, joinedAt: Date.now() };
    }
    data.students[studentId].score = score;
    data.students[studentId].coins = coins;
    writeClassroomData(data);
  }

  function getLeaderboard() {
    const data = readClassroomData();
    const students = data.students || {};
    return Object.values(students)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
  }

  function getLiveMonitorList() {
    const data = readLiveMonitorData();
    return Object.values(data).sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  function clearLiveMonitor() {
    try {
      localStorage.removeItem(LIVE_MONITOR_KEY);
    } catch (e) {}
  }

  function subscribeLeaderboard(callback) {
    onLeaderboardUpdate = callback;
    initChannel();
    if (typeof callback === "function") {
      callback(getLiveMonitorList());
    }
  }

  function setRole(role) {
    if (["teacher", "admin", "student"].includes(role)) {
      currentRole = role;
    }
  }

  function getRole() {
    return currentRole || "student";
  }

  function getStudentName() {
    return studentName;
  }

  function getClassPin() {
    return classPin;
  }

  // Ekspor API Modul
  window.MultiplayerModule = {
    startTeacherSession,
    regeneratePin,
    resumeTeacherSession,
    getLeaderboard,
    subscribeLeaderboard,
    joinAsStudent,
    connectAndJoin,
    updateStudentScore,
    resetLeaderboard,
    getRole,
    setRole,
    getStudentName,
    getClassPin,
    updateLiveProgress,
    getLiveMonitorList,
    clearLiveMonitor
  };

  console.log("[Multiplayer] multiplayer.js (Firebase Realtime Database) dimuat OK.");
})();
