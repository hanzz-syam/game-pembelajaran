/* =========================================================
   npc.js
   Autonomous Idle Wandering AI & Procedural 3D Animal NPCs
   Bergaya Animal Jam (Kelinci, Rubah, Panda, Beruang)
   Integrasi dengan Collider Fisik PhysicsModule
   ========================================================= */

(function () {
  "use strict";

  const NPC_TYPES = ["bunny", "deer", "fox", "cat", "dog", "panda", "bear"];

  const COLORS = {
    bunnyBody: 0xfff4e6,
    bunnyInnerEar: 0xffb7c5,
    foxBody: 0xff7b36,
    foxBelly: 0xffffff,
    foxEarTip: 0x2b2b2b,
    pandaBody: 0xffffff,
    pandaBlack: 0x222222,
    bearBody: 0x8b5a2b,
    bearBelly: 0xd2b48c,
    deerBody: 0xc88b4a,
    deerBelly: 0xfff8ee,
    deerAntler: 0x5c3d1e,
    catBody: 0x4a4e69,
    catInnerEar: 0xffcad4,
    dogBody: 0xe0a96d,
    dogEar: 0x8d5b4c,
    eye: 0x111111,
    nose: 0xff9999,
    blush: 0xffa0b4
  };

  function createMesh(geo, color, roughness = 0.7, metalness = 0.05) {
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      flatShading: true,
      roughness: roughness,
      metalness: metalness
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // ---------------- Procedural Animal Jam Style NPCs ----------------

  function createBunny() {
    const group = new THREE.Group();
    group.name = "NPC_Bunny";

    const body = createMesh(new THREE.SphereGeometry(0.45, 10, 8), COLORS.bunnyBody);
    body.position.y = 0.45;
    group.add(body);

    const head = createMesh(new THREE.SphereGeometry(0.38, 10, 8), COLORS.bunnyBody);
    head.position.y = 0.92;
    group.add(head);

    const earGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.55, 8);
    const earL = createMesh(earGeo, COLORS.bunnyBody);
    earL.position.set(-0.16, 1.4, 0);
    earL.rotation.z = -0.15;
    group.add(earL);

    const earR = createMesh(earGeo, COLORS.bunnyBody);
    earR.position.set(0.16, 1.4, 0);
    earR.rotation.z = 0.15;
    group.add(earR);

    const innerEarGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.45, 8);
    const innerEarL = createMesh(innerEarGeo, COLORS.bunnyInnerEar);
    innerEarL.position.set(-0.16, 1.4, 0.03);
    innerEarL.rotation.z = -0.15;
    group.add(innerEarL);

    const innerEarR = createMesh(innerEarGeo, COLORS.bunnyInnerEar);
    innerEarR.position.set(0.16, 1.4, 0.03);
    innerEarR.rotation.z = 0.15;
    group.add(innerEarR);

    const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const eyeL = createMesh(eyeGeo, COLORS.eye);
    eyeL.position.set(-0.13, 0.98, 0.32);
    group.add(eyeL);
    const eyeR = createMesh(eyeGeo, COLORS.eye);
    eyeR.position.set(0.13, 0.98, 0.32);
    group.add(eyeR);

    const nose = createMesh(new THREE.ConeGeometry(0.04, 0.05, 5), COLORS.nose);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.91, 0.37);
    group.add(nose);

    const blushGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const blushL = createMesh(blushGeo, COLORS.blush);
    blushL.position.set(-0.22, 0.9, 0.28);
    group.add(blushL);
    const blushR = createMesh(blushGeo, COLORS.blush);
    blushR.position.set(0.22, 0.9, 0.28);
    group.add(blushR);

    const tail = createMesh(new THREE.SphereGeometry(0.12, 8, 8), COLORS.bunnyBody);
    tail.position.set(0, 0.38, -0.42);
    group.add(tail);

    group.userData = { head, earL, earR };
    return group;
  }

  function createDeer() {
    const group = new THREE.Group();
    group.name = "NPC_Deer";

    const body = createMesh(new THREE.SphereGeometry(0.48, 10, 8), COLORS.deerBody);
    body.position.y = 0.5;
    group.add(body);

    const chest = createMesh(new THREE.SphereGeometry(0.3, 8, 8), COLORS.deerBelly);
    chest.position.set(0, 0.45, 0.22);
    group.add(chest);

    const head = createMesh(new THREE.SphereGeometry(0.36, 10, 8), COLORS.deerBody);
    head.position.y = 1.05;
    group.add(head);

    const snout = createMesh(new THREE.ConeGeometry(0.12, 0.22, 6), COLORS.deerBelly);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 1.0, 0.38);
    group.add(snout);

    const nose = createMesh(new THREE.SphereGeometry(0.04, 6, 6), COLORS.eye);
    nose.position.set(0, 1.0, 0.48);
    group.add(nose);

    const antlerMat = new THREE.MeshStandardMaterial({ color: COLORS.deerAntler, flatShading: true, roughness: 0.8 });
    function createAntler(isRight) {
      const antler = new THREE.Group();
      const main = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.4, 6), antlerMat);
      main.position.y = 0.2;
      main.rotation.z = isRight ? 0.3 : -0.3;
      antler.add(main);

      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.22, 6), antlerMat);
      branch.position.set(isRight ? 0.08 : -0.08, 0.25, 0.05);
      branch.rotation.z = isRight ? 0.6 : -0.6;
      antler.add(branch);

      return antler;
    }

    const antlerL = createAntler(false);
    antlerL.position.set(-0.15, 1.35, -0.05);
    group.add(antlerL);

    const antlerR = createAntler(true);
    antlerR.position.set(0.15, 1.35, -0.05);
    group.add(antlerR);

    const spotGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const spotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
    [[-0.12, 0.6, -0.15], [0.12, 0.65, -0.1], [0, 0.55, -0.28]].forEach(([sx, sy, sz]) => {
      const spot = new THREE.Mesh(spotGeo, spotMat);
      spot.position.set(sx, sy, sz);
      group.add(spot);
    });

    const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const eyeL = createMesh(eyeGeo, COLORS.eye);
    eyeL.position.set(-0.14, 1.1, 0.28);
    group.add(eyeL);
    const eyeR = createMesh(eyeGeo, COLORS.eye);
    eyeR.position.set(0.14, 1.1, 0.28);
    group.add(eyeR);

    const tail = createMesh(new THREE.SphereGeometry(0.1, 6, 6), COLORS.deerBelly);
    tail.position.set(0, 0.48, -0.44);
    group.add(tail);

    group.userData = { head, earL: antlerL, earR: antlerR };
    return group;
  }

  function createFox() {
    const group = new THREE.Group();
    group.name = "NPC_Fox";

    const body = createMesh(new THREE.SphereGeometry(0.48, 10, 8), COLORS.foxBody);
    body.position.y = 0.48;
    group.add(body);

    const chest = createMesh(new THREE.SphereGeometry(0.32, 8, 8), COLORS.foxBelly);
    chest.position.set(0, 0.45, 0.22);
    group.add(chest);

    const head = createMesh(new THREE.SphereGeometry(0.4, 10, 8), COLORS.foxBody);
    head.position.y = 0.95;
    group.add(head);

    const snout = createMesh(new THREE.ConeGeometry(0.14, 0.25, 6), COLORS.foxBelly);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.9, 0.42);
    group.add(snout);

    const nose = createMesh(new THREE.SphereGeometry(0.05, 6, 6), COLORS.eye);
    nose.position.set(0, 0.9, 0.53);
    group.add(nose);

    const earGeo = new THREE.ConeGeometry(0.12, 0.35, 4);
    const earL = createMesh(earGeo, COLORS.foxBody);
    earL.position.set(-0.2, 1.35, 0);
    earL.rotation.z = -0.2;
    group.add(earL);

    const earR = createMesh(earGeo, COLORS.foxBody);
    earR.position.set(0.2, 1.35, 0);
    earR.rotation.z = 0.2;
    group.add(earR);

    const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const eyeL = createMesh(eyeGeo, COLORS.eye);
    eyeL.position.set(-0.15, 1.02, 0.32);
    group.add(eyeL);
    const eyeR = createMesh(eyeGeo, COLORS.eye);
    eyeR.position.set(0.15, 1.02, 0.32);
    group.add(eyeR);

    const tail = createMesh(new THREE.CylinderGeometry(0.05, 0.2, 0.6, 8), COLORS.foxBody);
    tail.rotation.x = -Math.PI / 3;
    tail.position.set(0, 0.45, -0.45);
    group.add(tail);

    const tailTip = createMesh(new THREE.ConeGeometry(0.12, 0.25, 8), COLORS.foxBelly);
    tailTip.rotation.x = -Math.PI / 3;
    tailTip.position.set(0, 0.6, -0.65);
    group.add(tailTip);

    group.userData = { head, earL, earR, tail };
    return group;
  }

  function createCat() {
    const group = new THREE.Group();
    group.name = "NPC_Cat";

    const body = createMesh(new THREE.SphereGeometry(0.45, 10, 8), COLORS.catBody);
    body.position.y = 0.45;
    group.add(body);

    const head = createMesh(new THREE.SphereGeometry(0.38, 10, 8), COLORS.catBody);
    head.position.y = 0.92;
    group.add(head);

    const earGeo = new THREE.ConeGeometry(0.12, 0.32, 4);
    const earL = createMesh(earGeo, COLORS.catBody);
    earL.position.set(-0.18, 1.3, 0);
    earL.rotation.z = -0.15;
    group.add(earL);

    const earR = createMesh(earGeo, COLORS.catBody);
    earR.position.set(0.18, 1.3, 0);
    earR.rotation.z = 0.15;
    group.add(earR);

    const innerEarGeo = new THREE.ConeGeometry(0.07, 0.24, 4);
    const innerL = createMesh(innerEarGeo, COLORS.catInnerEar);
    innerL.position.set(-0.18, 1.28, 0.03);
    innerL.rotation.z = -0.15;
    group.add(innerL);

    const innerR = createMesh(innerEarGeo, COLORS.catInnerEar);
    innerR.position.set(0.18, 1.28, 0.03);
    innerR.rotation.z = 0.15;
    group.add(innerR);

    const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const eyeL = createMesh(eyeGeo, COLORS.eye);
    eyeL.position.set(-0.14, 0.98, 0.32);
    group.add(eyeL);
    const eyeR = createMesh(eyeGeo, COLORS.eye);
    eyeR.position.set(0.14, 0.98, 0.32);
    group.add(eyeR);

    const nose = createMesh(new THREE.SphereGeometry(0.04, 6, 6), COLORS.nose);
    nose.position.set(0, 0.9, 0.37);
    group.add(nose);

    const tail = createMesh(new THREE.CylinderGeometry(0.04, 0.05, 0.65, 8), COLORS.catBody);
    tail.position.set(0, 0.65, -0.45);
    tail.rotation.x = Math.PI / 4;
    group.add(tail);

    group.userData = { head, earL, earR, tail };
    return group;
  }

  function createDog() {
    const group = new THREE.Group();
    group.name = "NPC_Dog";

    const body = createMesh(new THREE.SphereGeometry(0.48, 10, 8), COLORS.dogBody);
    body.position.y = 0.48;
    group.add(body);

    const head = createMesh(new THREE.SphereGeometry(0.4, 10, 8), COLORS.dogBody);
    head.position.y = 0.96;
    group.add(head);

    const muzzle = createMesh(new THREE.SphereGeometry(0.18, 8, 8), 0xffffff);
    muzzle.position.set(0, 0.9, 0.35);
    group.add(muzzle);

    const nose = createMesh(new THREE.SphereGeometry(0.06, 6, 6), COLORS.eye);
    nose.position.set(0, 0.94, 0.5);
    group.add(nose);

    const earGeo = new THREE.SphereGeometry(0.13, 8, 8);
    const earL = createMesh(earGeo, COLORS.dogEar);
    earL.scale.set(0.7, 1.4, 0.7);
    earL.position.set(-0.28, 1.05, 0.05);
    group.add(earL);

    const earR = createMesh(earGeo, COLORS.dogEar);
    earR.scale.set(0.7, 1.4, 0.7);
    earR.position.set(0.28, 1.05, 0.05);
    group.add(earR);

    const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const eyeL = createMesh(eyeGeo, COLORS.eye);
    eyeL.position.set(-0.15, 1.04, 0.33);
    group.add(eyeL);
    const eyeR = createMesh(eyeGeo, COLORS.eye);
    eyeR.position.set(0.15, 1.04, 0.33);
    group.add(eyeR);

    const tail = createMesh(new THREE.CylinderGeometry(0.04, 0.07, 0.45, 8), COLORS.dogEar);
    tail.position.set(0, 0.55, -0.45);
    tail.rotation.x = -Math.PI / 3;
    group.add(tail);

    group.userData = { head, earL, earR, tail };
    return group;
  }

  function createPanda() {
    const group = new THREE.Group();
    group.name = "NPC_Panda";

    const body = createMesh(new THREE.SphereGeometry(0.5, 10, 8), COLORS.pandaBody);
    body.position.y = 0.5;
    group.add(body);

    const head = createMesh(new THREE.SphereGeometry(0.42, 10, 8), COLORS.pandaBody);
    head.position.y = 1.0;
    group.add(head);

    const earGeo = new THREE.SphereGeometry(0.13, 8, 8);
    const earL = createMesh(earGeo, COLORS.pandaBlack);
    earL.position.set(-0.28, 1.35, 0);
    group.add(earL);
    const earR = createMesh(earGeo, COLORS.pandaBlack);
    earR.position.set(0.28, 1.35, 0);
    group.add(earR);

    const eyePatchGeo = new THREE.SphereGeometry(0.11, 8, 8);
    const patchL = createMesh(eyePatchGeo, COLORS.pandaBlack);
    patchL.scale.set(1, 1.2, 0.4);
    patchL.position.set(-0.15, 1.02, 0.35);
    group.add(patchL);
    const patchR = createMesh(eyePatchGeo, COLORS.pandaBlack);
    patchR.scale.set(1, 1.2, 0.4);
    patchR.position.set(0.15, 1.02, 0.35);
    group.add(patchR);

    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const eyeL = createMesh(eyeGeo, COLORS.pandaBody);
    eyeL.position.set(-0.15, 1.03, 0.4);
    group.add(eyeL);
    const eyeR = createMesh(eyeGeo, COLORS.pandaBody);
    eyeR.position.set(0.15, 1.03, 0.4);
    group.add(eyeR);

    const nose = createMesh(new THREE.SphereGeometry(0.06, 6, 6), COLORS.pandaBlack);
    nose.position.set(0, 0.93, 0.42);
    group.add(nose);

    group.userData = { head, earL, earR };
    return group;
  }

  function createBear() {
    const group = new THREE.Group();
    group.name = "NPC_Bear";

    const body = createMesh(new THREE.SphereGeometry(0.52, 10, 8), COLORS.bearBody);
    body.position.y = 0.52;
    group.add(body);

    const belly = createMesh(new THREE.SphereGeometry(0.35, 8, 8), COLORS.bearBelly);
    belly.position.set(0, 0.48, 0.25);
    group.add(belly);

    const head = createMesh(new THREE.SphereGeometry(0.42, 10, 8), COLORS.bearBody);
    head.position.y = 1.02;
    group.add(head);

    const muzzle = createMesh(new THREE.SphereGeometry(0.18, 8, 8), COLORS.bearBelly);
    muzzle.position.set(0, 0.95, 0.36);
    group.add(muzzle);

    const nose = createMesh(new THREE.SphereGeometry(0.06, 6, 6), COLORS.eye);
    nose.position.set(0, 0.98, 0.5);
    group.add(nose);

    const earGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const earL = createMesh(earGeo, COLORS.bearBody);
    earL.position.set(-0.28, 1.35, 0);
    group.add(earL);
    const earR = createMesh(earGeo, COLORS.bearBody);
    earR.position.set(0.28, 1.35, 0);
    group.add(earR);

    const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const eyeL = createMesh(eyeGeo, COLORS.eye);
    eyeL.position.set(-0.16, 1.08, 0.34);
    group.add(eyeL);
    const eyeR = createMesh(eyeGeo, COLORS.eye);
    eyeR.position.set(0.16, 1.08, 0.34);
    group.add(eyeR);

    group.userData = { head, earL, earR };
    return group;
  }

  function createNPC(type, x, y, z, islandRef) {
    let mesh;
    switch (type) {
      case "deer":
        mesh = createDeer();
        break;
      case "fox":
        mesh = createFox();
        break;
      case "cat":
        mesh = createCat();
        break;
      case "dog":
        mesh = createDog();
        break;
      case "panda":
        mesh = createPanda();
        break;
      case "bear":
        mesh = createBear();
        break;
      case "bunny":
      default:
        mesh = createBunny();
        break;
    }

    mesh.position.set(x, y, z);
    mesh.scale.setScalar(0.75);

    let npcCollider = null;
    if (window.PhysicsModule) {
      npcCollider = window.PhysicsModule.registerCollider({
        type: "cylinder",
        position: new THREE.Vector3(x, y, z),
        radius: 0.45,
        height: 1.4
      });
    }

    mesh.userData.ai = {
      state: "idle",
      timer: 1 + Math.random() * 3,
      targetPos: new THREE.Vector3(x, y, z),
      baseCenter: new THREE.Vector3(x, y, z),
      moveSpeed: 1.2 + Math.random() * 0.6,
      islandRadius: (islandRef && islandRef.userData && islandRef.userData.radius) ? islandRef.userData.radius * 0.65 : 5,
      animTime: Math.random() * Math.PI * 2,
      rotationY: Math.random() * Math.PI * 2,
      islandRef: islandRef,
      collider: npcCollider
    };

    return mesh;
  }

  // ---------------- Autonomous Wandering AI State Machine ----------------

  function updateNPC(npc, delta, elapsed) {
    const ai = npc.userData.ai;
    if (!ai) return;

    ai.timer -= delta;
    ai.animTime += delta * 5;

    // Y lokal tepat di atas rumput pulau = 0.7
    const LOCAL_GROUND_Y = 0.7;

    if (ai.state === "idle") {
      npc.position.y = LOCAL_GROUND_Y + Math.sin(ai.animTime * 0.8) * 0.01;
      
      if (npc.userData.head) {
        npc.userData.head.rotation.y = Math.sin(ai.animTime * 0.5) * 0.15;
      }

      if (ai.timer <= 0) {
        ai.state = "wandering";
        ai.timer = 3 + Math.random() * 4;

        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * ai.islandRadius;
        ai.targetPos.x = Math.cos(angle) * dist;
        ai.targetPos.z = Math.sin(angle) * dist;
      }
    } else if (ai.state === "wandering") {
      const dirX = ai.targetPos.x - npc.position.x;
      const dirZ = ai.targetPos.z - npc.position.z;
      const dist = Math.hypot(dirX, dirZ);

      if (dist < 0.3 || ai.timer <= 0) {
        ai.state = "idle";
        ai.timer = 2 + Math.random() * 3;
      } else {
        const moveX = (dirX / dist) * ai.moveSpeed * delta;
        const moveZ = (dirZ / dist) * ai.moveSpeed * delta;
        npc.position.x += moveX;
        npc.position.z += moveZ;

        const targetAngle = Math.atan2(dirX, dirZ);
        let diff = (targetAngle - ai.rotationY) % (Math.PI * 2);
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;
        ai.rotationY += diff * Math.min(delta * 8, 1);
        npc.rotation.y = ai.rotationY;

        const hop = Math.abs(Math.sin(ai.animTime * 2)) * 0.12;
        npc.position.y = LOCAL_GROUND_Y + hop;

        if (npc.userData.earL && npc.userData.earR) {
          npc.userData.earL.rotation.z = -0.15 + Math.sin(ai.animTime * 2) * 0.1;
          npc.userData.earR.rotation.z = 0.15 - Math.sin(ai.animTime * 2) * 0.1;
        }
      }
    }

    // Sinkronkan posisi collider fisik NPC dengan posisi world-space dari mesh hewan
    if (ai.collider && ai.collider.position) {
      const tempWorldPos = new THREE.Vector3();
      npc.getWorldPosition(tempWorldPos);
      ai.collider.position.copy(tempWorldPos);
    }
  }

  const npcs = [];

  function spawnNPCsOnIslands(islands) {
    npcs.forEach(npc => {
      if (npc.userData && npc.userData.ai && npc.userData.ai.collider && window.PhysicsModule) {
        window.PhysicsModule.unregisterCollider(npc.userData.ai.collider);
      }
    });

    npcs.length = 0;
    if (!islands || !islands.length) return npcs;

    islands.forEach((island, index) => {
      const rad = (island.userData && island.userData.radius) ? island.userData.radius : 9;
      const count = index === islands.length - 1 ? 3 : (1 + Math.floor(Math.random() * 2));

      for (let i = 0; i < count; i++) {
        const type = NPC_TYPES[(index + i) % NPC_TYPES.length];
        const offsetAngle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const offsetDist = 1.5 + Math.random() * (rad * 0.45);

        const GROUND_Y = 0.7;
        const localX = Math.cos(offsetAngle) * offsetDist;
        const localZ = Math.sin(offsetAngle) * offsetDist;
        const localY = GROUND_Y;

        const npc = createNPC(type, localX, localY, localZ, island);
        island.add(npc);
        npcs.push(npc);
      }
    });

    return npcs;
  }

  function switchOrSpawnAnimalVariety(questionIndex, islands) {
    if (!islands || !islands.length) return npcs;

    const currentSpecies = NPC_TYPES[questionIndex % NPC_TYPES.length];

    npcs.forEach((npc, index) => {
      const island = npc.userData && npc.userData.ai ? npc.userData.ai.islandRef : null;
      if (!island) return;

      const localX = npc.position.x;
      const localY = npc.position.y;
      const localZ = npc.position.z;

      if (npc.userData.ai && npc.userData.ai.collider && window.PhysicsModule) {
        window.PhysicsModule.unregisterCollider(npc.userData.ai.collider);
      }

      island.remove(npc);

      const type = (index % 2 === 0) ? currentSpecies : NPC_TYPES[(questionIndex + index) % NPC_TYPES.length];
      const newNpc = createNPC(type, localX, localY, localZ, island);

      newNpc.scale.setScalar(0.01);
      island.add(newNpc);
      npcs[index] = newNpc;

      const startTime = performance.now();
      const duration = 500;
      function animatePop() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const scaleVal = 0.75 * Math.sin(progress * Math.PI * 0.5) * (1 + 0.3 * Math.sin(progress * Math.PI));
        newNpc.scale.setScalar(Math.max(0.01, scaleVal));
        if (progress < 1) requestAnimationFrame(animatePop);
        else newNpc.scale.setScalar(0.75);
      }
      animatePop();
    });

    return currentSpecies;
  }

  function updateNPCs(delta, elapsed) {
    npcs.forEach((npc) => updateNPC(npc, delta, elapsed));
  }

  window.NPCModule = {
    createBunny,
    createDeer,
    createFox,
    createCat,
    createDog,
    createPanda,
    createBear,
    createNPC,
    spawnNPCsOnIslands,
    switchOrSpawnAnimalVariety,
    updateNPCs,
    getNPCs: () => npcs,
    NPC_TYPES
  };
})();
