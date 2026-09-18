/* =========================================================
   multiplayer.js
   Sistem "multiplayer kelas" ringan berbasis client:
   - Guru membuat Lobby dengan PIN & memantau papan peringkat.
   - Murid bergabung dengan nama (+ PIN opsional) dan skornya
     otomatis tersinkron ke semua tab/perangkat pada browser
     yang sama melalui BroadcastChannel + localStorage
     (fallback storage event) — tanpa perlu server backend.
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

  // -------------------- Teacher --------------------
  function startTeacherSession() {
    initChannel();
    currentRole = "teacher";
    const data = readClassroomData();
    classPin = generatePin();
    data.pin = classPin;
    writeClassroomData(data);
    return classPin;
  }

  function regeneratePin() {
    const data = readClassroomData();
    classPin = generatePin();
    data.pin = classPin;
    writeClassroomData(data);
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
