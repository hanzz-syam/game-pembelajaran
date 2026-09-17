/* =========================================================
   pdf-parser.js  — PDF Quiz Parser Sistem Lengkap
   Versi: 3.11.174 (PDF.js)
   ---------------------------------------------------------
   Fitur:
   v Pembaca PDF baris-per-baris via PDF.js 3.11.174
   v Regex ekstraksi soal, pilihan A/B/C/D & kunci jawaban
   v Dukungan format: PDF, TXT, JSON, Excel/CSV (.xlsx/.xls)
   v Kunci Storage Seragam: 'GAME_QUIZ_DATA' di semua file
   v Simpan ke localStorage('GAME_QUIZ_DATA') + window.activeQuestions
   v Reset questionIndex ke 0 & trigger live-reload panel kuis
   ========================================================= */

(function () {
  "use strict";

  /* == PDF.js v3.11.174 Worker Source == */
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  /**
   * PEMBACA PDF — Baris per Baris (PDF.js v3.11.174)
   * Mengekstrak teks dari file PDF dengan mempertahankan urutan baris
   * berdasarkan posisi Y (atas ke bawah) dan X (kiri ke kanan).
   * @param {File} file
   * @returns {Promise<string>}
   */
  async function extractTextFromPDF(file) {
    if (!window.pdfjsLib) {
      throw new Error("PDF.js belum dimuat. Pastikan CDN pdf.js v3.11.174 tersedia.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    console.log("[PDFParser] Membaca PDF:", file.name, "— Halaman:", pdf.numPages);

    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      /* Urutkan item teks: Y besar = atas halaman (koordinat PDF terbalik),
         lalu X kecil ke besar (kiri ke kanan) dalam satu baris */
      const items = textContent.items.slice();
      items.sort((a, b) => {
        const yA = a.transform ? a.transform[5] : 0;
        const yB = b.transform ? b.transform[5] : 0;
        if (Math.abs(yA - yB) > 4) return yB - yA; // baris berbeda
        const xA = a.transform ? a.transform[4] : 0;
        const xB = b.transform ? b.transform[4] : 0;
        return xA - xB; // dalam baris sama
      });

      /* Rekonstruksi baris per baris secara eksplisit */
      const pageLines = [];
      let currentLine = "";
      let lastY = null;

      for (const item of items) {
        if (!item.str) continue;
        const currentY = item.transform ? item.transform[5] : null;

        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 4) {
          // Pergantian baris: simpan baris lama, mulai baris baru
          if (currentLine.trim()) pageLines.push(currentLine.trim());
          currentLine = item.str;
        } else {
          // Lanjut dalam baris yang sama
          if (currentLine.length > 0 && !currentLine.endsWith(" ") && !item.str.startsWith(" ")) {
            currentLine += " ";
          }
          currentLine += item.str;
        }
        if (currentY !== null) lastY = currentY;
      }
      if (currentLine.trim()) pageLines.push(currentLine.trim());

      console.log("[PDFParser] Halaman", pageNum, ":", pageLines.length, "baris");
      fullText += pageLines.join("\n") + "\n\n";
    }

    return fullText;
  }

  /**
   * Parsing data dari file Excel (.xlsx, .xls) atau CSV menggunakan SheetJS (XLSX).
   * @param {ArrayBuffer} arrayBuffer
   * @returns {Array<{question:string, options:string[], kunciIndex:number}>}
   */
  function parseExcelOrCSVData(arrayBuffer) {
    if (!window.XLSX) {
      console.warn("SheetJS (XLSX) tidak tersedia.");
      return [];
    }

    try {
      const workbook = window.XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (!Array.isArray(rawRows) || rawRows.length === 0) return [];

      const questions = [];

      // Cek apakah baris 0 adalah header
      let startRow = 0;
      const headerRow = rawRows[0].map((c) => String(c).toLowerCase().trim());
      const isHeader = headerRow.some((h) =>
        ["soal", "question", "pertanyaan", "opsi a", "option a", "jawaban", "kunci"].some((key) => h.includes(key))
      );
      if (isHeader) startRow = 1;

      for (let i = startRow; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!Array.isArray(row) || row.length < 3) continue;

        // Bersihkan sel
        const cleanRow = row.map((cell) => (cell !== undefined && cell !== null ? String(cell).trim() : ""));
        const questionText = cleanRow[0];

        if (!questionText || questionText.length < 2) continue;

        // Ambil opsi dari kolom selanjutnya
        const options = [];
        let answerVal = "";

        // Format umum: Kolom 0 = Soal, Kolom 1-4 = Opsi A-D, Kolom 5 = Kunci Jawaban
        if (cleanRow.length >= 5) {
          options.push(cleanRow[1], cleanRow[2], cleanRow[3]);
          if (cleanRow[4]) options.push(cleanRow[4]);
          if (cleanRow[5]) answerVal = cleanRow[5];
        } else {
          // Hanya 2 opsi
          options.push(cleanRow[1], cleanRow[2]);
          if (cleanRow[3]) answerVal = cleanRow[3];
        }

        const validOptions = options.filter((o) => o.length > 0);
        if (validOptions.length < 2) continue;

        let kunciIndex = 0;
        if (answerVal) {
          const letter = answerVal.toUpperCase().trim();
          if (letter.length === 1 && letter >= "A" && letter <= "D") {
            kunciIndex = letter.charCodeAt(0) - 65;
          } else if (!isNaN(parseInt(letter, 10))) {
            const num = parseInt(letter, 10);
            kunciIndex = num >= 1 ? num - 1 : num;
          } else {
            const matchIdx = validOptions.findIndex((o) => o.toLowerCase() === answerVal.toLowerCase());
            if (matchIdx !== -1) kunciIndex = matchIdx;
          }
        }

        if (kunciIndex < 0 || kunciIndex >= validOptions.length) kunciIndex = 0;

        questions.push({
          question: questionText,
          options: validOptions,
          kunciIndex: kunciIndex
        });
      }

      return questions;
    } catch (e) {
      console.error("Gagal parsing Excel/CSV:", e);
      return [];
    }
  }

  /**
   * Parsing data JSON jika file berupa .json
   */
  function parseJSONQuestions(text) {
    try {
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : (data.questions || data.soal || data.data || []);
      if (!Array.isArray(list)) return [];
      
      const parsed = [];
      for (const item of list) {
        let qText = item.question || item.soal || item.pertanyaan;
        let opts = item.options || item.opsi || item.pilihan;

        // Format objek seperti { soal: "...", a: "...", b: "...", c: "...", d: "...", jawaban: "B" }
        if (!opts && (item.a || item.A)) {
          opts = [item.a || item.A, item.b || item.B, item.c || item.C, item.d || item.D].filter(Boolean);
        }

        if (!qText || !Array.isArray(opts) || opts.length < 2) continue;
        
        let correctIdx = 0;
        const ans = item.kunciIndex !== undefined ? item.kunciIndex : (item.correctIndex !== undefined ? item.correctIndex : (item.jawaban || item.kunci));

        if (typeof ans === "number") {
          correctIdx = ans;
        } else if (typeof ans === "string") {
          const letter = ans.trim().toUpperCase();
          if (letter.length === 1 && letter >= "A" && letter <= "D") {
            correctIdx = letter.charCodeAt(0) - 65;
          } else {
            const matchIdx = opts.findIndex(o => String(o).trim().toLowerCase() === ans.trim().toLowerCase());
            if (matchIdx !== -1) correctIdx = matchIdx;
          }
        }
        
        parsed.push({
          question: String(qText).trim(),
          options: opts.map(o => String(o).trim()),
          kunciIndex: Math.max(0, Math.min(opts.length - 1, correctIdx))
        });
      }
      return parsed;
    } catch (e) {
      return [];
    }
  }

  /**
   * REGEX EKSTRAKSI SOAL & KUNCI JAWABAN dari Teks (PDF / TXT)
   * Format yang dikenali:
   *   Soal   : "1.", "1)", "1 ", "[1]", "Soal 1", "No 1."
   *   Pilihan: "A.", "a.", "A)", "a)", "(A)", "[A]"
   *   Kunci  : "Kunci:", "Jawaban:", "Ans:", "Key:" (abaikan kapitalisasi)
   */
  function parseQuestionsFromText(text) {
    if (!text || typeof text !== "string") return [];

    // Coba JSON terlebih dahulu
    const jsonParsed = parseJSONQuestions(text);
    if (jsonParsed.length > 0) return jsonParsed;

    // Normalisasi baris
    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0);
    const fullContent = lines.join("\n");

    // Pola Regex Fleksibel untuk Nomor Soal: 1., 1), 1 , [1], Soal 1, No 1.
    const SOAL_REGEX = /(?:^|\n)\s*(?:(?:Soal|No\.?|Nomor)\s+)?\[?(\d{1,3})\]?\s*(?:[.):]\s+|\s+(?=[A-Za-z\u0600-\u06FF]))/gi;
    const soalPositions = [];
    let m;
    while ((m = SOAL_REGEX.exec(fullContent)) !== null) {
      soalPositions.push({ index: m.index, number: parseInt(m[1], 10) });
    }

    if (soalPositions.length === 0) {
      // Fallback: pisah berdasarkan paragraf
      return parseByParagraph(fullContent);
    }

    const questions = [];

    for (let si = 0; si < soalPositions.length; si++) {
      const blockStart = soalPositions[si].index;
      const blockEnd = si < soalPositions.length - 1
        ? soalPositions[si + 1].index
        : fullContent.length;

      const block = fullContent.substring(blockStart, blockEnd).trim();
      if (block.length < 5) continue;

      // Pola Regex Fleksibel untuk Pilihan Jawaban: A., a., A), a), (A), [A]
      const optMatches = [];
      let optM;
      const optRx = /(?:^|\n)\s*(?:\(?\[?([A-Da-d])\]?\)?)\s*[.)\s]\s*/g;
      while ((optM = optRx.exec(block)) !== null) {
        optMatches.push({
          index: optM.index,
          matchLen: optM[0].length,
          letter: optM[1].toUpperCase()
        });
      }

      if (optMatches.length < 2) continue;

      // Ekstrak teks soal (sebelum pilihan pertama)
      let questionText = block.substring(0, optMatches[0].index).trim();
      questionText = questionText
        .replace(/^(?:Soal|No\.?|Nomor)?\s*\[?\d{1,3}\]?\s*[.):] */i, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!questionText || questionText.length < 3) continue;

      // Ekstrak teks setiap pilihan
      const options = [];
      const optLetters = [];

      for (let oi = 0; oi < optMatches.length; oi++) {
        const cur = optMatches[oi];
        const nextStart = oi < optMatches.length - 1
          ? optMatches[oi + 1].index
          : block.length;

        const rawOpt = block.substring(cur.index + cur.matchLen, nextStart);
        // Potong jika ada baris kunci jawaban di akhir opsi terakhir
        const optText = rawOpt
          .split(/(?:Kunci(?:\s*Jawaban)?|Jawaban(?:\s*Benar)?|Ans(?:wer)?|Key)\s*[:=.]/i)[0]
          .trim()
          .replace(/\s+/g, " ");

        if (optText.length > 0 && !optLetters.includes(cur.letter)) {
          options.push(optText);
          optLetters.push(cur.letter);
        }
      }

      if (options.length < 2) continue;
      while (options.length > 4) { options.pop(); optLetters.pop(); }

      // Pola Regex Fleksibel untuk Kunci Jawaban: Kunci:, Jawaban:, Ans:, Key: (abaikan kapitalisasi)
      let kunciIndex = 0;
      const kunciLineMatch = block.match(/(?:Kunci(?:\s*Jawaban)?|Jawaban(?:\s*Benar)?|Ans(?:wer)?|Key)\s*[:=.]?\s*([^\n]+)/i);

      if (kunciLineMatch) {
        let rawKunci = kunciLineMatch[1]
          .replace(/^(?:Kunci(?:\s*Jawaban)?|Jawaban(?:\s*Benar)?|Ans(?:wer)?|Key)\s*[:=.]?\s*/i, "")
          .replace(/^[.:=\s\(\)\[\]]+|[.:=\s\(\)\[\]]+$/g, "")
          .trim()
          .toUpperCase();

        // Cari pencocokan huruf (A-D) atau angka (1-4) di awal kunci
        const charMatch = rawKunci.match(/^[\(\[]?([A-D1-4])[\)\]]?/i);
        if (charMatch) {
          const val = charMatch[1].toUpperCase();
          if (val >= "A" && val <= "D") {
            const foundIdx = optLetters.indexOf(val);
            kunciIndex = foundIdx !== -1 ? foundIdx : val.charCodeAt(0) - 65;
          } else if (val >= "1" && val <= "4") {
            kunciIndex = parseInt(val, 10) - 1;
          }
        } else {
          // Jika kunci berupa teks isi jawaban, cocokkan dengan pilihan
          const matchIdx = options.findIndex(opt => opt.trim().toUpperCase() === rawKunci);
          if (matchIdx !== -1) kunciIndex = matchIdx;
        }
      }

      kunciIndex = Math.max(0, Math.min(options.length - 1, kunciIndex));
      questions.push({ question: questionText, options, kunciIndex: kunciIndex });
    }

    return questions;
  }

  /* Fallback: Parsing berdasarkan paragraf (bila tidak ada nomor soal) */
  function parseByParagraph(text) {
    const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 10);
    const questions = [];

    for (const para of paragraphs) {
      const optMatches = [];
      let optM;
      const optRx = /(?:^|\n)\s*(?:\(?\[?([A-Da-d])\]?\)?)\s*[.)\s]\s*/g;
      while ((optM = optRx.exec(para)) !== null) {
        optMatches.push({ index: optM.index, matchLen: optM[0].length, letter: optM[1].toUpperCase() });
      }
      if (optMatches.length < 2) continue;

      let qText = para.substring(0, optMatches[0].index)
        .replace(/^(?:Soal|No\.?|Nomor)?\s*\[?\d{1,3}\]?\s*[.):] */i, "")
        .replace(/\s+/g, " ").trim();
      if (!qText || qText.length < 3) continue;

      const options = [], optLetters = [];
      for (let oi = 0; oi < optMatches.length; oi++) {
        const cur = optMatches[oi];
        const nextStart = oi < optMatches.length - 1 ? optMatches[oi + 1].index : para.length;
        const rawOpt = para.substring(cur.index + cur.matchLen, nextStart)
          .split(/(?:Kunci(?:\s*Jawaban)?|Jawaban(?:\s*Benar)?|Ans(?:wer)?|Key)\s*[:=.]/i)[0]
          .trim().replace(/\s+/g, " ");
        if (rawOpt.length > 0 && !optLetters.includes(cur.letter)) {
          options.push(rawOpt); optLetters.push(cur.letter);
        }
      }
      if (options.length < 2) continue;

      let kunciIndex = 0;
      const km = para.match(/(?:Kunci(?:\s*Jawaban)?|Jawaban(?:\s*Benar)?|Ans(?:wer)?|Key)\s*[:=.]?\s*([^\n]+)/i);
      if (km) {
        let rawKunci = km[1]
          .replace(/^(?:Kunci(?:\s*Jawaban)?|Jawaban(?:\s*Benar)?|Ans(?:wer)?|Key)\s*[:=.]?\s*/i, "")
          .replace(/^[.:=\s\(\)\[\]]+|[.:=\s\(\)\[\]]+$/g, "")
          .trim()
          .toUpperCase();
        const charMatch = rawKunci.match(/^[\(\[]?([A-D1-4])[\)\]]?/i);
        if (charMatch) {
          const v = charMatch[1].toUpperCase();
          if (v >= "A" && v <= "D") {
            const fi = optLetters.indexOf(v);
            kunciIndex = fi !== -1 ? fi : v.charCodeAt(0) - 65;
          } else if (v >= "1" && v <= "4") {
            kunciIndex = parseInt(v, 10) - 1;
          }
        } else {
          const matchIdx = options.findIndex(opt => opt.trim().toUpperCase() === rawKunci);
          if (matchIdx !== -1) kunciIndex = matchIdx;
        }
      }

      questions.push({ question: qText, options, kunciIndex: Math.max(0, Math.min(options.length - 1, kunciIndex)) });
    }
    return questions;
  }

  /* ================================================================
     HAPUS DATA LAMA & TERAPKAN SOAL BARU
     1. localStorage.removeItem('quiz_data') — hapus data lama
     2. Simpan data baru ke localStorage('quiz_data')
     3. window.activeQuestions = formattedData (timpa langsung)
     4. Reset questionIndex & dispatch event pdfQuizLoaded
  ================================================================ */
  function applyParsedQuestions(parsedData, fileName) {
    if (!Array.isArray(parsedData) || parsedData.length === 0) return false;

    // Standardisasi format data soal agar selalu menyimpan kunciIndex (0..3)
    const formattedData = parsedData.map(q => ({
      question: q.question || q.soal || q.pertanyaan || "",
      options: Array.isArray(q.options) ? q.options : [],
      kunciIndex: (q.kunciIndex !== undefined) ? Number(q.kunciIndex) : ((q.correctIndex !== undefined) ? Number(q.correctIndex) : 0)
    }));

    // Langkah 1: Hapus kunci lama agar tidak ada konflik
    try {
      ["quiz_data", "islamgame_questions_v1", "dreamtown_questions"].forEach(k => localStorage.removeItem(k));
      console.log("[PDFParser] 🗑️ Kunci storage lama dihapus.");
    } catch (e) {
      console.warn("[PDFParser] Gagal menghapus localStorage lama:", e);
    }

    // Langkah 2: Simpan data baru ke GAME_QUIZ_DATA
    try {
      localStorage.setItem("GAME_QUIZ_DATA", JSON.stringify(formattedData));
      console.log("GURU: Berhasil menyimpan", formattedData.length, "soal ke GAME_QUIZ_DATA — dari '" + fileName + "'.");
    } catch (e) {
      console.warn("[PDFParser] Gagal menyimpan ke localStorage:", e);
    }

    // Langkah 3: Perbarui QuestionsModule (sumber data utama game)
    if (window.QuestionsModule && typeof window.QuestionsModule.setQuestionsFromPDF === "function") {
      window.QuestionsModule.setQuestionsFromPDF(formattedData);
    }

    // Langkah 4: Timpa window.activeQuestions secara langsung
    window.activeQuestions = formattedData.slice();
    console.log("[PDFParser] window.activeQuestions diperbarui:", formattedData.length, "soal.");

    // Langkah 5: Reset questionIndex ke 0 & trigger live-reload panel kuis
    if (window.QuizController && typeof window.QuizController.reloadWithNewQuestions === "function") {
      window.QuizController.reloadWithNewQuestions(formattedData);
    } else {
      // Dispatch custom event agar game.js bisa menangkap & reload kuis
      const event = new CustomEvent("pdfQuizLoaded", {
        detail: { questions: formattedData, count: formattedData.length, source: fileName }
      });
      window.dispatchEvent(event);
      console.log("[PDFParser] Event 'pdfQuizLoaded' dikirim dengan", formattedData.length, "soal.");
    }

    return true;
  }

  /**
   * HANDLER UTAMA: Proses file yang diunggah (PDF / TXT / JSON / Excel / CSV)
   * @param {File} file
   * @returns {Promise<{success:boolean, count:number, message:string}>}
   */
  async function handlePDFUpload(file) {
    try {
      if (!file) {
        return { success: false, count: 0, message: "Belum ada file yang dipilih." };
      }

      const fileName = file.name.toLowerCase();
      let parsed = [];

      console.log("[PDFParser] Memproses file:", file.name, "(" + (file.size / 1024).toFixed(1) + " KB)");

      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv")) {
        const buffer = await file.arrayBuffer();
        parsed = parseExcelOrCSVData(buffer);
      } else if (fileName.endsWith(".json")) {
        const text = await file.text();
        parsed = parseJSONQuestions(text);
      } else if (fileName.endsWith(".txt")) {
        const text = await file.text();
        parsed = parseQuestionsFromText(text);
      } else {
        // PDF — Baca baris per baris via PDF.js 3.11.174
        const text = await extractTextFromPDF(file);
        console.log("[PDFParser] Teks PDF diekstrak:", text ? text.length : 0, "karakter");

        // Notifikasi PDF Scan: Jika total teks yang diekstrak dari PDF kosong (0 karakter)
        if (!text || text.trim().length === 0) {
          return {
            success: false,
            count: 0,
            message: "File PDF ini berupa gambar/scan. Silakan salin teksnya ke file TXT/JSON."
          };
        }

        parsed = parseQuestionsFromText(text);
      }

      if (parsed.length === 0) {
        return {
          success: false,
          count: 0,
          message: "Tidak ada soal terdeteksi dalam '" + file.name + "'. " +
            "Pastikan PDF mengandung teks (bukan gambar scan), atau gunakan JSON/CSV/Excel."
        };
      }

      // Terapkan: hapus lama, simpan baru, update aktif, reload kuis
      applyParsedQuestions(parsed, file.name);

      return {
        success: true,
        count: parsed.length,
        message: "Berhasil memuat " + parsed.length + " soal dari '" + file.name + "'! " +
          "Soal baru langsung aktif — kuis dimulai dari soal pertama."
      };
    } catch (err) {
      console.error("[PDFParser] Gagal membaca file:", err);
      return {
        success: false,
        count: 0,
        message: "Gagal membaca file: " + (err.message || "Error tidak diketahui") + ". Coba format lain (JSON/CSV/Excel)."
      };
    }
  }

  window.PDFParserModule = {
    extractTextFromPDF,
    parseExcelOrCSVData,
    parseJSONQuestions,
    parseQuestionsFromText,
    parseByParagraph,
    applyParsedQuestions,
    handlePDFUpload
  };

  console.log("[PDFParser] pdf-parser.js dimuat OK — PDF.js v3.11.174 siap.");
})();
