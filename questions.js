/* =========================================================
   questions.js
   Mengelola bank soal game dengan logika pencocokan fleksibel:
   - Reset Cache Upload: Saat unggah file baru, hapus 'quiz_data'
     di localStorage agar game 100% memakai soal terbaru.
   - Normalisasi Teks: Hapus prefix opsi ('A. ', 'B. ', '1. '),
     trim spasi, dan abaikan huruf besar/kecil.
   - Logika Pencocokan Serbaguna: Mendukung teks, indeks/angka,
     dan huruf ('A'/'B'/'C'/'D') secara bersamaan.
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY_PRIMARY = "quiz_data";
  const OLD_STORAGE_KEYS = ["islamgame_questions_v1", "dreamtown_questions"];

  /* ------------------------------------------------------------------
     Soal Fallback Bawaan (hanya jika localStorage kosong & tidak ada upload)
  ------------------------------------------------------------------ */
  const FALLBACK_QUESTIONS = [
    {
      question: "Siapakah nabi terakhir umat Islam?",
      options: ["Nabi Isa AS", "Nabi Musa AS", "Nabi Muhammad SAW", "Nabi Ibrahim AS"],
      correctIndex: 2
    },
    {
      question: "Berapa jumlah rukun Islam?",
      options: ["3", "4", "5", "6"],
      correctIndex: 2
    },
    {
      question: "Kitab suci umat Islam adalah...",
      options: ["Injil", "Taurat", "Zabur", "Al-Qur'an"],
      correctIndex: 3
    },
    {
      question: "Shalat fardhu dalam sehari semalam berjumlah...",
      options: ["3 waktu", "4 waktu", "5 waktu", "6 waktu"],
      correctIndex: 2
    },
    {
      question: "Bulan ke-9 dalam kalender Hijriyah adalah bulan...",
      options: ["Syawal", "Ramadan", "Dzulhijjah", "Muharram"],
      correctIndex: 1
    }
  ];

  /* ── Normalisasi Teks: Hapus prefix A. B. 1. dll, trim spasi ── */
  function cleanOptionText(text) {
    if (text === null || text === undefined) return "";
    let str = String(text).trim();
    // Hapus imbuhan prefix opsi seperti 'A. ', 'B. ', '1. ', 'A) ', 'a) ', '1) ', 'Kunci:', 'Jawaban:'
    str = str.replace(/^(?:Kunci(?:\s*Jawaban)?|Jawaban|Ans(?:wer)?|Key)\s*[:=.]?\s*/i, "");
    str = str.replace(/^(?:[A-Da-d0-9][.\)]\s*)+/g, "").trim();
    // Hapus sisa karakter pemisah seperti titik atau titik dua di awal/akhir
    str = str.replace(/^[.:=\s]+|[.:=\s]+$/g, "").trim();
    return str;
  }

  /* ── Shuffle Array ── */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ── Reset Cache Upload ── */
  function clearAllQuizCache() {
    try {
      localStorage.removeItem(STORAGE_KEY_PRIMARY);
      OLD_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      console.log("[Questions] 🗑️ Data kuis lama di localStorage ('quiz_data') berhasil dihapus.");
    } catch (e) {
      console.warn("[Questions] Gagal menghapus cache localStorage:", e);
    }
  }

  /* ── Baca Soal dari localStorage ── */
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PRIMARY) || localStorage.getItem("islamgame_questions_v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log("[Questions] Soal dimuat dari localStorage:", parsed.length, "soal.");
        return parsed;
      }
    } catch (e) {
      console.warn("[Questions] Gagal membaca localStorage:", e);
    }
    return null;
  }

  /* ── Simpan Soal ke localStorage (Timpa Penuh) ── */
  function saveToStorage(questions) {
    clearAllQuizCache(); // Hapus cache lama terlebih dahulu sesuai instruksi
    try {
      localStorage.setItem(STORAGE_KEY_PRIMARY, JSON.stringify(questions));
      console.log("[Questions] ✅ " + questions.length + " soal baru berhasil disimpan ke localStorage ('quiz_data').");
    } catch (e) {
      console.warn("[Questions] Gagal menyimpan soal ke localStorage:", e);
    }
  }

  /* ── Logika Pencocokan Serbaguna & Normalisasi Jawaban (Diagnostik Alert) ── */
  function checkAnswer(question, chosenIdx, chosenRawText) {
    // Clean user choice text (.trim() dan hapus prefix opsi)
    const userChoiceClean = cleanOptionText(chosenRawText);
    const userChoiceLower = userChoiceClean.toLowerCase();

    // Tentukan kunci sistem dalam bentuk indeks & teks target pilihan yang benar
    let targetIndex = 0;
    if (question.correctIndex !== undefined) {
      targetIndex = question.correctIndex;
    } else {
      const rawKey = question.correctAnswer || question.jawaban || question.kunci;
      if (typeof rawKey === "number") {
        targetIndex = rawKey;
      } else if (typeof rawKey === "string") {
        const keyClean = cleanOptionText(rawKey).toUpperCase();
        if (keyClean.length === 1 && keyClean >= "A" && keyClean <= "D") {
          targetIndex = keyClean.charCodeAt(0) - 65;
        } else if (Array.isArray(question.options)) {
          const found = question.options.findIndex(opt => cleanOptionText(opt).toLowerCase() === keyClean.toLowerCase());
          if (found !== -1) targetIndex = found;
        }
      }
    }

    // Ambil opsi target berdasarkan targetIndex
    const rawTargetOpt = (Array.isArray(question.options) && question.options[targetIndex]) ? question.options[targetIndex] : "";
    const targetKeyClean = cleanOptionText(rawTargetOpt);
    const targetKeyLower = targetKeyClean.toLowerCase();

    // Pencocokan: periksa indeks langsung ATAU perbandingan teks ter-normalisasi (lowercase + trim)
    let isCorrect = (chosenIdx === targetIndex);

    if (!isCorrect && userChoiceLower.length > 0 && targetKeyLower.length > 0) {
      if (userChoiceLower === targetKeyLower) {
        isCorrect = true;
      }
    }

    // ── Pop-Up Alert Diagnostik di Layar ──
    const alertMessage = 
      "🔍 DIAGNOSTIK KUIS 🔍\n" +
      "-----------------------------------\n" +
      "User memilih: " + userChoiceClean + "\n" +
      "Kunci Sistem: " + targetKeyClean + "\n" +
      "Hasil Cocok?: " + (isCorrect ? "✅ BENAR" : "❌ SALAH");

    alert(alertMessage);

    return {
      isCorrect: isCorrect,
      userChoiceClean: userChoiceClean,
      targetKeyClean: targetKeyClean,
      targetIndex: targetIndex
    };
  }

  /* ── State Aktif ── */
  const fromStorage = loadFromStorage();
  let activeQuestions = fromStorage
    ? shuffle(fromStorage)
    : shuffle(FALLBACK_QUESTIONS.slice());

  let usingCustomFile = fromStorage !== null;

  /* ── API Publik ── */
  function setQuestionsFromPDF(parsedQuestions) {
    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      return false;
    }
    // Hapus data kuis lama di localStorage dan simpan yang baru
    saveToStorage(parsedQuestions);
    activeQuestions = shuffle(parsedQuestions.slice());
    usingCustomFile = true;
    console.log("[Questions] 🚀 Bank soal aktif diperbarui dari file baru:", parsedQuestions.length, "soal.");
    return true;
  }

  function resetToFallback() {
    clearAllQuizCache();
    usingCustomFile = false;
    activeQuestions = shuffle(FALLBACK_QUESTIONS.slice());
    console.log("[Questions] Reset ke soal fallback.");
  }

  function getQuestions()     { return activeQuestions; }
  function isUsingCustomPDF() { return usingCustomFile; }
  function getQuestionCount() { return activeQuestions.length; }

  window.QuestionsModule = {
    getQuestions: getQuestions,
    setQuestionsFromPDF: setQuestionsFromPDF,
    resetToFallback: resetToFallback,
    isUsingCustomPDF: isUsingCustomPDF,
    getQuestionCount: getQuestionCount,
    cleanOptionText: cleanOptionText,
    checkAnswer: checkAnswer,
    clearAllQuizCache: clearAllQuizCache,
    FALLBACK_QUESTIONS: FALLBACK_QUESTIONS
  };

  console.log("[Questions] questions.js dimuat OK. Soal aktif:", activeQuestions.length,
    usingCustomFile ? "(dari localStorage quiz_data)" : "(fallback bawaan)");
})();
