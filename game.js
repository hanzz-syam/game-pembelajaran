/* =========================================================
   game.js
   Titik pusat integrasi seluruh modul: world, player, audio,
   questions, townBuilder, multiplayer. Mengelola HUD, HP,
   skor, koin, alur kuis per pulau, dan status game.
   ========================================================= */

(function () {
  "use strict";

  // ---------------- State global ----------------
  const state = {
    hp: 100,
    maxHp: 100,
    score: 0,
    coins: 0,
    currentIslandIndex: 0,
    questionIndex: 0,
    questions: [],
    answeredIslands: new Set(),
    isGameOver: false,
    isQuestionOpen: false,
    isLevelComplete: false,
    moveSpeed: 6,
    velocityY: 0,
    isGrounded: true,
    playerRotationY: 0
  };

  let player = null;
  let scene, camera, renderer, clock;
  let islands = [];
  let bridges = [];

  // ---------------- DOM refs ----------------
  const dom = {};

  function cacheDom() {
    const ids = [
      "loading-screen", "loading-progress", "loading-text",
      "start-screen", "btn-mode-student", "btn-mode-teacher",
      "pdf-input", "pdf-status", "btn-start-game",
      "teacher-screen", "teacher-pin", "btn-new-pin", "btn-clear-leaderboard", "leaderboard-list", "btn-teacher-back",
      "join-screen", "student-name", "student-pin", "btn-join-class", "btn-join-back",
      "game-container", "game-canvas",
      "health-bar-inner", "health-text", "score-value", "coin-value",
      "btn-mute", "btn-shop", "btn-multiplayer", "effect-layer",
      "question-panel", "question-progress", "question-text", "answer-options",
      "feedback-toast", "dpad", "btn-jump",
      "shop-modal", "shop-coin-value", "shop-items", "btn-close-shop",
      "leaderboard-modal", "lb-modal-list", "btn-clear-lb-modal", "btn-close-lb",
      "gameover-modal", "final-score", "final-coin", "btn-restart",
      "levelcomplete-modal", "lc-final-score", "lc-final-coin", "btn-goto-town"
    ];
    ids.forEach((id) => (dom[id] = document.getElementById(id)));
  }

  // ---------------- Loading sequence ----------------
  function runLoadingSequence(callback) {
    let progress = 0;
    const texts = [
      "Menyiapkan pulau langit...",
      "Menanam pohon hias...",
      "Merangkai awan HD...",
      "Menyusun bank soal...",
      "Menyalakan portal kuis...",
      "Membangun rumah impian..."
    ];
    const interval = setInterval(() => {
      progress += 8 + Math.random() * 12;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(callback, 300);
      }
      dom["loading-progress"].style.width = progress + "%";
      dom["loading-text"].textContent = texts[Math.floor((progress / 100) * (texts.length - 1))];
    }, 220);
  }

  // ---------------- Screen management ----------------
  function showScreen(id) {
    ["loading-screen", "start-screen", "teacher-screen", "join-screen", "game-container"].forEach((s) => {
      dom[s].classList.add("hidden");
    });
    dom[id].classList.remove("hidden");
  }

  // ---------------- Init flow ----------------
  function init() {
    cacheDom();
    runLoadingSequence(() => {
      showScreen("start-screen");
      window.AudioModule.playMenuBGM();
    });

    bindStartScreenEvents();
    bindTeacherScreenEvents();
    bindJoinScreenEvents();
  }

  function bindStartScreenEvents() {
    let selectedMode = "student";

    dom["btn-mode-student"].addEventListener("click", () => {
      selectedMode = "student";
      dom["btn-mode-student"].style.opacity = "1";
      dom["btn-mode-teacher"].style.opacity = "0.6";
      window.AudioModule.playMenuBGM();
    });

    dom["btn-mode-teacher"].addEventListener("click", () => {
      selectedMode = "teacher";
      dom["btn-mode-teacher"].style.opacity = "1";
      dom["btn-mode-student"].style.opacity = "0.6";
      window.AudioModule.playMenuBGM();
    });

    dom["pdf-input"].addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      dom["pdf-status"].textContent = "⏳ Membaca file...";
      dom["pdf-status"].style.color = "#d4a017";
      const result = await window.PDFParserModule.handlePDFUpload(file);
      dom["pdf-status"].textContent = result.message;
      dom["pdf-status"].style.color = result.success ? "#2ea84e" : "#d42e48";
      window.AudioModule.playMenuBGM();
    });

    dom["btn-start-game"].addEventListener("click", () => {
      window.AudioModule.ensureContext();
      window.AudioModule.playMenuBGM();
      if (selectedMode === "teacher") {
        openTeacherDashboard();
      } else {
        showScreen("join-screen");
      }
    });
  }

  function bindTeacherScreenEvents() {
    dom["btn-new-pin"].addEventListener("click", () => {
      const pin = window.MultiplayerModule.regeneratePin();
      dom["teacher-pin"].textContent = pin;
    });

    if (dom["btn-clear-leaderboard"]) {
      dom["btn-clear-leaderboard"].addEventListener("click", () => {
        if (confirm("Apakah Anda yakin ingin menghapus semua riwayat pemain & papan peringkat?")) {
          window.MultiplayerModule.resetLeaderboard();
          renderLeaderboard(dom["leaderboard-list"]);
        }
      });
    }

    dom["btn-teacher-back"].addEventListener("click", () => {
      showScreen("start-screen");
    });
  }

  function bindJoinScreenEvents() {
    dom["btn-join-back"].addEventListener("click", () => {
      showScreen("start-screen");
    });
    dom["btn-join-class"].addEventListener("click", () => {
      const name = dom["student-name"].value.trim() || "Murid";
      const pin = dom["student-pin"].value.trim();
      window.MultiplayerModule.joinAsStudent(name, pin);
      startGame();
    });
  }

  function openTeacherDashboard() {
    const pin = window.MultiplayerModule.startTeacherSession();
    dom["teacher-pin"].textContent = pin;
    renderLeaderboard(dom["leaderboard-list"]);
    window.MultiplayerModule.subscribeLeaderboard(() => renderLeaderboard(dom["leaderboard-list"]));
    showScreen("teacher-screen");
  }

  function renderLeaderboard(container) {
    if (!container) return;
    const lb = window.MultiplayerModule.getLeaderboard();
    if (!lb.length) {
      container.innerHTML = '<p class="empty-note">Belum ada riwayat pemain. Silakan gabung dan mulai bermain!</p>';
      return;
    }
    container.innerHTML = lb
      .map((s, i) => {
        return `<div class="leaderboard-row"><span><span class="rank">#${i + 1}</span>${escapeHtml(s.name)}</span><span>⭐ ${s.score} · 🪙 ${s.coins}</span></div>`;
      })
      .join("");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------------- Start actual gameplay ----------------
  function startGame() {
    showScreen("game-container");
    state.questions = window.QuestionsModule.getQuestions();

    const worldData = window.WorldModule.initScene();
    window.WorldModule.initRenderer(dom["game-canvas"]);
    scene = worldData.scene;
    camera = worldData.camera;
    renderer = window.WorldModule.getRenderer();
    clock = worldData.clock;
    islands = window.WorldModule.getIslands();
    bridges = window.WorldModule.getBridges();

    player = window.PlayerModule.createPlayer();
    const firstIsland = islands[0];
    player.position.set(firstIsland.position.x, firstIsland.position.y + 0.91, firstIsland.position.z);
    scene.add(player);

    window.TownBuilderModule.buildPlacementGrid(window.WorldModule.getTownIsland());

    // Restore saved coins & decorations from localStorage
    const savedCoins = window.TownBuilderModule.loadCoins();
    if (savedCoins > 0) state.coins = savedCoins;
    window.TownBuilderModule.loadDecorations(window.WorldModule.getTownIsland());

    window.PlayerModule.setupKeyboardInput();
    window.PlayerModule.setupTouchInput();

    window.AudioModule.playGameBGM();

    bindHUDEvents();
    updateHUD();

    // ── Muat semua model dekoratif GLB dari folder models/ ke scene ───
    // ModelLoaderModule memuat: air_mancur, bangku, cerobong, gazebo,
    // jalan, kincir, kolam, lampu, menara_jam, pagar, pohon_palem,
    // pohon_pinus, taman_bunga — di sekitar town island.
    // CATATAN: rumah_mungil TIDAK dimuat di sini. Rumah hanya muncul
    // setelah pemain membeli "Rumah Mungil" dari toko (TownBuilderModule).
    if (window.ModelLoaderModule) {
      const townIsland = window.WorldModule.getTownIsland();
      window.ModelLoaderModule.loadAllModels(scene, townIsland, function () {
        console.log("[game.js] Semua model dekoratif GLB berhasil dimuat ke scene.");
      });
    } else {
      console.warn("[game.js] ModelLoaderModule tidak tersedia — model_loader.js belum dimuat.");
    }
    // ────────────────────────────────────────────────────────────────

    requestAnimationFrame(gameLoop);
  }

  // ---------------- HUD events ----------------
  function updateLeaderboardModalControls() {
    const role = window.MultiplayerModule ? window.MultiplayerModule.getRole() : "student";
    const isTeacherOrAdmin = (role === "teacher" || role === "admin");

    if (dom["btn-clear-lb-modal"]) {
      if (isTeacherOrAdmin) {
        dom["btn-clear-lb-modal"].style.display = "inline-block";
        dom["btn-clear-lb-modal"].disabled = false;
      } else {
        dom["btn-clear-lb-modal"].style.display = "none";
        dom["btn-clear-lb-modal"].disabled = true;
      }
    }
  }

  function bindHUDEvents() {
    dom["btn-mute"].addEventListener("click", () => {
      const muted = window.AudioModule.toggleMute();
      dom["btn-mute"].textContent = muted ? "🔇" : "🔊";
    });

    dom["btn-shop"].addEventListener("click", openShop);
    dom["btn-close-shop"].addEventListener("click", () => dom["shop-modal"].classList.add("hidden"));

    dom["btn-multiplayer"].addEventListener("click", () => {
      renderLeaderboard(dom["lb-modal-list"]);
      updateLeaderboardModalControls();
      dom["leaderboard-modal"].classList.remove("hidden");
    });

    if (dom["btn-clear-lb-modal"]) {
      dom["btn-clear-lb-modal"].addEventListener("click", () => {
        const role = window.MultiplayerModule ? window.MultiplayerModule.getRole() : "student";
        if (role === "student") {
          showFeedback("🚫 Akses Ditolak: Murid tidak dapat menghapus riwayat!", "wrong");
          return;
        }
        if (confirm("Apakah Anda yakin ingin menghapus semua riwayat pemain & papan peringkat?")) {
          window.MultiplayerModule.resetLeaderboard();
          renderLeaderboard(dom["lb-modal-list"]);
        }
      });
    }

    dom["btn-close-lb"].addEventListener("click", () => dom["leaderboard-modal"].classList.add("hidden"));

    dom["btn-restart"].addEventListener("click", () => {
      window.location.reload();
    });

    dom["btn-goto-town"].addEventListener("click", () => {
      dom["levelcomplete-modal"].classList.add("hidden");
      openShop();
    });
  }

  function openShop() {
    renderShopItems();
    dom["shop-coin-value"].textContent = state.coins;
    dom["shop-modal"].classList.remove("hidden");
  }

  function renderShopItems() {
    const items = window.TownBuilderModule.getShopItems();
    dom["shop-items"].innerHTML = items
      .map(
        (item) => `
        <div class="shop-item">
          <div class="shop-item-icon">${item.icon}</div>
          <div class="shop-item-name">${item.name}</div>
          <div class="shop-item-price">🪙 ${item.price}</div>
          <button
            data-item-id="${item.id}"
            data-price="${item.price}"
            class="shop-buy-btn"
            ${state.coins < item.price ? "disabled" : ""}
          >Beli</button>
        </div>`
      )
      .join("");

    // Gunakan event delegation — satu listener di container, bukan per-button
    // Ini mencegah listener ganda saat re-render
    dom["shop-items"].onclick = (e) => {
      const btn = e.target.closest("button.shop-buy-btn");
      if (!btn || btn.disabled) return;

      const id = btn.getAttribute("data-item-id");
      const price = parseInt(btn.getAttribute("data-price"), 10);

      // Validasi koin secara dinamis sebelum proses
      if (state.coins < price) {
        showFeedback("🪙 Koin tidak cukup!", "wrong");
        return;
      }

      // Nonaktifkan tombol sementara untuk mencegah double-click
      btn.disabled = true;
      btn.textContent = "⏳";

      const result = window.TownBuilderModule.purchaseItem(id, state.coins);
      showFeedback(result.message, result.success ? "correct" : "wrong");

      if (result.success) {
        state.coins = result.coins;
        window.AudioModule.playPurchaseSFX();
        updateHUD();
        dom["shop-coin-value"].textContent = state.coins;
        // Re-render shop items dengan data terbaru
        renderShopItems();
      } else {
        // Jika gagal, kembalikan tombol
        btn.disabled = false;
        btn.textContent = "Beli";
      }
    };
  }

  // ---------------- HUD update ----------------
  function updateHUD() {
    const pct = Math.max(0, (state.hp / state.maxHp) * 100);
    dom["health-bar-inner"].style.width = pct + "%";
    dom["health-text"].textContent = `${Math.max(0, state.hp)}/${state.maxHp}`;
    dom["health-bar-inner"].style.background =
      pct > 50
        ? "linear-gradient(90deg, #6bffa8, #22c55e)"
        : pct > 20
        ? "linear-gradient(90deg, #ffe066, #f5a623)"
        : "linear-gradient(90deg, #ff8787, #ef4444)";

    dom["score-value"].textContent = state.score;
    dom["coin-value"].textContent = state.coins;

    if (window.MultiplayerModule.getRole() === "student") {
      window.MultiplayerModule.updateStudentScore(state.score, state.coins);
    }
  }

  // ---------------- Feedback / effects ----------------
  function showFeedback(text, type) {
    dom["feedback-toast"].textContent = text;
    dom["feedback-toast"].className = "feedback-toast " + type;
    dom["feedback-toast"].classList.remove("hidden");
    setTimeout(() => dom["feedback-toast"].classList.add("hidden"), 900);
  }

  function spawnStarBurst() {
    const layer = dom["effect-layer"];
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    for (let i = 0; i < 14; i++) {
      const star = document.createElement("div");
      star.className = "star-particle";
      star.textContent = "⭐";
      const angle = Math.random() * Math.PI * 2;
      const dist = 100 + Math.random() * 180;
      star.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      star.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      star.style.left = centerX + "px";
      star.style.top = centerY + "px";
      layer.appendChild(star);
      setTimeout(() => star.remove(), 1100);
    }
  }

  function triggerScreenShake() {
    const container = dom["game-container"];
    container.classList.remove("screen-shake");
    void container.offsetWidth; // reflow untuk restart animasi
    container.classList.add("screen-shake");
    setTimeout(() => container.classList.remove("screen-shake"), 420);
  }

  // ---------------- On Next Question Event Trigger ----------------
  window.OnNextQuestion = function (questionIndex) {
    if (window.NPCModule && typeof window.NPCModule.switchOrSpawnAnimalVariety === "function") {
      window.NPCModule.switchOrSpawnAnimalVariety(questionIndex, islands);
    }
    if (window.WorldModule && typeof window.WorldModule.expandTreeDensityAndVariety === "function") {
      window.WorldModule.expandTreeDensityAndVariety(questionIndex);
    }
  };

  // ---------------- Quiz logic ----------------
  function openQuestionForIsland(islandIndex) {
    if (state.answeredIslands.has(islandIndex)) return;
    if (islandIndex >= state.questions.length) return;

    state.questionIndex = islandIndex;
    if (typeof window.OnNextQuestion === "function") {
      window.OnNextQuestion(islandIndex);
    }

    state.isQuestionOpen = true;
    const q = state.questions[islandIndex];
    dom["question-progress"].textContent = `Soal ${islandIndex + 1}/${state.questions.length}`;
    dom["question-text"].textContent = q.soal || q.question || q.pertanyaan;
    dom["answer-options"].innerHTML = "";

    q.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.className = "answer-btn";

      // Hapus imbuhan prefix opsi ('A. ', 'B. ', '1. ', dll) dari teks tombol
      const cleanedOpt = window.QuestionsModule
        ? window.QuestionsModule.cleanOptionText(opt)
        : String(opt).replace(/^(?:[A-Da-d0-9][.\)]\s*)+/g, "").trim();

      btn.textContent = cleanedOpt;
      btn.addEventListener("click", () => handleAnswer(islandIndex, idx, q, btn));
      dom["answer-options"].appendChild(btn);
    });

    dom["question-panel"].classList.remove("hidden");
  }

  function handleAnswer(islandIndex, chosenIdx, question, btnEl) {
    if (state.isGameOver) return;

    const allBtns = dom["answer-options"].querySelectorAll(".answer-btn");
    allBtns.forEach((b) => (b.disabled = true));

    // Evaluasi Jawaban (Pencocokan 3 cara sekaligus via QuestionsModule)
    let isCorrect = false;
    let userChoice = btnEl.textContent;
    let correctAnswer = question.correctIndex !== undefined ? question.correctIndex
                      : (question.correctAnswer !== undefined ? question.correctAnswer
                      : (question.jawaban !== undefined ? question.jawaban
                      : (question.kunci !== undefined ? question.kunci : 0)));

    if (window.QuestionsModule && typeof window.QuestionsModule.checkAnswer === "function") {
      const result = window.QuestionsModule.checkAnswer(question, chosenIdx, btnEl.textContent);
      isCorrect = result.isCorrect;
      userChoice = result.userClean;
      correctAnswer = result.systemKey;
    } else {
      isCorrect = chosenIdx === question.correctIndex;
    }

    // ── Debug Console Log (Sesuai Spesifikasi Instruktur) ──
    const itemSoal = question.soal || question.question || question.pertanyaan;
    console.log("Soal:", itemSoal);
    console.log("Jawaban Dipilih User:", userChoice);
    console.log("Kunci Jawaban di System:", correctAnswer);
    console.log("Hasil Cocok?:", isCorrect);

    if (isCorrect) {
      btnEl.classList.add("correct");
      state.score += 100;
      state.coins += 20;
      window.AudioModule.playPointSFX();
      spawnStarBurst();
      showFeedback("✅ Benar! +100 Skor & +20 Koin", "correct");

      // Persist coins after earning
      window.TownBuilderModule.saveCoins(state.coins);

      const bridge = bridges[islandIndex];
      if (bridge) {
        window.AudioModule.playBridgeSFX();
        window.WorldModule.openBridge(bridge);
      }
      state.answeredIslands.add(islandIndex);
    } else {
      btnEl.classList.add("wrong");
      // Highlight tombol kunci jawaban jika angka/indeks
      const highlightIdx = typeof correctAnswer === "number" ? correctAnswer : question.correctIndex;
      if (typeof highlightIdx === "number" && allBtns[highlightIdx]) {
        allBtns[highlightIdx].classList.add("correct");
      }
      state.hp = Math.max(0, state.hp - 20);
      window.AudioModule.playDamageSFX();
      triggerScreenShake();
      showFeedback("❌ Kurang tepat! -20 HP", "wrong");
    }

    updateHUD();

    setTimeout(() => {
      dom["question-panel"].classList.add("hidden");
      state.isQuestionOpen = false;

      if (state.hp <= 0) {
        triggerGameOver();
        return;
      }

      if (isCorrect && islandIndex === state.questions.length - 1) {
        triggerLevelComplete();
      }
    }, 1000);
  }

  function triggerGameOver() {
    state.isGameOver = true;
    window.AudioModule.stopBGM();
    window.AudioModule.playGameOverSFX();
    dom["final-score"].textContent = state.score;
    dom["final-coin"].textContent = state.coins;
    dom["gameover-modal"].classList.remove("hidden");
  }

  function triggerLevelComplete() {
    if (state.isLevelComplete) return;
    state.isLevelComplete = true;
    dom["lc-final-score"].textContent = state.score;
    dom["lc-final-coin"].textContent = state.coins;
    dom["levelcomplete-modal"].classList.remove("hidden");
  }

  // ---------------- Movement & camera ----------------
  function updatePlayerMovement(delta) {
    if (state.isGameOver || state.isQuestionOpen) return;

    const input = window.PlayerModule.getMoveInput();

    if (window.PhysicsModule) {
      window.PhysicsModule.updatePlayerPhysics(player, delta, input, state, islands);
    }

    checkIslandProximity();
    updateCamera();
  }

  function shortestAngleDelta(from, to) {
    let diff = (to - from) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  function getGroundYAtPosition(x, z) {
    let closest = islands[0];
    let closestDist = Infinity;
    islands.forEach((island) => {
      const d = Math.hypot(island.position.x - x, island.position.z - z);
      if (d < closestDist) {
        closestDist = d;
        closest = island;
      }
    });
    return closest.position.y;
  }

  function checkIslandProximity() {
    for (let i = 0; i < islands.length - 1; i++) {
      const island = islands[i];
      const dist = Math.hypot(player.position.x - island.position.x, player.position.z - island.position.z);
      if (dist < window.WorldModule.ISLAND_RADIUS * 1.1 && !state.answeredIslands.has(i) && !state.isQuestionOpen) {
        openQuestionForIsland(i);
      }
    }
  }

  function updateCamera() {
    const targetPos = new THREE.Vector3(
      player.position.x,
      player.position.y + 6,
      player.position.z + 11
    );
    camera.position.lerp(targetPos, 0.08);
    camera.lookAt(player.position.x, player.position.y + 1.5, player.position.z);
  }

  // ---------------- Main loop ----------------
  function gameLoop() {
    requestAnimationFrame(gameLoop);
    const delta = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.getElapsedTime();

    if (!state.isGameOver) {
      updatePlayerMovement(delta);
    }

    window.WorldModule.updateWorld(delta, elapsed);
    window.WorldModule.render();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
