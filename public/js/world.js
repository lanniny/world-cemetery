import * as THREE from "three";
import { RULES } from "./rules.js";

/** 固定种子的伪随机。风景要随机，但不能每次都长得不一样。 */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 到湖心的距离。湖是这片墓园里唯一一片水，也是水葬能放船的地方。 */
export function lakeDist(x, z) {
  const L = RULES.world.lake;
  return Math.hypot(x - L.x, z - L.z);
}

/** 站在这里会不会沉下去：比水面低太多就是深水，进不去。 */
export function isDeepWater(x, z) {
  return heightAt(x, z) < RULES.world.waterLevel - RULES.world.wadeDepth;
}

export function isInLake(x, z) {
  return lakeDist(x, z) <= RULES.world.lake.r;
}

/** 全墓园共用一张地形高度表，玩家、墓碑、遗物都贴在同一块地上。
 *  湖盆是在这张表上挖出来的一只碗：湖心四米多深，到半径 26 米处正好升到水面。
 *  这一条很要紧——水面是一片半径 26 米的平面，如果岸线附近的地面比水面还高，
 *  船就会被放在地面以下、整条埋进土里（第一版就是这个毛病）。 */
export function heightAt(x, z) {
  const a = Math.sin(x * 0.031) * Math.cos(z * 0.027);
  const b = Math.sin((x + z) * 0.063) * 0.42;
  const c = Math.sin(x * 0.115 - z * 0.07) * 0.22;
  const base = (a * 1.15 + b + c) * RULES.world.hillAmp;

  const L = RULES.world.lake;
  const d = Math.hypot(x - L.x, z - L.z);
  const edge = L.r * 2.1;
  if (d >= edge) return base;

  const t = d / edge;
  const bowl = -4.2 * (1 - t) * (1 - t);
  // 湖底也要有一点起伏，不能是一只完美的碗
  return bowl + base * 0.15;
}

export function groundNormal(x, z) {
  const e = 0.6;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return new THREE.Vector3(-dx, 2 * e, -dz).normalize();
}

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = 0;
    this.pickables = [];
  }

  build() {
    const scene = this.scene;
    const world = RULES.world;

    scene.background = new THREE.Color(0x070b10);
    scene.fog = new THREE.FogExp2(0x101820, world.fogDensity * 0.86);

    // 月光是冷的，灯笼是暖的。两样都在，园子才有层次。
    const hemi = new THREE.HemisphereLight(0x8ea8b4, 0x1a221c, 0.72);
    scene.add(hemi);

    const moonLight = new THREE.DirectionalLight(0xd7e8f0, 1.35);
    moonLight.position.set(-70, 90, -50);
    scene.add(moonLight);

    const fill = new THREE.DirectionalLight(0x3d5c68, 0.28);
    fill.position.set(60, 20, 40);
    scene.add(fill);

    this.moonDir = new THREE.Vector3(-0.62, 0.42, -0.66).normalize();
    this.buildSky();
    this.buildGround();
    this.buildWater();
    this.buildTrees();
    this.buildGrass();
    this.buildDressing();
    return this;
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(600, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x05070c) },
        bottom: { value: new THREE.Color(0x1a2c36) },
        moon: { value: this.moonDir.clone() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 bottom;
        uniform vec3 moon;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 1.4 + 0.15, 0.0, 1.0);
          vec3 col = mix(bottom, top, pow(h, 0.7));
          float halo = pow(max(dot(normalize(vDir), normalize(moon)), 0.0), 9.0);
          col += vec3(0.16, 0.28, 0.32) * halo;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(geo, mat));

    // 星
    const count = 900;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - Math.random() * 0.85);
      const r = 450;
      const y = Math.cos(phi);
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      positions[i * 3 + 1] = y * r * 0.9 + 20;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
      sizes[i] = Math.random() * 1.6 + 0.4;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const starMat = new THREE.PointsMaterial({
      color: 0xbfe3ea,
      size: 1.05,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      fog: false,
    });
    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);

    // 月
    const moonTex = this.makeMoonTexture();
    const moon = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })
    );
    moon.scale.set(58, 58, 1);
    moon.position.copy(this.moonDir).multiplyScalar(380);
    this.scene.add(moon);
    this.moon = moon;
  }

  makeMoonTexture() {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(240,248,246,0.95)");
    g.addColorStop(0.18, "rgba(214,236,236,0.85)");
    g.addColorStop(0.26, "rgba(150,196,204,0.35)");
    g.addColorStop(0.55, "rgba(90,140,158,0.09)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  buildGround() {
    const size = RULES.world.groundSize;
    const seg = 220;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: this.makeGroundTexture(),
      color: 0xffffff,
      roughness: 0.97,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = false;
    this.scene.add(ground);
    this.ground = ground;

    // 更暗的一圈，把墓园之外的雾压下去
    const outerGeo = new THREE.RingGeometry(RULES.world.radius + 8, 400, 64, 1);
    outerGeo.rotateX(-Math.PI / 2);
    const outer = new THREE.Mesh(outerGeo, new THREE.MeshBasicMaterial({ color: 0x0a1014, fog: true }));
    outer.position.y = -0.2;
    this.scene.add(outer);
  }

  makeGroundTexture() {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#4a5850";
    ctx.fillRect(0, 0, size, size);

    // 土、苔、碎石的斑驳
    for (let i = 0; i < 3400; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 7 + 1;
      const kind = Math.random();
      if (kind < 0.34) ctx.fillStyle = "rgba(72, 84, 72, 0.7)";
      else if (kind < 0.62) ctx.fillStyle = "rgba(100, 114, 96, 0.55)";
      else if (kind < 0.85) ctx.fillStyle = "rgba(126, 132, 118, 0.36)";
      else ctx.fillStyle = "rgba(150, 152, 140, 0.22)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 细颗粒
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 14);
    tex.anisotropy = 8;
    return tex;
  }

  /** 湖面：一层薄薄的水，加一道月亮倒影。船就浮在这条线上。 */
  buildWater() {
    const L = RULES.world.lake;
    const y = RULES.world.waterLevel;

    const geo = new THREE.CircleGeometry(L.r + 0.4, 72);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      map: this.makeWaterTexture(),
      color: 0xffffff,
      emissive: 0x0e2329,
      emissiveIntensity: 0.55,
      roughness: 0.22,
      metalness: 0.3,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const water = new THREE.Mesh(geo, mat);
    water.position.set(L.x, y, L.z);
    water.renderOrder = 1;
    this.scene.add(water);
    this.water = water;

    // 月亮掉进水里：一条被水拉长的高光
    const shine = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.makeMoonTexture(),
        color: 0xa8dde6,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    shine.scale.set(42, 13, 1);
    shine.position.set(L.x + 4, y + 0.04, L.z + 6);
    this.scene.add(shine);
    this.shine = shine;

    // 岸：一圈更暗的边，让水看起来是嵌进地里的
    const rimGeo = new THREE.RingGeometry(L.r + 0.3, L.r + 2.8, 72);
    rimGeo.rotateX(-Math.PI / 2);
    const rim = new THREE.Mesh(
      rimGeo,
      new THREE.MeshBasicMaterial({ color: 0x050a0d, transparent: true, opacity: 0.7, fog: true })
    );
    rim.position.set(L.x, y + 0.015, L.z);
    this.scene.add(rim);
  }

  /** 水纹：几道被风拉平的细线，让这一大片黑能看出是水而不是洞。 */
  makeWaterTexture() {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, "#2c5b64");
    g.addColorStop(0.5, "#224650");
    g.addColorStop(1, "#2a5560");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 300; i++) {
      const y = Math.random() * size;
      const w = 20 + Math.random() * 70;
      const a = 0.03 + Math.random() * 0.09;
      ctx.strokeStyle = `rgba(190, 232, 238, ${a})`;
      ctx.lineWidth = Math.random() * 1.4 + 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.random() * size, y);
      ctx.bezierCurveTo(
        Math.random() * size,
        y - 4,
        Math.random() * size,
        y + 4,
        Math.random() * size + w,
        y
      );
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    tex.anisotropy = 8;
    return tex;
  }

  /**
   * 树。三片林子加散落的几棵，全部走 InstancedMesh：八十多棵树只花三个 draw call。
   * 每一棵树的坐标都记下来——树葬要挂在树干上，得知道树在哪。
   */
  buildTrees() {
    const W = RULES.world;
    const spots = [];
    // 树的位置必须对所有人、每一次加载都一致：树葬挂在哪棵树上，是别人也要看见的事。
    const rnd = seeded(20261116);

    for (const g of W.groves) {
      for (let i = 0; i < g.n; i++) {
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(rnd()) * g.r;
        const x = g.x + Math.cos(a) * r;
        const z = g.z + Math.sin(a) * r;
        if (lakeDist(x, z) < W.lake.r + 6) continue;
        spots.push({ x, z, scale: 1.0 + rnd() * 0.5 });
      }
    }

    let tries = 0;
    const want = W.groves.reduce((n, g) => n + g.n, 0) + W.scatterTrees;
    while (spots.length < want && tries < 1200) {
      tries++;
      const a = rnd() * Math.PI * 2;
      const r = 58 + rnd() * 104;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (lakeDist(x, z) < W.lake.r + 7) continue;
      if (Math.hypot(x, z - 74) < 15) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 4.5)) continue;
      spots.push({ x, z, scale: 0.78 + rnd() * 0.55 });
    }

    const barkMat = new THREE.MeshStandardMaterial({ color: 0x2c3330, roughness: 0.96 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x1b2822, roughness: 0.94, flatShading: true });

    const trunkGeo = new THREE.CylinderGeometry(0.13, 0.23, 4.2, 6, 1);
    trunkGeo.translate(0, 2.1, 0);
    const branchGeo = new THREE.CylinderGeometry(0.03, 0.085, 2.2, 4, 1);
    branchGeo.translate(0, 1.1, 0);
    const crownGeo = new THREE.IcosahedronGeometry(1.75, 0);

    const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, spots.length);
    const branches = new THREE.InstancedMesh(branchGeo, barkMat, spots.length * 3);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);

    const dummy = new THREE.Object3D();
    let bi = 0;

    spots.forEach((s, i) => {
      const gy = heightAt(s.x, s.z) - 0.1;
      dummy.position.set(s.x, gy, s.z);
      dummy.rotation.set(0, rnd() * Math.PI * 2, 0);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      for (let b = 0; b < 3; b++) {
        const a = (b / 3) * Math.PI * 2 + rnd() * 0.7;
        dummy.position.set(s.x + Math.cos(a) * 0.12, gy + (2.4 + rnd() * 1.1) * s.scale, s.z + Math.sin(a) * 0.12);
        dummy.rotation.set(0, -a, 0);
        dummy.rotateZ(0.75 + rnd() * 0.5);
        dummy.scale.setScalar(s.scale);
        dummy.updateMatrix();
        branches.setMatrixAt(bi++, dummy.matrix);
      }

      dummy.position.set(s.x, gy + 3.5 * s.scale, s.z);
      dummy.rotation.set(rnd() * 0.4, rnd() * Math.PI, rnd() * 0.4);
      dummy.scale.set(s.scale * 1.25, s.scale * 0.9, s.scale * 1.25);
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);

      s.h = 4.2 * s.scale;
    });

    trunks.instanceMatrix.needsUpdate = true;
    branches.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    trunks.frustumCulled = false;
    branches.frustumCulled = false;
    crowns.frustumCulled = false;

    const group = new THREE.Group();
    group.add(trunks, branches, crowns);
    this.scene.add(group);
    this.trees = group;
    this.treeSpots = spots;
  }

  /** 站在哪棵树下：树葬要找最近的树干。 */
  nearestTree(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const s of this.treeSpots || []) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best ? { tree: best, distance: bestD } : null;
  }

  buildGrass() {
    const count = 3600;
    const geo = new THREE.ConeGeometry(0.05, 0.3, 3, 1, true);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x46584a,
      roughness: 1,
      side: THREE.DoubleSide,
      emissive: 0x121e15,
      emissiveIntensity: 0.42,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const radius = RULES.world.radius + 10;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      dummy.position.set(x, heightAt(x, z) + 0.12, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.24, Math.random() * Math.PI, (Math.random() - 0.5) * 0.24);
      dummy.scale.setScalar(0.6 + Math.random() * 0.9);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.grass = mesh;
  }

  /**
   * 园子里的摆设：石径、入口石柱、灯笼。
   * 位置用固定种子，所有人看见的是同一条路。这些东西不挡路，只是让地面不再是一块空的布。
   */
  buildDressing() {
    const rnd = seeded(20261122);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6d726c, roughness: 0.94 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a403c, roughness: 0.92 });
    const paperMat = new THREE.MeshStandardMaterial({
      color: 0xf0e2c4,
      emissive: 0xffb15a,
      emissiveIntensity: 0.85,
      roughness: 0.45,
    });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.9 });
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xe7e0d2, roughness: 0.8 });

    const stones = [];
    for (let i = 0; i < 36; i++) {
      const t = i / 35;
      const z = 80 - t * 62;
      const x = Math.sin(t * 2.4) * 5.5;
      if (lakeDist(x, z) < RULES.world.lake.r + 2) continue;
      stones.push({ x, z, s: 0.85 + rnd() * 0.45, ry: rnd() * Math.PI });
    }
    const stoneGeo = new THREE.CylinderGeometry(0.34, 0.4, 0.05, 6);
    const stoneMesh = new THREE.InstancedMesh(stoneGeo, stoneMat, stones.length);
    const dummy = new THREE.Object3D();
    stones.forEach((s, i) => {
      dummy.position.set(s.x, heightAt(s.x, s.z) + 0.03, s.z);
      dummy.rotation.set(0, s.ry, 0);
      dummy.scale.set(s.s, 1, s.s * 0.82);
      dummy.updateMatrix();
      stoneMesh.setMatrixAt(i, dummy.matrix);
    });
    stoneMesh.instanceMatrix.needsUpdate = true;
    stoneMesh.frustumCulled = false;
    this.scene.add(stoneMesh);

    const gateY = heightAt(0, 82);
    const pillarGeo = new THREE.BoxGeometry(0.38, 2.15, 0.38);
    for (const x of [-2.15, 2.15]) {
      const pillar = new THREE.Mesh(pillarGeo, stoneMat);
      pillar.position.set(x, gateY + 1.05, 82);
      this.scene.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.52), darkMat);
      cap.position.set(x, gateY + 2.16, 82);
      this.scene.add(cap);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.16, 0.28), darkMat);
    beam.position.set(0, gateY + 2.28, 82);
    this.scene.add(beam);
    this.viewBlockers = [
      { x: -2.15, z: 82, r: 0.55 },
      { x: 2.15, z: 82, r: 0.55 },
    ];

    const lanternSpots = [
      { x: -3.4, z: 76 },
      { x: 3.6, z: 64 },
      { x: -4.2, z: 50 },
      { x: 4.8, z: 36 },
      { x: -2.2, z: 22 },
      { x: RULES.world.lake.x + RULES.world.lake.r + 3.2, z: RULES.world.lake.z + 1 },
      { x: RULES.world.lake.x - 2, z: RULES.world.lake.z - RULES.world.lake.r - 2.4 },
    ];
    this.lanterns = [];
    for (const spot of lanternSpots) {
      if (lakeDist(spot.x, spot.z) < RULES.world.lake.r + 0.4) continue;
      const y = heightAt(spot.x, spot.z);
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.36), stoneMat);
      base.position.y = 0.08;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.15, 6), woodMat);
      post.position.y = 0.7;
      const house = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.28), paperMat);
      house.position.y = 1.38;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 4), darkMat);
      roof.position.y = 1.62;
      roof.rotation.y = Math.PI / 4;
      g.add(base, post, house, roof);
      g.position.set(spot.x, y, spot.z);
      this.scene.add(g);
      const light = new THREE.PointLight(0xffb067, 3.2, 8.5, 2);
      light.position.set(spot.x, y + 1.4, spot.z);
      this.scene.add(light);
      this.lanterns.push(light);
      this.viewBlockers.push({ x: spot.x, z: spot.z, r: 0.28 });
    }

    const flowerCount = 48;
    const flowerGeo = new THREE.ConeGeometry(0.05, 0.16, 5);
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
    for (let i = 0; i < flowerCount; i++) {
      const host = stones[Math.floor(rnd() * stones.length)];
      const a = rnd() * Math.PI * 2;
      const r = 0.45 + rnd() * 0.7;
      const x = host.x + Math.cos(a) * r;
      const z = host.z + Math.sin(a) * r;
      dummy.position.set(x, heightAt(x, z) + 0.08, z);
      dummy.rotation.set(0, rnd() * 2, 0);
      dummy.scale.setScalar(0.7 + rnd() * 0.8);
      dummy.updateMatrix();
      flowers.setMatrixAt(i, dummy.matrix);
    }
    flowers.instanceMatrix.needsUpdate = true;
    flowers.frustumCulled = false;
    this.scene.add(flowers);
  }

  update(dt, camera) {
    this.time += dt;
    if (this.stars) this.stars.rotation.y = this.time * 0.004;
    if (this.moon) this.moon.material.opacity = 0.9 + Math.sin(this.time * 0.4) * 0.05;
    if (this.grass) this.grass.material.color.setHSL(0.3, 0.14, 0.22 + Math.sin(this.time * 0.2) * 0.008);
    if (this.water) this.water.material.opacity = 0.86 + Math.sin(this.time * 0.6) * 0.03;
    if (this.shine) {
      this.shine.position.x = RULES.world.lake.x + 6 + Math.sin(this.time * 0.23) * 1.6;
      this.shine.material.opacity = 0.13 + Math.abs(Math.sin(this.time * 0.4)) * 0.05;
    }
    if (this.lanterns) {
      const pulse = 0.82 + Math.sin(this.time * 1.7) * 0.08;
      for (const light of this.lanterns) light.intensity = 3.2 * pulse;
    }
  }
}
