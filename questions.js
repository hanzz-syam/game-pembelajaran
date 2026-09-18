/* =========================================================
   questions.js
   Mengelola bank soal game dengan sistem Indeks Kunci Jawaban (kunciIndex 0..3):
   - Kunci Storage Seragam: 'GAME_QUIZ_DATA' di semua file.
   - Validasi Berbasis Urutan Tombol: (indexTombolDiklik === soal.kunciIndex).
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY_PRIMARY = "GAME_QUIZ_DATA";
  const OLD_STORAGE_KEYS = ["quiz_data", "islamgame_questions_v1", "dreamtown_questions"];

  /* ------------------------------------------------------------------
     Soal Fallback Bawaan (Dikosongkan sesuai instruksi: Tanpa Soal Bawaan)
  ------------------------------------------------------------------ */
  const FALLBACK_QUESTIONS = [];

  /* ── Normalisasi Teks Tombol Opsi: Hapus prefix A. B. 1. dll, trim spasi ── */
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

  /* ── Pembersihan Cache ── */
  function clearAllQuizCache() {
    try {
      // Hapus kunci lama (quiz_data dll) tapi TIDAK menghapus GAME_QUIZ_DATA
      OLD_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem(STORAGE_KEY_PRIMARY);
      console.log("[Questions] 🗑️ Cache kuis dihapus (GAME_QUIZ_DATA + kunci lama).");
    } catch (e) {
      console.warn("[Questions] Gagal menghapus cache localStorage:", e);
    }
  }

  /* ── TIDAK auto-clear saat dimuat — data Guru harus tetap tersimpan ── */

  /* ── Baca Soal dari localStorage ── */
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PRIMARY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Standardisasi setiap item agar memiliki kunciIndex (0..3)
        const normalized = parsed.map(item => {
          let kIdx = 0;
          if (item.kunciIndex !== undefined) {
            kIdx = Number(item.kunciIndex);
          } else if (item.correctIndex !== undefined) {
            kIdx = Number(item.correctIndex);
          } else if (item.jawaban !== undefined || item.kunci !== undefined) {
            const rawK = item.jawaban || item.kunci;
            if (typeof rawK === "number") kIdx = rawK;
            else if (typeof rawK === "string") {
              const letter = rawK.trim().toUpperCase();
              if (letter >= "A" && letter <= "D") kIdx = letter.charCodeAt(0) - 65;
              else if (!isNaN(parseInt(letter, 10))) kIdx = Math.max(0, parseInt(letter, 10) - 1);
            }
          }
          return {
            question: item.question || item.soal || item.pertanyaan || "",
            options: item.options || item.opsi || [],
            kunciIndex: Math.max(0, Math.min(3, kIdx))
          };
        });
        console.log("[Questions] Soal dimuat dari localStorage:", normalized.length, "soal.");
        return normalized;
      }
    } catch (e) {
      console.warn("[Questions] Gagal membaca localStorage:", e);
    }
    return null;
  }

  /* ── Simpan Soal ke localStorage (Timpa Penuh) ── */
  function saveToStorage(questions) {
    clearAllQuizCache(); // Hapus cache lama terlebih dahulu (localStorage.removeItem('quiz_data'))
    try {
      const formattedQuestions = questions.map(q => ({
        question: q.question || q.soal || q.pertanyaan || "",
        options: Array.isArray(q.options) ? q.options : [],
        kunciIndex: (q.kunciIndex !== undefined) ? Number(q.kunciIndex) : ((q.correctIndex !== undefined) ? Number(q.correctIndex) : 0)
      }));
      localStorage.setItem(STORAGE_KEY_PRIMARY, JSON.stringify(formattedQuestions));
      console.log("GURU: Berhasil menyimpan", formattedQuestions.length, "soal ke GAME_QUIZ_DATA.");
    } catch (e) {
      console.warn("[Questions] Gagal menyimpan soal ke localStorage:", e);
    }
  }

  /* ── Validasi Berbasis Urutan Tombol (Anti-Gagal) ── */
  function checkAnswer(question, indexTombolDiklik) {
    // Ambil kunciIndex soal (0..3)
    let kunciIndex = 0;
    if (question && question.kunciIndex !== undefined) {
      kunciIndex = Number(question.kunciIndex);
    } else if (question && question.correctIndex !== undefined) {
      kunciIndex = Number(question.correctIndex);
    }

    // Bandingkan secara langsung: indexTombolDiklik === soal.kunciIndex
    const isCorrect = (indexTombolDiklik === kunciIndex);

    return {
      isCorrect: isCorrect,
      kunciIndex: kunciIndex,
      indexTombolDiklik: indexTombolDiklik
    };
  }

  /* ── State Aktif (Kosong saat awal jika belum ada upload) ── */
  const fromStorage = loadFromStorage();
  let activeQuestions = fromStorage ? shuffle(fromStorage) : [];
  let usingCustomFile = fromStorage !== null;

  /* ── API Publik ── */
  function setQuestionsFromPDF(parsedQuestions) {
    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      return false;
    }
    // Hapus data kuis lama di localStorage dan simpan yang baru (KHUSUS GURU)
    saveToStorage(parsedQuestions);
    activeQuestions = shuffle(parsedQuestions.slice());
    usingCustomFile = true;
    console.log("[Questions] 🚀 Bank soal aktif Guru diperbarui:", parsedQuestions.length, "soal.");
    return true;
  }

  /* ── Khusus Murid: Muat soal ke memori permainan TANPA menimpa GAME_QUIZ_DATA Guru ── */
  function setStudentQuestions(questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
      return false;
    }
    const normalized = questions.map(item => {
      let kIdx = 0;
      if (item.kunciIndex !== undefined) {
        kIdx = Number(item.kunciIndex);
      } else if (item.correctIndex !== undefined) {
        kIdx = Number(item.correctIndex);
      }
      return {
        question: item.question || item.soal || item.pertanyaan || "",
        options: item.options || item.opsi || [],
        kunciIndex: Math.max(0, Math.min(3, kIdx))
      };
    });
    activeQuestions = shuffle(normalized);
    usingCustomFile = true;
    console.log("[Questions] 🎮 Soal sesi Murid berhasil dimuat ke memori game:", activeQuestions.length, "soal.");
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
    setStudentQuestions: setStudentQuestions,
    resetToFallback: resetToFallback,
    isUsingCustomPDF: isUsingCustomPDF,
    getQuestionCount: getQuestionCount,
    cleanOptionText: cleanOptionText,
    checkAnswer: checkAnswer,
    clearAllQuizCache: clearAllQuizCache,
    FALLBACK_QUESTIONS: FALLBACK_QUESTIONS
  };

  console.log("[Questions] questions.js dimuat OK. Soal aktif:", activeQuestions.length,
    usingCustomFile ? "(dari penyimpanan kuis)" : "(belum ada soal)");
})();
