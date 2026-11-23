import * as THREE from "three";
import { LOOKS, normalizeLook } from "./rules.js";

/**
 * 二次元来客：大眼睛、有体积的头发、赛璐璐明暗。
 * 关节仍是原来那一套，跪、鞠躬、合十和两种镜头都不用改。
 */

const IRIS = {
  ink: ["#d7fff6", "#3ec4b0", "#145864", "#071418"],
  ash: ["#f2f6ff", "#8aa4c4", "#31445c", "#101820"],
  pine: ["#e7ffe8", "#5aaa62", "#1d4a28", "#0c1810"],
  frost: ["#f4fbff", "#7eb6e6", "#2a5278", "#101820"],
  clay: ["#fff1df", "#e0a15a", "#7a4424", "#1c120c"],
};

let gradientMap;

function toonGradient() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([
    78, 82, 92, 255,
    142, 146, 156, 255,
    214, 216, 222, 255,
    255, 255, 255, 255,
  ]);
  gradientMap = new THREE.DataTexture(data, 4, 1);
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.wrapS = THREE.ClampToEdgeWrapping;
  gradientMap.needsUpdate = true;
  gradientMap.colorSpace = THREE.SRGBColorSpace;
  return gradientMap;
}

function palette(look) {
  return LOOKS.palette[normalizeLook(look).coat];
}

function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient(),
    side: opts.side || THREE.FrontSide,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
}

function put(geo, material, parent) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function hang(radius, length, material, parent) {
  const mesh = put(new THREE.CapsuleGeometry(radius, Math.max(0.02, length), 4, 8), material, parent);
  mesh.position.y = -(length * 0.5 + radius);
  return mesh;
}

function lathe(profile, material, parent, segments = 18) {
  const pts = profile.map(([x, y]) => new THREE.Vector2(x, y));
  return put(new THREE.LatheGeometry(pts, segments), material, parent);
}

function paintFace(canvas, skinHex, coatId) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const skin = new THREE.Color(skinHex);
  skin.lerp(new THREE.Color(0xffe4d2), 0.55);
  const skinCss = `#${skin.getHexString()}`;
  const shade = skin.clone().multiplyScalar(0.82);

  ctx.fillStyle = skinCss;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.54, w * 0.34, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  const cheek = ctx.createRadialGradient(w * 0.5, h * 0.2, 10, w * 0.5, h * 0.35, w * 0.4);
  cheek.addColorStop(0, "rgba(255,255,255,0.28)");
  cheek.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = cheek;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = `rgba(${Math.round(shade.r * 255)}, ${Math.round(shade.g * 255)}, ${Math.round(shade.b * 255)}, 0.35)`;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.78, w * 0.22, h * 0.1, 0, 0, Math.PI);
  ctx.fill();

  ctx.fillStyle = "rgba(214, 112, 118, 0.34)";
  ctx.beginPath();
  ctx.ellipse(w * 0.28, h * 0.62, 38, 18, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.72, h * 0.62, 38, 18, 0.3, 0, Math.PI * 2);
  ctx.fill();

  const iris = IRIS[coatId] || IRIS.ink;
  drawEye(ctx, w * 0.35, h * 0.48, iris);
  drawEye(ctx, w * 0.65, h * 0.48, iris, true);

  ctx.strokeStyle = "#2a241e";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.34);
  ctx.quadraticCurveTo(w * 0.33, h * 0.3, w * 0.44, h * 0.345);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.56, h * 0.345);
  ctx.quadraticCurveTo(w * 0.67, h * 0.3, w * 0.76, h * 0.34);
  ctx.stroke();

  ctx.strokeStyle = "rgba(150, 96, 84, 0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.58);
  ctx.lineTo(w * 0.485, h * 0.64);
  ctx.stroke();

  ctx.strokeStyle = "#c46d78";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(w * 0.46, h * 0.72);
  ctx.quadraticCurveTo(w * 0.5, h * 0.745, w * 0.54, h * 0.72);
  ctx.stroke();
}

function drawEye(ctx, x, y, iris, flip) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = "#fbf8f6";
  ctx.beginPath();
  ctx.ellipse(0, 2, 46, 54, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(-8, -10, 6, 0, 4, 40);
  g.addColorStop(0, iris[0]);
  g.addColorStop(0.35, iris[1]);
  g.addColorStop(0.72, iris[2]);
  g.addColorStop(1, iris[3]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 6, 30, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0c1014";
  ctx.beginPath();
  ctx.ellipse(0, 8, 13, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(-10, -8, 8, 11, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.ellipse(9, 8, 4, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#1a1614";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-48, 2);
  ctx.quadraticCurveTo(0, -58, 48, 2);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-38, 14);
  ctx.quadraticCurveTo(0, 46, 38, 14);
  ctx.stroke();
  ctx.restore();
}

function makeFaceMaterial(skinHex, coatId) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  paintFace(canvas, skinHex, coatId);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.2,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  mat.userData.canvas = canvas;
  mat.userData.tex = tex;
  return mat;
}

function repaintFace(mat, skinHex, coatId) {
  if (!mat?.userData?.canvas) return;
  paintFace(mat.userData.canvas, skinHex, coatId);
  mat.userData.tex.needsUpdate = true;
}

function addBangs(parent, material, length) {
  const bangs = put(new THREE.SphereGeometry(0.092, 16, 12), material, parent);
  bangs.scale.set(1.45, 0.48, 0.42);
  bangs.position.set(0, 0.175, 0.11);
  for (const side of [-1, 1]) {
    const lock = hang(0.018, length, material, parent);
    lock.position.set(side * 0.1, 0.13, 0.09);
    lock.rotation.z = side * -0.18;
    lock.rotation.x = -0.15;
  }
  const sheen = put(new THREE.SphereGeometry(0.05, 10, 8), material, parent);
  sheen.scale.set(0.7, 0.28, 0.35);
  sheen.position.set(0.02, 0.2, 0.04);
  return sheen;
}

export function createFigure(look, { local = false } = {}) {
  const spec = palette(look);
  const id = normalizeLook(look).coat;
  const coat = toon(spec.coat, { side: THREE.DoubleSide });
  const trim = toon(spec.trim);
  const skin = toon(spec.skin, { emissive: spec.skin, emissiveIntensity: 0.16 });
  const hairMat = toon(spec.hair);
  const hairHi = toon(spec.hair, { emissive: 0xffffff, emissiveIntensity: 0.18 });
  const shoe = toon(spec.shoe);
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x14181c, side: THREE.BackSide });
  const faceMat = typeof document === "undefined" ? toon(spec.skin) : makeFaceMaterial(spec.skin, id);
  const materials = [coat, trim, skin, hairMat, hairHi, shoe, outlineMat, faceMat];

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);

  const pelvis = put(new THREE.SphereGeometry(0.1, 16, 12), coat, hips);
  pelvis.scale.set(1.2, 0.62, 0.95);
  pelvis.position.y = 0.03;

  const skirt = put(new THREE.CylinderGeometry(0.118, 0.155, 0.48, 20, 1, true), coat, hips);
  skirt.position.y = -0.08;
  skirt.scale.set(1.05, 1, 0.78);

  const belt = put(new THREE.TorusGeometry(0.124, 0.012, 8, 22), trim, hips);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.1;
  belt.scale.set(1.05, 1, 0.76);
  const knot = put(new THREE.BoxGeometry(0.04, 0.028, 0.02), trim, hips);
  knot.position.set(0, 0.1, 0.1);

  const spine = new THREE.Group();
  spine.position.y = 0.12;
  hips.add(spine);

  const bodice = lathe(
    [
      [0.078, 0],
      [0.108, 0.1],
      [0.096, 0.22],
      [0.112, 0.36],
      [0.15, 0.48],
      [0.128, 0.56],
      [0.055, 0.6],
    ],
    coat,
    spine
  );
  bodice.scale.set(1.02, 1.05, 0.68);
  bodice.position.set(0, -0.04, local ? 0.03 : 0);

  const collar = put(new THREE.TorusGeometry(0.055, 0.012, 6, 16), trim, spine);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.54, 0.015);
  const placket = put(new THREE.BoxGeometry(0.014, 0.4, 0.01), trim, spine);
  placket.position.set(0, 0.26, 0.09);

  const neck = put(new THREE.CylinderGeometry(0.034, 0.04, 0.07, 12), skin, spine);
  neck.position.set(0, 0.56, 0.012);

  const head = new THREE.Group();
  head.position.set(0, 0.56, 0.02);
  spine.add(head);

  const skull = put(new THREE.SphereGeometry(0.118, 24, 18), skin, head);
  skull.scale.set(0.92, 1.06, 0.88);
  skull.position.y = 0.108;
  const skullLine = put(skull.geometry.clone(), outlineMat, head);
  skullLine.scale.copy(skull.scale).multiplyScalar(1.045);
  skullLine.position.copy(skull.position);

  const face = put(new THREE.PlaneGeometry(0.22, 0.26), faceMat, head);
  face.position.set(0, 0.1, 0.132);
  face.renderOrder = 2;

  const hairShort = new THREE.Group();
  head.add(hairShort);
  const cap = put(new THREE.SphereGeometry(0.132, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.68), hairMat, hairShort);
  cap.scale.set(1.05, 1.05, 1.15);
  cap.position.set(0, 0.125, -0.03);
  const capLine = put(cap.geometry.clone(), outlineMat, hairShort);
  capLine.position.copy(cap.position);
  capLine.scale.setScalar(1.04);
  addBangs(hairShort, hairMat, 0.11);
  const crown = put(new THREE.SphereGeometry(0.045, 10, 8), hairHi, hairShort);
  crown.scale.set(1.1, 0.35, 0.6);
  crown.position.set(-0.02, 0.22, 0.02);

  const hairTied = new THREE.Group();
  head.add(hairTied);
  const tiedCap = put(new THREE.SphereGeometry(0.126, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat, hairTied);
  tiedCap.position.set(0, 0.132, -0.008);
  addBangs(hairTied, hairMat, 0.2);
  const bun = put(new THREE.SphereGeometry(0.052, 14, 12), hairMat, hairTied);
  bun.position.set(0, 0.2, -0.04);
  const ribbon = put(new THREE.TorusGeometry(0.03, 0.007, 6, 12), trim, hairTied);
  ribbon.position.set(0, 0.19, -0.02);
  ribbon.rotation.x = 0.8;
  const tail = hang(0.028, 0.22, hairMat, hairTied);
  tail.position.set(0, 0.16, -0.07);

  const hairHood = new THREE.Group();
  head.add(hairHood);
  addBangs(hairHood, hairMat, 0.08);
  const cowl = put(new THREE.SphereGeometry(0.162, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.7), coat, hairHood);
  cowl.position.set(0, 0.125, -0.04);
  const hoodRim = put(new THREE.TorusGeometry(0.095, 0.01, 6, 18), trim, hairHood);
  hoodRim.position.set(0, 0.09, 0.045);
  hoodRim.rotation.x = 1.05;

  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.168, 0.44, 0.02);
    spine.add(pivot);
    const shoulder = put(new THREE.SphereGeometry(0.05, 10, 8), coat, pivot);
    shoulder.scale.set(1.05, 0.7, 0.85);
    const upperSleeve = put(new THREE.CylinderGeometry(0.052, 0.04, 0.26, 10, 1, true), coat, pivot);
    upperSleeve.position.y = -0.14;
    const fore = new THREE.Group();
    fore.position.y = -0.28;
    pivot.add(fore);
    const forearm = put(new THREE.CylinderGeometry(0.042, 0.03, 0.22, 10, 1, true), coat, fore);
    forearm.position.y = -0.08;
    const cuff = put(new THREE.TorusGeometry(0.034, 0.007, 6, 12), trim, fore);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.015;
    const hand = new THREE.Group();
    hand.position.y = -0.25;
    fore.add(hand);
    const palm = put(new THREE.SphereGeometry(0.032, 10, 8), skin, hand);
    palm.scale.set(0.8, 1.2, 0.5);
    const thumb = put(new THREE.SphereGeometry(0.013, 8, 6), skin, hand);
    thumb.position.set(side * 0.024, 0.01, 0.016);
    return { pivot, fore };
  };

  const leg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.07, -0.02, 0);
    hips.add(pivot);
    hang(0.046, 0.26, coat, pivot);
    const shin = new THREE.Group();
    shin.position.y = -0.4;
    pivot.add(shin);
    hang(0.034, 0.24, coat, shin);
    const foot = put(new THREE.SphereGeometry(0.048, 10, 8), shoe, shin);
    foot.scale.set(0.62, 0.38, 1.35);
    foot.position.set(0, -0.35, 0.045);
    return { pivot, shin };
  };

  const mantle = new THREE.Group();
  const mantleCloth = put(new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.48), coat, mantle);
  mantleCloth.scale.set(1.4, 0.36, 0.9);
  mantleCloth.position.set(0, 0.4, -0.02);
  spine.add(mantle);

  const armL = arm(-1);
  const armR = arm(1);
  const legL = leg(-1);
  const legR = leg(1);

  const shadow = put(
    new THREE.CircleGeometry(0.42, 20),
    new THREE.MeshBasicMaterial({ color: 0x05080a, transparent: true, opacity: 0.32, depthWrite: false }),
    root
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.renderOrder = 1;
  materials.push(shadow.material);

  const fig = {
    root,
    hips,
    spine,
    head,
    armL: armL.pivot,
    armR: armR.pivot,
    foreL: armL.fore,
    foreR: armR.fore,
    legL: legL.pivot,
    legR: legR.pivot,
    shinL: legL.shin,
    shinR: legR.shin,
    hairShort,
    hairTied,
    hairHood,
    mantle,
    coat,
    trim,
    skin,
    hairMat,
    hairHi,
    faceMat,
    shadow,
    materials,
    local,
  };
  applyLook(fig, look);
  applyPose(fig, "idle", 0, 0);
  return fig;
}

export function applyLook(fig, look, showHead = !fig.local) {
  const spec = palette(look);
  const styled = normalizeLook(look);
  fig.coat.color.setHex(spec.coat);
  fig.trim.color.setHex(spec.trim);
  fig.skin.color.setHex(spec.skin);
  if (fig.skin.emissive) {
    fig.skin.emissive.setHex(spec.skin);
    fig.skin.emissiveIntensity = 0.16;
  }
  fig.hairMat.color.setHex(spec.hair);
  if (fig.hairHi) {
    const hi = new THREE.Color(spec.hair).offsetHSL(0, -0.05, 0.18);
    fig.hairHi.color.copy(hi);
  }
  repaintFace(fig.faceMat, spec.skin, styled.coat);
  fig.head.visible = !!showHead;
  fig.hairShort.visible = showHead && styled.hair === "short";
  fig.hairTied.visible = showHead && styled.hair === "tied";
  fig.hairHood.visible = showHead && styled.hair === "hood";
  if (fig.mantle) fig.mantle.visible = !!showHead && styled.hair === "hood";
}

function resetPose(fig) {
  fig.hips.position.y = 0.92;
  fig.hips.rotation.set(0, 0, 0);
  fig.spine.rotation.set(0, 0, 0);
  fig.head.rotation.set(0, 0, 0);
  for (const part of [fig.armL, fig.armR, fig.foreL, fig.foreR, fig.legL, fig.legR, fig.shinL, fig.shinR]) {
    part.rotation.set(0, 0, 0);
  }
  fig.armL.rotation.z = -0.1;
  fig.armR.rotation.z = 0.1;
}

/** 站、走、跪、揖、合十、默哀。时间只用来呼吸和迈步，姿态本身是稳的。 */
export function applyPose(fig, anim, time, phase = 0) {
  resetPose(fig);
  const breathe = Math.sin(time * 1.5 + phase) * 0.012;
  fig.spine.rotation.x = breathe;

  if (anim === "walk" || anim === "run") {
    const run = anim === "run";
    const s = Math.sin(time * (run ? 11 : 6.4) + phase);
    const amp = run ? 0.72 : 0.48;
    fig.legL.rotation.x = s * amp;
    fig.legR.rotation.x = -s * amp;
    fig.shinL.rotation.x = Math.max(0, -s) * (run ? 0.9 : 0.65);
    fig.shinR.rotation.x = Math.max(0, s) * (run ? 0.9 : 0.65);
    fig.armL.rotation.x = -s * amp * 0.75;
    fig.armR.rotation.x = s * amp * 0.75;
    fig.hips.position.y = 0.92 + Math.abs(Math.cos(time * (run ? 11 : 6.4) + phase)) * (run ? 0.05 : 0.03);
    return;
  }

  if (anim === "sit") {
    fig.hips.position.y = 0.46;
    fig.legL.rotation.x = -1.25;
    fig.legR.rotation.x = -1.25;
    fig.shinL.rotation.x = 1.4;
    fig.shinR.rotation.x = 1.4;
    fig.spine.rotation.x = 0.08;
    fig.armL.rotation.x = 0.25;
    fig.armR.rotation.x = 0.25;
    return;
  }

  if (anim === "kneel") {
    fig.hips.position.y = 0.34;
    fig.hips.rotation.x = 0.08;
    fig.legL.rotation.x = -1.45;
    fig.legR.rotation.x = -1.45;
    fig.shinL.rotation.x = 2.2;
    fig.shinR.rotation.x = 2.2;
    fig.spine.rotation.x = 0.42;
    fig.head.rotation.x = 0.22;
    fig.armL.rotation.x = 0.95;
    fig.armR.rotation.x = 0.95;
    fig.armL.rotation.z = 0.02;
    fig.armR.rotation.z = -0.02;
    fig.foreL.rotation.x = -1.25;
    fig.foreR.rotation.x = -1.25;
    return;
  }

  if (anim === "bow") {
    fig.spine.rotation.x = 0.9;
    fig.head.rotation.x = 0.28;
    fig.armL.rotation.x = 0.28;
    fig.armR.rotation.x = 0.28;
    fig.armL.rotation.z = 0.14;
    fig.armR.rotation.z = -0.14;
    return;
  }

  if (anim === "clasp") {
    fig.armL.rotation.set(1.05, 0.42, -0.05);
    fig.armR.rotation.set(1.05, -0.42, 0.05);
    fig.foreL.rotation.x = -1.45;
    fig.foreR.rotation.x = -1.45;
    fig.head.rotation.x = 0.18;
    fig.spine.rotation.x = 0.06;
    return;
  }

  if (anim === "mourn") {
    fig.spine.rotation.x = 0.16;
    fig.head.rotation.x = 0.5;
    fig.armL.rotation.x = 0.14;
    fig.armR.rotation.x = 0.14;
    return;
  }

  if (anim === "ghost") {
    fig.armL.rotation.set(-0.25, 0, -0.42);
    fig.armR.rotation.set(-0.25, 0, 0.42);
    fig.legL.rotation.x = 0.18;
    fig.legR.rotation.x = -0.12;
    fig.spine.rotation.x = -0.08;
  }
}

export function setFigureOpacity(fig, opacity) {
  const faded = opacity < 0.98;
  for (const material of fig.materials) {
    material.transparent = faded || material === fig.shadow.material;
    material.opacity = material === fig.shadow.material ? opacity * 0.32 : opacity;
  }
  fig.root.visible = opacity > 0.02;
}

/** 第一人称里看得见的袖口和手。低头看身体时把手藏起来，避免和身上的手叠成两双。 */
export function createHands(look) {
  const spec = palette(look);
  const skin = toon(spec.skin, { emissive: spec.skin, emissiveIntensity: 0.16 });
  const cloth = toon(spec.coat);
  const root = new THREE.Group();
  const left = new THREE.Group();
  const right = new THREE.Group();
  root.add(left, right);

  const mitt = (side, parent) => {
    const sleeve = put(new THREE.CapsuleGeometry(0.04, 0.1, 3, 7), cloth, parent);
    sleeve.rotation.x = 0.7;
    sleeve.position.set(0, 0.02, 0.02);
    const palm = put(new THREE.SphereGeometry(0.04, 10, 8), skin, parent);
    palm.scale.set(0.85, 0.58, 1.2);
    palm.position.set(side * 0.008, -0.04, -0.02);
    const thumb = put(new THREE.SphereGeometry(0.015, 8, 6), skin, parent);
    thumb.position.set(side * 0.038, -0.028, 0.012);
    for (let i = 0; i < 3; i += 1) {
      const finger = put(new THREE.CapsuleGeometry(0.007, 0.022, 2, 4), skin, parent);
      finger.rotation.x = 0.35;
      finger.position.set((i - 1) * 0.014, -0.068, -0.03);
    }
  };
  mitt(-1, left);
  mitt(1, right);

  const api = {
    root,
    left,
    right,
    skin,
    cloth,
    applyLook(next) {
      const p = palette(next);
      skin.color.setHex(p.skin);
      if (skin.emissive) skin.emissive.setHex(p.skin);
      cloth.color.setHex(p.coat);
    },
    setPose(anim, time, speed, pitch) {
      const bob = Math.sin(time * (speed > 4 ? 11 : 6.4)) * Math.min(speed, 6) * 0.008;
      const lookingDown = pitch > 0.42;
      const show = !lookingDown && anim !== "sit";
      root.visible = show;
      if (!show) return;
      left.position.set(-0.22, -0.14 + bob, -0.38);
      right.position.set(0.22, -0.14 - bob, -0.38);
      left.rotation.set(0.5, 0.15, 0.15);
      right.rotation.set(0.5, -0.15, -0.15);
      if (anim === "walk" || anim === "run") {
        const s = Math.sin(time * (anim === "run" ? 11 : 6.4));
        left.position.z += s * 0.04;
        right.position.z -= s * 0.04;
      } else if (anim === "clasp") {
        left.position.set(-0.045, -0.06, -0.36);
        right.position.set(0.045, -0.06, -0.36);
        left.rotation.set(1.15, 0.5, 0.1);
        right.rotation.set(1.15, -0.5, -0.1);
      } else if (anim === "bow" || anim === "kneel") {
        left.position.set(-0.12, -0.28, -0.5);
        right.position.set(0.12, -0.28, -0.5);
        left.rotation.set(1.15, 0.1, 0.05);
        right.rotation.set(1.15, -0.1, -0.05);
      } else if (anim === "mourn") {
        left.position.y -= 0.06;
        right.position.y -= 0.06;
        left.rotation.x = 0.9;
        right.rotation.x = 0.9;
      } else if (anim === "ghost") {
        left.position.set(-0.32, -0.08, -0.4);
        right.position.set(0.32, -0.08, -0.4);
      }
    },
  };
  api.applyLook(look);
  return api;
}

export function disposeFigure(fig) {
  fig.root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
  });
  for (const material of fig.materials) {
    material.map?.dispose?.();
    material.emissiveMap?.dispose?.();
    material.dispose();
  }
}
