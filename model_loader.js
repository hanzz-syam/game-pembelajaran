/* =========================================================
   model_loader.js
   Memuat semua file model .glb langsung dari folder models/
   menggunakan Three.js GLTFLoader. Tidak menggunakan Base64
   dari models_data.js sama sekali.
   Pencahayaan AmbientLight & DirectionalLight sudah ada di
   world.js (setupLights), modul ini menambahkan model-model
   dekoratif ke scene utama saat game pertama kali dimulai.
   ========================================================= */

(function () {
  "use strict";

  /* ----------------------------------------------------------------
     Daftar semua model GLB yang akan dimuat saat game start.
     key      : nama kunci unik
     path     : path relatif ke file GLB di folder models/
     scale    : skala seragam
     positions: array [{x,y,z,ry?}] posisi instance relatif ke
                town island. ry = rotasi Y dalam radian (opsional).
  ---------------------------------------------------------------- */
  /*
   * CATATAN: rumah_mungil.glb SENGAJA tidak ada di sini.
   * Rumah HANYA dimuat & ditampilkan ketika pemain membeli
   * item "Rumah Mungil" (id: "cottage") di toko (TownBuilderModule).
   * Jangan tambahkan rumah_mungil ke daftar ini.
   */
  var MODEL_DEFINITIONS = [
    {
      key: "air_mancur",
      path: "models/air_mancur.glb",
      scale: 1.8,
      positions: [{ x: 0, y: 0, z: 0 }]
    },
    {
      key: "bangku",
      path: "models/bangku.glb",
      scale: 1.3,
      positions: [
        { x:  3.5, y: 0, z:  3, ry: 0.4 },
        { x: -3.5, y: 0, z:  3, ry: -0.4 }
      ]
    },
    {
      key: "cerobong",
      path: "models/cerobong.glb",
      scale: 1.1,
      positions: [{ x: -5, y: 0, z: -4 }]
    },
    {
      key: "gazebo",
      path: "models/gazebo.glb",
      scale: 1.5,
      positions: [{ x: 6.5, y: 0, z: -5 }]
    },
    {
      key: "jalan",
      path: "models/jalan.glb",
      scale: 2.0,
      positions: [
        { x: 0, y: 0, z:  4 },
        { x: 0, y: 0, z:  0 },
        { x: 0, y: 0, z: -4 }
      ]
    },
    {
      key: "kincir",
      path: "models/kincir.glb",
      scale: 1.5,
      positions: [{ x: -7, y: 0, z: 5 }]
    },
    {
      key: "kolam",
      path: "models/kolam.glb",
      scale: 1.5,
      positions: [{ x: 5.5, y: 0, z: 5.5 }]
    },
    {
      key: "lampu",
      path: "models/lampu.glb",
      scale: 1.3,
      positions: [
        { x:  5,   y: 0, z:  0 },
        { x: -5,   y: 0, z:  0 },
        { x:  0,   y: 0, z:  7 },
        { x:  0,   y: 0, z: -7 }
      ]
    },
    {
      key: "menara_jam",
      path: "models/menara_jam.glb",
      scale: 1.8,
      positions: [{ x: 0, y: 0, z: -8 }]
    },
    {
      key: "pagar",
      path: "models/pagar.glb",
      scale: 1.2,
      positions: [
        { x:  8, y: 0, z: 0 },
        { x: -8, y: 0, z: 0 }
      ]
    },
    {
      key: "pohon_palem",
      path: "models/pohon_palem.glb",
      scale: 1.4,
      positions: [
        { x:  7, y: 0, z:  7 },
        { x: -7, y: 0, z:  7 },
        { x:  7, y: 0, z: -7 },
        { x: -7, y: 0, z: -7 }
      ]
    },
    {
      key: "pohon_pinus",
      path: "models/pohon_pinus.glb",
      scale: 1.3,
      positions: [
        { x:  9, y: 0, z:  2 },
        { x: -9, y: 0, z: -2 }
      ]
    },
    {
      key: "taman_bunga",
      path: "models/taman_bunga.glb",
      scale: 1.4,
      positions: [
        { x:  3, y: 0, z: 6.5 },
        { x: -3, y: 0, z: 6.5 }
      ]
    }
  ];

  var _loader      = null;
  var _scene       = null;
  var _basePos     = { x: 0, y: 0, z: 0 };
  var _loadedCount = 0;
  var _totalCount  = MODEL_DEFINITIONS.length;
  var _onComplete  = null;

  /* ---------- Pastikan GLTFLoader tersedia ---------- */
  function ensureLoader(cb) {
    if (_loader) { cb(_loader); return; }
    if (typeof THREE !== "undefined" && typeof THREE.GLTFLoader !== "undefined") {
      _loader = new THREE.GLTFLoader();
      console.log("[ModelLoader] GLTFLoader siap (sudah tersedia dari index.html).");
      cb(_loader);
      return;
    }
    console.log("[ModelLoader] Memuat GLTFLoader dari CDN...");
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
    s.onload = function () {
      if (typeof THREE.GLTFLoader !== "undefined") {
        _loader = new THREE.GLTFLoader();
        console.log("[ModelLoader] GLTFLoader dimuat dari CDN.");
        cb(_loader);
      } else {
        console.error("[ModelLoader] GLTFLoader gagal diinisialisasi.");
        cb(null);
      }
    };
    s.onerror = function () {
      console.error("[ModelLoader] Gagal mengambil GLTFLoader dari CDN.");
      cb(null);
    };
    document.head.appendChild(s);
  }

  /* ---------- Pastikan pencahayaan ada ---------- */
  function ensureLighting(sc) {
    var hasAmb = false, hasDir = false;
    sc.traverse(function (o) {
      if (o.isAmbientLight)     hasAmb = true;
      if (o.isDirectionalLight) hasDir = true;
    });
    if (!hasAmb) {
      var a = new THREE.AmbientLight(0xffffff, 0.85);
      a.name = "ml_ambient";
      sc.add(a);
      console.log("[ModelLoader] AmbientLight ditambahkan.");
    }
    if (!hasDir) {
      var d = new THREE.DirectionalLight(0xfff8e7, 1.4);
      d.position.set(30, 50, 20);
      d.castShadow = true;
      d.shadow.mapSize.set(2048, 2048);
      d.shadow.camera.left   = -60;
      d.shadow.camera.right  =  60;
      d.shadow.camera.top    =  60;
      d.shadow.camera.bottom = -60;
      d.shadow.bias = -0.001;
      d.name = "ml_directional";
      sc.add(d);
      console.log("[ModelLoader] DirectionalLight ditambahkan.");
    }
  }

  /* ---------- Upgrade material supaya terkena cahaya ---------- */
  function upgradeMaterials(obj) {
    obj.traverse(function (child) {
      if (!child.isMesh) return;
      child.castShadow    = true;
      child.receiveShadow = true;
      var mats = Array.isArray(child.material) ? child.material : [child.material];
      var upgraded = mats.map(function (mat) {
        if (!mat || !mat.isMeshBasicMaterial) return mat;
        var nm = new THREE.MeshStandardMaterial({
          color:     mat.color ? mat.color.clone() : new THREE.Color(0xcccccc),
          roughness: 0.75,
          metalness: 0.05
        });
        if (mat.map) nm.map = mat.map;
        return nm;
      });
      child.material = Array.isArray(child.material) ? upgraded : upgraded[0];
    });
  }

  /* ---------- Counter penyelesaian ---------- */
  function onModelDone() {
    _loadedCount++;
    console.log("[ModelLoader] " + _loadedCount + "/" + _totalCount + " model dimuat.");
    if (_loadedCount >= _totalCount) {
      console.log("[ModelLoader] ✅ Semua model GLB selesai dimuat!");
      if (_onComplete) _onComplete();
    }
  }

  // Offset permukaan pulau kota: rumput ada di group.y + 0.7
  // Model diposisikan relatif ke group.position, jadi tambahkan 0.7
  var GROUND_SURFACE_OFFSET = 0.7;

  /* ---------- Tempatkan model ke scene ---------- */
  function placeModel(prototype, def) {
    upgradeMaterials(prototype);
    def.positions.forEach(function (pos) {
      var clone = prototype.clone(true);

      /* Clone material supaya instance bisa berbeda warna/tekstur nanti */
      clone.traverse(function (child) {
        if (child.isMesh && child.material) {
          child.material = Array.isArray(child.material)
            ? child.material.map(function (m) { return m.clone(); })
            : child.material.clone();
        }
      });

      clone.scale.setScalar(def.scale || 1.0);

      /* Hitung bounding box agar bagian bawah model menyentuh permukaan */
      var bbox = new THREE.Box3().setFromObject(clone);
      var modelBottomY = bbox.min.y;  // titik terendah model (world space, belum dipindah)
      // Naikkan model agar kaki tepat di permukaan
      var snapY = GROUND_SURFACE_OFFSET - modelBottomY + pos.y;

      clone.position.set(
        _basePos.x + pos.x,
        _basePos.y + snapY,
        _basePos.z + pos.z
      );

      /* Rotasi Y opsional */
      if (pos.ry !== undefined) {
        clone.rotation.y = pos.ry;
      }

      clone.name = "glb_" + def.key + "_" + pos.x + "_" + pos.z;
      _scene.add(clone);
    });
    console.log("[ModelLoader] Ditempatkan: " + def.key + " (" + def.positions.length + " instance).");
  }

  /* ---------- Load langsung dari file .glb ---------- */
  function loadFromFile(loader, def) {
    var p = def.path;

    /* Untuk file:// protocol, hindari leading slash yang bermasalah di Windows */
    if (window.location.protocol === "file:" && p.charAt(0) === "/") {
      p = p.substring(1);
    }

    loader.load(
      p,
      function (gltf) {
        placeModel(gltf.scene, def);
        onModelDone();
      },
      function (xhr) {
        /* Progress opsional */
        if (xhr.total > 0) {
          var pct = ((xhr.loaded / xhr.total) * 100).toFixed(0);
          console.log("[ModelLoader] " + def.key + ": " + pct + "%");
        }
      },
      function (err) {
        console.error("[ModelLoader] ❌ Gagal load: " + p, err);
        onModelDone(); /* tetap lanjut agar counter tidak stuck */
      }
    );
  }

  /* ================================================================
     API PUBLIK
  ================================================================ */

  /**
   * loadAllModels(scene, townIsland, callback)
   * Muat semua model GLB dari folder models/ ke scene.
   * townIsland opsional — digunakan sebagai offset posisi pusat.
   */
  function loadAllModels(scene, townIsland, callback) {
    if (!scene) {
      console.error("[ModelLoader] Parameter 'scene' wajib diberikan.");
      if (callback) callback();
      return;
    }

    _scene       = scene;
    _onComplete  = callback || null;
    _loadedCount = 0;
    _totalCount  = MODEL_DEFINITIONS.length;

    /* Offset dari posisi town island */
    if (townIsland && townIsland.position) {
      _basePos = {
        x: townIsland.position.x,
        y: townIsland.position.y,
        z: townIsland.position.z
      };
    } else {
      _basePos = { x: 0, y: 0, z: 0 };
    }

    console.log("[ModelLoader] Memulai pemuatan " + MODEL_DEFINITIONS.length + " model GLB dari folder models/ ...");
    console.log("[ModelLoader] Base position:", _basePos);

    /* Tambah lampu jika belum ada */
    ensureLighting(scene);

    ensureLoader(function (loader) {
      if (!loader) {
        console.error("[ModelLoader] GLTFLoader tidak tersedia. Model tidak dimuat.");
        if (_onComplete) _onComplete();
        return;
      }
      /* Load semua model secara paralel */
      MODEL_DEFINITIONS.forEach(function (def) {
        loadFromFile(loader, def);
      });
    });
  }

  function getLoader() { return _loader; }

  window.ModelLoaderModule = {
    loadAllModels: loadAllModels,
    getLoader: getLoader
  };

  console.log("[ModelLoader] model_loader.js dimuat OK (mode: langsung dari file GLB).");
})();
