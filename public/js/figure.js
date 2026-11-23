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

  const cape = put(new THREE.CylinderGeometry(0.14, 0.24, 0.72, 22, 1, true), coat, hips);
  cape.position.y = -0.12;
  cape.scale.set(1.02, 1, 0.76);

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

  // 兜帽只包后脑和头顶，脸留在开口里。phi 从 π 起，盖住 -Z 那一侧。
  const hood = put(new THREE.SphereGeometry(0.155, 22, 16, Math.PI, Math.PI, 0.2, Math.PI * 0.62), coat, head);
  hood.position.set(0, 0.1, -0.02);
  const hoodInner = put(new THREE.SphereGeometry(0.118, 16, 10, Math.PI, Math.PI, 0.35, Math.PI * 0.4), lining, head);
  hoodInner.position.set(0, 0.11, -0.035);

  const hairShort = new THREE.Group();
  head.add(hairShort);
  const fringe = put(new THREE.SphereGeometry(0.07, 12, 10), hairMat, hairShort);
  fringe.scale.set(1.5, 0.38, 0.45);
  fringe.position.set(0, 0.14, 0.07);

  const hairTied = new THREE.Group();
  head.add(hairTied);
  const tuft = put(new THREE.SphereGeometry(0.04, 12, 10), hairMat, hairTied);
  tuft.position.set(0, 0.16, -0.08);
  const ribbon = put(new THREE.TorusGeometry(0.022, 0.006, 6, 10), lining, hairTied);
  ribbon.position.set(0, 0.15, -0.06);
  ribbon.rotation.x = 0.7;

  const hairHood = new THREE.Group();
  head.add(hairHood);
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

/** 站、走、跪、揖、合十、默哀。披风挂在胯上，鞠躬时上身弯、斗篷还垂着。 */
export function applyPose(fig, anim, time, phase = 0) {
  resetPose(fig);
  const breathe = Math.sin(time * 1.4 + phase) * 0.01;
  fig.spine.rotation.x = breathe;

  if (anim === "walk" || anim === "run") {
    const run = anim === "run";
    const s = Math.sin(time * (run ? 11 : 6.4) + phase);
    const amp = run ? 0.62 : 0.42;
    fig.legL.rotation.x = s * amp;
    fig.legR.rotation.x = -s * amp;
    fig.shinL.rotation.x = Math.max(0, -s) * (run ? 0.8 : 0.55);
    fig.shinR.rotation.x = Math.max(0, s) * (run ? 0.8 : 0.55);
    fig.armL.rotation.x = -s * amp * 0.65;
    fig.armR.rotation.x = s * amp * 0.65;
    fig.hips.position.y = 0.92 + Math.abs(Math.cos(time * (run ? 11 : 6.4) + phase)) * (run ? 0.04 : 0.025);
    return;
  }

  if (anim === "sit") {
    fig.hips.position.y = 0.48;
    fig.legL.rotation.x = -1.2;
    fig.legR.rotation.x = -1.2;
    fig.shinL.rotation.x = 1.35;
    fig.shinR.rotation.x = 1.35;
    fig.spine.rotation.x = 0.06;
    fig.armL.rotation.x = 0.2;
    fig.armR.rotation.x = 0.2;
    return;
  }

  if (anim === "kneel") {
    fig.hips.position.y = 0.42;
    fig.hips.rotation.x = 0.06;
    fig.legL.rotation.x = -1.4;
    fig.legR.rotation.x = -1.4;
    fig.shinL.rotation.x = 2.15;
    fig.shinR.rotation.x = 2.15;
    fig.spine.rotation.x = 0.28;
    fig.head.rotation.x = 0.16;
    fig.armL.rotation.x = 0.85;
    fig.armR.rotation.x = 0.85;
    fig.foreL.rotation.x = -1.2;
    fig.foreR.rotation.x = -1.2;
    return;
  }

  if (anim === "bow") {
    fig.spine.rotation.x = 0.72;
    fig.head.rotation.x = 0.2;
    fig.armL.rotation.x = 0.35;
    fig.armR.rotation.x = 0.35;
    return;
  }

  if (anim === "clasp") {
    fig.armL.rotation.set(1.0, 0.35, -0.04);
    fig.armR.rotation.set(1.0, -0.35, 0.04);
    fig.foreL.rotation.x = -1.4;
    fig.foreR.rotation.x = -1.4;
    fig.head.rotation.x = 0.12;
    fig.spine.rotation.x = 0.05;
    return;
  }

  if (anim === "mourn") {
    fig.spine.rotation.x = 0.12;
    fig.head.rotation.x = 0.38;
    fig.armL.rotation.x = 0.12;
    fig.armR.rotation.x = 0.12;
    return;
  }

  if (anim === "ghost") {
    fig.armL.rotation.set(-0.2, 0, -0.28);
    fig.armR.rotation.set(-0.2, 0, 0.28);
    fig.spine.rotation.x = -0.06;
  }
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
      const bob = Math.sin(time * (speed > 4 ? 11 : 6.4)) * Math.min(speed, 6) * 0.008;
      const lookingDown = pitch > 0.42;
      const show = !lookingDown && anim !== "sit";
      root.visible = show;
      if (!show) return;
      left.position.set(-0.2, -0.16 + bob, -0.36);
      right.position.set(0.2, -0.16 - bob, -0.36);
      left.rotation.set(0.45, 0.12, 0.1);
      right.rotation.set(0.45, -0.12, -0.1);
      if (anim === "walk" || anim === "run") {
        const s = Math.sin(time * (anim === "run" ? 11 : 6.4));
        left.position.z += s * 0.035;
        right.position.z -= s * 0.035;
      } else if (anim === "clasp") {
        left.position.set(-0.04, -0.05, -0.34);
        right.position.set(0.04, -0.05, -0.34);
        left.rotation.set(1.05, 0.4, 0.08);
        right.rotation.set(1.05, -0.4, -0.08);
      } else if (anim === "bow" || anim === "kneel") {
        left.position.set(-0.1, -0.26, -0.46);
        right.position.set(0.1, -0.26, -0.46);
        left.rotation.set(1.05, 0.08, 0.04);
        right.rotation.set(1.05, -0.08, -0.04);
      } else if (anim === "mourn") {
        left.position.y -= 0.05;
        right.position.y -= 0.05;
      } else if (anim === "ghost") {
        left.position.set(-0.28, -0.08, -0.38);
        right.position.set(0.28, -0.08, -0.38);
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
    material.dispose();
  }
}
