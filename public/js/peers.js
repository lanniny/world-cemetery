import * as THREE from "three";
import { heightAt } from "./world.js";
import { applyLook, applyPose, createFigure, disposeFigure, setFigureOpacity } from "./figure.js";
import { normalizeLook, unpackLook } from "./rules.js";

/** 服务端为了省带宽，动作只发一个字母。 */
const ANIM = {
  i: "idle",
  w: "walk",
  r: "run",
  s: "sit",
  g: "ghost",
  b: "bow",
  k: "kneel",
  c: "clasp",
  m: "mourn",
};
const toCode = (v) => (typeof v === "string" ? v.slice(0, 1) : "i");

function makeLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 64);
  ctx.font = '26px "Songti SC", "SimSun", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(236, 228, 214, 0.94)";
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Peers {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.entries = new Map();
  }

  ensure(uid, name, look) {
    let entry = this.entries.get(uid);
    if (entry) {
      if (name && entry.name !== name) {
        entry.name = name;
        entry.label.material.map.dispose();
        entry.label.material.map = makeLabel(name);
      }
      if (look) this.applyLook(entry, look);
      return entry;
    }

    const root = new THREE.Group();
    const fig = createFigure(normalizeLook(look));
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeLabel(name || "无名者"), transparent: true, depthWrite: false, opacity: 0 })
    );
    label.scale.set(1.35, 0.34, 1);
    label.position.y = 1.92;
    root.add(fig.root, label);
    this.group.add(root);

    entry = {
      uid,
      name: name || "无名者",
      root,
      fig,
      label,
      look: normalizeLook(look),
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      anim: "idle",
      phase: Math.random() * Math.PI * 2,
      opacity: 0,
    };
    this.entries.set(uid, entry);
    return entry;
  }

  applyLook(entry, look) {
    const next = normalizeLook(look);
    if (entry.look && entry.look.coat === next.coat && entry.look.hair === next.hair) return;
    entry.look = next;
    applyLook(entry.fig, next);
  }

  /** 服务端每秒发来的是 [uid,x,y,z,yaw,anim缩写,样子] 。名字进门时已经给过。 */
  setList(rows, selfUid) {
    const alive = new Set();
    for (const row of rows) {
      const uid = row[0];
      if (uid === selfUid) continue;
      alive.add(uid);
      const entry = this.ensure(uid);
      entry.tx = row[1];
      entry.ty = row[2];
      entry.tz = row[3];
      entry.tyaw = row[4];
      entry.anim = ANIM[toCode(row[5])] || "idle";
      if (row.length > 6 && row[6] != null) this.applyLook(entry, unpackLook(row[6]));
    }
    for (const uid of this.entries.keys()) {
      if (!alive.has(uid)) this.entries.get(uid).fading = true;
    }
  }

  remove(uid) {
    const entry = this.entries.get(uid);
    if (entry) entry.fading = true;
  }

  update(dt, camera) {
    const now = performance.now() / 1000;
    for (const [uid, entry] of this.entries) {
      if (entry.tx === undefined) entry.tx = entry.x;
      if (entry.tz === undefined) entry.tz = entry.z;

      entry.x += ((entry.tx ?? entry.x) - entry.x) * Math.min(1, dt * 9);
      entry.z += ((entry.tz ?? entry.z) - entry.z) * Math.min(1, dt * 9);
      entry.y += ((entry.ty ?? entry.y) - entry.y) * Math.min(1, dt * 6);

      const targetYaw = entry.tyaw ?? entry.yaw;
      const short = ((targetYaw - entry.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      entry.yaw += short * Math.min(1, dt * 7);

      const ground = heightAt(entry.x, entry.z);
      const lift = entry.anim === "ghost" ? Math.max(0, entry.y - ground) : 0;
      entry.root.position.set(entry.x, ground + lift, entry.z);
      entry.root.rotation.y = entry.yaw + Math.PI;
      applyPose(entry.fig, entry.anim, now, entry.phase);
      entry.label.position.y = entry.anim === "kneel" ? 1.45 : entry.anim === "sit" || entry.anim === "bow" ? 1.62 : 1.92;

      const dist = camera.position.distanceTo(entry.root.position);
      const want = entry.fading ? 0 : Math.max(0, Math.min(1, 1 - (dist - 48) / 18));
      entry.opacity += (want - entry.opacity) * Math.min(1, dt * 4);
      setFigureOpacity(entry.fig, entry.opacity);
      entry.label.material.opacity = entry.opacity * 0.92;
      entry.root.visible = entry.opacity > 0.02;

      if (entry.fading && entry.opacity < 0.02) {
        this.group.remove(entry.root);
        entry.label.material.map.dispose();
        entry.label.material.dispose();
        disposeFigure(entry.fig);
        this.entries.delete(uid);
      }
    }
  }
}
