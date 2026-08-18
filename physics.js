/* =========================================================
   physics.js
   Sistem Fisika & Deteksi Tabrakan 3D Presisi Tinggi:
   1. High-Precision Multi-Raycast Ground Contact System
   2. Solid Environmental Collisions & Surface Sliding (Capsule vs Box/Cylinder)
   3. Void Fall & Safe Island Respawn Handling
   ========================================================= */

(function () {
  "use strict";

  const raycaster = new THREE.Raycaster();
  const downVector = new THREE.Vector3(0, -1, 0);

  // Registri objek fisika
  const groundMeshes = [];
  const obstacleColliders = [];

  // Parameter pemain (skala 0.62)
  const PLAYER_RADIUS = 0.45;
  const PLAYER_HEIGHT = 1.2;
  const PIVOT_OFFSET = 0.21; // Jarak dari posisi pivot pemain ke dasar sepatu bot (0.62 * 0.34 = 0.21)
  const GRAVITY = 20;

  // ---------------- Registri Objek Ground & Collider ----------------

  function registerGroundMesh(mesh) {
    if (mesh && !groundMeshes.includes(mesh)) {
      groundMeshes.push(mesh);
    }
  }

  function unregisterGroundMesh(mesh) {
    const idx = groundMeshes.indexOf(mesh);
    if (idx !== -1) groundMeshes.splice(idx, 1);
  }

  function clearGroundMeshes() {
    groundMeshes.length = 0;
  }

  /**
   * Mendaftarkan rintangan padat (Collider).
   * @param {Object} collider 
   *   - type: 'cylinder' | 'box'
   *   - position: THREE.Vector3
   *   - radius: number (jika cylinder)
   *   - height: number
   *   - min / max: THREE.Vector3 (jika box)
   *   - size: THREE.Vector3 (jika box)
   *   - refMesh: THREE.Object3D (opsional)
   */
  function registerCollider(collider) {
    if (collider && collider.position) {
      obstacleColliders.push(collider);
    }
    return collider;
  }

  function unregisterCollider(collider) {
    const idx = obstacleColliders.indexOf(collider);
    if (idx !== -1) obstacleColliders.splice(idx, 1);
  }

  function clearColliders() {
    obstacleColliders.length = 0;
  }

  // ---------------- Presisi Kontak Tanah (Multi-Raycasting) ----------------

  /**
   * Menghitung posisi Y tanah terakurat di bawah koordinat (x, z) menggunakan raycasting 5 titik (center + 4 probe kaki).
   */
  function getRaycastGroundY(x, currentY, z) {
    if (groundMeshes.length === 0) return null;

    // Probe 5 titik: Tengah, Depan, Belakang, Kiri, Kanan (jarak 0.2 unit dari tengah)
    const offsets = [
      [0, 0],
      [0.2, 0],
      [-0.2, 0],
      [0, 0.2],
      [0, -0.2]
    ];

    let highestHitY = -Infinity;
    let hitFound = false;

    const rayOriginY = currentY + 1.2; // Mulai raycast dari pinggang/dada pemain
    const rayFarDistance = 6.0;

    for (let i = 0; i < offsets.length; i++) {
      const probeX = x + offsets[i][0];
      const probeZ = z + offsets[i][1];
      const origin = new THREE.Vector3(probeX, rayOriginY, probeZ);

      raycaster.set(origin, downVector);
      raycaster.far = rayFarDistance;

      const intersects = raycaster.intersectObjects(groundMeshes, true);
      if (intersects.length > 0) {
        const hit = intersects[0];
        if (hit.point.y > highestHitY) {
          highestHitY = hit.point.y;
          hitFound = true;
        }
      }
    }

    return hitFound ? highestHitY : null;
  }

  // ---------------- Tabrakan Rintangan & Wall Sliding ----------------

  /**
   * Memeriksa dan mengoreksi pergerakan horizontal (dx, dz) terhadap seluruh collider rintangan.
   * Menerapkan fisika permukaan meluncur (surface sliding).
   */
  function resolveObstacleCollisions(currentPos, proposedX, proposedZ) {
    let finalX = proposedX;
    let finalZ = proposedZ;

    for (let pass = 0; pass < 2; pass++) { // 2 iterasi resolusi untuk kelancaran sudut
      for (const col of obstacleColliders) {
        if (!col || !col.position) continue;

        if (col.type === "cylinder") {
          const colX = col.position.x;
          const colZ = col.position.z;
          const colRad = col.radius || 0.5;

          // Cek jarak Y (jika pemain jauh di atas/bawah rintangan, abaikan)
          const colMinY = col.position.y - 0.2;
          const colMaxY = col.position.y + (col.height || 2.5);
          if (currentPos.y < colMinY || currentPos.y - PIVOT_OFFSET > colMaxY) continue;

          const distX = finalX - colX;
          const distZ = finalZ - colZ;
          const distSq = distX * distX + distZ * distZ;
          const minDist = PLAYER_RADIUS + colRad;

          if (distSq < minDist * minDist && distSq > 0.00001) {
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;

            // Normal kontak (dari pusat rintangan ke pemain)
            const nx = distX / dist;
            const nz = distZ / dist;

            // Dorong posisi keluar dari rintangan
            finalX += nx * overlap;
            finalZ += nz * overlap;
          }
        } else if (col.type === "box") {
          const colMinY = col.position.y - 0.2;
          const colMaxY = col.position.y + (col.size ? col.size.y : 2.0);
          if (currentPos.y < colMinY || currentPos.y - PIVOT_OFFSET > colMaxY) continue;

          const minX = (col.position.x - (col.size ? col.size.x / 2 : 1)) - PLAYER_RADIUS;
          const maxX = (col.position.x + (col.size ? col.size.x / 2 : 1)) + PLAYER_RADIUS;
          const minZ = (col.position.z - (col.size ? col.size.z / 2 : 1)) - PLAYER_RADIUS;
          const maxZ = (col.position.z + (col.size ? col.size.z / 2 : 1)) + PLAYER_RADIUS;

          if (finalX > minX && finalX < maxX && finalZ > minZ && finalZ < maxZ) {
            // Pemain di dalam bounding box yang diperluas -> cari sumbu kompresi terkecil
            const pushLeft = finalX - minX;
            const pushRight = maxX - finalX;
            const pushBack = finalZ - minZ;
            const pushFront = maxZ - finalZ;

            const minOverlap = Math.min(pushLeft, pushRight, pushBack, pushFront);

            if (minOverlap === pushLeft) finalX = minX;
            else if (minOverlap === pushRight) finalX = maxX;
            else if (minOverlap === pushBack) finalZ = minZ;
            else if (minOverlap === pushFront) finalZ = maxZ;
          }
        }
      }
    }

    return { x: finalX, z: finalZ };
  }

  // ---------------- Pembaruan Utama Fisika Pemain ----------------

  /**
   * Memproses pergerakan, gravitasi, raycast ground snap, tabrakan rintangan, dan respawn.
   */
  function updatePlayerPhysics(player, delta, input, state, islands) {
    if (!player || state.isGameOver || state.isQuestionOpen) return;

    // 1. Hitung vektor pergerakan input
    let moveX = 0;
    let moveZ = 0;
    if (input.forward) moveZ -= 1;
    if (input.backward) moveZ += 1;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;

    const isMoving = moveX !== 0 || moveZ !== 0;
    let proposedX = player.position.x;
    let proposedZ = player.position.z;

    if (isMoving) {
      const len = Math.hypot(moveX, moveZ);
      moveX /= len;
      moveZ /= len;

      proposedX += moveX * state.moveSpeed * delta;
      proposedZ += moveZ * state.moveSpeed * delta;

      // Rotasi pemain menghadap arah pergerakan
      const targetRotation = Math.atan2(moveX, moveZ);
      let diff = (targetRotation - state.playerRotationY) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      state.playerRotationY += diff * Math.min(delta * 12, 1);
      player.rotation.y = state.playerRotationY;
    }

    // 2. Terapkan Tabrakan Rintangan & Surface Sliding
    const correctedPos = resolveObstacleCollisions(player.position, proposedX, proposedZ);
    player.position.x = correctedPos.x;
    player.position.z = correctedPos.z;

    // 3. Raycast Ground Contact
    const groundYHit = getRaycastGroundY(player.position.x, player.position.y, player.position.z);

    // Loncat (Jump)
    if (input.jump && state.isGrounded) {
      state.velocityY = 6.8;
      state.isGrounded = false;
    }

    if (groundYHit !== null) {
      const targetSurfaceY = groundYHit + PIVOT_OFFSET;

      if (state.isGrounded) {
        // Saat berjalan di atas tanah: Kaki selalu menapak presisi tinggi (snap halus ke permukaan)
        player.position.y += (targetSurfaceY - player.position.y) * Math.min(delta * 20, 1);
        state.velocityY = 0;
      } else {
        // Saat melayang/jatuh di udara
        state.velocityY -= GRAVITY * delta;
        player.position.y += state.velocityY * delta;

        // Cek mendarat (landing)
        if (player.position.y <= targetSurfaceY && state.velocityY <= 0) {
          player.position.y = targetSurfaceY;
          state.velocityY = 0;
          state.isGrounded = true;
        }
      }
    } else {
      // Tidak ada tanah di bawah kaki (pemain di atas void/jurang)
      state.isGrounded = false;
      state.velocityY -= GRAVITY * delta;
      player.position.y += state.velocityY * delta;
    }

    // 4. Deteksi Jatuh ke Jurang / Void Respawn Handling
    if (player.position.y < -25) {
      // Temukan pulau terdekat untuk respawn aman
      let safeIsland = islands && islands.length ? islands[0] : null;
      let minD = Infinity;
      if (islands) {
        islands.forEach((isl) => {
          const d = Math.hypot(isl.position.x - player.position.x, isl.position.z - player.position.z);
          if (d < minD) {
            minD = d;
            safeIsland = isl;
          }
        });
      }

      if (safeIsland) {
        player.position.set(safeIsland.position.x, safeIsland.position.y + 3.0, safeIsland.position.z);
      } else {
        player.position.set(0, 5, 0);
      }

      state.velocityY = 0;
      state.isGrounded = false;

      // Kurangi HP karena jatuh ke jurang
      state.hp = Math.max(0, state.hp - 15);
      if (window.AudioModule) window.AudioModule.playDamageSFX();
    }

    // 5. Animasi karakter
    if (window.PlayerModule && window.PlayerModule.animatePlayer) {
      window.PlayerModule.animatePlayer(player, delta, isMoving && state.isGrounded);
    }
  }

  window.PhysicsModule = {
    registerGroundMesh,
    unregisterGroundMesh,
    clearGroundMeshes,
    registerCollider,
    unregisterCollider,
    clearColliders,
    getRaycastGroundY,
    resolveObstacleCollisions,
    updatePlayerPhysics,
    getGroundMeshes: () => groundMeshes,
    getColliders: () => obstacleColliders
  };
})();
