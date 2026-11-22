import * as THREE from "three";
import { heightAt } from "./world.js";
import { makeGlowTexture } from "./graves.js";

/** 服务端为了省带宽，动作只发一个字母。 */
const ANIM = { i: "idle", w: "walk", r: "run", s: "sit", g: "ghost" };
const toCode = (v) => (typeof v === "string" ? v.slice(0, 1) : "w");

function makeLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 64);
  ctx.font = '26px "Songti SC", "SimSun", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(214, 244, 238, 0.9)";
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
    this.targets = new Map();
  }

  build(entry) {
    const root = new THREE.Group();

    const mat = new THREE.MeshBasicMaterial({
      color: 0x7fc9e6,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.85, 4, 10), mat);
    torso.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat);
    head.position.y = 1.66;

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        color: 0x86e6d2,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.3,
      })
    );
    halo.scale.set(1.6, 2.4, 1);
    halo.position.y = 1.1;

    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeLabel(""), transparent: true, depthWrite: false, opacity: 0 })
    );
    label.scale.set(2.2, 0.55, 1);
    label.position.y = 2.15;

    root.add(torso, head, halo, label);
    this.group.add(root);

    return { root, torso, head, halo, label, mat, renders: 0 };
  }

  ensure(uid, name) {
    let entry = this.entries.get(uid);
    if (entry) {
      if (name && entry.name !== name) {
        entry.name = name;
        entry.label.material.map.dispose();
        entry.label.material.map = makeLabel(name);
      }
      return entry;
    }
    entry = this.build();
    entry.uid = uid;
    entry.name = name || "无名者";
    entry.label.material.map = makeLabel(entry.name);
    entry.x = 0;
    entry.y = 0;
    entry.z = 0;
    entry.ty = 1;
    entry.yaw = 0;
    entry.anim = "idle";
    entry.opacity = 0;
    this.entries.set(uid, entry);
    return entry;
  }

  /** 服务端每秒发来的是 [uid,x,y,z,yaw,anim缩写] 的数组，名字进门时已经给过。 */
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
      entry.anim = ANIM[toCode(row[5])] || "walk";
    }
    for (const uid of this.entries.keys()) {
      if (!alive.has(uid)) {
        const e = this.entries.get(uid);
        e.fading = true;
      }
    }
  }

  remove(uid) {
    const entry = this.entries.get(uid);
    if (entry) entry.fading = true;
  }

  update(dt, camera) {
    for (const [uid, entry] of this.entries) {
      if (entry.tx === undefined) entry.tx = entry.x;
      if (entry.tz === undefined) entry.tz = entry.z;

      entry.x += (entry.tx - entry.x) * Math.min(1, dt * 9);
      entry.z += (entry.tz - entry.z) * Math.min(1, dt * 9);
      entry.y += (entry.ty - entry.y) * Math.min(1, dt * 6);

      let short = ((entry.tyaw - entry.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      entry.yaw += short * Math.min(1, dt * 7);

      const ground = heightAt(entry.x, entry.z);
      const lift = entry.anim === "ghost" ? Math.max(0, entry.y - ground) : 0;
      const sink = entry.anim === "sit" ? -0.35 : 0;

      entry.root.position.set(entry.x, ground + sink + lift * 0.6, entry.z);
      entry.root.rotation.y = entry.yaw + Math.PI;
      entry.root.rotation.z = Math.sin(performance.now() * 0.0008 + entry.x) * 0.012;

      const dist = camera.position.distanceTo(entry.root.position);
      const want = entry.fading ? 0 : Math.max(0, Math.min(1, 1 - (dist - 44) / 16)) * 0.9;
      entry.opacity += (want - entry.opacity) * Math.min(1, dt * 4);
      entry.mat.opacity = entry.opacity * 0.22;
      entry.halo.material.opacity = entry.opacity * 0.22;
      entry.label.material.opacity = entry.opacity * 0.9;
      entry.root.visible = entry.opacity > 0.01;
      entry.halo.scale.set(1.2, 1.9, 1);

      const bob = entry.anim === "walk" || entry.anim === "run" ? Math.sin(performance.now() * 0.006) * 0.05 : 0;
      entry.torso.position.y = 1.05 + bob;
      entry.head.position.y = 1.66 + bob;

      if (entry.fading && entry.opacity < 0.01) {        this.group.remove(entry.root);
        entry.label.material.map.dispose();
        this.entries.delete(uid);
      }
    }
  }
}
