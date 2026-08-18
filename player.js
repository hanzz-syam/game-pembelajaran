/* =========================================================
   player.js
   Karakter 3D prosedural bergaya blok bersih (Roblox-like),
   presisi sesuai deskripsi:
   - Anak laki-laki, kepala besar, rambut hitam
   - Headset biru besar di telinga
   - Kacamata pilot/goggles kuning-emas di dahi
   - Jumpsuit lengan panjang biru muda
   - Sabuk cokelat + buckle emas
   - Ransel cokelat di punggung
   - Sepatu bot kuning-cokelat, alas gelap
   Juga menangani input gerak (keyboard + D-pad sentuh) dan animasi.
   ========================================================= */

(function () {
  "use strict";

  const COLORS = {
    skin: 0xffd7ad,
    hair: 0x1a1a1a,
    headset: 0x2f7fd6,
    headsetDark: 0x1c5aa3,
    goggleFrame: 0xe0a800,
    goggleLens: 0xfff3b0,
    jumpsuit: 0xaee0ff,
    jumpsuitDark: 0x8fd0f5,
    belt: 0x6b4226,
    buckle: 0xffd700,
    backpack: 0x7a4a24,
    backpackDark: 0x5e3819,
    boot: 0xc98a3c,
    bootSole: 0x2b2320,
    glove: 0xffd7ad
  };

  function box(w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function cyl(rt, rb, h, color, seg) {
    const geo = new THREE.CylinderGeometry(rt, rb, h, seg || 8);
    const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function createPlayer() {
    const player = new THREE.Group();
    player.name = "PlayerCharacter";

    // ---------------- Torso (jumpsuit biru muda) ----------------
    const torsoGroup = new THREE.Group();
    torsoGroup.name = "torso";
    const torso = box(0.95, 1.05, 0.55, COLORS.jumpsuit);
    torso.position.y = 0;
    torsoGroup.add(torso);

    // Garis aksen jumpsuit
    const chestStripe = box(0.97, 0.14, 0.57, COLORS.jumpsuitDark);
    chestStripe.position.y = 0.15;
    torsoGroup.add(chestStripe);

    // Sabuk cokelat + buckle emas
    const belt = box(1.0, 0.16, 0.6, COLORS.belt);
    belt.position.y = -0.5;
    torsoGroup.add(belt);
    const buckle = box(0.22, 0.18, 0.06, COLORS.buckle);
    buckle.position.set(0, -0.5, 0.31);
    torsoGroup.add(buckle);

    // Ransel cokelat di punggung
    const backpack = box(0.65, 0.75, 0.35, COLORS.backpack);
    backpack.position.set(0, 0.05, -0.42);
    torsoGroup.add(backpack);
    const backpackPocket = box(0.4, 0.3, 0.12, COLORS.backpackDark);
    backpackPocket.position.set(0, -0.15, -0.62);
    torsoGroup.add(backpackPocket);
    const strapL = box(0.14, 0.8, 0.12, COLORS.backpackDark);
    strapL.position.set(-0.32, 0.1, -0.15);
    torsoGroup.add(strapL);
    const strapR = box(0.14, 0.8, 0.12, COLORS.backpackDark);
    strapR.position.set(0.32, 0.1, -0.15);
    torsoGroup.add(strapR);

    torsoGroup.position.y = 1.55;
    player.add(torsoGroup);

    // ---------------- Kepala besar ----------------
    const headGroup = new THREE.Group();
    headGroup.name = "head";

    const head = box(0.85, 0.8, 0.8, COLORS.skin);
    headGroup.add(head);

    // Rambut hitam (menutup atas & belakang kepala)
    const hairTop = box(0.9, 0.28, 0.85, COLORS.hair);
    hairTop.position.y = 0.42;
    headGroup.add(hairTop);
    const hairBack = box(0.87, 0.55, 0.2, COLORS.hair);
    hairBack.position.set(0, 0.18, -0.33);
    headGroup.add(hairBack);
    const hairFront = box(0.87, 0.14, 0.15, COLORS.hair);
    hairFront.position.set(0, 0.32, 0.36);
    headGroup.add(hairFront);

    // Mata sederhana (blok kecil)
    const eyeGeo = new THREE.BoxGeometry(0.09, 0.09, 0.04);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, flatShading: true });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.2, -0.02, 0.41);
    headGroup.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.2, -0.02, 0.41);
    headGroup.add(eyeR);

    // Mulut kecil (senyum sederhana)
    const mouth = box(0.22, 0.05, 0.04, 0xc06a5a);
    mouth.position.set(0, -0.24, 0.41);
    headGroup.add(mouth);

    // ---------------- Headset biru besar di telinga ----------------
    const headsetBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.07, 8, 16, Math.PI),
      new THREE.MeshStandardMaterial({ color: COLORS.headsetDark, flatShading: true })
    );
    headsetBand.rotation.z = Math.PI;
    headsetBand.rotation.x = Math.PI / 2;
    headsetBand.position.set(0, 0.55, 0);
    headGroup.add(headsetBand);

    const earCupGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.18, 12);
    const earCupMat = new THREE.MeshStandardMaterial({ color: COLORS.headset, flatShading: true, roughness: 0.4, metalness: 0.2 });
    const earCupL = new THREE.Mesh(earCupGeo, earCupMat);
    earCupL.rotation.z = Math.PI / 2;
    earCupL.position.set(-0.48, 0.02, 0);
    headGroup.add(earCupL);
    const earCupR = new THREE.Mesh(earCupGeo, earCupMat);
    earCupR.rotation.z = Math.PI / 2;
    earCupR.position.set(0.48, 0.02, 0);
    headGroup.add(earCupR);
    // Aksen tengah ear cup
    const earAccentGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.2, 10);
    const earAccentMat = new THREE.MeshStandardMaterial({ color: COLORS.headsetDark, flatShading: true });
    const earAccentL = new THREE.Mesh(earAccentGeo, earAccentMat);
    earAccentL.rotation.z = Math.PI / 2;
    earAccentL.position.set(-0.5, 0.02, 0);
    headGroup.add(earAccentL);
    const earAccentR = new THREE.Mesh(earAccentGeo, earAccentMat);
    earAccentR.rotation.z = Math.PI / 2;
    earAccentR.position.set(0.5, 0.02, 0);
    headGroup.add(earAccentR);

    // ---------------- Kacamata pilot/goggles kuning-emas di dahi ----------------
    const goggleGroup = new THREE.Group();
    const goggleFrameMat = new THREE.MeshStandardMaterial({ color: COLORS.goggleFrame, flatShading: true, roughness: 0.35, metalness: 0.4 });
    const goggleLensMat = new THREE.MeshStandardMaterial({ color: COLORS.goggleLens, flatShading: true, roughness: 0.2, metalness: 0.1, emissive: 0x554400, emissiveIntensity: 0.15 });

    const lensGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.1, 12);
    const lensL = new THREE.Mesh(lensGeo, goggleLensMat);
    lensL.rotation.x = Math.PI / 2;
    lensL.position.set(-0.19, 0.36, 0.42);
    goggleGroup.add(lensL);
    const lensR = new THREE.Mesh(lensGeo, goggleLensMat);
    lensR.rotation.x = Math.PI / 2;
    lensR.position.set(0.19, 0.36, 0.42);
    goggleGroup.add(lensR);

    const frameGeo = new THREE.TorusGeometry(0.19, 0.035, 8, 16);
    const frameL = new THREE.Mesh(frameGeo, goggleFrameMat);
    frameL.position.set(-0.19, 0.36, 0.42);
    goggleGroup.add(frameL);
    const frameR = new THREE.Mesh(frameGeo, goggleFrameMat);
    frameR.position.set(0.19, 0.36, 0.42);
    goggleGroup.add(frameR);

    const bridge = box(0.1, 0.05, 0.05, COLORS.goggleFrame);
    bridge.position.set(0, 0.36, 0.42);
    goggleGroup.add(bridge);

    const strapGeo = new THREE.TorusGeometry(0.44, 0.03, 6, 16, Math.PI);
    const goggleStrap = new THREE.Mesh(strapGeo, goggleFrameMat);
    goggleStrap.rotation.x = Math.PI / 2;
    goggleStrap.rotation.z = Math.PI;
    goggleStrap.position.set(0, 0.36, -0.05);
    goggleGroup.add(goggleStrap);

    headGroup.add(goggleGroup);

    headGroup.position.y = 2.55;
    player.add(headGroup);

    // ---------------- Lengan (panjang, jumpsuit biru muda) ----------------
    function createArm(side) {
      const armGroup = new THREE.Group();
      const upperArm = box(0.28, 0.55, 0.3, COLORS.jumpsuit);
      upperArm.position.y = -0.27;
      armGroup.add(upperArm);
      const lowerArm = box(0.25, 0.5, 0.27, COLORS.jumpsuit);
      lowerArm.position.y = -0.75;
      armGroup.add(lowerArm);
      const hand = box(0.24, 0.22, 0.24, COLORS.glove);
      hand.position.y = -1.05;
      armGroup.add(hand);
      armGroup.position.set(side === "left" ? -0.62 : 0.62, 1.95, 0);
      armGroup.name = side === "left" ? "armLeft" : "armRight";
      return armGroup;
    }
    const armLeft = createArm("left");
    const armRight = createArm("right");
    player.add(armLeft);
    player.add(armRight);

    // ---------------- Kaki (jumpsuit + boots kuning-cokelat) ----------------
    function createLeg(side) {
      const legGroup = new THREE.Group();
      const upperLeg = box(0.36, 0.55, 0.38, COLORS.jumpsuitDark);
      upperLeg.position.y = -0.27;
      legGroup.add(upperLeg);
      const lowerLeg = box(0.32, 0.45, 0.34, COLORS.jumpsuitDark);
      lowerLeg.position.y = -0.72;
      legGroup.add(lowerLeg);

      // Boot tinggi kuning-cokelat
      const bootShaft = box(0.36, 0.4, 0.4, COLORS.boot);
      bootShaft.position.y = -1.05;
      legGroup.add(bootShaft);
      const bootSole = box(0.4, 0.12, 0.5, COLORS.bootSole);
      bootSole.position.y = -1.28;
      legGroup.add(bootSole);

      legGroup.position.set(side === "left" ? -0.24 : 0.24, 1.0, 0);
      legGroup.name = side === "left" ? "legLeft" : "legRight";
      return legGroup;
    }
    const legLeft = createLeg("left");
    const legRight = createLeg("right");
    player.add(legLeft);
    player.add(legRight);

    player.userData = {
      parts: { torsoGroup, headGroup, armLeft, armRight, legLeft, legRight },
      walkTime: 0,
      isMoving: false
    };

    player.scale.setScalar(0.62);
    player.castShadow = true;

    return player;
  }

  // ---------------- Input & Movement ----------------

  const keysPressed = {};
  const touchState = { up: false, down: false, left: false, right: false, jump: false };

  function setupKeyboardInput() {
    window.addEventListener("keydown", (e) => {
      keysPressed[e.key.toLowerCase()] = true;
    });
    window.addEventListener("keyup", (e) => {
      keysPressed[e.key.toLowerCase()] = false;
    });
  }

  function setupTouchInput() {
    const dpadButtons = document.querySelectorAll(".dpad-btn");
    dpadButtons.forEach((btn) => {
      const dir = btn.dataset.dir;
      const setState = (val) => (e) => {
        e.preventDefault();
        touchState[dir] = val;
      };
      btn.addEventListener("touchstart", setState(true), { passive: false });
      btn.addEventListener("touchend", setState(false), { passive: false });
      btn.addEventListener("touchcancel", setState(false), { passive: false });
      btn.addEventListener("mousedown", setState(true));
      btn.addEventListener("mouseup", setState(false));
      btn.addEventListener("mouseleave", setState(false));
    });

    const jumpBtn = document.getElementById("btn-jump");
    if (jumpBtn) {
      const setJump = (val) => (e) => {
        e.preventDefault();
        touchState.jump = val;
      };
      jumpBtn.addEventListener("touchstart", setJump(true), { passive: false });
      jumpBtn.addEventListener("touchend", setJump(false), { passive: false });
      jumpBtn.addEventListener("mousedown", setJump(true));
      jumpBtn.addEventListener("mouseup", setJump(false));
    }
  }

  function getMoveInput() {
    const forward = keysPressed["w"] || keysPressed["arrowup"] || touchState.up;
    const backward = keysPressed["s"] || keysPressed["arrowdown"] || touchState.down;
    const left = keysPressed["a"] || keysPressed["arrowleft"] || touchState.left;
    const right = keysPressed["d"] || keysPressed["arrowright"] || touchState.right;
    const jump = keysPressed[" "] || touchState.jump;
    return { forward, backward, left, right, jump };
  }

  function animatePlayer(player, delta, isMoving) {
    const parts = player.userData.parts;
    if (isMoving) {
      player.userData.walkTime += delta * 8;
      const swing = Math.sin(player.userData.walkTime) * 0.5;
      parts.legLeft.rotation.x = swing;
      parts.legRight.rotation.x = -swing;
      parts.armLeft.rotation.x = -swing * 0.8;
      parts.armRight.rotation.x = swing * 0.8;
      parts.torsoGroup.position.y = 1.55 + Math.abs(Math.sin(player.userData.walkTime * 2)) * 0.04;
    } else {
      parts.legLeft.rotation.x *= 0.8;
      parts.legRight.rotation.x *= 0.8;
      parts.armLeft.rotation.x *= 0.8;
      parts.armRight.rotation.x *= 0.8;
      parts.torsoGroup.position.y += (1.55 - parts.torsoGroup.position.y) * 0.2;
    }
  }

  window.PlayerModule = {
    createPlayer,
    setupKeyboardInput,
    setupTouchInput,
    getMoveInput,
    animatePlayer
  };
})();
