/* =========================================================
   multiplayer.js
   Sistem "multiplayer kelas" berbasis Client & PeerJS (WebRTC P2P):
   - Guru membuat Lobby dengan PIN & memantau papan peringkat.
   - P2P PeerJS otomatis mengirimkan bank soal (GAME_QUIZ_DATA)
     dari Device 1 (Guru) ke Device 2 (Murid) saat Murid memasukkan PIN.
   - Sinkronisasi nilai & progress murid ter-update secara real-time
     ke HP/Laptop Guru via PeerJS DataConnection + BroadcastChannel.
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "psk_islam_classroom_v1";
  const CHANNEL_NAME = "psk_islam_classroom_channel";

  let channel = null;
  let currentRole = null; // 'teacher' | 'student'
  let studentId = null;
  let studentName = null;
  let classPin = null;
  let onLeaderboardUpdate = null;

  // State PeerJS (WebRTC P2P)
  let teacherPeer = null;
  let studentPeer = null;
  let activeConnections = [];
  let studentConn = null;

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
      if (e.key === STORAGE_KEY || e.key === "GAME_LIVE_MONITOR") notifyLeaderboardUpdate();
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (channel) {
      channel.postMessage({ type: "leaderboard-update" });
    }
  }

  function notifyLeaderboardUpdate() {
    if (typeof onLeaderboardUpdate === "function") {
      onLeaderboardUpdate(getLeaderboard());
    }
  }

  function generatePin() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // -------------------- PeerJS Teacher Host --------------------
  function initTeacherPeerHost(pin) {
    if (typeof window.Peer === "undefined") {
      console.warn("[PeerJS Guru] Library PeerJS tidak ditemukan.");
      return;
    }

    try {
      if (teacherPeer) {
        teacherPeer.destroy();
      }

      const peerId = "psk_room_" + pin;
      console.log("[PeerJS Guru] Menginisialisasi Host Peer dengan ID:", peerId);
      teacherPeer = new window.Peer(peerId);

      teacherPeer.on("open", (id) => {
        console.log("[PeerJS Guru] Host Room Peer aktif dengan ID:", id);
      });

      teacherPeer.on("connection", (conn) => {
        console.log("[PeerJS Guru] Murid terhubung dari peranti lain:", conn.peer);
        activeConnections.push(conn);

        conn.on("data", (data) => {
          if (data && data.type === "REQUEST_QUIZ") {
            console.log("[PeerJS Guru] Menerima permintaan soal dari murid:", data.name);
            const quizData = JSON.parse(localStorage.getItem("GAME_QUIZ_DATA") || "[]");
            conn.send({
              type: "QUIZ_DATA",
              questions: quizData,
              pin: classPin
            });
          } else if (data && data.type === "LIVE_PROGRESS") {
            console.log("[PeerJS Guru] Menerima progress nilai murid:", data.name, data.score);
            const liveData = readLiveMonitorData();
            liveData[data.name] = {
              name: data.name,
              currentQuestion: data.currentQuestion,
              totalQuestions: data.totalQuestions,
              correct: data.correct,
              wrong: data.wrong,
              status: data.status,
              score: data.score,
              lastUpdated: Date.now()
            };
            writeLiveMonitorData(liveData);
            notifyLeaderboardUpdate();
          }
        });

        conn.on("close", () => {
          activeConnections = activeConnections.filter(c => c !== conn);
        });

        conn.on("error", (err) => {
          console.warn("[PeerJS Guru] Error koneksi client:", err);
        });
      });

      teacherPeer.on("error", (err) => {
        console.warn("[PeerJS Guru] Peer Server Error:", err);
        if (err.type === "unavailable-id") {
          console.log("[PeerJS Guru] PIN digunakan, membuat PIN baru...");
          regeneratePin();
        }
      });
    } catch (e) {
      console.warn("[PeerJS Guru] Gagal membuat Peer host:", e);
    }
  }

  // -------------------- Teacher --------------------
  function startTeacherSession() {
    initChannel();
    currentRole = "teacher";
    const data = readClassroomData();
    classPin = generatePin();
    data.pin = classPin;
    writeClassroomData(data);
    initTeacherPeerHost(classPin);
    return classPin;
  }

  function regeneratePin() {
    const data = readClassroomData();
    classPin = generatePin();
    data.pin = classPin;
    writeClassroomData(data);
    initTeacherPeerHost(classPin);
    return classPin;
  }

  function getLeaderboard() {
    const data = readClassroomData();
    const students = data.students || {};
    return Object.values(students)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
  }

  function subscribeLeaderboard(callback) {
    onLeaderboardUpdate = callback;
    initChannel();
  }

  // -------------------- Student --------------------
  function joinAsStudent(name, pin) {
    initChannel();
    currentRole = "student";
    studentName = (name || "Murid").trim().slice(0, 16) || "Murid";
    studentId = "s_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
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
   * Menghubungkan Murid ke Guru via PeerJS (WebRTC P2P) dan mengambil soal jika PIN diisi.
   */
  function connectAndJoin(name, pin, callback) {
    initChannel();
    currentRole = "student";
    studentName = (name || "Murid").trim().slice(0, 16) || "Murid";
    studentId = "s_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
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

    // 1. Jika tidak ada PIN yang dimasukkan -> Coba baca dari memori lokal (offline / same-device mode)
    if (!classPin) {
      const localQuiz = JSON.parse(localStorage.getItem("GAME_QUIZ_DATA") || "[]");
      if (localQuiz.length > 0) {
        if (window.QuestionsModule) {
          window.QuestionsModule.setQuestionsFromPDF(localQuiz);
        }
        if (typeof callback === "function") callback({ success: true, count: localQuiz.length, questions: localQuiz });
      } else {
        if (typeof callback === "function") callback({ success: false, message: "Silakan masukkan PIN Kelas dari Guru untuk mengunduh soal." });
      }
      return;
    }

    // 2. Jika ada PIN dimasukkan dan PeerJS tersedia -> Ambil soal dari Guru via P2P
    if (typeof window.Peer === "undefined") {
      // Fallback tanpa library PeerJS
      const localQuiz = JSON.parse(localStorage.getItem("GAME_QUIZ_DATA") || "[]");
      if (localQuiz.length > 0) {
        if (window.QuestionsModule) window.QuestionsModule.setQuestionsFromPDF(localQuiz);
        if (typeof callback === "function") callback({ success: true, count: localQuiz.length, questions: localQuiz });
      } else {
        if (typeof callback === "function") callback({ success: false, message: "Pustaka PeerJS tidak tersedia & soal lokal kosong." });
      }
      return;
    }

    let isHandled = false;
    const targetPeerId = "psk_room_" + classPin;
    console.log("[PeerJS Murid] Menghubungkan ke PIN Kelas Guru:", targetPeerId);

    if (studentPeer) {
      try { studentPeer.destroy(); } catch (e) {}
    }
    studentPeer = new window.Peer();

    const timeoutTimer = setTimeout(() => {
      if (!isHandled) {
        isHandled = true;
        // Fallback: Coba lihat jika soal sudah ada di localStorage lokal
        const localQuiz = JSON.parse(localStorage.getItem("GAME_QUIZ_DATA") || "[]");
        if (localQuiz.length > 0) {
          if (window.QuestionsModule) window.QuestionsModule.setQuestionsFromPDF(localQuiz);
          if (typeof callback === "function") callback({ success: true, count: localQuiz.length, questions: localQuiz, warning: "Koneksi P2P batas waktu. Menggunakan cache lokal." });
        } else {
          if (typeof callback === "function") callback({ success: false, message: "Gagal terhubung ke PIN Guru (" + classPin + "). Pastikan PIN benar dan Guru sedang online!" });
        }
      }
    }, 7000);

    studentPeer.on("open", (id) => {
      console.log("[PeerJS Murid] Client Peer aktif:", id);
      try {
        studentConn = studentPeer.connect(targetPeerId, { reliable: true });

        studentConn.on("open", () => {
          console.log("[PeerJS Murid] ✅ Terhubung ke Guru! Meminta bank soal...");
          studentConn.send({ type: "REQUEST_QUIZ", name: studentName });
        });

        studentConn.on("data", (data) => {
          if (data && data.type === "QUIZ_DATA") {
            console.log("[PeerJS Murid] 📦 Berhasil menerima data soal dari Guru! Jumlah:", data.questions ? data.questions.length : 0);
            if (!isHandled) {
              isHandled = true;
              clearTimeout(timeoutTimer);

              if (Array.isArray(data.questions) && data.questions.length > 0) {
                localStorage.setItem("GAME_QUIZ_DATA", JSON.stringify(data.questions));
                if (window.QuestionsModule) {
                  window.QuestionsModule.setQuestionsFromPDF(data.questions);
                }
                if (typeof callback === "function") callback({ success: true, count: data.questions.length, questions: data.questions });
              } else {
                if (typeof callback === "function") callback({ success: false, message: "Guru di PIN " + classPin + " belum selesai mengunggah soal kuis." });
              }
            }
          }
        });

        studentConn.on("error", (err) => {
          console.warn("[PeerJS Murid] Error koneksi channel:", err);
        });
      } catch (err) {
        console.warn("[PeerJS Murid] Gagal menginisialisasi koneksi:", err);
      }
    });

    studentPeer.on("error", (err) => {
      console.warn("[PeerJS Murid] Error Peer client:", err);
      if (!isHandled) {
        isHandled = true;
        clearTimeout(timeoutTimer);
        if (typeof callback === "function") callback({ success: false, message: "PIN Kelas (" + classPin + ") tidak ditemukan atau Guru belum mengaktifkan ruang kelas." });
      }
    });
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

  function resetLeaderboard() {
    const data = readClassroomData();
    data.students = {};
    writeClassroomData(data);
    notifyLeaderboardUpdate();
    return true;
  }

  function setRole(role) {
    if (["teacher", "admin", "student"].includes(role)) {
      currentRole = role;
    }
  }

  // -------------------- Live Monitor --------------------
  const LIVE_MONITOR_KEY = "GAME_LIVE_MONITOR";

  function readLiveMonitorData() {
    try {
      const raw = localStorage.getItem(LIVE_MONITOR_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(e) {
      return {};
    }
  }

  function writeLiveMonitorData(data) {
    localStorage.setItem(LIVE_MONITOR_KEY, JSON.stringify(data));
    if (channel) {
      channel.postMessage({ type: "leaderboard-update" });
    }
  }

  function updateLiveProgress(correctCount, wrongCount, currentQ, totalQ, isFinished, score) {
    if (currentRole !== "student" || !studentName) return;
    const data = readLiveMonitorData();
    data[studentName] = {
      name: studentName,
      currentQuestion: currentQ,
      totalQuestions: totalQ,
      correct: correctCount,
      wrong: wrongCount,
      status: isFinished ? "Selesai" : "Sedang Mengerjakan",
      score: score,
      lastUpdated: Date.now()
    };
    writeLiveMonitorData(data);

    // Sinkronkan balik ke Device Guru via PeerJS P2P connection jika ada
    if (studentConn && studentConn.open) {
      try {
        studentConn.send({
          type: "LIVE_PROGRESS",
          name: studentName,
          currentQuestion: currentQ,
          totalQuestions: totalQ,
          correct: correctCount,
          wrong: wrongCount,
          status: isFinished ? "Selesai" : "Sedang Mengerjakan",
          score: score
        });
      } catch (e) {
        console.warn("[PeerJS Murid] Gagal mengirim progress P2P:", e);
      }
    }
  }

  function getLiveMonitorList() {
    const data = readLiveMonitorData();
    return Object.values(data).sort((a, b) => b.score - a.score);
  }
  
  function clearLiveMonitor() {
    localStorage.removeItem(LIVE_MONITOR_KEY);
  }

  function getRole() {
    return currentRole || "student";
  }

  function getStudentName() {
    return studentName;
  }

  window.MultiplayerModule = {
    startTeacherSession,
    regeneratePin,
    getLeaderboard,
    subscribeLeaderboard,
    joinAsStudent,
    connectAndJoin,
    updateStudentScore,
    resetLeaderboard,
    getRole,
    setRole,
    getStudentName,
    updateLiveProgress,
    getLiveMonitorList,
    clearLiveMonitor
  };
})();

