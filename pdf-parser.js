/* =========================================================
   pdf-parser.js
   Ekstraksi & Parsing Soal Serbaguna dari Berbagai Format:
   - Excel (.xlsx, .xls) via SheetJS
   - CSV (.csv) via SheetJS / Text parsing
   - JSON (.json)
   - PDF (.pdf) via PDF.js (layout Y-position preserved)
   - TXT (.txt)
   ========================================================= */

(function () {
  "use strict";

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
  }

  /**
   * Mengekstrak seluruh teks dari file PDF (File object) dengan mempertahankan urutan baris (Y-pos).
   * @param {File} file
   * @returns {Promise<string>}
   */
  async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const items = textContent.items.slice();
      items.sort((a, b) => {
        const yA = a.transform ? a.transform[5] : 0;
        const yB = b.transform ? b.transform[5] : 0;
        if (Math.abs(yA - yB) > 4) {
          return yB - yA;
        }
        const xA = a.transform ? a.transform[4] : 0;
        const xB = b.transform ? b.transform[4] : 0;
        return xA - xB;
      });

      let pageText = "";
      let lastY = null;
      for (const item of items) {
        if (!item.str) continue;
        const currentY = item.transform ? item.transform[5] : null;
        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 4) {
          pageText += "\n";
        } else if (pageText.length > 0 && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
          pageText += " ";
        }
        pageText += item.str;
        if (currentY !== null) lastY = currentY;
      }
      fullText += pageText + "\n\n";
    }
    return fullText;
  }

  /**
   * Parsing data dari file Excel (.xlsx, .xls) atau CSV menggunakan SheetJS (XLSX).
   * @param {ArrayBuffer} arrayBuffer
   * @returns {Array<{question:string, options:string[], correctIndex:number}>}
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

        let correctIndex = 0;
        if (answerVal) {
          const letter = answerVal.toUpperCase().trim();
          if (letter.length === 1 && letter >= "A" && letter <= "D") {
            correctIndex = letter.charCodeAt(0) - 65;
          } else if (!isNaN(parseInt(letter, 10))) {
            const num = parseInt(letter, 10);
            correctIndex = num >= 1 ? num - 1 : num;
          } else {
            const matchIdx = validOptions.findIndex((o) => o.toLowerCase() === answerVal.toLowerCase());
            if (matchIdx !== -1) correctIndex = matchIdx;
          }
        }

        if (correctIndex < 0 || correctIndex >= validOptions.length) correctIndex = 0;

        questions.push({
          question: questionText,
          options: validOptions,
          correctIndex: correctIndex
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
        const ans = item.correctIndex !== undefined ? item.correctIndex : (item.jawaban || item.kunci);

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
          correctIndex: Math.max(0, Math.min(opts.length - 1, correctIdx))
        });
      }
      return parsed;
    } catch (e) {
      return [];
    }
  }

  /**
   * Parsing teks mentah dari PDF atau TXT menjadi array soal.
   */
  function parseQuestionsFromText(text) {
    if (!text || typeof text !== "string") return [];

    // 1. Coba parsing JSON lebih dahulu
    const jsonParsed = parseJSONQuestions(text);
    if (jsonParsed.length > 0) return jsonParsed;

    const cleaned = text.replace(/\r/g, "\n");
    const lines = cleaned.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const fullContent = lines.join("\n");

    // 2. Deteksi blok soal berdasar penomoran: 1., 1), Soal 1, 1:, Q1.
    const blockRegex = /(?:^|\n)\s*(?:Soal\s*)?(\d{1,3})\s*[.:\)]\s*/gi;
    const matches = [];
    let match;
    while ((match = blockRegex.exec(fullContent)) !== null) {
      matches.push({
        index: match.index,
        number: match[1]
      });
    }

    const blocks = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = (i < matches.length - 1) ? matches[i + 1].index : fullContent.length;
      const blockText = fullContent.substring(start, end).trim();
      if (blockText.length > 5) {
        blocks.push(blockText);
      }
    }

    if (blocks.length === 0) {
      const altBlocks = fullContent.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 10);
      blocks.push(...altBlocks);
    }

    const questions = [];

    for (const block of blocks) {
      const optionLabelRegex = /(?:^|\s|\n)(?:\(?([a-dA-D])[\.\)]|\b([a-dA-D])[\.\)])\s*/g;
      const optMatches = [];
      let optMatch;
      while ((optMatch = optionLabelRegex.exec(block)) !== null) {
        const letter = (optMatch[1] || optMatch[2]).toUpperCase();
        optMatches.push({
          index: optMatch.index,
          matchLength: optMatch[0].length,
          letter: letter
        });
      }

      if (optMatches.length < 2) continue;

      const answerMatch = block.match(/(?:Jawaban|Kunci|Ans|Answer|Key)\s*[:=.]?\s*\(?\s*([a-dA-D1-4])\s*\)?/i);
      let correctIndex = 0;

      const firstOptIndex = optMatches[0].index;
      let questionText = block.substring(0, firstOptIndex).trim();
      questionText = questionText.replace(/^(?:Soal\s*)?\d{1,3}\s*[.:\)]\s*/i, "").trim();
      questionText = questionText.replace(/\s+/g, " ");

      if (!questionText || questionText.length < 2) continue;

      const options = [];
      const optionLetters = [];

      for (let i = 0; i < optMatches.length; i++) {
        const currentOpt = optMatches[i];
        const textEnd = (i < optMatches.length - 1) ? optMatches[i + 1].index : block.length;
        const rawOptText = block.substring(currentOpt.index + currentOpt.matchLength, textEnd);
        const optTextClean = rawOptText.split(/(?:Jawaban|Kunci|Ans|Answer)/i)[0].trim().replace(/\s+/g, " ");

        if (optTextClean.length > 0 && !optionLetters.includes(currentOpt.letter)) {
          options.push(optTextClean);
          optionLetters.push(currentOpt.letter);
        }
      }

      if (options.length < 2) continue;
      while (options.length > 4) {
        options.pop();
        optionLetters.pop();
      }

      if (answerMatch) {
        const val = answerMatch[1].toUpperCase();
        if (val >= "A" && val <= "D") {
          const foundIdx = optionLetters.indexOf(val);
          if (foundIdx !== -1) correctIndex = foundIdx;
          else correctIndex = val.charCodeAt(0) - 65;
        } else if (val >= "1" && val <= "4") {
          correctIndex = parseInt(val, 10) - 1;
        }
      }

      if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;

      questions.push({
        question: questionText,
        options: options,
        correctIndex: correctIndex
      });
    }

    return questions;
  }

  /**
   * Memproses unggahan file (Excel / CSV / JSON / PDF / TXT).
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
        // PDF atau file lainnya
        const text = await extractTextFromPDF(file);
        parsed = parseQuestionsFromText(text);
      }

      if (parsed.length === 0) {
        return {
          success: false,
          count: 0,
          message: "Tidak ada soal terdeteksi dalam file. Pastikan format file sesuai (Excel/CSV/JSON/PDF/TXT)."
        };
      }

      window.QuestionsModule.setQuestionsFromPDF(parsed);
      return {
        success: true,
        count: parsed.length,
        message: `🎉 Berhasil memuat ${parsed.length} soal dari ${file.name}! Soal disimpan & akan digunakan mulai sekarang.`
      };
    } catch (err) {
      console.error("Gagal membaca file:", err);
      return {
        success: false,
        count: 0,
        message: "Gagal membaca file. Silakan coba lagi atau gunakan format lain (JSON/CSV/Excel)."
      };
    }
  }

  window.PDFParserModule = {
    extractTextFromPDF,
    parseExcelOrCSVData,
    parseJSONQuestions,
    parseQuestionsFromText,
    handlePDFUpload
  };
})();
