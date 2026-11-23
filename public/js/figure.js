import * as THREE from "three";
import { LOOKS, normalizeLook } from "./rules.js";

/**
 * 披斗篷的小小来客：圆头、安静的脸、兜帽和披风是轮廓。
 * 关节仍是原来那一套，跪、鞠躬、合十和两种镜头都不用改。
 */

function palette(look) {
  return LOOKS.palette[normalizeLook(look).coat];
}

function cloth(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.94,
    metalness: 0,
    side: opts.side || THREE.FrontSide,
    emissive: opts.emissive ?? color,
    emissiveIntensity: opts.emissiveIntensity ?? 0.06,
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
  const mesh = put(new THREE.CapsuleGeometry(radius, Math.max(0.02, length), 5, 8), material, parent);
  mesh.position.y = -(length * 0.5 + radius);
  return mesh;
}

export function createFigure(look, { local = false } = {}) {
  const spec = palette(look);
  const coat = cloth(spec.coat, { side: THREE.DoubleSide, emissiveIntensity: 0.07 });
  const lining = cloth(spec.trim, { side: THREE.DoubleSide, emissiveIntensity: 0.22, roughness: 0.8 });
  const skin = cloth(spec.skin, { emissiveIntensity: 0.12, roughness: 0.72 });
  const hairMat = cloth(spec.hair, { emissiveIntensity: 0.05, roughness: 0.86 });
  const shoe = cloth(spec.shoe, { emissiveIntensity: 0.04, roughness: 0.9 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x2a2624,
    roughness: 0.4,
    emissive: 0x1a1816,
    emissiveIntensity: 0.4,
  });
  const materials = [coat, lining, skin, hairMat, shoe, eyeMat];

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);

  const cape = new THREE.Group();
  hips.add(cape);
  const capeCloth = put(new THREE.CylinderGeometry(0.14, 0.24, 0.72, 22, 1, true), coat, cape);
  capeCloth.position.y = -0.12;
  capeCloth.scale.set(1.02, 1, 0.76);

  const spine = new THREE.Group();
  spine.position.y = 0.12;
  hips.add(spine);

  const chest = put(new THREE.SphereGeometry(0.11, 16, 12), coat, spine);
  chest.scale.set(1.05, 1.15, 0.72);
  chest.position.set(0, 0.28, local ? 0.03 : 0.01);

  const neck = put(new THREE.CylinderGeometry(0.032, 0.038, 0.06, 12), skin, spine);
  neck.position.set(0, 0.5, 0.015);

  const head = new THREE.Group();
  head.position.set(0, 0.56, 0.02);
  spine.add(head);

  const skull = put(new THREE.SphereGeometry(0.118, 24, 18), skin, head);
  skull.scale.set(1.02, 0.98, 0.96);
  skull.position.y = 0.1;

  const eye = (side) => {
    const ball = put(new THREE.SphereGeometry(0.014, 10, 8), eyeMat, head);
    ball.scale.set(1, 1.15, 0.7);
    ball.position.set(side * 0.032, 0.11, 0.1);
    const light = put(new THREE.SphereGeometry(0.004, 6, 6), lining, head);
    light.position.set(side * 0.032 - 0.004, 0.116, 0.108);
    return ball;
  };
  eye(-1);
  eye(1);
  const mouth = put(new THREE.CapsuleGeometry(0.003, 0.016, 2, 4), eyeMat, head);
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0, 0.055, 0.105);

  // 兜帽和头发比头慢半拍，转身时布料才跟着过来。
  const hood = new THREE.Group();
  head.add(hood);
  const cowl = put(new THREE.SphereGeometry(0.155, 22, 16, Math.PI, Math.PI, 0.2, Math.PI * 0.62), coat, hood);
  cowl.position.set(0, 0.1, -0.02);
  const hoodInner = put(new THREE.SphereGeometry(0.118, 16, 10, Math.PI, Math.PI, 0.35, Math.PI * 0.4), lining, hood);
  hoodInner.position.set(0, 0.11, -0.035);

  const hairShort = new THREE.Group();
  hood.add(hairShort);
  const fringe = put(new THREE.SphereGeometry(0.07, 12, 10), hairMat, hairShort);
  fringe.scale.set(1.5, 0.38, 0.45);
  fringe.position.set(0, 0.14, 0.07);

  const hairTied = new THREE.Group();
  hood.add(hairTied);
  const tuft = put(new THREE.SphereGeometry(0.04, 12, 10), hairMat, hairTied);
  tuft.position.set(0, 0.16, -0.08);
  const ribbon = put(new THREE.TorusGeometry(0.022, 0.006, 6, 10), lining, hairTied);
  ribbon.position.set(0, 0.15, -0.06);
  ribbon.rotation.x = 0.7;

  const hairHood = new THREE.Group();
  hood.add(hairHood);
  const deepCowl = put(new THREE.SphereGeometry(0.172, 20, 14, Math.PI * 0.85, Math.PI * 1.3, 0.15, Math.PI * 0.62), coat, hairHood);
  deepCowl.position.set(0, 0.1, -0.03);

  const mantle = new THREE.Group();
  const shoulder = put(new THREE.SphereGeometry(0.16, 16, 12), coat, mantle);
  shoulder.scale.set(1.45, 0.55, 0.82);
  shoulder.position.set(0, 0.32, -0.01);
  spine.add(mantle);

  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, 0.4, 0.02);
    spine.add(pivot);
    const sleeve = put(new THREE.CylinderGeometry(0.055, 0.038, 0.28, 12, 1, true), coat, pivot);
    sleeve.position.y = -0.15;
    const fore = new THREE.Group();
    fore.position.y = -0.28;
    pivot.add(fore);
    const forearm = put(new THREE.CylinderGeometry(0.04, 0.028, 0.2, 12, 1, true), coat, fore);
    forearm.position.y = -0.08;
    const cuff = put(new THREE.TorusGeometry(0.03, 0.007, 6, 12), lining, fore);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.16;
    const hand = new THREE.Group();
    hand.position.y = -0.22;
    fore.add(hand);
    const palm = put(new THREE.SphereGeometry(0.03, 12, 10), skin, hand);
    palm.scale.set(0.85, 1.05, 0.6);
    const thumb = put(new THREE.SphereGeometry(0.012, 8, 6), skin, hand);
    thumb.position.set(side * 0.02, 0.008, 0.014);
    return { pivot, fore };
  };

  const leg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.06, -0.05, 0.01);
    hips.add(pivot);
    hang(0.04, 0.22, coat, pivot);
    const shin = new THREE.Group();
    shin.position.y = -0.36;
    pivot.add(shin);
    hang(0.03, 0.2, coat, shin);
    const foot = put(new THREE.SphereGeometry(0.04, 10, 8), shoe, shin);
    foot.scale.set(0.65, 0.4, 1.25);
    foot.position.set(0, -0.3, 0.04);
    return { pivot, shin };
  };

  const armL = arm(-1);
  const armR = arm(1);
  const legL = leg(-1);
  const legR = leg(1);

  const shadow = put(
    new THREE.CircleGeometry(0.38, 20),
    new THREE.MeshBasicMaterial({ color: 0x05080a, transparent: true, opacity: 0.28, depthWrite: false }),
    root
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.scale.set(1.15, 1, 0.85);
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
    cape,
    hood,
    coat,
    trim: lining,
    skin,
    hairMat,
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
  if (fig.coat.emissive) fig.coat.emissive.setHex(spec.coat);
  fig.trim.color.setHex(spec.trim);
  if (fig.trim.emissive) fig.trim.emissive.setHex(spec.trim);
  fig.skin.color.setHex(spec.skin);
  if (fig.skin.emissive) fig.skin.emissive.setHex(spec.skin);
  fig.hairMat.color.setHex(spec.hair);
  if (fig.hairMat.emissive) fig.hairMat.emissive.setHex(spec.hair);
  fig.head.visible = !!showHead;
  fig.hairShort.visible = showHead && styled.hair === "short";
  fig.hairTied.visible = showHead && styled.hair === "tied";
  fig.hairHood.visible = showHead && styled.hair === "hood";
  if (fig.mantle) {
    fig.mantle.visible = true;
    const wide = styled.hair === "hood" ? 1.12 : 1;
    fig.mantle.scale.set(wide, 1, wide);
  }
}

const POSE_KEYS = [
  "hipsY", "hipsX", "hipsYRot", "hipsZ",
  "spineX", "spineY", "spineZ",
  "headX", "headY", "headZ",
  "armLX", "armLY", "armLZ", "armRX", "armRY", "armRZ",
  "foreLX", "foreRX",
  "legLX", "legRX", "shinLX", "shinRX",
];

function restPose() {
  return {
    hipsY: 0.92, hipsX: 0, hipsYRot: 0, hipsZ: 0,
    spineX: 0, spineY: 0, spineZ: 0,
    headX: 0, headY: 0, headZ: 0,
    armLX: 0, armLY: 0, armLZ: -0.08, armRX: 0, armRY: 0, armRZ: 0.08,
    foreLX: 0.12, foreRX: 0.12,
    legLX: 0, legRX: 0, shinLX: 0.06, shinRX: 0.06,
  };
}

/** 大多数时间头几乎不动，隔一阵轻轻偏一下。 */
function glance(time, phase) {
  const gate = Math.pow(Math.max(0, Math.sin(time * 0.37 + phase)), 8);
  return Math.sin(time * 1.15 + phase * 2) * 0.2 * gate;
}

function samplePose(anim, time, phase) {
  const p = restPose();
  const breath = Math.sin(time * 1.35 + phase);
  const sway = Math.sin(time * 0.5 + phase);

  if (anim === "walk" || anim === "run") {
    const run = anim === "run";
    const freq = run ? 9.4 : 5.5;
    const s = Math.sin(time * freq + phase);
    const c = Math.cos(time * freq + phase);
    const amp = run ? 0.72 : 0.52;
    p.legLX = s * amp;
    p.legRX = -s * amp;
    p.shinLX = Math.max(0, -s) * (run ? 0.95 : 0.8) + 0.1;
    p.shinRX = Math.max(0, s) * (run ? 0.95 : 0.8) + 0.1;
    p.hipsZ = c * (run ? 0.1 : 0.08);
    p.hipsYRot = s * (run ? 0.18 : 0.14);
    p.hipsX = Math.sin(time * freq * 2 + phase) * 0.015;
    p.spineY = -s * (run ? 0.14 : 0.11);
    p.spineZ = -c * 0.05;
    p.spineX = 0.035 + Math.abs(s) * 0.04;
    p.armLX = -s * (run ? 0.62 : 0.5);
    p.armRX = s * (run ? 0.62 : 0.5);
    p.armLZ = -0.1 - c * 0.05;
    p.armRZ = 0.1 - c * 0.05;
    p.foreLX = Math.max(0, s) * 0.55 + 0.08;
    p.foreRX = Math.max(0, -s) * 0.55 + 0.08;
    p.headY = -s * 0.07;
    p.headX = 0.02 + Math.abs(c) * 0.035;
    p.hipsY = 0.92 + Math.pow(Math.abs(c), 1.35) * (run ? 0.05 : 0.032);
    return p;
  }

  p.spineX = breath * 0.02;
  p.spineY = sway * 0.035;
  p.spineZ = Math.sin(time * 0.42 + phase) * 0.012;
  p.headY = glance(time, phase);
  p.headX = Math.sin(time * 0.72 + phase) * 0.025;
  p.hipsY = 0.92 + breath * 0.008;
  p.armLZ = -0.08 + Math.sin(time * 0.6 + phase) * 0.03;
  p.armRZ = 0.08 + Math.sin(time * 0.6 + phase + 1) * 0.03;

  if (anim === "sit") {
    p.hipsY = 0.48 + breath * 0.006;
    p.legLX = -1.15;
    p.legRX = -1.15;
    p.shinLX = 1.32;
    p.shinRX = 1.32;
    p.spineX = 0.05 + breath * 0.015;
    p.armLX = 0.22;
    p.armRX = 0.22;
    p.foreLX = 0.35;
    p.foreRX = 0.35;
  } else if (anim === "kneel") {
    p.hipsY = 0.42;
    p.hipsX = 0.05;
    p.legLX = -1.4;
    p.legRX = -1.4;
    p.shinLX = 2.15;
    p.shinRX = 2.15;
    p.spineX = 0.26 + breath * 0.012;
    p.headX = 0.14 + Math.sin(time * 0.8 + phase) * 0.02;
    p.armLX = 0.82;
    p.armRX = 0.82;
    p.foreLX = -1.15;
    p.foreRX = -1.15;
  } else if (anim === "bow") {
    p.spineX = 0.7 + breath * 0.015;
    p.headX = 0.18;
    p.armLX = 0.34;
    p.armRX = 0.34;
    p.foreLX = 0.22;
    p.foreRX = 0.22;
  } else if (anim === "clasp") {
    p.armLX = 1.0;
    p.armRX = 1.0;
    p.armLY = 0.32;
    p.armRY = -0.32;
    p.armLZ = -0.04;
    p.armRZ = 0.04;
    p.foreLX = -1.35;
    p.foreRX = -1.35;
    p.headX = 0.1 + breath * 0.015;
    p.spineX = 0.04 + breath * 0.012;
  } else if (anim === "mourn") {
    p.spineX = 0.1 + breath * 0.015;
    p.headX = 0.36 + Math.sin(time * 0.6 + phase) * 0.02;
    p.armLX = 0.14;
    p.armRX = 0.14;
    p.foreLX = 0.18;
    p.foreRX = 0.18;
  } else if (anim === "ghost") {
    p.armLX = -0.18 + Math.sin(time * 1.2 + phase) * 0.08;
    p.armRX = -0.18 + Math.sin(time * 1.2 + phase + 1) * 0.08;
    p.armLZ = -0.26;
    p.armRZ = 0.26;
    p.spineX = -0.05 + breath * 0.02;
    p.hipsY = 0.92 + Math.sin(time * 1.6 + phase) * 0.02;
  }
  return p;
}

function writePose(fig, p) {
  fig.hips.position.y = p.hipsY;
  fig.hips.rotation.set(p.hipsX, p.hipsYRot, p.hipsZ);
  fig.spine.rotation.set(p.spineX, p.spineY, p.spineZ);
  fig.head.rotation.set(p.headX, p.headY, p.headZ);
  fig.armL.rotation.set(p.armLX, p.armLY, p.armLZ);
  fig.armR.rotation.set(p.armRX, p.armRY, p.armRZ);
  fig.foreL.rotation.set(p.foreLX, 0, 0);
  fig.foreR.rotation.set(p.foreRX, 0, 0);
  fig.legL.rotation.set(p.legLX, 0, 0);
  fig.legR.rotation.set(p.legRX, 0, 0);
  fig.shinL.rotation.set(p.shinLX, 0, 0);
  fig.shinR.rotation.set(p.shinRX, 0, 0);
}

function follow(current, target, dt, rate) {
  const k = 1 - Math.exp(-dt * rate);
  current.x += (target.x - current.x) * k;
  current.y += (target.y - current.y) * k;
  current.z += (target.z - current.z) * k;
}

/** 站、走、跪、揖、合十、默哀。换动作会缓入，披风和兜帽比身体慢一点。 */
export function applyPose(fig, anim, time, phase = 0) {
  const target = samplePose(anim, time, phase);
  if (!fig.motion) {
    fig.motion = {
      anim,
      blend: 1,
      from: target,
      cur: { ...target },
      last: time,
      cape: { x: 0, y: 0, z: 0 },
      hood: { x: 0, y: 0, z: 0 },
      mantle: { x: 0, y: 0, z: 0 },
    };
  }
  const m = fig.motion;
  const dt = m.last ? Math.min(0.05, Math.max(0, time - m.last)) : 1 / 60;
  m.last = time;
  if (m.anim !== anim) {
    m.anim = anim;
    m.from = { ...m.cur };
    m.blend = 0;
  }
  m.blend = Math.min(1, m.blend + dt / 0.36);
  const k = m.blend * m.blend * (3 - 2 * m.blend);
  if (m.blend >= 1) {
    Object.assign(m.cur, target);
  } else {
    for (const key of POSE_KEYS) m.cur[key] = m.from[key] * (1 - k) + target[key] * k;
  }
  writePose(fig, m.cur);

  const p = m.cur;
  // 布料追的是身体上一拍的角度，所以转身和迈步时会晚一点才跟上。
  follow(m.cape, { x: p.hipsX + p.spineX * 0.45, y: p.hipsYRot, z: p.hipsZ }, dt, 3.2);
  follow(m.hood, { x: p.headX * 0.5, y: p.headY, z: p.headZ }, dt, 2.5);
  follow(m.mantle, { x: p.spineX * 0.3, y: p.spineY, z: p.spineZ }, dt, 3.6);
  if (fig.cape) {
    fig.cape.rotation.set(m.cape.x - (p.hipsX + p.spineX * 0.45), m.cape.y - p.hipsYRot, m.cape.z - p.hipsZ);
  }
  if (fig.hood) fig.hood.rotation.set(m.hood.x - p.headX * 0.5, m.hood.y - p.headY, m.hood.z - p.headZ);
  if (fig.mantle) fig.mantle.rotation.set(m.mantle.x - p.spineX * 0.3, m.mantle.y - p.spineY, m.mantle.z - p.spineZ);
}

export function setFigureOpacity(fig, opacity) {
  const faded = opacity < 0.98;
  for (const material of fig.materials) {
    material.transparent = faded || material === fig.shadow.material;
    material.opacity = material === fig.shadow.material ? opacity * 0.28 : opacity;
  }
  fig.root.visible = opacity > 0.02;
}

/** 第一人称里看得见的袖口。是一双小而圆的手，不是一排手指。 */
export function createHands(look) {
  const spec = palette(look);
  const skin = cloth(spec.skin, { emissiveIntensity: 0.12, roughness: 0.72 });
  const coatMat = cloth(spec.coat, { side: THREE.DoubleSide, emissiveIntensity: 0.07 });
  const root = new THREE.Group();
  const left = new THREE.Group();
  const right = new THREE.Group();
  root.add(left, right);

  const mitt = (side, parent) => {
    const sleeve = put(new THREE.CapsuleGeometry(0.038, 0.09, 4, 8), coatMat, parent);
    sleeve.rotation.x = 0.65;
    sleeve.position.set(0, 0.01, 0.02);
    const palm = put(new THREE.SphereGeometry(0.036, 12, 10), skin, parent);
    palm.scale.set(0.9, 0.7, 1.05);
    palm.position.set(side * 0.006, -0.04, -0.015);
    const thumb = put(new THREE.SphereGeometry(0.014, 8, 6), skin, parent);
    thumb.position.set(side * 0.03, -0.02, 0.01);
  };
  mitt(-1, left);
  mitt(1, right);

  const api = {
    root,
    left,
    right,
    skin,
    cloth: coatMat,
    applyLook(next) {
      const p = palette(next);
      skin.color.setHex(p.skin);
      if (skin.emissive) skin.emissive.setHex(p.skin);
      coatMat.color.setHex(p.coat);
      if (coatMat.emissive) coatMat.emissive.setHex(p.coat);
    },
    setPose(anim, time, speed, pitch) {
      const run = anim === "run";
      const freq = run ? 9.4 : 5.5;
      const s = Math.sin(time * freq);
      const c = Math.cos(time * freq);
      const breath = Math.sin(time * 1.35) * 0.012;
      const lookingDown = pitch > 0.42;
      const show = !lookingDown && anim !== "sit";
      root.visible = show;
      if (!show) return;
      const goal = {
        lx: -0.2, ly: -0.16 + breath, lz: -0.36, lrx: 0.42, lry: 0.1, lrz: 0.08,
        rx: 0.2, ry: -0.16 + breath, rz: -0.36, rrx: 0.42, rry: -0.1, rrz: -0.08,
      };
      if (anim === "walk" || anim === "run") {
        const swing = run ? 0.07 : 0.05;
        goal.lz = -0.36 + s * swing;
        goal.rz = -0.36 - s * swing;
        goal.ly = -0.16 + Math.abs(c) * 0.02;
        goal.ry = -0.16 + Math.abs(c) * 0.02;
        goal.lrx = 0.4 - s * 0.25;
        goal.rrx = 0.4 + s * 0.25;
      } else if (anim === "clasp") {
        goal.lx = -0.04; goal.rx = 0.04;
        goal.ly = -0.05; goal.ry = -0.05;
        goal.lz = -0.34; goal.rz = -0.34;
        goal.lrx = 1.05; goal.rrx = 1.05;
        goal.lry = 0.4; goal.rry = -0.4;
      } else if (anim === "bow" || anim === "kneel") {
        goal.lx = -0.1; goal.rx = 0.1;
        goal.ly = -0.24; goal.ry = -0.24;
        goal.lz = -0.46; goal.rz = -0.46;
        goal.lrx = 1.02; goal.rrx = 1.02;
      } else if (anim === "mourn") {
        goal.ly -= 0.05;
        goal.ry -= 0.05;
        goal.lrx = 0.75;
        goal.rrx = 0.75;
      } else if (anim === "ghost") {
        goal.lx = -0.28; goal.rx = 0.28;
        goal.ly = -0.08 + breath; goal.ry = -0.08 + breath;
        goal.lz = -0.38; goal.rz = -0.38;
      }
      if (!this.motion) this.motion = { anim, blend: 1, from: goal, cur: { ...goal }, last: time };
      const motion = this.motion;
      const dt = motion.last ? Math.min(0.05, Math.max(0, time - motion.last)) : 1 / 60;
      motion.last = time;
      if (motion.anim !== anim) {
        motion.anim = anim;
        motion.from = { ...motion.cur };
        motion.blend = 0;
      }
      motion.blend = Math.min(1, motion.blend + dt / 0.28);
      const k = motion.blend * motion.blend * (3 - 2 * motion.blend);
      const keys = Object.keys(goal);
      if (motion.blend >= 1) Object.assign(motion.cur, goal);
      else for (const key of keys) motion.cur[key] = motion.from[key] * (1 - k) + goal[key] * k;
      const cpos = motion.cur;
      left.position.set(cpos.lx, cpos.ly, cpos.lz);
      right.position.set(cpos.rx, cpos.ry, cpos.rz);
      left.rotation.set(cpos.lrx, cpos.lry, cpos.lrz);
      right.rotation.set(cpos.rrx, cpos.rry, cpos.rrz);
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
    material.dispose();
  }
}
