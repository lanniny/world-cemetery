import * as THREE from "three";
import { LOOKS, normalizeLook } from "./rules.js";

/**
 * 来客穿一身收身的长袍，有脖子、脸和头发。
 * 关节还是原来那一套：跪、鞠躬、合十只改这些枢轴，不换骨骼。
 */

function palette(look) {
  return LOOKS.palette[normalizeLook(look).coat];
}

function clothMat(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.74,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
}

function skinMat(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.52,
    metalness: 0,
    emissive: color,
    emissiveIntensity: 0.07,
  });
}

function hairMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.14,
  });
}

function put(geo, material, parent) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

/** 胶囊沿 -Y 垂下，顶端贴在父节点原点，肘和膝才还在原来的位置。 */
function hang(radius, length, material, parent) {
  const mesh = put(new THREE.CapsuleGeometry(radius, Math.max(0.02, length), 4, 8), material, parent);
  mesh.position.y = -(length * 0.5 + radius);
  return mesh;
}

function lathe(profile, material, parent, segments = 16) {
  const pts = profile.map(([x, y]) => new THREE.Vector2(x, y));
  return put(new THREE.LatheGeometry(pts, segments), material, parent);
}

export function createFigure(look, { local = false } = {}) {
  const spec = palette(look);
  const coat = clothMat(spec.coat);
  const trim = clothMat(spec.trim);
  const skin = skinMat(spec.skin);
  const hairMat = hairMaterial(spec.hair);
  const shoe = clothMat(spec.shoe);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1c1614, roughness: 0.35, metalness: 0.05 });
  const materials = [coat, trim, skin, hairMat, shoe, eyeMat];

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);

  const pelvis = put(new THREE.SphereGeometry(0.11, 14, 10), coat, hips);
  pelvis.scale.set(1.35, 0.72, 1.05);
  pelvis.position.y = 0.02;

  const skirt = put(new THREE.CylinderGeometry(0.132, 0.168, 0.46, 18, 1, true), coat, hips);
  skirt.position.y = -0.08;
  skirt.scale.set(1.08, 1, 0.82);

  const belt = put(new THREE.TorusGeometry(0.132, 0.014, 8, 20), trim, hips);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.1;
  belt.scale.set(1.08, 1, 0.78);
  const knot = put(new THREE.SphereGeometry(0.022, 10, 8), trim, hips);
  knot.position.set(0, 0.1, 0.105);

  const spine = new THREE.Group();
  spine.position.y = 0.12;
  hips.add(spine);

  const bodice = lathe(
    [
      [0.085, 0],
      [0.12, 0.08],
      [0.105, 0.2],
      [0.125, 0.34],
      [0.168, 0.46],
      [0.145, 0.54],
      [0.062, 0.58],
    ],
    coat,
    spine
  );
  bodice.scale.set(1.08, 1.08, 0.72);
  bodice.position.set(0, -0.06, local ? 0.03 : 0);

  const yoke = put(new THREE.SphereGeometry(0.15, 14, 10), coat, spine);
  yoke.scale.set(1.35, 0.38, 0.7);
  yoke.position.set(0, 0.44, local ? 0.02 : 0);

  const collar = put(new THREE.TorusGeometry(0.062, 0.014, 6, 14), trim, spine);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.55, 0.01);

  const placket = put(new THREE.BoxGeometry(0.018, 0.42, 0.012), trim, spine);
  placket.position.set(0, 0.26, 0.1);

  const neck = put(new THREE.CylinderGeometry(0.04, 0.046, 0.08, 10), skin, spine);
  neck.position.set(0, 0.58, 0.01);

  const head = new THREE.Group();
  head.position.set(0, 0.57, 0.015);
  spine.add(head);

  const skull = put(new THREE.SphereGeometry(0.108, 18, 14), skin, head);
  skull.scale.set(0.94, 1.08, 0.9);
  skull.position.y = 0.1;

  const jaw = put(new THREE.SphereGeometry(0.055, 12, 10), skin, head);
  jaw.scale.set(1.05, 0.72, 0.85);
  jaw.position.set(0, 0.03, 0.035);

  const nose = put(new THREE.SphereGeometry(0.016, 8, 6), skin, head);
  nose.scale.set(0.7, 0.9, 1.2);
  nose.position.set(0, 0.09, 0.098);

  for (const side of [-1, 1]) {
    const eye = put(new THREE.SphereGeometry(0.02, 8, 6), eyeMat, head);
    eye.scale.set(1.2, 0.7, 0.5);
    eye.position.set(side * 0.038, 0.112, 0.092);
    const brow = put(new THREE.CapsuleGeometry(0.007, 0.032, 2, 4), hairMat, head);
    brow.rotation.z = side * -0.35;
    brow.position.set(side * 0.038, 0.142, 0.09);
    const ear = put(new THREE.SphereGeometry(0.02, 8, 6), skin, head);
    ear.scale.set(0.45, 0.85, 0.55);
    ear.position.set(side * 0.098, 0.08, 0.01);
  }
  const mouth = put(new THREE.CapsuleGeometry(0.004, 0.028, 2, 4), eyeMat, head);
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0, 0.028, 0.09);

  const hairShort = new THREE.Group();
  head.add(hairShort);
  const cap = put(new THREE.SphereGeometry(0.116, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat, hairShort);
  cap.position.y = 0.12;
  const bangs = put(new THREE.SphereGeometry(0.055, 12, 8), hairMat, hairShort);
  bangs.scale.set(1.7, 0.55, 0.7);
  bangs.position.set(0, 0.145, 0.06);
  const nape = put(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.4), hairMat, hairShort);
  nape.position.set(0, 0.06, -0.04);

  const hairTied = new THREE.Group();
  head.add(hairTied);
  const tiedCap = put(new THREE.SphereGeometry(0.118, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat, hairTied);
  tiedCap.position.y = 0.125;
  const bun = put(new THREE.SphereGeometry(0.05, 12, 10), hairMat, hairTied);
  bun.position.set(0, 0.1, -0.09);
  const tail = hang(0.02, 0.1, hairMat, hairTied);
  tail.position.set(0, 0.02, -0.1);
  const band = put(new THREE.TorusGeometry(0.028, 0.006, 6, 10), trim, hairTied);
  band.position.set(0, 0.1, -0.075);

  const hairHood = new THREE.Group();
  head.add(hairHood);
  const cowl = put(new THREE.SphereGeometry(0.155, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.72), coat, hairHood);
  cowl.position.set(0, 0.12, -0.045);
  const hoodRim = put(new THREE.TorusGeometry(0.09, 0.012, 6, 16), trim, hairHood);
  hoodRim.position.set(0, 0.08, 0.04);
  hoodRim.rotation.x = 1.15;
  for (const side of [-1, 1]) {
    const flap = hang(0.034, 0.16, coat, hairHood);
    flap.position.x = side * 0.1;
    flap.position.z = -0.02;
    flap.rotation.z = side * -0.55;
    flap.rotation.x = 0.15;
  }

  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.175, 0.44, 0.02);
    spine.add(pivot);
    const cap = put(new THREE.SphereGeometry(0.055, 10, 8), coat, pivot);
    cap.scale.set(1, 0.8, 0.8);
    hang(0.048, 0.2, coat, pivot);
    const fore = new THREE.Group();
    fore.position.y = -0.28;
    pivot.add(fore);
    const forearm = hang(0.04, 0.18, coat, fore);
    forearm.position.y += 0.05;
    const cuff = put(new THREE.TorusGeometry(0.04, 0.008, 6, 10), trim, fore);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.02;
    const hand = new THREE.Group();
    hand.position.y = -0.26;
    fore.add(hand);
    const palm = put(new THREE.SphereGeometry(0.04, 10, 8), skin, hand);
    palm.scale.set(0.85, 1.15, 0.55);
    const thumb = put(new THREE.SphereGeometry(0.016, 8, 6), skin, hand);
    thumb.position.set(side * 0.03, 0.01, 0.02);
    return { pivot, fore };
  };

  const leg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.075, -0.02, 0);
    hips.add(pivot);
    hang(0.055, 0.26, coat, pivot);
    const shin = new THREE.Group();
    shin.position.y = -0.4;
    pivot.add(shin);
    hang(0.042, 0.24, coat, shin);
    const foot = put(new THREE.SphereGeometry(0.055, 10, 8), shoe, shin);
    foot.scale.set(0.7, 0.42, 1.35);
    foot.position.set(0, -0.36, 0.04);
    return { pivot, shin };
  };

  const mantle = new THREE.Group();
  const mantleCloth = put(new THREE.SphereGeometry(0.24, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), coat, mantle);
  mantleCloth.scale.set(1.35, 0.42, 0.95);
  mantleCloth.position.set(0, 0.4, -0.02);
  spine.add(mantle);

  const armL = arm(-1);
  const armR = arm(1);
  const legL = leg(-1);
  const legR = leg(1);

  const shadow = put(new THREE.CircleGeometry(0.46, 20), new THREE.MeshBasicMaterial({
    color: 0x05080a,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  }), root);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.scale.set(1, 1.15, 1);
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
  const hair = normalizeLook(look).hair;
  fig.coat.color.setHex(spec.coat);
  fig.trim.color.setHex(spec.trim);
  fig.skin.color.setHex(spec.skin);
  fig.skin.emissive.setHex(spec.skin);
  fig.hairMat.color.setHex(spec.hair);
  fig.head.visible = !!showHead;
  fig.hairShort.visible = showHead && hair === "short";
  fig.hairTied.visible = showHead && hair === "tied";
  fig.hairHood.visible = showHead && hair === "hood";
  if (fig.mantle) fig.mantle.visible = !!showHead && hair === "hood";
}

function resetPose(fig) {
  fig.hips.position.y = 0.92;
  fig.hips.rotation.set(0, 0, 0);
  fig.spine.rotation.set(0, 0, 0);
  fig.head.rotation.set(0, 0, 0);
  for (const part of [fig.armL, fig.armR, fig.foreL, fig.foreR, fig.legL, fig.legR, fig.shinL, fig.shinR]) {
    part.rotation.set(0, 0, 0);
  }
  fig.armL.rotation.z = -0.12;
  fig.armR.rotation.z = 0.12;
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
  const skin = skinMat(spec.skin);
  const cloth = clothMat(spec.coat);
  const root = new THREE.Group();
  const left = new THREE.Group();
  const right = new THREE.Group();
  root.add(left, right);

  const mitt = (side, parent) => {
    const sleeve = put(new THREE.CapsuleGeometry(0.042, 0.1, 3, 7), cloth, parent);
    sleeve.rotation.x = 0.7;
    sleeve.position.set(0, 0.02, 0.02);
    const palm = put(new THREE.SphereGeometry(0.042, 10, 8), skin, parent);
    palm.scale.set(0.9, 0.62, 1.25);
    palm.position.set(side * 0.01, -0.045, -0.02);
    const thumb = put(new THREE.SphereGeometry(0.016, 8, 6), skin, parent);
    thumb.position.set(side * 0.04, -0.03, 0.01);
    for (let i = 0; i < 3; i += 1) {
      const finger = put(new THREE.CapsuleGeometry(0.008, 0.02, 2, 4), skin, parent);
      finger.rotation.x = 0.4;
      finger.position.set(side * 0.004 + (i - 1) * 0.014, -0.07, -0.03);
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
      skin.emissive.setHex(p.skin);
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
  for (const material of fig.materials) material.dispose();
}
