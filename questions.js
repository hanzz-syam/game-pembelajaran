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
    // Hapus imbuhan prefix opsi seperti 'A. ', 'B. ', '1. ', 'A) ', 'a) ', '1) '
    str = str.replace(/^(?:[A-Da-d0-9][.\)]\s*)+/g, "").trim();
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

  /* ── Logika Pencocokan Serbaguna (3 cara sekaligus) ── */
  function checkAnswer(question, chosenIdx, chosenRawText) {
    const userClean = cleanOptionText(chosenRawText);
    const userCleanLower = userClean.toLowerCase();

    const letters = ["A", "B", "C", "D", "E", "F"];
    const userLetter = letters[chosenIdx] || "";

    // Ambil kunci jawaban dari berbagai kemungkinan properti
    const systemKey = question.correctIndex !== undefined ? question.correctIndex
                    : (question.correctAnswer !== undefined ? question.correctAnswer
                    : (question.jawaban !== undefined ? question.jawaban
                    : (question.kunci !== undefined ? question.kunci : 0)));

    let isCorrect = false;

    // 1. Cocokkan jika kunci berupa Indeks / Angka (0/1/2/3 atau 1/2/3/4)
    if (typeof systemKey === "number" || (!isNaN(parseInt(systemKey, 10)) && String(systemKey).trim().length <= 2)) {
      const numKey = parseInt(systemKey, 10);
      // Cek index 0-based
      if (chosenIdx === numKey) {
        isCorrect = true;
      }
      // Cek index 1-based (1, 2, 3, 4)
      else if (chosenIdx + 1 === numKey) {
        isCorrect = true;
      }
    }

    // 2. Cocokkan jika kunci berupa Huruf ('A'/'B'/'C'/'D')
    if (!isCorrect && typeof systemKey === "string") {
      const keyUpper = systemKey.trim().toUpperCase();
      if (keyUpper.length === 1 && keyUpper >= "A" && keyUpper <= "Z") {
        if (userLetter === keyUpper) {
          isCorrect = true;
        }
        const letterIdx = keyUpper.charCodeAt(0) - 65;
        if (chosenIdx === letterIdx) {
          isCorrect = true;
        }
      }
    }

    // 3. Cocokkan jika kunci berupa Teks Jawaban
    if (!isCorrect) {
      const keyClean = cleanOptionText(systemKey);
      const keyCleanLower = keyClean.toLowerCase();

      if (userCleanLower.length > 0 && keyCleanLower.length > 0 && userCleanLower === keyCleanLower) {
        isCorrect = true;
      }

      // Cocokkan teks pilihan user dengan teks pada array question.options[systemKey] jika systemKey angka
      if (Array.isArray(question.options) && typeof systemKey === "number" && question.options[systemKey]) {
        const targetOptClean = cleanOptionText(question.options[systemKey]).toLowerCase();
        if (userCleanLower === targetOptClean) {
          isCorrect = true;
        }
      }
    }

    return {
      isCorrect: isCorrect,
      systemKey: systemKey,
      userClean: userClean
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
