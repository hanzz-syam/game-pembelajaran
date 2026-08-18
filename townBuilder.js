/* =========================================================
   townBuilder.js — Dream Home / Town Customization Edition
   Toko dekorasi kota impian: rumah, taman, ornamen klasik.
   Pemain membeli item dengan koin hasil kuis.
   Termasuk pendaftaran collider fisik presisi untuk setiap item.
   ========================================================= */

(function () {
  "use strict";

  // ─── Shop Catalogue ─────────────────────────────────────────
  const SHOP_ITEMS = [
    // --- Bangunan Rumah ---
    { id: "cottage",   name: "Rumah Mungil",         icon: "🏡", price: 180 },
    { id: "chimney",   name: "Cerobong Asap Klasik",  icon: "🏠", price: 130 },
    { id: "gazebo",    name: "Gazebo",                icon: "⛺", price: 160 },
    // --- Pohon & Tanaman ---
    { id: "palm",      name: "Pohon Palem Hias",      icon: "🌴", price:  70 },
    { id: "pine",      name: "Pohon Pinus Rindang",   icon: "🌲", price:  80 },
    { id: "garden",    name: "Taman Bunga Warna",     icon: "🌷", price:  75 },
    // --- Furnitur Taman ---
    { id: "bench",     name: "Bangku Taman",          icon: "🪑", price:  50 },
    { id: "lamp",      name: "Lampu Jalan Klasik",    icon: "🪔", price:  55 },
    { id: "fence",     name: "Pagar Kayu Taman",      icon: "🪵", price:  60 },
    // --- Ornamen Air ---
    { id: "fountain",  name: "Air Mancur",             icon: "⛲", price: 120 },
    { id: "pond",      name: "Kolam Ikan",             icon: "🐠", price: 140 },
    // --- Ornamen Spesial ---
    { id: "windmill",  name: "Kincir Angin Mini",      icon: "🏗️", price: 200 },
    { id: "clocktower",name: "Menara Jam Taman",       icon: "🕰️", price: 220 },
    { id: "pathway",   name: "Jalan Setapak Batu",     icon: "🪨", price:  90 }
  ];

  // ─── Mapping Path Model 3D (.glb) ───────────────────────────
  const SHOP_MODEL_PATHS = {
    cottage:    "/models/rumah_mungil.glb",
    chimney:    "/models/cerobong.glb",
    gazebo:     "/models/gazebo.glb",
    palm:       "/models/pohon_palem.glb",
    pine:       "/models/pohon_pinus.glb",
    garden:     "/models/taman_bunga.glb",
    bench:      "/models/bangku.glb",
    lamp:       "/models/lampu.glb",
    fence:      "/models/pagar.glb",
    fountain:   "/models/air_mancur.glb",
    pond:       "/models/kolam.glb",
    windmill:   "/models/kincir.glb",
    clocktower: "/models/menara_jam.glb",
    pathway:    "/models/jalan.glb"
  };

  let placedItems    = [];
  let placementSlots = [];
  let nextSlotIndex  = 0;
  const modelCache   = {};
  let gltfLoaderInstance = null;

  const STORAGE_KEY_DECO  = "dreamtown_decorations";
  const STORAGE_KEY_COINS = "dreamtown_coins";

  // ─── Placement grid ─────────────────────────────────────────
  function buildPlacementGrid(townIsland) {
    placementSlots = [];
    const radius = townIsland.userData.radius * 0.55;
    [5, 9, 13].forEach((count, rIdx, arr) => {
      const r = radius * ((rIdx + 1) / arr.length);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        placementSlots.push({
          x: Math.cos(angle) * r,
          z: Math.sin(angle) * r,
          used: false
        });
      }
    });
    nextSlotIndex = 0;
  }

  // ─── Dynamic GLTFLoader & Model Factory Helper ─────────────

  function resolveModelPath(path) {
    if (!path) return path;
    if (window.location.protocol === "file:" && path.startsWith("/")) {
      return path.substring(1);
    }
    return path;
  }

  function ensureGLTFLoader(callback) {
    if (typeof THREE.GLTFLoader !== "undefined") {
      if (!gltfLoaderInstance) gltfLoaderInstance = new THREE.GLTFLoader();
      callback(gltfLoaderInstance);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
    script.onload = () => {
      if (typeof THREE.GLTFLoader !== "undefined") {
        gltfLoaderInstance = new THREE.GLTFLoader();
        callback(gltfLoaderInstance);
      } else {
        callback(null);
      }
    };
    script.onerror = () => {
      console.error("[TownBuilder] Gagal memuat GLTFLoader.js dari CDN");
      callback(null);
    };
    document.head.appendChild(script);
  }

  function createMeshForItem(itemId, callback) {
    // 1. Cek cache memori (model sudah pernah di-load sebelumnya)
    if (modelCache[itemId]) {
      const clone = modelCache[itemId].clone(true);
      clone.traverse(child => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      callback(clone);
      return;
    }

    const fallbackProcedural = () => {
      const factory = MESH_FACTORY[itemId];
      if (factory) {
        callback(factory());
      } else {
        console.error(`[TownBuilder] Tidak ditemukan model maupun mesh prosedural untuk item '${itemId}'`);
        callback(null);
      }
    };

    // 2. Load langsung dari file GLB di SHOP_MODEL_PATHS
    const rawPath = SHOP_MODEL_PATHS[itemId];
    if (rawPath) {
      ensureGLTFLoader((loader) => {
        if (!loader) { fallbackProcedural(); return; }
        const resolvedPath = resolveModelPath(rawPath);
        loader.load(
          resolvedPath,
          (gltf) => {
            const sceneObj = gltf.scene;
            sceneObj.traverse(child => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            modelCache[itemId] = sceneObj;
            createMeshForItem(itemId, callback); // ambil dari cache
          },
          undefined,
          (err) => {
            console.warn(`[TownBuilder] File GLB '${rawPath}' gagal dimuat, pakai mesh prosedural.`, err);
            fallbackProcedural();
          }
        );
      });
      return;
    }

    // 3. Fallback prosedural jika tidak ada path GLB
    fallbackProcedural();
  }

  // ─── Persistence: Save / Load Decorations ──────────────────

  function saveDecorations() {
    try {
      const data = placedItems.map(p => ({
        id: p.id,
        slotX: p.slotX,
        slotZ: p.slotZ,
        rotY: p.rotY
      }));
      localStorage.setItem(STORAGE_KEY_DECO, JSON.stringify(data));
    } catch (e) {
      console.warn("[TownBuilder] Gagal menyimpan dekorasi:", e);
    }
  }

  function loadDecorations(townIslandRef) {
    const island = townIslandRef || (window.WorldModule ? window.WorldModule.getTownIsland() : null);
    if (!island) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY_DECO);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved) || saved.length === 0) return;

      // Rebuild placement grid if needed
      if (placementSlots.length === 0) {
        buildPlacementGrid(island);
      }

      saved.forEach(entry => {
        createMeshForItem(entry.id, (mesh) => {
          if (!mesh) return;

          // Model berbasis y=0, diletakkan tepat di atas permukaan rumput (y=0.7)
          const SURFACE_Y = 0.7;
          mesh.position.set(entry.slotX, SURFACE_Y, entry.slotZ);
          mesh.rotation.y = entry.rotY || 0;
          mesh.visible = true;
          mesh.traverse(child => { if (child.isMesh) child.visible = true; });
          island.add(mesh);

          // Register physics collider
          let createdCollider = null;
          if (window.PhysicsModule) {
            const posX = island.position.x + entry.slotX;
            const posY = island.position.y + SURFACE_Y;
            const posZ = island.position.z + entry.slotZ;
            const worldPos = new THREE.Vector3(posX, posY, posZ);
            createdCollider = registerColliderForItem(entry.id, worldPos);
          }

          placedItems.push({
            id: entry.id,
            mesh,
            collider: createdCollider,
            slotX: entry.slotX,
            slotZ: entry.slotZ,
            rotY: entry.rotY || 0
          });

          // Advance slot index to avoid overlap with future purchases
          nextSlotIndex = Math.min(nextSlotIndex + 1, placementSlots.length);
        });
      });

      console.log(`[TownBuilder] Dimuat ${saved.length} dekorasi tersimpan.`);
    } catch (e) {
      console.warn("[TownBuilder] Gagal memuat dekorasi:", e);
    }
  }

  function saveCoins(coins) {
    try { localStorage.setItem(STORAGE_KEY_COINS, String(coins)); } catch (e) { /* noop */ }
  }

  function loadCoins() {
    try {
      const val = localStorage.getItem(STORAGE_KEY_COINS);
      return val !== null ? parseInt(val, 10) : 0;
    } catch (e) { return 0; }
  }

  // ─── Collider Registration Helper ─────────────────────────

  function registerColliderForItem(itemId, worldPos) {
    if (!window.PhysicsModule) return null;
    switch (itemId) {
      case "cottage":     return window.PhysicsModule.registerCollider({ type: "box",      position: worldPos, size: new THREE.Vector3(1.8, 1.6, 1.4) });
      case "chimney":     return window.PhysicsModule.registerCollider({ type: "box",      position: worldPos, size: new THREE.Vector3(1.4, 1.6, 1.2) });
      case "gazebo":      return window.PhysicsModule.registerCollider({ type: "cylinder", position: worldPos, radius: 1.05, height: 2.2 });
      case "palm":
      case "pine":        return window.PhysicsModule.registerCollider({ type: "cylinder", position: worldPos, radius: 0.35, height: 2.2 });
      case "bench":       return window.PhysicsModule.registerCollider({ type: "box",      position: worldPos, size: new THREE.Vector3(1.0, 0.7, 0.6) });
      case "fence":       return window.PhysicsModule.registerCollider({ type: "box",      position: worldPos, size: new THREE.Vector3(2.4, 0.85, 0.3) });
      case "fountain":    return window.PhysicsModule.registerCollider({ type: "cylinder", position: worldPos, radius: 0.95, height: 1.2 });
      case "pond":        return window.PhysicsModule.registerCollider({ type: "cylinder", position: worldPos, radius: 0.9, height: 0.4 });
      case "windmill":    return window.PhysicsModule.registerCollider({ type: "cylinder", position: worldPos, radius: 0.5, height: 2.5 });
      case "clocktower":  return window.PhysicsModule.registerCollider({ type: "cylinder", position: worldPos, radius: 0.6, height: 3.5 });
      case "lamp":        return window.PhysicsModule.registerCollider({ type: "cylinder", position: worldPos, radius: 0.2, height: 2.0 });
      default:            return null;
    }
  }

  // ─── 3D Mesh Factories ──────────────────────────────────────

  function shadow(group) {
    group.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return group;
  }

  function mat(color, roughness = 0.75, metalness = 0, emissive = null, emissiveIntensity = 0) {
    const opts = { color, flatShading: true, roughness, metalness };
    if (emissive !== null) { opts.emissive = emissive; opts.emissiveIntensity = emissiveIntensity; }
    return new THREE.MeshStandardMaterial(opts);
  }

  /** 🏡 Rumah Mungil */
  function createCottageMesh() {
    const g = new THREE.Group();
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.4), mat(0xfff8ee)), {position: new THREE.Vector3(0, 0.6, 0)}));
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 1.35, 0.85, 4), mat(0xe05c3a));
    roof.position.y = 1.62;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.6, 0.06), mat(0x8b5e3c));
    door.position.set(0, 0.3, 0.73);
    g.add(door);
    [-0.55, 0.55].forEach(x => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.06), mat(0x88ccff, 0.1, 0.1));
      win.position.set(x, 0.72, 0.73);
      g.add(win);
    });
    return shadow(g);
  }

  /** 🏠 Cerobong Asap Klasik */
  function createChimneyMesh() {
    const g = new THREE.Group();
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.2), mat(0xf0e0c8)), {position: new THREE.Vector3(0, 0.5, 0)}));
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 1.05, 0.7, 4), mat(0x6d3b1e));
    roof.position.y = 1.35;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), mat(0xb04030));
    chimney.position.set(0.35, 1.8, 0.15);
    g.add(chimney);
    const smokeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.55, flatShading: true });
    [0, 0.2, 0.42].forEach((yOff, i) => {
      const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.12 + i * 0.05, 6, 5), smokeMat);
      smoke.position.set(0.35, 2.22 + yOff * 1.4, 0.15);
      g.add(smoke);
    });
    return shadow(g);
  }

  /** ⛺ Gazebo */
  function createGazeboMesh() {
    const g = new THREE.Group();
    g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 6), mat(0xd4b896)), {position: new THREE.Vector3(0, 0.05, 0)}));
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), mat(0xeee0c8));
      pillar.position.set(Math.cos(angle) * 0.8, 0.8, Math.sin(angle) * 0.8);
      g.add(pillar);
    }
    const roofCone = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.7, 6), mat(0xff7043));
    roofCone.position.y = 1.95;
    g.add(roofCone);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), mat(0xffd53e, 0.3, 0.4));
    tip.position.y = 2.38;
    g.add(tip);
    return shadow(g);
  }

  /** 🌴 Pohon Palem Hias */
  function createPalmMesh() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 2.0, 7), mat(0x9c7a4f));
    trunk.position.y = 1.0;
    trunk.rotation.z = 0.08;
    g.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, flatShading: true });
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.1, 5), leafMat);
      const angle = (i / 7) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.15, 2.0, Math.sin(angle) * 0.15);
      leaf.rotation.z = Math.PI / 2.3;
      leaf.rotation.y = angle;
      g.add(leaf);
    }
    return shadow(g);
  }

  /** 🌲 Pohon Pinus */
  function createPineMesh() {
    const g = new THREE.Group();
    g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 6), mat(0x7a5030)), {position: new THREE.Vector3(0, 0.45, 0)}));
    const leafMat = mat(0x2d7a3c);
    [0, 0.7, 1.35].forEach((yBase, i) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.75 - i * 0.18, 0.9, 7), leafMat);
      cone.position.y = 1.05 + yBase;
      g.add(cone);
    });
    return shadow(g);
  }

  /** 🌷 Taman Bunga */
  function createGardenMesh() {
    const g = new THREE.Group();
    const colors = [0xff6b9d, 0xffd166, 0xff8c69, 0xb388ff, 0x64dfdf];
    for (let i = 0; i < 6; i++) {
      const stemMat = mat(0x3fa34d);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 5), stemMat);
      const angle = (i / 6) * Math.PI * 2;
      stem.position.set(Math.cos(angle) * 0.38, 0.21, Math.sin(angle) * 0.38);
      g.add(stem);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 6), mat(colors[i % colors.length]));
      flower.position.set(Math.cos(angle) * 0.38, 0.44, Math.sin(angle) * 0.38);
      g.add(flower);
    }
    return shadow(g);
  }

  /** 🪑 Bangku Taman */
  function createBenchMesh() {
    const g = new THREE.Group();
    const woodMat = mat(0x8b5a2b);
    [-0.4, 0.4].forEach(x => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.55), woodMat);
      leg.position.set(x, 0.2, 0);
      g.add(leg);
    });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.08, 0.5), mat(0xc8905a));
    seat.position.y = 0.42;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.35, 0.07), mat(0xc8905a));
    back.position.set(0, 0.62, -0.22);
    g.add(back);
    return shadow(g);
  }

  /** 🪔 Lampu Jalan Klasik */
  function createLampMesh() {
    const g = new THREE.Group();
    const ironMat = mat(0x2c2c3e);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.8, 8), ironMat);
    pole.position.y = 0.9;
    g.add(pole);
    const curve = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.4, 6), ironMat);
    curve.position.set(0.18, 1.72, 0);
    curve.rotation.z = Math.PI / 6;
    g.add(curve);
    const headMat = mat(0xfff5b0, 0.2, 0.1, 0xffcc66, 0.7);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 7), headMat);
    head.position.set(0.3, 1.82, 0);
    g.add(head);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 8), mat(0x1a1a2e));
    shade.position.set(0.3, 2.0, 0);
    g.add(shade);
    return shadow(g);
  }

  /** 🪵 Pagar Kayu */
  function createFenceMesh() {
    const g = new THREE.Group();
    const woodMat = mat(0xb07840);
    [-0.6, 1.4].forEach(x => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.08), woodMat);
      rail.position.set(0, x < 0 ? 0.3 : 0.65, 0);
      g.add(rail);
    });
    for (let i = -1.0; i <= 1.0; i += 0.45) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.08), mat(0xc89050));
      plank.position.set(i, 0.42, 0);
      g.add(plank);
    }
    return shadow(g);
  }

  /** ⛲ Air Mancur */
  function createFountainMesh() {
    const g = new THREE.Group();
    const stoneMat = mat(0xc8c0b0);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x6cc5ff, flatShading: true, transparent: true, opacity: 0.82 });
    g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.35, 12), stoneMat), {position: new THREE.Vector3(0, 0.17, 0)}));
    g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.1, 12), waterMat), {position: new THREE.Vector3(0, 0.37, 0)}));
    g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.75, 8), stoneMat), {position: new THREE.Vector3(0, 0.62, 0)}));
    g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.2, 9, 7), waterMat), {position: new THREE.Vector3(0, 1.02, 0)}));
    return shadow(g);
  }

  /** 🐠 Kolam Ikan */
  function createPondMesh() {
    const g = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.15, 7, 16), mat(0xb0a090));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.15;
    g.add(rim);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x3ba8d8, flatShading: true, transparent: true, opacity: 0.78, roughness: 0.1 });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.12, 14), waterMat);
    water.position.y = 0.1;
    g.add(water);
    [[0.25, 0.2], [-0.28, 0], [0, -0.3]].forEach(([fx, fz]) => {
      const fish = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), mat(0xff8c3b));
      fish.position.set(fx, 0.14, fz);
      g.add(fish);
    });
    const lilyMat = mat(0x5db85d);
    const lily = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 8), lilyMat);
    lily.position.set(-0.2, 0.17, 0.2);
    g.add(lily);
    return shadow(g);
  }

  /** 🏗️ Kincir Angin Mini */
  function createWindmillMesh() {
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 2.2, 8), mat(0xe8d8b8));
    tower.position.y = 1.1;
    g.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 8), mat(0x7a3d1e));
    cap.position.y = 2.45;
    g.add(cap);
    const bladeColor = mat(0xd4b86a);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.06), bladeColor);
      const angle = (i / 4) * Math.PI * 2;
      blade.position.set(Math.cos(angle) * 0.4, 2.2 + Math.sin(angle) * 0.4, 0.06);
      blade.rotation.z = angle;
      g.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 8), mat(0x5a3010, 0.4, 0.3));
    hub.rotation.x = Math.PI / 2;
    hub.position.set(0, 2.2, 0.07);
    g.add(hub);
    return shadow(g);
  }

  /** 🕰️ Menara Jam Taman */
  function createClockTowerMesh() {
    const g = new THREE.Group();
    const stoneMat = mat(0xe4d8c0);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.55, 3.0, 8), stoneMat);
    body.position.y = 1.5;
    g.add(body);
    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 14), mat(0xfff4b8, 0.3));
    clockFace.rotation.x = Math.PI / 2;
    clockFace.position.set(0, 2.4, 0.5);
    g.add(clockFace);
    const handH = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.04), mat(0x111111));
    handH.position.set(0, 2.5, 0.56);
    g.add(handH);
    const handM = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.04), mat(0x333333));
    handM.rotation.z = Math.PI / 4;
    handM.position.set(-0.1, 2.45, 0.56);
    g.add(handM);
    const topMat = mat(0x4a6ea8, 0.4, 0.2);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 8), topMat);
    roof.position.y = 3.45;
    g.add(roof);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), mat(0xffd53e, 0.2, 0.5));
    star.position.y = 4.0;
    g.add(star);
    return shadow(g);
  }

  /** 🪨 Jalan Setapak Batu */
  function createPathwayMesh() {
    const g = new THREE.Group();
    const stoneMat = mat(0xb8b0a0);
    const accentMat = mat(0xd8d0c0);
    const positions = [[0,0],[-0.3,0.4],[0.2,0.8],[-0.15,1.2],[0.1,1.6]];
    positions.forEach(([x, z], i) => {
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.42 + Math.random()*0.1, 0.08, 0.38 + Math.random()*0.1), i % 2 === 0 ? stoneMat : accentMat);
      stone.position.set(x, 0.04, z - 0.8);
      stone.rotation.y = Math.random() * 0.3;
      g.add(stone);
    });
    return shadow(g);
  }

  // ─── Factory map ────────────────────────────────────────────
  const MESH_FACTORY = {
    cottage:    createCottageMesh,
    chimney:    createChimneyMesh,
    gazebo:     createGazeboMesh,
    palm:       createPalmMesh,
    pine:       createPineMesh,
    garden:     createGardenMesh,
    bench:      createBenchMesh,
    lamp:       createLampMesh,
    fence:      createFenceMesh,
    fountain:   createFountainMesh,
    pond:       createPondMesh,
    windmill:   createWindmillMesh,
    clocktower: createClockTowerMesh,
    pathway:    createPathwayMesh
  };

  // ─── Purchase logic & Physics Collider Registration ─────────────
  function purchaseItem(itemId, currentCoins) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return { success: false, message: "Item tidak ditemukan.", coins: currentCoins };
    if (currentCoins < item.price) return { success: false, message: "🪙 Koin tidak cukup!", coins: currentCoins };

    const townIsland = window.WorldModule ? window.WorldModule.getTownIsland() : null;
    if (!townIsland) return { success: false, message: "Pulau kota belum siap!", coins: currentCoins };

    // Auto-rebuild placement grid if empty
    if (placementSlots.length === 0) {
      buildPlacementGrid(townIsland);
    }

    // Reset slot index if all slots are used (allow re-use)
    if (nextSlotIndex >= placementSlots.length) {
      nextSlotIndex = 0;
      placementSlots.forEach(s => (s.used = false));
    }

    const slot = placementSlots[nextSlotIndex++];
    slot.used = true;

    const SURFACE_Y = 0.7;
    const rotY = Math.random() * Math.PI * 2;

    createMeshForItem(itemId, (mesh) => {
      if (!mesh) return;

      mesh.position.set(slot.x, SURFACE_Y, slot.z);
      mesh.rotation.y = rotY;
      townIsland.add(mesh);

      mesh.visible = true;
      mesh.traverse(child => { if (child.isMesh) child.visible = true; });

      // ── Spawn bounce animation ──
      mesh.scale.setScalar(0.01);
      const spawnStart = performance.now();
      const spawnDuration = 500;
      function animateSpawn() {
        const elapsed = performance.now() - spawnStart;
        const t = Math.min(elapsed / spawnDuration, 1);
        const s = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 2.5);
        mesh.scale.setScalar(Math.max(0.01, Math.min(s, 1.15)));
        if (t < 1) requestAnimationFrame(animateSpawn);
        else mesh.scale.setScalar(1.0);
      }
      animateSpawn();

      // Hitung posisi world untuk Physics Collider
      const posX = townIsland.position.x + slot.x;
      const posY = townIsland.position.y + SURFACE_Y;
      const posZ = townIsland.position.z + slot.z;

      // Registrasi Collider via helper
      let createdCollider = null;
      if (window.PhysicsModule) {
        const worldPos = new THREE.Vector3(posX, posY, posZ);
        createdCollider = registerColliderForItem(itemId, worldPos);
      }

      placedItems.push({
        id: itemId,
        mesh,
        collider: createdCollider,
        slotX: slot.x,
        slotZ: slot.z,
        rotY: rotY
      });

      // ── Auto-save dekorasi ke localStorage ──
      saveDecorations();
    });

    const newCoins = currentCoins - item.price;
    saveCoins(newCoins);

    return {
      success: true,
      message: `✨ ${item.name} berhasil dipasang di kota impianmu!`,
      coins: newCoins
    };
  }

  function getShopItems()       { return SHOP_ITEMS; }
  function getPlacedItemCount() { return placedItems.length; }

  function resetTown() {
    placedItems.forEach(p => {
      if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
      if (p.collider && window.PhysicsModule) window.PhysicsModule.unregisterCollider(p.collider);
    });
    placedItems   = [];
    nextSlotIndex = 0;
    placementSlots.forEach(s => (s.used = false));

    // Hapus data tersimpan dari localStorage
    try {
      localStorage.removeItem(STORAGE_KEY_DECO);
      localStorage.removeItem(STORAGE_KEY_COINS);
    } catch (e) { /* noop */ }
  }

  window.TownBuilderModule = {
    SHOP_ITEMS,
    SHOP_MODEL_PATHS,
    buildPlacementGrid,
    purchaseItem,
    getShopItems,
    getPlacedItemCount,
    resetTown,
    saveDecorations,
    loadDecorations,
    saveCoins,
    loadCoins
  };
})();
