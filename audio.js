/* =========================================================
   audio.js
   Sistem Audio Game Petualangan:
   1. Musik Menu Utama (`bgm.mp3`) - Diputar di Halaman Awal / Menu.
   2. Musik Gameplay (`game.mp3`) - Diputar saat Petualangan Dimulai.
   3. Fitur Autoplay Unlocker: Otomatis memutar musik begitu pemain
      mengklik/menyentuh layar pertama kali (Mematuhi Kebijakan Browser).
   4. Fitur Looping Terus-Menerus Otomatis (`loop = true`).
   5. Efek Suara (SFX) Poin, Kerusakan, Jembatan, Beli Dekorasi, Game Over.
   ========================================================= */

(function () {
  "use strict";

  let audioCtx = null;
  let masterGain = null;
  let sfxGain = null;
  let isMuted = false;

  // =========================================================
  // 🎵 LOKASI FILE MUSIK GAME ANDA DI CODINGAN:
  // - bgm.mp3  : Musik Halaman Awal / Menu Utama
  // - game.mp3 : Musik Gameplay saat Petualangan Dimulai
  // =========================================================
  let MENU_BGM_FILE = "bgm.mp3";
  let GAME_BGM_FILE = "game.mp3";

  let customAudio = null;
  let currentTrackType = null; // 'menu' | 'game'
  let userInteracted = false;

  function ensureContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.6;
      masterGain.connect(audioCtx.destination);

      sfxGain = audioCtx.createGain();
      sfxGain.gain.value = 0.55;
      sfxGain.connect(masterGain);
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function initAudioPlayer() {
    if (!customAudio) {
      customAudio = new Audio();
      customAudio.loop = true; // 🔄 MUSIK BERULANG TERUS-MENERUS (LOOPING OTOMATIS)
      customAudio.volume = 0.45;
    }
  }

  // ---------------- Autoplay Unlocker (Penting untuk Browser) ----------------
  function unlockAutoplayOnFirstInteraction() {
    if (userInteracted) return;
    userInteracted = true;
    ensureContext();

    if (customAudio && customAudio.paused && !isMuted) {
      customAudio.play().catch(() => {});
    } else if (!customAudio) {
      playMenuBGM();
    }
  }

  window.addEventListener("pointerdown", unlockAutoplayOnFirstInteraction, { passive: true });
  window.addEventListener("click", unlockAutoplayOnFirstInteraction, { passive: true });
  window.addEventListener("keydown", unlockAutoplayOnFirstInteraction, { passive: true });

  function playTone(freq, startTime, duration, type, gainNode, peakVol) {
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.exponentialRampToValueAtTime(peakVol, startTime + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(env);
    env.connect(gainNode);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  // -------------------- Pemutar Musik (Menu & Gameplay) --------------------

  /**
   * Memutar Musik Menu Utama (bgm.mp3) secara berulang.
   */
  function playMenuBGM() {
    ensureContext();
    initAudioPlayer();

    if (currentTrackType === "menu" && customAudio && !customAudio.paused) return;

    currentTrackType = "menu";
    customAudio.src = MENU_BGM_FILE;
    customAudio.loop = true;
    customAudio.muted = isMuted;

    const playPromise = customAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.log("Autoplay diblokir browser, musik akan memutar saat layar diklik:", err);
      });
    }
  }

  /**
   * Memutar Musik Gameplay Petualangan (game.mp3) secara berulang saat petualangan dimulai.
   */
  function playGameBGM() {
    ensureContext();
    initAudioPlayer();

    if (currentTrackType === "game" && customAudio && !customAudio.paused) return;

    currentTrackType = "game";
    customAudio.src = GAME_BGM_FILE;
    customAudio.loop = true;
    customAudio.muted = isMuted;

    const playPromise = customAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.log("Autoplay diblokir browser, musik akan memutar saat layar diklik:", err);
      });
    }
  }

  function startBGM() {
    if (currentTrackType === "game") {
      playGameBGM();
    } else {
      playMenuBGM();
    }
  }

  function stopBGM() {
    if (customAudio) {
      customAudio.pause();
      customAudio.currentTime = 0;
    }
    currentTrackType = null;
  }

  function setMusicFiles(menuFile, gameFile) {
    if (menuFile) MENU_BGM_FILE = menuFile;
    if (gameFile) GAME_BGM_FILE = gameFile;
  }

  // -------------------- Efek Suara (SFX) --------------------
  function playPointSFX() {
    ensureContext();
    if (isMuted) return;
    const now = audioCtx.currentTime;
    const notes = [587.33, 659.25, 739.99, 880.0];
    notes.forEach((freq, i) => {
      playTone(freq, now + i * 0.08, 0.22, "triangle", sfxGain, 0.5);
    });
  }

  function playDamageSFX() {
    ensureContext();
    if (isMuted) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.45, now + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(env);
    env.connect(sfxGain);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  function playBridgeSFX() {
    ensureContext();
    if (isMuted) return;
    const now = audioCtx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25];
    notes.forEach((freq, i) => {
      playTone(freq, now + i * 0.1, 0.35, "sine", sfxGain, 0.35);
    });
  }

  function playPurchaseSFX() {
    ensureContext();
    if (isMuted) return;
    const now = audioCtx.currentTime;
    playTone(392.0, now, 0.15, "square", sfxGain, 0.3);
    playTone(523.25, now + 0.1, 0.2, "square", sfxGain, 0.3);
  }

  function playGameOverSFX() {
    ensureContext();
    if (isMuted) return;
    const now = audioCtx.currentTime;
    const notes = [392.0, 349.23, 293.66, 220.0];
    notes.forEach((freq, i) => {
      playTone(freq, now + i * 0.22, 0.4, "sawtooth", sfxGain, 0.35);
    });
  }

  function toggleMute() {
    ensureContext();
    isMuted = !isMuted;
    masterGain.gain.setTargetAtTime(isMuted ? 0.0001 : 0.6, audioCtx.currentTime, 0.05);
    if (customAudio) {
      customAudio.muted = isMuted;
      if (!isMuted && customAudio.paused) {
        customAudio.play().catch(() => {});
      }
    }
    return isMuted;
  }

  function getMuted() {
    return isMuted;
  }

  window.AudioModule = {
    ensureContext,
    playMenuBGM,
    playGameBGM,
    startBGM,
    stopBGM,
    setMusicFiles,
    playPointSFX,
    playDamageSFX,
    playBridgeSFX,
    playPurchaseSFX,
    playGameOverSFX,
    toggleMute,
    getMuted
  };
})();
