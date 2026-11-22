import * as THREE from "three";
import { LOOKS, normalizeLook } from "./rules.js";

/**
 * 来客是一个人：衣服、头发、手脚都在。
 * 动作改的是这具身体上的关节，不再是一团会飘的雾。
 */

function palette(look) {
  return LOOKS.palette[normalizeLook(look).coat];
}

function clothMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.02 });
}

function skinMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.0 });
}

function box(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

export function createFigure(look, { local = false } = {}) {
  const spec = palette(look);
  const coat = clothMat(spec.coat);
  const trim = clothMat(spec.trim);
  const skin = skinMat(spec.skin);
  const hairMat = clothMat(spec.hair);
  const shoe = clothMat(spec.shoe);
  const materials = [coat, trim, skin, hairMat, shoe];

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);

  const pelvis = box(0.34, 0.2, 0.2, coat);
  pelvis.position.y = 0.02;
  hips.add(pelvis);

  const spine = new THREE.Group();
  spine.position.y = 0.12;
  hips.add(spine);
  const torso = box(0.4, 0.52, 0.22, coat);
  torso.position.y = 0.26;
  // 自己的眼睛在头的位置。胸口稍稍靠前，低头才看得见自己的衣服，而不是一团空。
  if (local) torso.position.z = 0.14;
  spine.add(torso);
  const collar = box(0.18, 0.05, 0.06, trim);
  collar.position.set(0, 0.5, 0.09);
  spine.add(collar);
  const sash = box(0.42, 0.045, 0.23, trim);
  sash.position.y = 0.02;
  spine.add(sash);

  const head = new THREE.Group();
  head.position.y = 0.56;
  spine.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), skin);
  skull.position.y = 0.11;
  skull.scale.set(1, 1.08, 0.96);
  head.add(skull);

  const hairShort = new THREE.Mesh(
    new THREE.SphereGeometry(0.132, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    hairMat
  );
  hairShort.position.y = 0.15;
  head.add(hairShort);

  const hairTied = new THREE.Group();
  const tiedCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.132, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat
  );
  tiedCap.position.y = 0.15;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), hairMat);
  knot.position.set(0, 0.02, -0.11);
  hairTied.add(tiedCap, knot);
  head.add(hairTied);

  const hairHood = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.68),
    coat
  );
  hairHood.position.y = 0.13;
  head.add(hairHood);

  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.25, 0.46, 0);
    spine.add(pivot);
    const upper = box(0.09, 0.28, 0.1, coat);
    upper.position.y = -0.15;
    pivot.add(upper);
    const fore = new THREE.Group();
    fore.position.y = -0.3;
    pivot.add(fore);
    const forearm = box(0.08, 0.26, 0.09, coat);
    forearm.position.y = -0.13;
    fore.add(forearm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.045), skin);
    hand.position.y = -0.29;
    fore.add(hand);
    const cuff = box(0.09, 0.035, 0.1, trim);
    cuff.position.y = -0.02;
    fore.add(cuff);
    return { pivot, fore };
  };

  const leg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.09, -0.02, 0);
    hips.add(pivot);
    const thigh = box(0.11, 0.4, 0.12, coat);
    thigh.position.y = -0.2;
    pivot.add(thigh);
    const shin = new THREE.Group();
    shin.position.y = -0.4;
    pivot.add(shin);
    const calf = box(0.1, 0.38, 0.11, coat);
    calf.position.y = -0.18;
    shin.add(calf);
    const foot = box(0.1, 0.06, 0.2, shoe);
    foot.position.set(0, -0.38, 0.04);
    shin.add(foot);
    return { pivot, shin };
  };

  const armL = arm(-1);
  const armR = arm(1);
  const legL = leg(-1);
  const legR = leg(1);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 18),
    new THREE.MeshBasicMaterial({ color: 0x05080a, transparent: true, opacity: 0.35, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  shadow.renderOrder = 1;
  root.add(shadow);
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
    coat,
    trim,
    skin,
    hairMat,
    shadow,
    materials,
    local,
  };
  // 自己的头在眼睛里面，藏掉，免得从里面看见头骨
  if (local) fig.head.visible = false;
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
  fig.hairMat.color.setHex(spec.hair);
  fig.head.visible = !!showHead;
  fig.hairShort.visible = showHead && hair === "short";
  fig.hairTied.visible = showHead && hair === "tied";
  fig.hairHood.visible = showHead && hair === "hood";
}

function resetPose(fig) {
  fig.hips.position.y = 0.92;
  fig.hips.rotation.set(0, 0, 0);
  fig.spine.rotation.set(0, 0, 0);
  fig.head.rotation.set(0, 0, 0);
  for (const part of [fig.armL, fig.armR, fig.foreL, fig.foreR, fig.legL, fig.legR, fig.shinL, fig.shinR]) {
    part.rotation.set(0, 0, 0);
  }
  fig.armL.rotation.z = -0.08;
  fig.armR.rotation.z = 0.08;
}

/** 站、走、跪、揖、合十、默哀。时间只用来呼吸和迈步，姿态本身是稳的。 */
export function applyPose(fig, anim, time, phase = 0) {
  resetPose(fig);
  const breathe = Math.sin(time * 1.5 + phase) * 0.015;
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
    fig.hips.position.y = 0.5;
    fig.hips.rotation.x = 0.12;
    fig.legL.rotation.x = -1.5;
    fig.legR.rotation.x = -1.5;
    fig.shinL.rotation.x = 2.25;
    fig.shinR.rotation.x = 2.25;
    fig.spine.rotation.x = 0.72;
    fig.head.rotation.x = 0.28;
    fig.armL.rotation.x = 0.7;
    fig.armR.rotation.x = 0.7;
    fig.armL.rotation.z = 0.05;
    fig.armR.rotation.z = -0.05;
    fig.foreL.rotation.x = -1.15;
    fig.foreR.rotation.x = -1.15;
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
    material.opacity = material === fig.shadow.material ? opacity * 0.35 : opacity;
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
    const sleeve = box(0.09, 0.16, 0.09, cloth);
    sleeve.position.set(0, 0.02, 0.04);
    sleeve.rotation.x = 0.5;
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.05, 0.1), skin);
    palm.position.set(side * 0.01, -0.05, -0.02);
    parent.add(sleeve, palm);
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
