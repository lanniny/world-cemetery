import * as THREE from "three";
import { heightAt, groundNormal, isInLake } from "./world.js";
import { RULES } from "./rules.js";

const STONE_COLD = new THREE.Color(0x3c464b);
const STONE_WARM = new THREE.Color(0x4a4038);

let stoneTexCache = null;
/** 贴地的一团软暗，给碑和献物一个落在地上的根。 */
function makeSoftShadowTexture() {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.5, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const SHADOW_TEX = makeSoftShadowTexture();

function makeShadowMesh(w, d, opacity = 0.5) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({
      map: SHADOW_TEX,
      color: 0x000000,
      transparent: true,
      opacity,
      depthWrite: false,
      fog: true,
    })
  );
}

function stoneTexture() {
  if (stoneTexCache) return stoneTexCache;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#b9c1c0";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 5 + 0.6;
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(120,128,128,0.35)" : "rgba(214,220,218,0.25)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 几道裂纹
  ctx.strokeStyle = "rgba(92,99,100,0.5)";
  for (let i = 0; i < 6; i++) {
    ctx.lineWidth = Math.random() * 1.2 + 0.3;
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    const steps = 5 + Math.floor(Math.random() * 5);
    for (let s = 0; s < steps; s++) {
      x += (Math.random() - 0.5) * 46;
      y += (Math.random() - 0.5) * 46;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  stoneTexCache = tex;
  return tex;
}

export function stoneColor(tone = 2) {
  const t = Math.max(0, Math.min(5, tone)) / 5;
  return STONE_COLD.clone().lerp(STONE_WARM, t);
}

export function glowColor(tone = 2, lights = 0) {
  const t = Math.max(0, Math.min(5, tone)) / 5;
  const cold = new THREE.Color(0x86e6d2);
  const warm = new THREE.Color(0xf0b476);
  const base = cold.clone().lerp(warm, t);
  return base.multiplyScalar(1 + Math.min(lights, 12) * 0.06);
}

/** 把名字和那一行字刻成贴到碑面上的透明图。
 *  石板/方柱/门形是竖排，屏幕碑是横排——否则字会被压扁。 */
/** 碑前放下的东西：一朵花、一根蜡烛、一只纸鸟。 */
const OFFER_LOOK = {
  paper: { color: 0xf0e9dc, emissive: 0x5a5340, emissiveIntensity: 0.55, roughness: 0.8 },
  stem: { color: 0x445638, emissive: 0x141a10, emissiveIntensity: 0.45, roughness: 0.9 },
  wax: { color: 0xefe6d2, emissive: 0x4a4030, emissiveIntensity: 0.5, roughness: 0.6 },
};

const OFFER_FRESH = new THREE.Color(0xf0e9dc);
const OFFER_FADED = new THREE.Color(0x8e7a58);

function offerMat(look) {
  return new THREE.MeshStandardMaterial({ ...look });
}

function makeOffering(kind) {
  const g = new THREE.Group();
  if (kind === "flower") {
    const paper = offerMat(OFFER_LOOK.paper);
    const stemMat = offerMat(OFFER_LOOK.stem);
    for (let i = 0; i < 3; i += 1) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.34, 6), stemMat);
      stem.position.set((i - 1) * 0.06, 0.17, (i % 2) * 0.05);
      stem.rotation.z = (i - 1) * 0.12;
      g.add(stem);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), paper);
      head.position.set((i - 1) * 0.065, 0.36, (i % 2) * 0.05);
      g.add(head);
    }
    g.userData = { kind: "flower", mat: paper };
    return g;
  }
  if (kind === "candle") {
    const waxMat = offerMat(OFFER_LOOK.wax);
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, 0.22, 8), waxMat);
    wax.position.y = 0.11;
    g.add(wax);
    const flame = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        color: 0xffb867,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.9,
        fog: false,
      })
    );
    flame.scale.set(0.3, 0.3, 1);
    flame.position.y = 0.27;
    g.add(flame);
    g.userData = { kind: "candle", mat: waxMat, wax, flame };
    return g;
  }
  if (kind === "bird") {
    // 一只折纸的鸟：几片薄纸撑起来，风一吹就那样立着
    const paper = offerMat({ ...OFFER_LOOK.paper, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.16), paper);
    body.position.set(0, 0.06, 0.01);
    body.rotation.x = -0.12;
    g.add(body);
    for (const side of [1, -1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), paper);
      wing.position.set(side * 0.06, 0.06, 0);
      wing.rotation.set(-0.25, side * 0.55, side * 0.22);
      g.add(wing);
    }
    g.userData = { kind: "bird", mat: paper };
    return g;
  }
  return null;
}

/** 放在碑前的东西也会旧：花枯下去，蜡烧矮、火自己灭，纸鸟慢慢塌。 */
function weatherOffering(item, ageDays) {
  const d = item.userData || {};
  if (!d.mat || !d.kind) return;
  const t = Math.min(1, Math.max(0, ageDays / 45));
  d.mat.color.copy(OFFER_FRESH).lerp(OFFER_FADED, t);
  d.mat.emissiveIntensity = 0.55 * (1 - t * 0.6);
  if (d.kind === "flower") {
    item.scale.setScalar(1 - t * 0.22);
    item.rotation.z = -t * 0.3;
  } else if (d.kind === "bird") {
    item.rotation.z = t * 0.36;
  } else if (d.kind === "candle") {
    if (d.flame) d.flame.visible = ageDays < 6;
    const keep = Math.max(0.35, 1 - ageDays / 70);
    if (d.wax) {
      d.wax.scale.y = keep;
      d.wax.position.y = 0.11 * keep;
    }
  }
}

/** 1954 — 2021：只写年份，写成碑面上一行小字。 */
function lifeLine(grave) {
  const b = /^\d{4}$/.test(grave.born || "") ? grave.born : "";
  const d = /^\d{4}$/.test(grave.died || "") ? grave.died : "";
  if (b && d) return `${b} — ${d}`;
  if (b) return `生于 ${b}`;
  if (d) return `卒于 ${d}`;
  return "";
}

export function makeFaceTexture(grave, opts = {}) {
  const horizontal = opts.horizontal ?? grave.form === "screen";
  const w = opts.w || (horizontal ? 512 : 256);
  const h = opts.h || (horizontal ? 320 : 480);
  // 小牌子（树牌、船牌、灯笼）按比例缩字号，否则字会撑爆
  const k = Math.min(h / 320, w / 512);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  const name = String(grave.name || "").slice(0, 12);
  const chars = [...name];
  const line = String(grave.epitaph || "");
  const textAlpha = grave.sealed ? 0.34 : 1;

  if (horizontal && grave.form === "screen") {
    // 屏幕碑：先铺一层发绿的暗屏
    ctx.fillStyle = "rgba(6, 14, 15, 0.92)";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      ctx.fillStyle = "rgba(84, 196, 186, 0.05)";
      ctx.fillRect(0, y, w, 1);
    }
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(120, 220, 210, 0.08)");
    g.addColorStop(1, "rgba(10, 30, 30, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  if (horizontal) {
    const nameSize = (chars.length > 8 ? 30 : chars.length > 6 ? 36 : 44) * k;
    ctx.font = `${nameSize}px "Songti SC", "SimSun", serif`;
    ctx.fillStyle = `rgba(16, 26, 28, ${0.6 * textAlpha})`;
    ctx.fillText(name, w / 2 + 2 * k, h * 0.42 + 2 * k);
    ctx.globalAlpha = textAlpha;
    ctx.fillStyle = "rgba(214, 255, 244, 0.96)";
    ctx.fillText(name, w / 2, h * 0.42);

    ctx.strokeStyle = `rgba(196, 242, 233, ${0.28 * textAlpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 70 * k, h * 0.52);
    ctx.lineTo(w / 2 + 70 * k, h * 0.52);
    ctx.stroke();

    if (line) {
      ctx.font = `${18 * k}px "Songti SC", "SimSun", serif`;
      ctx.fillStyle = `rgba(180, 232, 222, ${0.85 * textAlpha})`;
      const perLine = Math.max(5, Math.round(18 * (w / 512)));
      const lead = 26 * k;
      let ry = h * 0.52 + 34 * k;
      for (let i = 0; i < line.length && i < perLine * 3; i += perLine) {
        ctx.fillText(line.slice(i, i + perLine), w / 2, ry);
        ry += lead;
      }
    }
    ctx.globalAlpha = 1;
  } else {
    // 碑上有照片时，照片占碑面顶部，名字往下让
    const hasPhoto = grave.photoOn === "face" && !!grave.photo;
    const zoneTop = hasPhoto ? Math.round(h * 0.34) : 40;
    const bottomLimit = h - 130;
    const nameRoom = Math.max(60, bottomLimit - zoneTop);
    let nameSize = chars.length > 7 ? 24 : chars.length > 5 ? 28 : hasPhoto ? 32 : 36;
    const fit = Math.floor(nameRoom / Math.max(1, chars.length) / 1.16);
    if (fit < nameSize) nameSize = Math.max(14, fit);
    const gap = nameSize * 1.16;
    const totalH = chars.length * gap;
    let y = zoneTop + Math.max(nameSize, (nameRoom - totalH) / 2 + nameSize);

    ctx.font = `${nameSize}px "Songti SC", "SimSun", serif`;
    for (const ch of chars) {
      const jitter = Math.sin(ch.charCodeAt(0) * 7.3) * 1.2;
      ctx.save();
      ctx.fillStyle = `rgba(18, 26, 28, ${0.6 * textAlpha})`;
      ctx.fillText(ch, w / 2 + jitter + 1.5, y + 1.5);
      ctx.globalAlpha = textAlpha * (0.86 + Math.random() * 0.14);
      ctx.fillStyle = "rgba(228, 255, 248, 0.95)";
      ctx.fillText(ch, w / 2 + jitter, y);
      ctx.restore();
      y += gap;
    }

    const lineY = Math.min(h - 120, y + 6);
    ctx.strokeStyle = `rgba(196, 242, 233, ${0.22 * textAlpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 34, lineY);
    ctx.lineTo(w / 2 + 34, lineY);
    ctx.stroke();

    // 生卒：一道小字。碑上有它，才像一块真的碑
    const life = lifeLine(grave);
    let nextY = lineY + 30;
    if (life) {
      ctx.font = `13px "Songti SC", "SimSun", serif`;
      ctx.fillStyle = `rgba(172, 218, 210, ${0.78 * textAlpha})`;
      ctx.fillText(life, w / 2, lineY + 25);
      nextY = lineY + 52;
    }

    if (line) {
      ctx.font = `15px "Songti SC", "SimSun", serif`;
      ctx.fillStyle = `rgba(186, 232, 225, ${0.9 * textAlpha})`;
      const perLine = 11;
      let ry = nextY;
      for (let i = 0; i < line.length && i < perLine * 4; i += perLine) {
        ctx.fillText(line.slice(i, i + perLine), w / 2, ry);
        ry += 24;
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 贴地扩散的一圈光，只在两个人同时站住的时候出现。 */
function makeRingTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.62, "rgba(255,255,255,0.5)");
  grad.addColorStop(0.9, "rgba(255,255,255,0.1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const RING_TEXTURE = makeRingTexture();
const PHOTO_LOADER = new THREE.TextureLoader();

const FORM_LABELS = { slab: "石板碑", pillar: "方柱碑", gate: "门形碑", screen: "屏幕碑" };
const RELIC_LABELS = { none: "什么都不放", candle: "一支烛", flower: "一束花", phone: "一部旧手机", chair: "一把空椅", bird: "一只纸鸟" };
const BURIAL_LABELS = { stone: "立一块碑", tree: "埋在树根下", water: "放在水面上", sky: "放上天空" };

export const formLabel = (id) => FORM_LABELS[id] || "石板碑";
export const relicLabel = (id) => RELIC_LABELS[id] || "什么都不放";
export const burialLabel = (id) => BURIAL_LABELS[id] || "立一块碑";

/** 时间会把这些颜色带到每一尊东西上：石头走苔，木头走暗，纸走黄，灯走烟。 */
const WEATHER_TINT = {
  stone: 0x74805f,
  wood: 0x54432f,
  paper: 0xcbb083,
  sky: 0x9c5533,
};

/** 一盏灯悬多高：由 id 推出来，同一盏灯每次都停在同一片天上。 */
const hash01 = (text) => {
  let h = 7;
  for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h / 9973;
};
const skyHeight = (grave) => {
  const [lo, hi] = RULES.grave.skyHover;
  return lo + (hi - lo) * hash01(grave.id);
};

function makeShape(form) {
  const group = new THREE.Group();

  if (form === "slab") {
    const shape = new THREE.Shape();
    shape.moveTo(-0.5, 0);
    shape.lineTo(-0.5, 1.36);
    shape.quadraticCurveTo(-0.5, 1.72, 0, 1.72);
    shape.quadraticCurveTo(0.5, 1.72, 0.5, 1.36);
    shape.lineTo(0.5, 0);
    shape.lineTo(-0.5, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.17, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 8 });
    geo.translate(0, 0, -0.085);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.03 }));
    group.add(mesh);
    group.userData.face = { w: 0.72, h: 1.34, y: 0.96, z: 0.14 };
  } else if (form === "pillar") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.95, 0.44), new THREE.MeshStandardMaterial({ roughness: 0.9 }));
    body.position.y = 0.98;
    group.add(body);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.58), new THREE.MeshStandardMaterial({ roughness: 0.9 }));
    cap.position.y = 2.0;
    group.add(cap);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.14, 0.64), new THREE.MeshStandardMaterial({ roughness: 0.95 }));
    base.position.y = 0.07;
    group.add(base);
    group.userData.face = { w: 0.36, h: 1.45, y: 1.0, z: 0.24 };
  } else if (form === "gate") {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.1, 0.2), mat);
    left.position.set(-0.62, 1.05, 0);
    const right = left.clone();
    right.position.x = 0.62;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.22), mat);
    beam.position.y = 2.1;
    group.add(left, right, beam);
    group.userData.face = { w: 0.8, h: 1.25, y: 1.18, z: 0.13 };
  } else {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.15 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.09), mat);
    panel.position.y = 1.05;
    panel.rotation.x = -0.12;
    group.add(panel);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.12), mat);
    stand.position.y = 0.3;
    group.add(stand);
    group.userData.face = { w: 1.28, h: 0.84, y: 1.05, z: 0.05, tilt: -0.12 };
  }
  return group;
}

function makeRelic(kind, glow) {
  const group = new THREE.Group();
  if (kind === "none" || !kind) return group;

  if (kind === "candle") {
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.04, 0.16, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8cfbc, roughness: 0.8 })
    );
    wax.position.y = 0.08;
    group.add(wax);
    const flame = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeGlowTexture(), color: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    flame.scale.set(0.22, 0.3, 1);
    flame.position.y = 0.22;
    group.add(flame);
    group.userData.flame = flame;
  } else if (kind === "flower") {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd7e3dd, roughness: 0.7, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const petal = new THREE.Mesh(new THREE.CircleGeometry(0.06, 5), mat);
      const a = (i / 7) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.07, 0.1 + Math.random() * 0.1, Math.sin(a) * 0.07);
      petal.rotation.set(Math.random(), a, 0.6 + Math.random() * 0.4);
      group.add(petal);
    }
  } else if (kind === "phone") {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.17, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x0d1114, roughness: 0.4, metalness: 0.5 })
    );
    body.position.y = 0.11;
    body.rotation.x = -0.4;
    body.rotation.y = 0.3;
    group.add(body);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.072, 0.13),
      new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.5 })
    );
    screen.position.set(0, 0.112, 0.008);
    screen.rotation.copy(body.rotation);
    screen.translateZ(0.001);
    group.add(screen);
    group.userData.screen = screen;
  } else if (kind === "chair") {
    const wood = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.95 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.36), wood);
    seat.position.y = 0.42;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.04), wood);
    back.position.set(0, 0.64, -0.16);
    const legs = [0.17, -0.17].flatMap((x) => [0.15, -0.15].map((z) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.04), wood);
      leg.position.set(x, 0.21, z);
      return leg;
    }));
    group.add(seat, back, ...legs);
  } else if (kind === "bird") {
    const paper = new THREE.MeshStandardMaterial({ color: 0xcfd9d4, roughness: 0.9, side: THREE.DoubleSide });
    const wing = new THREE.PlaneGeometry(0.24, 0.1);
    const l = new THREE.Mesh(wing, paper);
    l.rotation.z = 0.5;
    l.position.x = -0.1;
    const r = new THREE.Mesh(wing, paper);
    r.rotation.z = -0.5;
    r.position.x = 0.1;
    const body = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.16), paper);
    body.rotation.x = -1.2;
    body.position.y = 0.02;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.14, 6), paper);
    base.position.y = 0.07;
    l.position.y = r.position.y = body.position.y = 0.16;
    group.add(l, r, body, base);
    group.userData.bird = [l, r];
  }
  group.position.z = 0.58;
  return group;
}

let glowTextureCache = null;
export function makeGlowTexture() {
  if (glowTextureCache) return glowTextureCache;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  glowTextureCache = tex;
  return tex;
}

export class GraveSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.entries = new Map();
    this.time = 0;

    // 真实光源很贵，只给离玩家最近的几座碑用
    this.lightPool = [];
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0x9fe8dc, 0, 9, 2);
      light.visible = false;
      scene.add(light);
      this.lightPool.push(light);
    }
  }

  add(grave, { fresh = false } = {}) {
    if (this.entries.has(grave.id)) return this.entries.get(grave.id);
    const burial = RULES.grave.burialIds.includes(grave.burial) ? grave.burial : "stone";
    if (burial !== "stone") return this.addOther(grave, burial, { fresh });
    const root = new THREE.Group();
    const glow = glowColor(grave.tone, grave.lights);

    const body = makeShape(grave.form);
    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneTexture(),
      color: stoneColor(grave.tone),
      roughness: 0.94,
      metalness: 0.02,
      emissive: 0x0e1514,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide,
    });
    body.traverse((o) => {
      if (o.isMesh) o.material = stoneMat;
    });
    root.add(body);

    // 碑脚下的一团软暗：没有它，碑像浮在雾里
    const rootShadow = makeShadowMesh(1.12, 0.95, 0.55);
    rootShadow.rotation.x = -Math.PI / 2;
    rootShadow.position.y = 0.062;
    rootShadow.renderOrder = 1;
    root.add(rootShadow);

    const faceInfo = body.userData.face;
    const tex = makeFaceTexture(grave);
    const faceMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      color: 0xffffff,
      opacity: 1,
      fog: true,
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(faceInfo.w, faceInfo.h), faceMat);
    face.position.set(0, faceInfo.y, faceInfo.z);
    if (faceInfo.tilt) face.rotation.x = faceInfo.tilt;
    face.renderOrder = 2;
    root.add(face);

    // 碑前的微光
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        color: glow,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.35,
      })
    );
    halo.scale.setScalar(2.4);
    halo.position.set(0, 1.1, 0.2);
    root.add(halo);

    const relic = makeRelic(grave.relic, glow);
    root.add(relic);

    // 碑上的照片：可以嵌在碑面（字下面的那块空白），也可以立在碑前
    if (grave.photo) {
      const onFace = grave.photoOn === "face";
      const tall = grave.form !== "screen";
      const maxW = onFace ? faceInfo.w * 0.46 : 0.28;
      const maxH = onFace ? faceInfo.h * 0.26 : 0.36;
      const tilt = onFace ? faceInfo.tilt || 0 : -0.12;
      const topSlot = onFace && tall;
      const baseY = onFace
        ? topSlot
          ? faceInfo.y + faceInfo.h / 2 - 0.05 - maxH / 2
          : faceInfo.y - faceInfo.h / 2 + 0.05 + maxH / 2
        : 0.42;
      const baseZ = onFace ? faceInfo.z + 0.016 : 0.015;

      if (onFace) {
        const frame = new THREE.Mesh(
          new THREE.PlaneGeometry(maxW + 0.03, maxH + 0.03),
          new THREE.MeshStandardMaterial({ color: 0x242b2e, roughness: 0.9, metalness: 0.1 })
        );
        frame.position.set(0, baseY, baseZ - 0.004);
        frame.rotation.x = tilt;
        root.add(frame);
      } else {
        const standMat = new THREE.MeshStandardMaterial({ color: 0x2a3134, roughness: 0.8, metalness: 0.15 });
        const holder = new THREE.Group();
        holder.position.set(-0.46, 0, 0.4);
        holder.rotation.y = 0.42;

        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.026), standMat);
        frame.position.y = 0.42;
        frame.rotation.x = -0.12;
        holder.add(frame);

        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.032), standMat);
        post.position.y = 0.2;
        holder.add(post);

        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.12), standMat);
        foot.position.set(0, 0.015, 0.015);
        holder.add(foot);

        root.add(holder);
        const pic2 = new THREE.Mesh(
          new THREE.PlaneGeometry(maxW, maxH),
          new THREE.MeshBasicMaterial({ color: 0x1b2023, fog: true })
        );
        pic2.position.set(0, 0.42, 0.015);
        pic2.rotation.x = -0.12;
        holder.add(pic2);
        // 地面立牌的光照与 tilt 与碑面不同，单独走一遍缩放
        PHOTO_LOADER.load(grave.photo, (tex) => {
          if (!tex.image || !tex.image.width) return;
          const aspect = tex.image.width / tex.image.height;
          let w = maxW;
          let h = w / aspect;
          if (h > maxH) {
            h = maxH;
            w = h * aspect;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          pic2.geometry.dispose();
          pic2.geometry = new THREE.PlaneGeometry(w, h);
          pic2.material.dispose();
          pic2.material = new THREE.MeshBasicMaterial({ map: tex, fog: true });
        });
      }

      if (onFace) {
        const pic = new THREE.Mesh(
          new THREE.PlaneGeometry(maxW, maxH),
          new THREE.MeshBasicMaterial({ color: 0x1b2023, fog: true })
        );
        pic.position.set(0, baseY, baseZ);
        pic.rotation.x = tilt;
        root.add(pic);

        PHOTO_LOADER.load(grave.photo, (tex) => {
          if (!tex.image || !tex.image.width) return;
          const aspect = tex.image.width / tex.image.height;
          let w = maxW;
          let h = w / aspect;
          if (h > maxH) {
            h = maxH;
            w = h * aspect;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          pic.geometry.dispose();
          pic.geometry = new THREE.PlaneGeometry(w, h);
          pic.material.dispose();
          pic.material = new THREE.MeshBasicMaterial({ map: tex, fog: true });
        });
      }
    }

    const ringMat = new THREE.MeshBasicMaterial({
      map: RING_TEXTURE,
      color: 0xbfeaff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.32, 0.9);
    ring.visible = false;
    root.add(ring);

    const x = grave.x;
    const z = grave.z;
    root.position.set(x, heightAt(x, z) - 0.06, z);
    const normal = groundNormal(x, z);
    root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    root.rotateY(grave.ry || 0);
    root.rotateX(-normal.x * 0.3);
    root.rotateZ(normal.z * 0.3);

    if (fresh) {
      root.position.y = heightAt(x, z) - 1.9;
      root.scale.setScalar(0.9);
    }

    this.group.add(root);
    body.updateMatrixWorld(true);
    const bodySize = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3()).toArray().map((n) => +n.toFixed(2));
    const entry = { id: grave.id, grave, root, face, halo, relic, ring, ringMat, ringLife: 0, stoneMat, faceMat, rise: fresh ? 0 : 1, flash: fresh ? 2.6 : 0.35, bodySize, burial: "stone", weather: { mat: stoneMat, base: stoneMat.color.clone(), kind: "stone" }, mood: null, moodAt: -1000 };
    this.entries.set(grave.id, entry);
    return entry;
  }

  /**
   * 另外三种葬法。石头之外，人还想把自己放在别的地方：
   * 树葬——一块木牌挂在树干上，牌上的字朝路；
   * 水葬——一只小船浮在湖面，船尾一块牌，船头一盏灯；
   * 天葬——一盏孔明灯悬在几米高处，慢慢漂，像还没走远。
   */
  addOther(grave, burial, { fresh = false } = {}) {
    const root = new THREE.Group();
    const glow = glowColor(grave.tone, grave.lights);
    const x = grave.x;
    const z = grave.z;

    let faceInfo = { w: 0.32, h: 0.24, y: 1.34, z: 0.3, tilt: -0.14, tw: 256, th: 192 };
    let baseY = heightAt(x, z) - 0.04;
    let haloY = 1.1;
    let haloZ = 0.2;
    let faceFog = true;
    // 时间会在这尊东西上留下痕迹：纸会旧、绳会松、灯会升。这里存下能改的那些。
    let weather = null;

    if (burial === "tree") {
      const woodMat = new THREE.MeshStandardMaterial({
        color: 0x6b5334,
        emissive: 0x161009,
        emissiveIntensity: 0.6,
        roughness: 0.92,
        metalness: 0.02,
      });
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.026), woodMat);
      board.position.set(0, 1.34, 0.4);
      board.rotation.x = -0.13;
      root.add(board);

      const rope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.007, 0.007, 0.26, 4),
        new THREE.MeshBasicMaterial({ color: 0x1b1611, fog: true })
      );
      rope.position.set(0, 1.62, 0.38);
      root.add(rope);

      // 树根边上的一小堆土
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 5),
        new THREE.MeshStandardMaterial({ color: 0x2f3730, roughness: 1 })
      );
      mound.scale.set(1.2, 0.28, 1.2);
      mound.position.y = 0.03;
      root.add(mound);

      faceInfo = { w: 0.33, h: 0.44, y: 1.34, z: 0.416, tilt: -0.13, tw: 256, th: 320 };
      haloY = 1.32;
      haloZ = 0.48;
      weather = { mat: woodMat, board, tilt0: -0.13, kind: "wood" };
    } else if (burial === "water") {
      baseY = RULES.world.waterLevel + 0.02;

      // 折纸船：两片斜面对折，中间一道折痕。纸是米白的，夜里也认得出。
      const paperMat = new THREE.MeshStandardMaterial({
        color: 0xf4eee1,
        emissive: 0x5c5343,
        emissiveIntensity: 0.75,
        roughness: 0.86,
        metalness: 0,
        side: THREE.DoubleSide,
      });
      const L = 2.3;
      const W = 0.9;

      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, W * 0.74), paperMat);
        panel.position.set(0, 0.19, side * W * 0.35);
        panel.rotation.x = side * 0.6;
        root.add(panel);
      }
      const crease = new THREE.Mesh(new THREE.BoxGeometry(L, 0.03, 0.07), paperMat);
      crease.position.set(0, 0.032, 0);
      root.add(crease);

      // 船头船尾收成尖：一块立起来的三角纸
      for (const dir of [-1, 1]) {
        const tipGeo = new THREE.BufferGeometry();
        tipGeo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(
            [
              dir * L * 0.5, 0.03, 0,
              dir * (L * 0.5 + 0.46), 0.22, 0,
              dir * L * 0.5, 0.28, 0,
            ],
            3
          )
        );
        tipGeo.computeVertexNormals();
        root.add(new THREE.Mesh(tipGeo, paperMat));
      }

      // 一张纸帆。没有它，从远处看这只是一片白。
      const sailGeo = new THREE.BufferGeometry();
      sailGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            -0.16, 0.1, 0,
            -0.16, 0.78, 0,
            0.34, 0.16, 0,
          ],
          3
        )
      );
      sailGeo.computeVertexNormals();
      root.add(new THREE.Mesh(sailGeo, paperMat));

      // 船头一盏灯。sprite 负责那圈光，灯芯是一个不受光的亮点：
      // 只用 sprite 的话，压在船板上会被深度测试切掉一半。
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd0a0, fog: false })
      );
      bulb.position.set(0.95, 0.36, 0);
      root.add(bulb);

      const lamp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: makeGlowTexture(),
          color: 0xffb779,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        })
      );
      lamp.scale.set(1.5, 1.5, 1);
      lamp.position.set(0.95, 0.4, 0);
      lamp.renderOrder = 3;
      root.add(lamp);
      root.userData.lamp = lamp;

      faceInfo = { w: 0.54, h: 0.36, y: 0.32, z: 0.03, tilt: 0, tw: 384, th: 256 };
      haloY = 0.62;
      haloZ = 0.1;
      weather = { mat: paperMat, kind: "paper" };
    } else {
      // 天葬
      baseY = heightAt(x, z) + skyHeight(grave);
      faceFog = false;

      const paperMat = new THREE.MeshStandardMaterial({
        color: 0xb8683c,
        emissive: 0xd0723c,
        emissiveIntensity: 0.95,
        roughness: 0.9,
        fog: false,
        side: THREE.DoubleSide,
      });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.64, 14, 1, true), paperMat);
      root.add(body);
      const seat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.22, 0.07, 14),
        new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95, fog: false })
      );
      seat.position.y = -0.355;
      root.add(seat);

      // 从下面看是一圈被火照亮的口：孔明灯底下不该是一个黑洞
      const mouth = new THREE.Mesh(
        new THREE.CircleGeometry(0.34, 16),
        new THREE.MeshBasicMaterial({
          color: 0xff9a55,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          fog: false,
        })
      );
      mouth.rotation.x = Math.PI / 2;
      mouth.position.y = -0.31;
      root.add(mouth);

      // 灯芯的火
      const flame = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: makeGlowTexture(),
          color: 0xffc07a,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0.85,
          fog: false,
        })
      );
      flame.scale.set(1.0, 1.0, 1);
      flame.position.y = -0.3;
      root.add(flame);
      root.userData.flame = flame;

      faceInfo = { w: 0.48, h: 0.48, y: 0, z: 0.405, tilt: 0, tw: 512, th: 512 };
      haloY = 0;
      haloZ = 0;
      weather = { mat: paperMat, flame, body, mouth, kind: "sky" };
    }

    const tex = makeFaceTexture(grave, {
      horizontal: true,
      w: faceInfo.tw,
      h: faceInfo.th,
    });
    const faceMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      color: 0xffffff,
      opacity: 1,
      fog: faceFog,
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(faceInfo.w, faceInfo.h), faceMat);
    face.position.set(0, faceInfo.y, faceInfo.z);
    if (faceInfo.tilt) face.rotation.x = faceInfo.tilt;
    face.renderOrder = 2;
    root.add(face);

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        color: glow,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.35,
        fog: faceFog,
      })
    );
    halo.scale.setScalar(burial === "sky" ? 1.9 : 2.2);
    halo.position.set(0, haloY, haloZ);
    root.add(halo);

    // 照片：树葬挂树根，水葬放在船里，天葬贴在灯上
    if (grave.photo && burial !== "sky") {
      const onFace = grave.photoOn === "face";
      const maxW = onFace ? faceInfo.w * 0.62 : 0.24;
      const maxH = onFace ? faceInfo.h * 0.3 : 0.3;
      const px = onFace ? 0 : burial === "tree" ? 0.26 : 0.1;
      const py = onFace ? faceInfo.y - faceInfo.h / 2 + maxH / 2 + 0.02 : burial === "tree" ? 0.34 : 0.12;
      const pz = onFace ? faceInfo.z + 0.012 : burial === "tree" ? 0.12 : 0.02;

      const pic = new THREE.Mesh(
        new THREE.PlaneGeometry(maxW, maxH),
        new THREE.MeshBasicMaterial({ color: 0x1b2023, fog: true })
      );
      pic.position.set(px, py, pz);
      if (onFace && faceInfo.tilt) pic.rotation.x = faceInfo.tilt;
      root.add(pic);

      PHOTO_LOADER.load(grave.photo, (t2) => {
        if (!t2.image || !t2.image.width) return;
        const aspect = t2.image.width / t2.image.height;
        let w = maxW;
        let h = w / aspect;
        if (h > maxH) {
          h = maxH;
          w = h * aspect;
        }
        t2.colorSpace = THREE.SRGBColorSpace;
        pic.geometry.dispose();
        pic.geometry = new THREE.PlaneGeometry(w, h);
        pic.material.dispose();
        pic.material = new THREE.MeshBasicMaterial({ map: t2, fog: true });
      });
    }

    // 只有落在地上的葬法才有一圈光；灯在天上，地上那一圈就不必了
    let ring = null;
    let ringMat = null;
    if (burial !== "sky") {
      ringMat = new THREE.MeshBasicMaterial({
        map: RING_TEXTURE,
        color: 0xbfeaff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.28, 0.8);
      ring.visible = false;
      root.add(ring);
    }

    root.position.set(x, baseY, z);
    if (burial === "tree") {
      const normal = groundNormal(x, z);
      root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      const treeShadow = makeShadowMesh(0.92, 0.92, 0.42);
      treeShadow.rotation.x = -Math.PI / 2;
      treeShadow.position.y = 0.05;
      root.add(treeShadow);
    }
    root.rotateY(grave.ry || 0);

    if (fresh) {
      root.scale.setScalar(0.85);
    }

    this.group.add(root);
    const entry = {
      id: grave.id,
      grave,
      root,
      face,
      halo,
      relic: null,
      ring,
      ringMat,
      ringLife: 0,
      stoneMat: null,
      faceMat,
      rise: 1,
      flash: fresh ? 2.6 : 0.35,
      bodySize: [0.4, 0.4, 0.4],
      burial,
      baseY,
      textureOpts: { horizontal: true, w: faceInfo.tw, h: faceInfo.th },
      weather: weather && { ...weather, base: weather.mat.color.clone() },
      mood: null,
      moodAt: -1000,
    };
    this.entries.set(grave.id, entry);
    return entry;
  }

  remove(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.group.remove(entry.root);
    entry.faceMat.map?.dispose();
    this.entries.delete(id);
  }

  sync(grave) {
    const entry = this.entries.get(grave.id);
    if (!entry) return;
    const prevSealed = !!entry.grave.sealed;
    const merged = { ...entry.grave, ...grave };
    entry.grave = merged;
    const glow = glowColor(merged.tone, merged.lights);
    entry.halo.material.color.copy(glow);
    if (!!merged.sealed !== prevSealed) {
      entry.faceMat.map?.dispose();
      entry.faceMat.map = makeFaceTexture(merged, entry.textureOpts || {});
      entry.faceMat.needsUpdate = true;
      entry.faceMat.opacity = merged.sealed ? 0.6 : 1;
    }
  }

  pulse(id, strength = 1.6) {
    const entry = this.entries.get(id);
    if (entry) entry.flash = Math.max(entry.flash, strength);
  }

  /** 碑前放着的东西：一朵花、一根蜡烛、一只纸鸟。放上去就不再拿走。 */
  paintOfferings(entry) {
    if (!entry.offerGroup) {
      entry.offerGroup = new THREE.Group();
      entry.root.add(entry.offerGroup);
    }
    const group = entry.offerGroup;
    while (group.children.length) {
      const old = group.children[0];
      group.remove(old);
      old.traverse?.((n) => {
        if (n.geometry) n.geometry.dispose();
      });
    }
    // 船和灯前面没有地面，放不住东西
    if (entry.grave.burial === "water" || entry.grave.burial === "sky") return;
    const list = (entry.grave.offerings || []).slice(0, 3);
    list.forEach((o, i) => {
      const item = makeOffering(o.kind);
      if (!item) return;
      item.position.set((i - (list.length - 1) / 2) * 0.3, 0.008, 0.76);
      item.rotation.y = (i - (list.length - 1) / 2) * 0.35;
      const small = makeShadowMesh(0.26, 0.26, 0.6);
      small.rotation.x = -Math.PI / 2;
      small.position.y = 0.004;
      item.add(small);
      weatherOffering(item, (Date.now() - (Date.parse(o.at) || Date.now())) / 86400000);
      group.add(item);
    });
  }

  /** 贴地推开一圈光。两个人同时站住的时候用。 */
  ringOnce(id) {
    const entry = this.entries.get(id);
    if (entry) entry.ringLife = 4.0;
  }

  /** 找出视野内最近的一座碑，供靠近提示与阅读使用。 */
  nearest(position, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const entry of this.entries.values()) {
      const dx = entry.grave.x - position.x;
      const dz = entry.grave.z - position.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) {
        bestD = d;
        best = entry;
      }
    }
    return best ? { entry: best, distance: bestD } : null;
  }

  update(dt, camera) {
    this.time += dt;
    const camPos = camera.position;
    const sorted = [];

    for (const entry of this.entries.values()) {
      // 碑前放下的东西：别人放过来时，这块碑要跟着变
      const offerSig = (entry.grave.offerings || []).map((o) => o.kind).join("|");
      if (offerSig !== entry.offerSig) {
        entry.offerSig = offerSig;
        this.paintOfferings(entry);
      }
      if (entry.offerGroup) {
        for (const item of entry.offerGroup.children) {
          const flame = item.userData && item.userData.flame;
          if (flame) {
            flame.material.opacity = 0.72 + Math.sin(this.time * 5.4 + entry.grave.x) * 0.22;
          }
        }
      }
      // —— 时间在每一尊东西上留下的痕迹。
      // 被记得的碑是亮的，没人来的碑是暗的；但没有一座会消失。
      if (this.time - entry.moodAt > 8) {
        entry.moodAt = this.time;
        const now = Date.now();
        const born = Date.parse(entry.grave.createdAt || "") || now;
        const lit = Date.parse(entry.grave.lastLightAt || "") || 0;
        const ageDays = (now - born) / 86400000;
        const sinceLight = lit ? (now - lit) / 86400000 : 3650;
        const d = new Date(now);
        const mmdd =
          String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        entry.mood = {
          weathered: Math.min(1, ageDays / 30),
          remembered: Math.max(0, 1 - sinceLight / 7),
          tonight: !!entry.grave.anniversary && entry.grave.anniversary === mmdd,
          // 很久没人来的一盏灯，会慢慢升上去，变成天上的一颗星
          starred: ageDays > 45 && sinceLight > 21,
        };
        // 碑前那几件也在旧：花枯、蜡短、火灭
        if (entry.offerGroup) {
          const list = entry.grave.offerings || [];
          entry.offerGroup.children.forEach((item, i) => {
            const o = list[i];
            if (o) weatherOffering(item, (now - (Date.parse(o.at) || now)) / 86400000);
          });
        }
      }
      const mood = entry.mood || { weathered: 0, remembered: 0, tonight: false, starred: false };
      const worn = mood.weathered * (1 - mood.remembered * 0.85);

      if (entry.weather) {
        const tint = WEATHER_TINT[entry.weather.kind] ?? WEATHER_TINT.stone;
        entry.weather.mat.color.copy(entry.weather.base).lerp(new THREE.Color(tint), worn * 0.9);
        // 木牌会慢慢垂下来
        if (entry.weather.board) entry.weather.board.rotation.x = entry.weather.tilt0 - worn * 0.22;
      }

      // 落成动画
      if (entry.rise < 1) {
        entry.rise = Math.min(1, entry.rise + dt * 0.9);
        const ease = 1 - Math.pow(1 - entry.rise, 3);
        entry.root.position.y = heightAt(entry.grave.x, entry.grave.z) - 0.06 - (1 - ease) * 1.9;
        entry.root.scale.setScalar(0.9 + ease * 0.1);
      }

      // 闪光衰减
      entry.flash *= Math.max(0, 1 - dt * 1.8);

      const dx = entry.grave.x - camPos.x;
      const dz = entry.grave.z - camPos.z;
      const dist = Math.hypot(dx, dz);
      const near = Math.max(0, 1 - dist / 26);
      const flicker = 0.86 + Math.sin(this.time * 2.1 + entry.grave.x) * 0.07 + Math.sin(this.time * 5.3 + entry.grave.z) * 0.04;

      entry.halo.material.opacity = (0.14 + near * 0.42 + entry.flash * 0.55) * flicker;
      entry.halo.scale.setScalar(1.4 + near * 1.5 + entry.flash * 1.2);
      entry.halo.position.y = entry.burial === "sky" ? 0 : 0.9 + near * 0.2;

      // 忌日那一夜，不用人来，它自己亮着
      if (mood.tonight) {
        entry.halo.material.opacity = Math.max(entry.halo.material.opacity, 0.72 * flicker);
        entry.halo.scale.setScalar(Math.max(entry.halo.scale.x, 3.4));
      }

      // 很久没人来的灯，火会褪成一颗偏白的、更大的星
      if (entry.weather && entry.weather.flame) {
        const star = entry.burial === "sky" && mood.starred;
        const flame = entry.weather.flame;
        if (star) {
          flame.material.color.setHex(0xdfefff);
          flame.material.opacity = 0.6 + Math.sin(this.time * 1.1 + entry.grave.x) * 0.12;
          flame.scale.set(5.2, 5.2, 1);
          entry.halo.material.color.setHex(0xdfefff);
          entry.halo.material.opacity = 0.62;
          entry.halo.scale.setScalar(3.2);
        } else {
          flame.material.color.setHex(entry.weather.kind === "sky" ? 0xffc07a : 0xffffff);
          flame.material.opacity = 0.85;
          flame.scale.set(1.0, 1.0, 1);
        }
      }

      // 水葬：船跟着水呼吸，慢慢地晃，船头的灯也跟着呼吸
      if (entry.burial === "water") {
        // 没人管的时候，船会一点点往湖心漂；有人献过光，它就回来
        const L = RULES.world.lake;
        const dx = L.x - entry.grave.x;
        const dz = L.z - entry.grave.z;
        const len = Math.hypot(dx, dz) || 1;
        const drift = worn * 3.4;
        entry.root.position.x = entry.grave.x + (dx / len) * drift;
        entry.root.position.z = entry.grave.z + (dz / len) * drift;
        entry.root.position.y = entry.baseY + Math.sin(this.time * 0.7 + entry.grave.x) * 0.05;
        entry.root.rotation.z = Math.sin(this.time * 0.45 + entry.grave.z) * 0.045;
        const lamp = entry.root.userData.lamp;
        if (lamp) lamp.material.opacity = 0.55 + Math.sin(this.time * 1.7 + entry.grave.z) * 0.16;
      }
      // 天葬：灯在前后的风里上下，火一直在抖
      if (entry.burial === "sky") {
        const lift = mood.weathered * 6.5;
        entry.root.position.y = entry.baseY + lift + Math.sin(this.time * 0.32 + entry.grave.x) * 0.55;
        entry.root.rotation.y += dt * 0.06;
        if (mood.starred) {
          // 没人来的灯已经升得很高，看不清字了，最后只剩一团偏白的光
          entry.root.scale.setScalar(0.5);
          if (entry.weather) {
            entry.weather.mat.opacity = 0.14;
            if (entry.weather.mouth) entry.weather.mouth.material.opacity = 0.06;
          }
        } else {
          entry.root.scale.setScalar(1);
          if (entry.weather) {
            entry.weather.mat.opacity = 1;
            if (entry.weather.mouth) entry.weather.mouth.material.opacity = 0.95;
          }
        }
        const flame = entry.root.userData.flame;
        if (flame) flame.material.opacity = 0.55 + Math.sin(this.time * 5 + entry.grave.z) * 0.22;
      }
      entry.faceMat.opacity = Math.min(1, 0.25 + near * 1.6) * (entry.grave.sealed ? 0.55 : 1);

      if (entry.relic?.userData?.flame) {
        // 远处像一支静止的蜡烛，走近才看得见火在抖
        entry.relic.userData.flame.material.opacity =
          0.38 + near * 0.18 + Math.sin(this.time * 6 + entry.grave.z) * (0.05 + near * 0.22);
      }
      if (entry.relic?.userData?.bird) {
        const flap = Math.sin(this.time * (0.9 + near * 1.3) + entry.grave.x) * (0.03 + near * 0.24);
        entry.relic.userData.bird[0].rotation.z = 0.5 + flap;
        entry.relic.userData.bird[1].rotation.z = -0.5 - flap;
      }

      if (entry.ring && entry.ringLife > 0) {
        entry.ringLife = Math.max(0, entry.ringLife - dt);
        const t = 1 - entry.ringLife / 4.0;
        const s = 2.0 + t * 9.5;
        entry.ring.scale.set(s, s, 1);
        entry.ringMat.opacity = Math.max(0, 0.8 * (1 - t) * Math.min(1, t * 2.2));
        entry.ring.visible = entry.ringLife > 0.03;
      }

      sorted.push({ entry, dist });
    }

    sorted.sort((a, b) => a.dist - b.dist);
    for (let i = 0; i < this.lightPool.length; i++) {
      const light = this.lightPool[i];
      const item = sorted[i];
      if (!item || item.dist > 22) {
        light.intensity = 0;
        light.visible = false;
        continue;
      }
      light.visible = true;
      light.position.set(item.entry.grave.x, item.entry.root.position.y + 1.2, item.entry.grave.z);
      light.color.copy(glowColor(item.entry.grave.tone, item.entry.grave.lights));
      const target =
        (0.9 * Math.max(0, 1 - item.dist / 22) + item.entry.flash * 0.9) *
        (item.entry.mood && item.entry.mood.tonight ? 1.6 : 1);
      light.intensity += (target - light.intensity) * Math.min(1, dt * 6);
    }
  }
}
