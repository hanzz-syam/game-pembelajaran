/* =========================================================
   world.js - HD Animal Jam Edition
   Membangun scene Three.js HD:
   - Pencahayaan lembut, bayangan halus (PCFSoftShadowMap)
   - Pulau langit pastel berlapis rumput mekar, jamur raksasa, kristal berkilau
   - Awan HD melayang & partikel keajaiban (sparkles)
   - Integrasi NPC hewan mengembara (Idle Wandering AI)
   - Pendaftaran fisik Ground Raycast & Collider Obstacle
   ========================================================= */

(function () {
  "use strict";

  let scene, camera, renderer, clock;
  let islands = [];
  let bridges = [];
  let clouds = [];
  let sparkles = [];
  let rainbowMesh = null;
  let ambientLight, sunLight, hemiLight;
  let townIsland = null;

  const ISLAND_SPACING = 28;
  const ISLAND_RADIUS = 9;

  function initRenderer(canvas) {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    // r128 compatibility: use outputEncoding (not outputColorSpace which is r152+)
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    return renderer;
  }

  function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7ed0ff);
    scene.fog = new THREE.FogExp2(0xbbe3ff, 0.007);

    camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );
    camera.position.set(0, 9, 16);

    clock = new THREE.Clock();

    if (window.PhysicsModule) {
      window.PhysicsModule.clearGroundMeshes();
      window.PhysicsModule.clearColliders();
    }

    setupLights();
    buildSkyIslandChain(window.QuestionsModule.getQuestionCount());
    buildClouds();
    buildSkySparkles();
    buildRainbow();

    window.addEventListener("resize", onWindowResize);

    return { scene, camera, renderer, clock };
  }

  function setupLights() {
    ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xfff5d6, 1.45);
    sunLight.position.set(25, 40, 15);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.bias = -0.0015;
    scene.add(sunLight);

    hemiLight = new THREE.HemisphereLight(0xb5e2ff, 0x76c873, 0.55);
    scene.add(hemiLight);
  }

  // ---------------- Animal Jam Style Props ----------------

  function createGiantMushroom(x, y, z, scale = 1, capColor = 0xff5e7e) {
    const group = new THREE.Group();

    const stemGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.2, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xfffdf5, flatShading: true, roughness: 0.7 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.6;
    stem.castShadow = true;
    group.add(stem);

    const capGeo = new THREE.SphereGeometry(0.75, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const capMat = new THREE.MeshStandardMaterial({ color: capColor, flatShading: true, roughness: 0.5 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 1.15;
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);

    const spotGeo = new THREE.SphereGeometry(0.1, 6, 6);
    const spotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const spot = new THREE.Mesh(spotGeo, spotMat);
      const angle = (i / 5) * Math.PI * 2;
      spot.position.set(Math.cos(angle) * 0.45, 1.35 + Math.random() * 0.1, Math.sin(angle) * 0.45);
      group.add(spot);
    }

    group.scale.setScalar(scale);
    group.position.set(x, y, z);
    return group;
  }

  function createCrystalCluster(x, y, z, color = 0x48e5c2) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.35,
      flatShading: true,
      roughness: 0.2,
      metalness: 0.3
    });

    const crystalCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < crystalCount; i++) {
      const height = 0.8 + Math.random() * 0.7;
      const radius = 0.15 + Math.random() * 0.1;
      const geo = new THREE.ConeGeometry(radius, height, 5);
      const crystal = new THREE.Mesh(geo, mat);
      crystal.position.set((Math.random() - 0.5) * 0.4, height / 2, (Math.random() - 0.5) * 0.4);
      crystal.rotation.x = (Math.random() - 0.5) * 0.4;
      crystal.rotation.z = (Math.random() - 0.5) * 0.4;
      crystal.castShadow = true;
      group.add(crystal);
    }

    group.position.set(x, y, z);
    return group;
  }

  function createFlowerPatch(x, y, z) {
    const group = new THREE.Group();
    const flowerColors = [0xff6b8b, 0xffd166, 0xab83a1, 0x64dfdf];
    for (let i = 0; i < 6; i++) {
      const petalMat = new THREE.MeshStandardMaterial({
        color: flowerColors[Math.floor(Math.random() * flowerColors.length)],
        flatShading: true
      });
      const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12), petalMat);
      flower.position.set((Math.random() - 0.5) * 0.8, 0.12, (Math.random() - 0.5) * 0.8);
      group.add(flower);
    }
    group.position.set(x, y, z);
    return group;
  }

  function createLowPolyTreeCone(x, y, z) {
    const group = new THREE.Group();
    group.name = "Tree_Pine";
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.26, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x7c4e29, flatShading: true, roughness: 0.9 })
    );
    trunk.position.y = 0.6;
    trunk.castShadow = true;
    group.add(trunk);

    const leafColors = [0x52c77d, 0x3bb273, 0x76e096];
    const leafMat = new THREE.MeshStandardMaterial({
      color: leafColors[Math.floor(Math.random() * leafColors.length)],
      flatShading: true,
      roughness: 0.8
    });

    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.2 - i * 0.28, 1.4, 7), leafMat);
      cone.position.y = 1.35 + i * 0.9;
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);
    }
    group.position.set(x, y, z);
    return group;
  }

  function createOakTree(x, y, z) {
    const group = new THREE.Group();
    group.name = "Tree_Oak";

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 1.4, 7),
      new THREE.MeshStandardMaterial({ color: 0x6e4726, flatShading: true, roughness: 0.9 })
    );
    trunk.position.y = 0.7;
    trunk.castShadow = true;
    group.add(trunk);

    const oakColors = [0x55a630, 0x2b9348, 0x80b918, 0xaacc00];
    const leafMat = new THREE.MeshStandardMaterial({
      color: oakColors[Math.floor(Math.random() * oakColors.length)],
      flatShading: true,
      roughness: 0.8
    });

    const mainSphere = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), leafMat);
    mainSphere.position.y = 2.0;
    mainSphere.castShadow = true;
    mainSphere.receiveShadow = true;
    group.add(mainSphere);

    for (let i = 0; i < 3; i++) {
      const sub = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 1), leafMat);
      const angle = (i / 3) * Math.PI * 2;
      sub.position.set(Math.cos(angle) * 0.5, 1.8 + Math.random() * 0.4, Math.sin(angle) * 0.5);
      sub.castShadow = true;
      group.add(sub);
    }

    group.position.set(x, y, z);
    return group;
  }

  function createPalmTree(x, y, z) {
    const group = new THREE.Group();
    group.name = "Tree_Palm";

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x9c6644, flatShading: true, roughness: 0.85 });
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.18 - i * 0.02, 0.22 - i * 0.02, 0.5, 6), trunkMat);
      seg.position.set(Math.sin(i * 0.15) * 0.15, 0.25 + i * 0.45, 0);
      seg.rotation.z = -i * 0.05;
      seg.castShadow = true;
      group.add(seg);
    }

    const frondMat = new THREE.MeshStandardMaterial({ color: 0x38b000, flatShading: true, roughness: 0.7, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.4, 4), frondMat);
      frond.position.set(Math.cos(angle) * 0.6, 2.3, Math.sin(angle) * 0.6);
      frond.rotation.x = Math.PI / 3;
      frond.rotation.y = angle;
      frond.castShadow = true;
      group.add(frond);
    }

    group.position.set(x, y, z);
    return group;
  }

  function createFloweringTree(x, y, z) {
    const group = new THREE.Group();
    group.name = "Tree_Sakura";

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 1.3, 7),
      new THREE.MeshStandardMaterial({ color: 0x5c3d1e, flatShading: true, roughness: 0.9 })
    );
    trunk.position.y = 0.65;
    trunk.castShadow = true;
    group.add(trunk);

    const blossomColors = [0xff85a1, 0xffa4b6, 0xff70a6, 0xff9ebb];
    const blossomMat = new THREE.MeshStandardMaterial({
      color: blossomColors[Math.floor(Math.random() * blossomColors.length)],
      flatShading: true,
      roughness: 0.6
    });

    const top = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 1), blossomMat);
    top.position.y = 1.95;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    for (let i = 0; i < 4; i++) {
      const sub = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), blossomMat);
      const angle = (i / 4) * Math.PI * 2;
      sub.position.set(Math.cos(angle) * 0.55, 1.8, Math.sin(angle) * 0.55);
      sub.castShadow = true;
      group.add(sub);
    }

    group.position.set(x, y, z);
    return group;
  }

  function createTreeBySpecies(species, x, y, z) {
    switch (species) {
      case "oak":
        return createOakTree(x, y, z);
      case "palm":
        return createPalmTree(x, y, z);
      case "flowering":
      case "sakura":
        return createFloweringTree(x, y, z);
      case "pine":
      default:
        return createLowPolyTreeCone(x, y, z);
    }
  }

  const TREE_SPECIES = ["pine", "oak", "palm", "flowering"];

  function expandTreeDensityAndVariety(questionIndex) {
    if (!islands || !islands.length) return;

    const TREE_MIN_DIST = 8.0;   // Jarak aman minimum antar pohon/bangunan (8 unit)
    const MAX_ATTEMPTS = 30;     // Batas maksimum upaya penempatan per pohon

    islands.forEach((island, iIndex) => {
      if (island.userData.isTown) return;

      const rad = island.userData.radius || ISLAND_RADIUS;
      const GROUND_Y = 0.7;

      // Array penampung SEMUA posisi objek (pohon & prop) yang sudah ada
      const usedPositions = [];

      // Kumpulkan posisi semua objek existing di pulau ini
      island.traverse((child) => {
        if (child.name && (child.name.startsWith("Tree_") || child.name.startsWith("Prop_"))) {
          usedPositions.push({ x: child.position.x, z: child.position.z });
        }
      });

      const extraTreeCount = 1 + Math.floor(Math.random() * 2);

      for (let k = 0; k < extraTreeCount; k++) {
        let placed = false;
        let tx, tz;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          const angle = Math.random() * Math.PI * 2;
          // Sebarkan ke area PINGGIRAN pulau (55% - 90% radius)
          const dist = rad * 0.55 + Math.random() * (rad * 0.35);
          tx = Math.cos(angle) * dist;
          tz = Math.sin(angle) * dist;

          // Jangan terlalu dekat pusat pulau (min 3.5 unit)
          if (Math.hypot(tx, tz) < 3.5) continue;

          // Jangan melewati tepi pulau
          if (Math.hypot(tx, tz) > rad * 0.92) continue;

          // Periksa jarak terhadap semua posisi yang sudah terpakai
          let tooClose = false;
          for (const used of usedPositions) {
            if (Math.hypot(tx - used.x, tz - used.z) < TREE_MIN_DIST) {
              tooClose = true;
              break;
            }
          }

          if (tooClose) continue;

          // Posisi valid — simpan dan keluar dari loop percobaan
          usedPositions.push({ x: tx, z: tz });
          placed = true;
          break;
        }

        if (!placed) {
          console.log(`[World] ❌ Pohon ke-${k + 1} di pulau ${iIndex} GAGAL ditempatkan (pulau padat).`);
          continue;
        }

        const species = TREE_SPECIES[Math.floor(Math.random() * TREE_SPECIES.length)];
        const treeMesh = createTreeBySpecies(species, tx, GROUND_Y, tz);

        treeMesh.scale.setScalar(0.01);
        island.add(treeMesh);

        if (window.PhysicsModule) {
          window.PhysicsModule.registerCollider({
            type: "cylinder",
            position: new THREE.Vector3(island.position.x + tx, island.position.y + GROUND_Y, island.position.z + tz),
            radius: 0.45,
            height: 2.6
          });
        }

        const startTime = performance.now();
        const duration = 600 + Math.random() * 400;
        function animateTreeGrowth() {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const s = Math.sin(progress * Math.PI * 0.5) * (1 + 0.15 * Math.sin(progress * Math.PI));
          treeMesh.scale.setScalar(Math.max(0.01, s));
          if (progress < 1) requestAnimationFrame(animateTreeGrowth);
          else treeMesh.scale.setScalar(1.0);
        }
        animateTreeGrowth();
      }
    });
  }

  function createCloud(x, y, z, scale) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95, transparent: true, opacity: 0.94 });
    const puffCount = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < puffCount; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.0 + Math.random() * 0.5, 8, 7), mat);
      puff.position.set((i - puffCount / 2) * 0.95, Math.random() * 0.35, Math.random() * 0.4);
      group.add(puff);
    }
    group.scale.setScalar(scale);
    group.position.set(x, y, z);
    group.userData = {
      driftSpeed: 0.2 + Math.random() * 0.3,
      driftRange: 8 + Math.random() * 8,
      baseX: x
    };
    return group;
  }

  function buildClouds() {
    clouds = [];
    for (let i = 0; i < 18; i++) {
      const x = (Math.random() - 0.5) * 160;
      const y = 16 + Math.random() * 16;
      const z = (Math.random() - 0.5) * 160;
      const cloud = createCloud(x, y, z, 1.1 + Math.random() * 0.8);
      clouds.push(cloud);
      scene.add(cloud);
    }
  }

  function buildSkySparkles() {
    sparkles = [];
    const geo = new THREE.OctahedronGeometry(0.18);
    const sparkleColors = [0xfff3b0, 0xabf7b1, 0x9bf6ff, 0xffc6ff];

    for (let i = 0; i < 35; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: sparkleColors[i % sparkleColors.length],
        emissive: sparkleColors[i % sparkleColors.length],
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.85
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 140,
        4 + Math.random() * 20,
        (Math.random() - 0.5) * 140
      );
      mesh.userData = {
        floatSpeed: 0.5 + Math.random() * 0.8,
        offset: Math.random() * Math.PI * 2
      };
      sparkles.push(mesh);
      scene.add(mesh);
    }
  }

  // ---------------- Pelangi Langit ----------------

  /**
   * Bangun pelangi melengkung indah di langit latar belakang.
   * Dibuat dari 7 lapisan TorusGeometry (cincin tipis) dengan warna spektrum.
   * Diposisikan jauh di belakang pulau agar tidak menghalangi UI.
   */
  function buildRainbow() {
    // 5 pita warna cerah pelangi (dikunci ke kamera agar selalu terlihat)
    const RAINBOW_COLORS = [
      0xff2020, // Merah
      0xffdd00, // Kuning
      0x00cc44, // Hijau
      0x2288ff, // Biru
      0xaa00ff  // Ungu
    ];

    const rainbowGroup = new THREE.Group();
    rainbowGroup.name = "Rainbow";

    const BASE_RADIUS = 18;
    const BAND_GAP = 2.0;
    const TUBE_RADIUS = 1.0;

    RAINBOW_COLORS.forEach((color, i) => {
      const radius = BASE_RADIUS - i * BAND_GAP;
      const geo = new THREE.TorusGeometry(radius, TUBE_RADIUS, 16, 100, Math.PI);
      const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide
      });
      const band = new THREE.Mesh(geo, mat);
      rainbowGroup.add(band);
    });

    // Posisi tetap di koordinat dunia — melengkung di atas latar pulau
    rainbowGroup.position.set(0, 8, -45);
    rainbowGroup.rotation.x = -Math.PI / 12;

    scene.add(rainbowGroup);
    rainbowMesh = rainbowGroup;
    console.log("Pelangi & Pohon berhasil ditata di Scene!");
    return rainbowGroup;
  }

  // ---------------- Sky Islands HD ----------------

  function createIsland(index, x, y, z, isTown) {
    const group = new THREE.Group();

    const rad = isTown ? ISLAND_RADIUS * 1.5 : ISLAND_RADIUS;

    // Badan pulau berlapis tanah & batu pastel
    const bodyGeo = new THREE.CylinderGeometry(rad, rad * 0.35, 4.5, 9, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x937254, flatShading: true, roughness: 0.9 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = -2.25;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Lapisan rumput mekar
    const grassColors = [0x8be37e, 0xa3ee96, 0x76d86b];
    const grassMat = new THREE.MeshStandardMaterial({
      color: isTown ? 0x9be887 : grassColors[index % grassColors.length],
      flatShading: true,
      roughness: 0.85
    });
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.7, 9), grassMat);
    grass.position.y = 0.35;
    grass.castShadow = true;
    grass.receiveShadow = true;
    group.add(grass);

    group.position.set(x, y, z);
    group.userData = {
      index: index,
      isTown: !!isTown,
      radius: rad,
      floatOffset: Math.random() * Math.PI * 2
    };

    // Registrasi Rumput Pulau sebagai Target Ground Raycast
    if (window.PhysicsModule) {
      window.PhysicsModule.registerGroundMesh(grass);
    }

    const GROUND_Y = 0.7;

    if (!isTown) {
      const placedProps = [];
      const MIN_DIST = 2.6;

      function canPlace(px, pz, radius = 1.0) {
        if (Math.hypot(px, pz) < 1.8) return false;

        for (const p of placedProps) {
          const dist = Math.hypot(px - p.x, pz - p.z);
          if (dist < MIN_DIST + (radius - 1.0)) return false;
        }
        return true;
      }

      // 1. Jamur Raksasa (Barat Laut)
      const mX = -rad * 0.5;
      const mZ = rad * 0.35;
      if (canPlace(mX, mZ, 1.2)) {
        placedProps.push({ x: mX, z: mZ, type: "mushroom" });
        const mColor = [0xff5e7e, 0xff99c8, 0xffc6ff, 0xffa447][index % 4];
        group.add(createGiantMushroom(mX, GROUND_Y, mZ, 1.0, mColor));
      }

      // 2. Kluster Kristal (Timur Laut)
      const cX = rad * 0.5;
      const cZ = -rad * 0.35;
      if (canPlace(cX, cZ, 1.0)) {
        placedProps.push({ x: cX, z: cZ, type: "crystal" });
        const cColor = [0x48e5c2, 0x7209b7, 0x4cc9f0, 0xf72585][index % 4];
        group.add(createCrystalCluster(cX, GROUND_Y, cZ, cColor));
      }

      // 3. Taman Bunga (Selatan)
      const fX = 0;
      const fZ = rad * 0.55;
      if (canPlace(fX, fZ, 0.8)) {
        placedProps.push({ x: fX, z: fZ, type: "flower" });
        group.add(createFlowerPatch(fX, GROUND_Y, fZ));
      }

      // 4. Pohon dengan Variasi Spesies (Sudut-sudut yang belum terisi)
      const treeAngles = [Math.PI * 0.85, -Math.PI * 0.35, -Math.PI * 0.85];
      treeAngles.forEach((angle, tidx) => {
        const r = rad * 0.58;
        const tx = Math.cos(angle) * r;
        const tz = Math.sin(angle) * r;
        if (canPlace(tx, tz, 1.1)) {
          const species = TREE_SPECIES[(index + tidx) % TREE_SPECIES.length];
          placedProps.push({ x: tx, z: tz, type: "tree" });
          group.add(createTreeBySpecies(species, tx, GROUND_Y, tz));
        }
      });

      // Registrasi Physics Collider
      if (window.PhysicsModule) {
        const worldGroundY = y + GROUND_Y;
        placedProps.forEach((prop) => {
          if (prop.type === "tree") {
            window.PhysicsModule.registerCollider({
              type: "cylinder",
              position: new THREE.Vector3(x + prop.x, worldGroundY, z + prop.z),
              radius: 0.4, height: 2.8
            });
          } else if (prop.type === "mushroom") {
            window.PhysicsModule.registerCollider({
              type: "cylinder",
              position: new THREE.Vector3(x + prop.x, worldGroundY, z + prop.z),
              radius: 0.5, height: 1.6
            });
          } else if (prop.type === "crystal") {
            window.PhysicsModule.registerCollider({
              type: "cylinder",
              position: new THREE.Vector3(x + prop.x, worldGroundY, z + prop.z),
              radius: 0.45, height: 1.3
            });
          }
        });
      }
    }

    scene.add(group);
    return group;
  }

  // ---------------- Jembatan Kuis ----------------

  function createBridge(fromIsland, toIsland) {
    const group = new THREE.Group();
    const dir = new THREE.Vector3().subVectors(toIsland.position, fromIsland.position);
    const length = dir.length() - ISLAND_RADIUS * 1.1;
    const midpoint = new THREE.Vector3().addVectors(fromIsland.position, toIsland.position).multiplyScalar(0.5);

    const plankMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, flatShading: true, roughness: 0.8 });
    const plank = new THREE.Mesh(new THREE.BoxGeometry(length, 0.35, 2.4), plankMat);
    plank.castShadow = true;
    plank.receiveShadow = true;
    plank.position.copy(midpoint);
    plank.position.y = fromIsland.position.y;
    plank.lookAt(toIsland.position.x, plank.position.y, toIsland.position.z);
    plank.rotation.y += Math.PI / 2;
    plank.scale.set(0.001, 1, 1);
    group.add(plank);

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xffb703,
      emissiveIntensity: 0.7,
      flatShading: true
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.24, 10, 26), ringMat);
    const portalPos = new THREE.Vector3().lerpVectors(fromIsland.position, toIsland.position, 0.12);
    ring.position.copy(portalPos);
    ring.position.y = fromIsland.position.y + 1.5;
    ring.lookAt(toIsland.position.x, ring.position.y, toIsland.position.z);
    group.add(ring);

    if (window.PhysicsModule) {
      window.PhysicsModule.registerGroundMesh(plank);
    }

    scene.add(group);

    return { group, plank, ring, opened: false, fromIsland, toIsland };
  }

  function openBridge(bridge) {
    if (!bridge || bridge.opened) return;
    bridge.opened = true;
    const start = performance.now();
    const duration = 900;
    function animateOpen() {
      const t = Math.min((performance.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      bridge.plank.scale.x = 0.001 + eased * 0.999;
      bridge.ring.rotation.z += 0.15;
      bridge.ring.material.emissiveIntensity = 0.7 + Math.sin(t * Math.PI) * 0.9;
      if (t < 1) requestAnimationFrame(animateOpen);
    }
    animateOpen();
  }

  function buildSkyIslandChain(questionCount) {
    islands = [];
    bridges = [];
    const count = Math.max(questionCount, 1);

    for (let i = 0; i < count; i++) {
      const x = i * ISLAND_SPACING;
      const y = 0 + Math.sin(i * 0.6) * 1.5;
      const z = Math.sin(i * 0.9) * 4;
      const island = createIsland(i, x, y, z, false);
      islands.push(island);
    }

    const lastIsland = islands[islands.length - 1];
    const townX = lastIsland.position.x + ISLAND_SPACING;
    const townY = lastIsland.position.y;
    const townZ = lastIsland.position.z + 2;
    townIsland = createIsland(count, townX, townY, townZ, true);
    islands.push(townIsland);

    for (let i = 0; i < islands.length - 1; i++) {
      bridges.push(createBridge(islands[i], islands[i + 1]));
    }

    if (window.NPCModule) {
      window.NPCModule.spawnNPCsOnIslands(islands);
    }

    return { islands, bridges, townIsland };
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function updateWorld(delta, elapsed) {
    islands.forEach((island) => {
      const offset = island.userData.floatOffset || 0;
      island.position.y += Math.sin(elapsed * 0.7 + offset) * 0.002;
    });

    clouds.forEach((cloud) => {
      cloud.position.x = cloud.userData.baseX + Math.sin(elapsed * 0.05 * cloud.userData.driftSpeed) * cloud.userData.driftRange;
    });

    sparkles.forEach((sparkle) => {
      sparkle.rotation.y += delta * sparkle.userData.floatSpeed;
      sparkle.position.y += Math.sin(elapsed * 1.5 + sparkle.userData.offset) * 0.008;
    });

    bridges.forEach((bridge) => {
      if (!bridge.opened) {
        bridge.ring.rotation.z += delta * 0.45;
      }
    });

    // Animasi pelangi: naik-turun lembut + denyut opacity ringan
    if (rainbowMesh) {
      rainbowMesh.userData.pulse = (rainbowMesh.userData.pulse || 0) + delta * 0.18;
      const sway = Math.sin(rainbowMesh.userData.pulse) * 0.35;
      rainbowMesh.position.y = rainbowMesh.userData.baseY + sway;
      rainbowMesh.children.forEach((band, i) => {
        if (band.material) {
          band.material.opacity = (0.52 - i * 0.015) + Math.sin(rainbowMesh.userData.pulse + i * 0.4) * 0.04;
        }
      });
    }

    if (window.NPCModule) {
      window.NPCModule.updateNPCs(delta, elapsed);
    }
  }

  function render() {
    renderer.render(scene, camera);
  }

  window.WorldModule = {
    initRenderer,
    initScene,
    updateWorld,
    render,
    openBridge,
    getScene: () => scene,
    getCamera: () => camera,
    getRenderer: () => renderer,
    getClock: () => clock,
    getIslands: () => islands,
    getBridges: () => bridges,
    getTownIsland: () => townIsland,
    createLowPolyTreeCone,
    createOakTree,
    createPalmTree,
    createFloweringTree,
    createTreeBySpecies,
    expandTreeDensityAndVariety,
    ISLAND_RADIUS,
    ISLAND_SPACING
  };
})();
