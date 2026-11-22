import * as THREE from "three";
import { heightAt, isDeepWater } from "./world.js";
import { RULES } from "./rules.js";

export class Player {
  constructor(camera, dom, obstacles) {
    this.camera = camera;
    this.dom = dom;
    this.obstacles = obstacles;

    this.pos = new THREE.Vector3(0, heightAt(0, 74), 74);
    this.vy = 0;
    this.grounded = true;
    this.sitting = false;
    this.crouching = false;
    this.gesture = null;
    this.gestureT = 0;
    this.speed = 0;

    this.yaw = 0;
    this.pitch = 0;
    this.bob = 0;
    this.eye = RULES.player.eyeHeight;

    this.keys = new Set();
    this.touchMove = { x: 0, z: 0 };
    this.touchMode = false;
    this.spaceHeld = 0;
    this.active = false;
    this.locked = false;
    this.moved = false;

    this.onSit = null;
    this.onGesture = null;
    this.onLockChange = null;

    this.bind();
  }

  bind() {
    const onKeyDown = (e) => {
      if (!this.active) return;
      const code = e.code;
      if (["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) e.preventDefault();
      if (this.keys.has(code)) return;
      this.keys.add(code);

      if (code === "KeyF") this.toggleSit();
      if (code === "KeyC" && !this.sitting && this.gesture !== "kneel") this.crouching = true;
      if (code === "Space" && !this.sitting) this.jump();
      if (code === "KeyG") this.toggleGesture("kneel");
      if (code === "KeyZ") this.playBow();
      if (code === "KeyV") this.toggleGesture("clasp");
      if (code === "KeyB") this.toggleGesture("mourn");
    };

    const onKeyUp = (e) => {
      this.keys.delete(e.code);
      if (e.code === "KeyC") this.crouching = false;
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    let dragging = false;
    document.addEventListener("mousedown", (e) => {
      if (e.button === 0 && e.target === this.dom && !this.locked) dragging = true;
    });
    document.addEventListener("mouseup", () => {
      dragging = false;
    });

    document.addEventListener("mousemove", (e) => {
      // 正常情况是锁定指针；锁定不可用时退回按住左键拖动
      if (!this.locked && !dragging) return;
      this.yaw -= e.movementX * RULES.player.lookSensitivity;
      this.pitch -= e.movementY * RULES.player.lookSensitivity;
      const limit = Math.PI / 2 - 0.02;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    });

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) {
        this.keys.clear();
        this.crouching = false;
      }
      this.onLockChange?.(this.locked);
    });

    window.addEventListener("blur", () => {
      this.keys.clear();
      this.crouching = false;
    });
  }

  focus() {
    if (this.locked || this.touchMode) return;
    const attempt = (options) => {
      try {
        const promise = options ? this.dom.requestPointerLock(options) : this.dom.requestPointerLock();
        if (promise && typeof promise.catch === "function") promise.catch(() => {});
      } catch {
        /* 某些环境不允许锁定指针，退回拖动视角 */
      }
    };
    attempt({ unadjustedMovement: true });
  }

  release() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  setTouchMove(x, z) {
    this.touchMove.x = Math.max(-1, Math.min(1, x));
    this.touchMove.z = Math.max(-1, Math.min(1, z));
  }

  lookBy(dx, dy) {
    this.yaw -= dx * RULES.player.lookSensitivity;
    this.pitch -= dy * RULES.player.lookSensitivity;
    const limit = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  jump() {
    if (this.sitting) {
      this.toggleSit();
      return;
    }
    if (this.gesture === "kneel" || this.gesture === "bow") {
      this.clearGesture();
      return;
    }
    if (this.grounded) {
      this.vy = RULES.player.jumpSpeed;
      this.grounded = false;
      this.spaceHeld = 0;
    }
  }

  toggleSit() {
    this.sitting = !this.sitting;
    this.crouching = false;
    if (this.sitting) this.clearGesture(false);
    this.keys.clear();
    this.onSit?.(this.sitting);
  }

  /** 跪、合十、默哀可以按住不放。再按一次，或者走开，就收回来。 */
  toggleGesture(name) {
    if (!this.active) return;
    if (this.sitting) this.toggleSit();
    if (this.gesture === name) {
      this.clearGesture();
      return;
    }
    this.gesture = name;
    this.gestureT = 0;
    if (name === "kneel") this.crouching = false;
    this.onGesture?.(name);
  }

  /** 鞠躬是一下，不是一种站法。鞠完自己起来。 */
  playBow() {
    if (!this.active || this.gesture === "kneel") return;
    if (this.sitting) this.toggleSit();
    this.gesture = "bow";
    this.gestureT = 0;
    this.crouching = false;
    this.onGesture?.("bow");
  }

  clearGesture(notify = true) {
    if (!this.gesture) return;
    this.gesture = null;
    this.gestureT = 0;
    if (notify) this.onGesture?.(null);
  }

  forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  update(dt) {
    const P = RULES.player;
    const keys = this.keys;

    let inputX = 0;
    let inputZ = 0;
    const rooted = this.sitting || this.gesture === "kneel" || this.gesture === "bow";
    if (this.active && !rooted) {
      if (keys.has("KeyW") || keys.has("ArrowUp")) inputZ -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) inputZ += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) inputX -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) inputX += 1;
      inputX = Math.max(-1, Math.min(1, inputX + this.touchMove.x));
      inputZ = Math.max(-1, Math.min(1, inputZ + this.touchMove.z));
    }

    const running = keys.has("ShiftLeft") || keys.has("ShiftRight");
    let maxSpeed = this.crouching ? 1.4 : running ? P.runSpeed : P.walkSpeed;
    if (keys.has("Space") && !this.grounded) maxSpeed = P.ghostSpeed;

    const forward = this.forward();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3().addScaledVector(forward, -inputZ).addScaledVector(right, inputX);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(maxSpeed);
    if (wish.lengthSq() > 0.01 && (this.gesture === "clasp" || this.gesture === "mourn")) {
      this.clearGesture();
    }
    if (this.gesture === "bow") {
      this.gestureT += dt;
      if (this.gestureT > 1.65) this.clearGesture();
    }

    const accel = Math.min(1, P.accel * dt);
    this.vel = this.vel || new THREE.Vector3();
    this.vel.lerp(wish, accel);

    this.moved = this.vel.lengthSq() > 0.05;
    this.speed = this.vel.length();

    const prevX = this.pos.x;
    const prevZ = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // 水：浅的地方能蹚，再深就站不住，会被推回岸上
    if (isDeepWater(this.pos.x, this.pos.z)) {
      this.pos.x = prevX;
      this.pos.z = prevZ;
      this.vel.set(0, 0, 0);
    }

    // 墓园边界：走不出去，只能被雾慢慢推回来
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > RULES.world.radius) {
      const k = RULES.world.radius / r;
      this.pos.x *= k;
      this.pos.z *= k;
    }

    // 撞上碑就滑开
    for (const ob of this.obstacles) {
      const dx = this.pos.x - ob.x;
      const dz = this.pos.z - ob.z;
      const d = Math.hypot(dx, dz);
      const min = ob.r + 0.34;
      if (d < min && d > 0.0001) {
        this.pos.x = ob.x + (dx / d) * min;
        this.pos.z = ob.z + (dz / d) * min;
      }
    }

    // 竖直方向
    const groundY = heightAt(this.pos.x, this.pos.z);
    const holdingSpace = this.keys.has("Space");
    if (holdingSpace) this.spaceHeld += dt;
    else this.spaceHeld = 0;

    if (!this.grounded) {
      if (holdingSpace && this.spaceHeld > 0.22) {
        // 离魂：按住空格浮起来，越高越慢
        const lift = 13.5;
        const ceiling = groundY + 16;
        if (this.pos.y < ceiling) {
          this.vy += (lift - P.gravity) * dt * 0.9;
          this.vy = Math.min(this.vy, 4.6);
        } else {
          this.vy = Math.max(this.vy - 2 * dt, 0);
        }
      } else {
        this.vy -= P.gravity * dt;
      }
      this.pos.y += this.vy * dt;
      if (this.pos.y <= groundY) {
        this.pos.y = groundY;
        this.vy = 0;
        this.grounded = true;
      }
    } else {
      this.pos.y = groundY;
      this.vy = 0;
    }

    // 蹲下、跪下、鞠躬时，眼睛跟着身体一起低下来
    let targetEye = P.eyeHeight;
    if (this.sitting) targetEye = P.seatHeight;
    else if (this.gesture === "kneel") targetEye = P.kneelHeight;
    else if (this.crouching) targetEye = P.crouchHeight;
    else if (this.gesture === "bow") targetEye = P.eyeHeight - 0.28;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 9);

    // 走路的轻微摇晃
    if (this.moved && this.grounded) {
      this.bob += dt * (this.speed * 1.6 + 1.2);
    }
    const bobAmp = this.grounded ? Math.min(this.speed, P.runSpeed) * 0.006 : 0;
    const bobY = Math.sin(this.bob) * bobAmp;
    const bobX = Math.cos(this.bob * 0.5) * bobAmp * 0.6;

    let pitchBias = 0;
    if (this.gesture === "bow") pitchBias = 0.42;
    else if (this.gesture === "kneel") pitchBias = 0.22;
    else if (this.gesture === "mourn") pitchBias = 0.18;
    else if (this.gesture === "clasp") pitchBias = 0.06;

    this.camera.position.set(this.pos.x + bobX, this.pos.y + this.eye + bobY, this.pos.z);
    this.camera.rotation.set(this.pitch + pitchBias, this.yaw, Math.sin(this.bob * 0.5) * bobAmp * 0.9, "YXZ");
  }

  anim() {
    if (this.sitting) return "sit";
    if (this.gesture === "kneel") return "kneel";
    if (this.gesture === "bow") return "bow";
    if (!this.grounded && this.spaceHeld > 0.22) return "ghost";
    if (this.speed > RULES.player.walkSpeed + 1) return "run";
    if (this.speed > 0.4) return "walk";
    if (this.gesture === "clasp") return "clasp";
    if (this.gesture === "mourn") return "mourn";
    return "idle";
  }

  snapshot() {
    return {
      x: +this.pos.x.toFixed(2),
      y: +this.pos.y.toFixed(2),
      z: +this.pos.z.toFixed(2),
      yaw: +this.yaw.toFixed(3),
    };
  }
}
