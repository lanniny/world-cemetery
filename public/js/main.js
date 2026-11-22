import * as THREE from "three";
import { World, heightAt, isDeepWater, lakeDist } from "./world.js";
import { GraveSystem } from "./graves.js";
import { Player } from "./player.js";
import { Peers } from "./peers.js";
import { UI } from "./ui.js";
import { Net } from "./net.js";
import { Sound } from "./audio.js";
import { RULES, RULESET_ID } from "./rules.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x05080c, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.06, 900);

const world = new World(scene, renderer).build();
const graves = new GraveSystem(scene);
const peers = new Peers(scene);
const sound = new Sound();
const obstacles = [];
const player = new Player(camera, canvas, obstacles);
const TOUCH_MODE = new URLSearchParams(location.search).has("touch") ||
  !!window.matchMedia?.("(pointer: coarse)").matches;
player.touchMode = TOUCH_MODE;
const ui = new UI();

// —— 空气。贴地的三层薄雾，和一层浮尘：夜里有厚度，园子才不像一张平面。
const mistTex = (() => {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.08, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,0.52)");
  g.addColorStop(0.45, "rgba(255,255,255,0.2)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

const mistLayers = [];
for (let i = 0; i < 3; i += 1) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 52),
    new THREE.MeshBasicMaterial({
      map: mistTex,
      color: 0x6d8f8c,
      transparent: true,
      opacity: 0.025 + i * 0.009,
      depthWrite: false,
      fog: true,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.2 + i * 0.3;
  m.renderOrder = 1;
  scene.add(m);
  mistLayers.push(m);
}

const DUST = 160;
const dustGeo = new THREE.BufferGeometry();
{
  const arr = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i += 1) {
    const r = 3 + Math.random() * 15;
    const a = Math.random() * Math.PI * 2;
    arr[i * 3] = Math.cos(a) * r;
    arr[i * 3 + 1] = 0.2 + Math.random() * 3.2;
    arr[i * 3 + 2] = Math.sin(a) * r;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
}
const dust = new THREE.Points(
  dustGeo,
  new THREE.PointsMaterial({
    color: 0xcfe3da,
    size: 0.04,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    map: mistTex,
    blending: THREE.AdditiveBlending,
    fog: true,
  })
);
dust.frustumCulled = false;
scene.add(dust);

/** 声音开着还是关着：HUD 上那个按钮和 M 键走同一条路。 */
const toggleSound = () => {
  const next = !sound.muted;
  sound.setMuted(next);
  localStorage.setItem("cc.mute", next ? "1" : "0");
  ui.setSound(!next);
  ui.toast(next ? "声音关掉了。" : "声音打开了。", 1800);
};
ui.onSoundToggle = toggleSound;

// ?spawn=x,z,yaw,pitch —— 直接把落点放到某处。调试用，也方便约人一起站到湖边。
{
  const spawn = new URLSearchParams(location.search).get("spawn");
  if (spawn) {
    const [sx, sz, syaw, spitch] = spawn.split(",").map(Number);
    if (Number.isFinite(sx) && Number.isFinite(sz)) {
      player.pos.set(sx, heightAt(sx, sz), sz);
      if (Number.isFinite(syaw)) player.yaw = syaw;
      if (Number.isFinite(spitch)) player.pitch = spitch;
    }
  }
}

const state = {
  uid: localStorage.getItem("cc.uid") || "",
  token: localStorage.getItem("cc.token") || "",
  member: false,
  name: localStorage.getItem("cc.name") || "",
  selfId: null,
  started: false,
  previewId: null,
  previewAt: null,
  sendAcc: 0,
  promptTarget: null,
  online: 0,
  bellCount: 0,
  silenceCount: 0,
  // 名录里点了某座碑之后，屏幕上一直指着它，直到走到跟前
  guide: null,
  // ?grave=id：有人把一座碑递给了你。进门后直接落到它前面。
  sharedId: new URLSearchParams(location.search).get("grave") || "",
  sharedArrived: false,
};

let net = null;

// 旧版本把临时身份写在 cc.uid 里。登录之前先记下它，登录后好把那些碑认回来。
if (!localStorage.getItem("cc.token") && !localStorage.getItem("cc.legacyUid")) {
  const oldUid = localStorage.getItem("cc.uid") || "";
  if (oldUid) localStorage.setItem("cc.legacyUid", oldUid);
}

/* ---------------------------------------------------------------- 启动 */

ui.el.name.value = state.name;

/** 上一次登录留下的 token 还在，就直接用；名字可以改，账号不能。 */
function enterAsIdentity(token, name) {
  state.token = token;
  if (token) localStorage.setItem("cc.token", token);
  if (name) {
    state.name = name;
    localStorage.setItem("cc.name", name);
  }
  sound.start();
  sound.setMuted(localStorage.getItem("cc.mute") === "1");
  ui.setSound(!sound.muted);
  ui.hideBoot();
  state.started = true;
  player.active = true;
  player.focus();
  if (TOUCH_MODE) {
    document.getElementById("touch-ui").classList.remove("hidden");
    document.querySelector(".intro-keys").textContent = "左边走 · 右边看 · 读 / 立 · 名录";
  }
  connect();
  setTimeout(() => ui.toast(TOUCH_MODE ? "走到一块空地上，点「读 / 立」立一座碑。" : "走到一块空地上，按 E 立一座碑。", 5200), 1800);
}

ui.el.enter.addEventListener("click", async () => {
  const name = ui.el.name.value.trim();
  const secret = ui.el.secret.value.trim();

  // 没有输入那句话，但浏览器里还留着上一次的 token：还是同一个人
  if (!secret && state.token) {
    enterAsIdentity(state.token, name || state.name || "无名者");
    return;
  }
  if (!name) {
    ui.toast("先给自己一个名字。", 3200);
    ui.el.name.focus();
    return;
  }
  if (secret.length < 4) {
    ui.toast("那句话至少四个字。它只用来证明这个账号还是你的。", 3800);
    ui.el.secret.focus();
    return;
  }

  ui.el.enter.disabled = true;
  ui.el.enter.textContent = "在开门…";
  try {
    const resp = await fetch("/api/account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, secret }),
    });
    const data = await resp.json();
    if (!data.ok || !data.token) {
      ui.toast(data.message || "进不去。再试一次。", 4200);
      ui.el.enter.disabled = false;
      ui.el.enter.textContent = "走进雾里";
      return;
    }

    // 这台浏览器以前用临时身份立的碑，划到账号名下
    const legacyUid = localStorage.getItem("cc.legacyUid") || "";
    if (legacyUid) {
      try {
        const c = await fetch("/api/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: data.token, legacyUid }),
        });
        const got = await c.json();
        if (got.ok && got.moved) {
          ui.toast(`以前你在这儿留下的 ${got.moved} 座碑，现在归你了。`, 4600);
          localStorage.removeItem("cc.legacyUid");
        }
      } catch {
        /* 认领失败不影响进门 */
      }
    }

    state.uid = data.uid;
    localStorage.setItem("cc.uid", data.uid);
    ui.el.enter.disabled = false;
    ui.el.enter.textContent = "走进雾里";
    enterAsIdentity(data.token, data.name);
  } catch {
    ui.toast("门口没有回应。等一下再试。", 3600);
    ui.el.enter.disabled = false;
    ui.el.enter.textContent = "走进雾里";
  }
});

ui.el.name.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.isComposing) ui.el.enter.click();
});

ui.el.secret.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.isComposing) ui.el.enter.click();
});

canvas.addEventListener("click", () => {
  if (state.started && !ui.isOpen() && !player.locked) player.focus();
});

/* ---------------------------------------------------------------- 联机 */

function connect() {
  if (state.uid) localStorage.setItem("cc.uid", state.uid);
  net = new Net({
    onOpen: () => ui.toast("你已经在里面了。"),
    onWelcome: (msg) => {
      state.uid = msg.you;
      state.selfId = msg.you;
      state.member = !!msg.member;
      if (state.member) localStorage.setItem("cc.uid", msg.you);
      if (msg.name) {
        state.name = msg.name;
        ui.el.name.value = msg.name;
      }
      ui.setSelf(msg.you);
      for (const g of msg.graves || []) {
        graves.add(g);
        localGraveBook.set(g.id, g);
      }
      // 进门时一次拿到已经在场的人的名字，之后每秒的坐标同步里不再带名字
      for (const [ouid, oname] of msg.online || []) peers.ensure(ouid, oname);
      rebuildObstacles();
      ui.status(0, graves.entries.size);
      if (state.sharedId && !state.sharedArrived) {
        state.sharedArrived = true;
        arriveAtSharedGrave(state.sharedId);
      }
      // 只给第一次来的人看：怎么站，怎么走，怎么读。看完自己消失。
      if (!localStorage.getItem("cc.seenIntro")) {
        localStorage.setItem("cc.seenIntro", "1");
        setTimeout(() => ui.showIntro(), 1500);
      }
      if (!state.member) {
        if (state.token) {
          // 手里这个身份已经不作数了（账号被删、密钥换了）。别让人以为自己是登录状态。
          localStorage.removeItem("cc.token");
          state.token = "";
          player.active = false;
          player.release();
          ui.showBoot();
          ui.toast("上次的身份不在了。把名字和那句话重新写一遍。", 5200);
          return;
        }
        setTimeout(() => ui.toast("你还没给自己名字：现在只能走、能读，不能立碑。", 5600), 3600);
      }
    },
    onPeers: (list) => {
      peers.setList(list, state.selfId);
      state.online = list.length;
      ui.status(list.length, graves.entries.size);
    },
    onPeerIn: (msg) => {
      // 有人走进来：先把名字记下，坐标等下一帧 peers 带过来
      if (msg && msg.uid) peers.ensure(msg.uid, msg.name);
    },
    onRaised: (grave) => {
      if (state.previewId) {
        graves.remove(state.previewId);
        state.previewId = null;
      }
      localGraveBook.set(grave.id, grave);
      graves.add(grave, { fresh: true });
      rebuildObstacles();
      ui.status(state.online, graves.entries.size);
      sound.bell(160, 0.7);
      if (grave.authorId === state.selfId) {
        ui.setRaisePending(false);
        const cfg = ui.takeEchoConfig();
        if (cfg) {
          try {
            localStorage.setItem("cc.echo." + grave.id, JSON.stringify(cfg));
          } catch {
            /* 存不进去也不影响碑本身 */
          }
        }
        if (ui.openPanel === "raise") ui.close();
        // 立完先说"它成了"，再说"它在哪"。水葬和天葬的落点不在脚下，
        // 不说清楚方向，人会以为没立上。
        const far = Math.hypot(grave.x - player.pos.x, grave.z - player.pos.z);
        const dir = compassDir(grave);
        let line = "立好了。它会一直在这儿。";
        if (grave.burial === "water") line = `船放进水里了。往${dir}看，在 ${Math.round(far)} 米外漂着。`;
        else if (grave.burial === "tree") line = "木牌挂上了，就挂在那棵树的树干上。绕过去能看清。";
        else if (grave.burial === "sky") line = `灯升起来了。抬头往${dir}看，它停在你上方的半空里。`;
        if (cfg) line += "回声的钥匙只在你手上。";
        setTimeout(() => ui.toast(line, 4600), 900);
      } else if (grave.authorId !== state.selfId) {
        ui.toast(`「${grave.name}」的碑立起来了。`, 3000);
      }
    },
    onGone: (msg) => {
      localGraveBook.delete(msg.id);
      graves.remove(msg.id);
      if (ui.currentGrave && ui.currentGrave.grave.id === msg.id) {
        ui.close();
        ui.toast("这座碑被它的作者拆掉了。", 3200);
      }
      if (state.previewId === msg.id) state.previewId = null;
    },

    onEdited: (grave) => {
      if (!grave || !grave.id) return;
      localGraveBook.set(grave.id, grave);
      // 碑形、照片、刻字都可能变了，整块重画最省心
      graves.remove(grave.id);
      graves.add(grave, { fresh: false });
      rebuildObstacles();
      ui.status(state.online, graves.entries.size);
      const mine = grave.authorId === state.selfId;
      if (mine) {
        ui.setRaisePending(false);
        if (ui.openPanel === "raise") ui.close();
        ui.toast("改好了。", 3000);
        return;
      }
      if (ui.currentGrave && ui.currentGrave.grave.id === grave.id) {
        const entry = graves.entries.get(grave.id);
        if (entry) ui.renderRead(entry, state.selfId);
      }
      if (!mine) ui.toast(`「${grave.name}」的碑被人改过了。`, 3000);
    },

    onUpdated: (msg) => {
      const local = localGraveBook.get(msg.id);
      if (local) {
        if (typeof msg.lights === "number") local.lights = msg.lights;
        if (typeof msg.visits === "number") local.visits = msg.visits;
        if (typeof msg.sealed === "boolean") local.sealed = msg.sealed;
        if (typeof msg.lastLightAt === "string") local.lastLightAt = msg.lastLightAt;
        if (Array.isArray(msg.offerings)) local.offerings = msg.offerings;
        graves.sync(local);
        const entry = graves.entries.get(msg.id);
        if (entry) {
          entry.grave = { ...entry.grave, ...local };
          if (ui.currentGrave && ui.currentGrave.grave.id === msg.id) ui.renderRead(entry, state.selfId);
        }
        if (msg.by && msg.by !== state.selfId) graves.pulse(msg.id, 1.2);
      }
    },
    onBell: (msg) => {
      if (typeof msg.x !== "number" || typeof msg.z !== "number") return;
      const dx = msg.x - player.pos.x;
      const dz = msg.z - player.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > RULES.grave.bellRadius) return;
      const pan = panToward(msg.x, msg.z);
      state.bellCount += 1;
      sound.farBell(pan, 1 - dist / RULES.grave.bellRadius);
    },
    onSilence: (msg) => {
      if (typeof msg.x !== "number" || typeof msg.z !== "number") return;
      const d = Math.hypot(msg.x - player.pos.x, msg.z - player.pos.z);
      if (d > 26) return;
      state.silenceCount += 1;
      graves.pulse(msg.id, 3.2);
      graves.ringOnce(msg.id);
      ui.veil();
      if (d <= RULES.interact.readRadius + 1.2) {
        sound.chord(1);
        ui.toast("有人和你一起站在这里。", 2800);
      } else {
        sound.chord(0.35);
      }
    },
    onNoted: (msg) => {
      const local = localGraveBook.get(msg.id);
      if (!local) return;
      local.notes = local.notes || [];
      if (!local.notes.some((n) => n.at === msg.note.at && n.by === msg.note.by)) local.notes.push(msg.note);
      const entry = graves.entries.get(msg.id);
      if (entry) entry.grave.notes = local.notes;
      if (ui.currentGrave && ui.currentGrave.grave.id === msg.id) ui.renderRead(entry, state.selfId);
      else if (msg.note.by !== state.name) ui.toast(`有人在「${local.name}」前留了一句话。`, 3000);
    },
    onReject: (msg) => {
      ui.setRaisePending(false);
      ui.toast(msg.reason || "没能这样做。");
    },
    onClose: () => {
      const pending = ui.raisePending;
      ui.setRaisePending(false);
      ui.toast(
        pending
          ? "连接断了。重连后先看看碑是否已经立上，再决定要不要重试。"
          : "连接断了，正在重新走进雾里…",
        pending ? 5600 : 3200
      );
    },
  });
  net.connect({ uid: state.uid || "", name: state.name, pos: player.snapshot() }, state.token || null);
}

const localGraveBook = new Map();

function rebuildObstacles() {
  obstacles.length = 0;
  for (const entry of graves.entries.values()) {
    if (entry.id === "__preview__") continue;
    // 船在水里、灯在天上，人走不过去也用不着绕
    if (entry.burial === "water" || entry.burial === "sky") continue;
    obstacles.push({ x: entry.grave.x, z: entry.grave.z, r: 0.55 });
  }
}

/** 这块碑最终站在哪：树葬挂在树上，水葬落在湖里，其余就在身前。 */
function placement(data) {
  const burial = data.burial || "stone";

  if (burial === "water") {
    const L = RULES.world.lake;
    const dx = player.pos.x - L.x;
    const dz = player.pos.z - L.z;
    const len = Math.hypot(dx, dz) || 1;
    const x = L.x + (dx / len) * (L.r * 0.55);
    const z = L.z + (dz / len) * (L.r * 0.55);
    return { x, z, ry: Math.atan2(-(x - player.pos.x), -(z - player.pos.z)), treeX: 0, treeZ: 0 };
  }

  if (burial === "tree" && ui.raiseCtx.tree) {
    const t = ui.raiseCtx.tree;
    return { x: t.x, z: t.z, ry: Math.atan2(-(t.x - player.pos.x), -(t.z - player.pos.z)), treeX: t.x, treeZ: t.z };
  }

  const fwd = player.forward();
  return {
    x: player.pos.x + fwd.x * RULES.grave.previewDistance,
    z: player.pos.z + fwd.z * RULES.grave.previewDistance,
    ry: Math.atan2(-fwd.x, -fwd.z),
    treeX: 0,
    treeZ: 0,
  };
}

/* ---------------------------------------------------------------- 立碑 */

ui.onPreview = (data) => {
  if (!data.name) {
    if (state.previewId) {
      graves.remove(state.previewId);
      state.previewId = null;
    }
    return;
  }
  const spot = placement(data);
  const grave = { id: "__preview__", ...data, ...spot, authorId: state.selfId, lights: 0 };

  if (state.previewId) {
    graves.remove(state.previewId);
    state.previewId = null;
  }
  const entry = graves.add(grave, { fresh: false });
  state.previewId = "__preview__";
  entry.rise = 1;
  entry.flash = 0.25;
  entry.halo.material.opacity = 0.5;
};

ui.onEditRequest = (id) => {
  const entry = graves.entries.get(id);
  if (entry) ui.openEdit(entry);
};

ui.onEdit = (id, data) => {
  if (!net || net.ws?.readyState !== WebSocket.OPEN) {
    ui.setRaisePending(false);
    ui.toast("还没连上公墓。等连接回来再改。");
    return;
  }
  if (!data.name) {
    ui.setRaisePending(false);
    ui.toast("碑上总得有个名字。");
    return;
  }
  net.send({ t: "edit", id, grave: data });
};

ui.onOffer = (kind) => {
  const cur = ui.currentGrave;
  if (!cur || !net) return;
  net.send({ t: "offer", id: cur.grave.id, kind });
};

ui.onSubmit = (data) => {
  if (!net || net.ws?.readyState !== WebSocket.OPEN) {
    ui.setRaisePending(false);
    ui.toast("还没连上公墓。等连接回来再立。");
    return;
  }
  if (!data.name) {
    ui.setRaisePending(false);
    ui.toast("碑上总得有个名字。");
    return;
  }
  const spot = placement(data);
  net.send({
    t: "raise",
    grave: {
      ...data,
      ...spot,
    },
  });
};

ui.onClose = (kind) => {
  if (kind === "raise" && state.previewId) {
    graves.remove(state.previewId);
    state.previewId = null;
  }
  if (kind === "raise" && typeof state.savedPitch === "number") {
    player.pitch = state.savedPitch;
    state.savedPitch = null;
  }
  player.active = true;
  player.focus();
};

ui.el.helpClose.onclick = () => {
  ui.toggleHelp(false);
  player.active = true;
  player.focus();
};

ui.el.listClose.onclick = () => {
  ui.hideList();
  player.active = true;
  player.focus();
};

/* ---------------------------------------------------------------- 阅读 */

ui.onEcho = async (id, text, history) => {
  try {
    const res = await fetch("/api/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, text, history, upstream: ui.echoConfig || null }),
    });
    if (res.status === 503) {
      ui.echoFail("这座墓园还没有接上回声。");
      return;
    }
    if (res.status === 429) {
      ui.echoFail("太快了。等他缓一缓。");
      return;
    }
    if (res.status === 400) {
      const body = await res.json().catch(() => ({}));
      ui.echoFail(body.error === "no_voice" ? "这块碑上没有留下他的声音。" : "这句话说不出口。");
      return;
    }
    if (!res.ok) {
      ui.echoFail("他没有回应。风有点大。");
      return;
    }
    const data = await res.json();
    const reply = String(data.reply || "").trim();
    if (!reply) {
      ui.echoFail("他没有回应。");
      return;
    }
    ui.echoReply(reply);
    sound.chord(0.25);
  } catch {
    ui.echoFail("声音断了一下。");
  }
};

ui.onLight = (id) => {
  const local = localGraveBook.get(id);
  if (!local) return;
  net?.send({ t: "light", id });
  local.lights = (local.lights || 0) + 1;
  const entry = graves.entries.get(id);
  if (entry) {
    entry.grave.lights = local.lights;
    graves.pulse(id, 2.2);
    graves.sync(entry.grave);
  }
  const scale = [220, 180, 260, 150, 300][Math.min(4, Math.floor(Math.random() * 5))];
  sound.bell(scale, 1);
  if (ui.currentGrave) ui.renderRead(graves.entries.get(id), state.selfId);
};

ui.onNote = (id, text) => {
  net?.send({ t: "note", id, text });
};

ui.onSeal = (id) => {
  net?.send({ t: "seal", id });
};

ui.onDelete = (id) => {
  net?.send({ t: "remove", id });
};

/* ---------------------------------------------------------------- 交互 */

/** 有人点开的是一座碑的链接。能落就落在它前面，落不了也一直指着它。 */
function arriveAtSharedGrave(id) {
  const g = localGraveBook.get(id);
  if (!g) {
    ui.toast("这座碑不在这里了。也许已经被立碑的人带走。", 5200);
    return;
  }
  if (!new URLSearchParams(location.search).has("spawn")) {
    let z = g.z + 2.8;
    // 纸船可能在水上：一步步往岸边退，绝不把人扔进深水
    for (let i = 0; i < 12 && isDeepWater(g.x, z); i += 1) z += 1.2;
    if (!isDeepWater(g.x, z) && Math.hypot(g.x, z) < RULES.world.radius - 2) {
      player.pos.set(g.x, heightAt(g.x, z), z);
      player.yaw = 0;
      player.pitch = 0;
    }
  }
  state.guide = { id: g.id, name: g.name, x: g.x, z: g.z };
  ui.toast(`你来看「${g.name}」。它就在前面。`, 5200);
}

ui.onShare = async (id) => {
  const url = `${location.origin}${location.pathname}?grave=${encodeURIComponent(id)}`;
  try {
    await navigator.clipboard.writeText(url);
    ui.toast("链接抄好了。发给一个人，他会落在这座碑前。", 3600);
  } catch {
    window.prompt("把这个链接发给他：", url);
  }
};

function nearestGrave() {
  return graves.nearest(player.pos, RULES.interact.stoneRadius + 0.6);
}

/** 声音在左手边还是右手边。0 是正前，-1 左，1 右。 */
function panToward(x, z) {
  const dx = x - player.pos.x;
  const dz = z - player.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.4) return 0;
  const fwd = player.forward();
  const rightX = -fwd.z;
  const rightZ = fwd.x;
  return Math.max(-1, Math.min(1, (dx * rightX + dz * rightZ) / dist));
}

function tryInteract() {
  if (!state.started || ui.isOpen()) return;
  const hit = nearestGrave();
  if (hit && hit.distance <= RULES.interact.readRadius) {
    const entry = hit.entry;
    const local = localGraveBook.get(entry.grave.id) || entry.grave;
    ui.openRead(entry, state.selfId);
    player.active = false;
    player.release();
    net?.send({ t: "visit", id: entry.grave.id });
  } else {
    state.savedPitch = player.pitch;
    player.pitch = Math.max(player.pitch, 0.24);
    ui.el.raiseName.value = "";
    const treeHit = world.nearestTree(player.pos.x, player.pos.z);
    const treeTaken = treeHit ? treeTakenAt(treeHit.tree) : "";
    const lakeD = lakeDist(player.pos.x, player.pos.z);
    ui.openRaise({
      tree: treeHit?.tree || null,
      treeDist: treeHit?.distance ?? Infinity,
      treeTaken,
      lakeDist: lakeD,
      canTree: !!treeHit && treeHit.distance <= RULES.grave.treeAnchorMax && !treeTaken,
      canWater: lakeD <= RULES.world.lake.r + RULES.grave.waterEdgeMax,
    });
    player.active = false;
    player.release();
    const space = spaceCheck();
    if (space) ui.toast(space, 3200);
  }
}

/** 这块碑的回声钥匙：存在立碑者自己的浏览器里，服务器和别的浏览器都看不到。 */
function echoConfigFor(id) {
  try {
    const raw = localStorage.getItem("cc.echo." + id);
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    if (!cfg || !cfg.baseUrl || !cfg.key || !cfg.model) return null;
    return cfg;
  } catch {
    return null;
  }
}

function tryEcho() {
  if (!state.started || ui.isOpen()) return;
  const hit = nearestGrave();
  if (!hit || hit.distance > RULES.interact.readRadius) {
    ui.toast("再靠近一点，站在碑前面。", 2600);
    return;
  }
  const g = hit.entry.grave;
  if (g.sealed) {
    ui.toast("这座碑已经沉睡了。", 2600);
    return;
  }
  if (!g.voice) {
    ui.toast("这块碑上没有留下他说话的样子。", 3200);
    return;
  }
  const cfg = echoConfigFor(g.id);
  if (!cfg) {
    ui.toast("这块碑的回声只在立碑的人手里。", 3400);
    return;
  }
  ui.openEcho(hit.entry, cfg);
  player.active = false;
  player.release();
}

function spaceCheck() {
  const fwd = player.forward();
  const x = player.pos.x + fwd.x * 2.2;
  const z = player.pos.z + fwd.z * 2.2;
  if (Math.hypot(x, z) > RULES.world.radius - 4) return "太靠近雾墙了，往里走一点再立。";
  for (const entry of graves.entries.values()) {
    if (Math.hypot(entry.grave.x - x, entry.grave.z - z) < RULES.grave.minSpacing) {
      return "这里离别的碑太近了。走开几步。";
    }
  }
  return null;
}

/** 这棵树已经有人靠着了吗？返回那个人的碑名，服务端仍会做同样的判断。 */
function treeTakenAt(tree) {
  if (!tree) return "";
  for (const g of localGraveBook.values()) {
    if (g.burial !== "tree") continue;
    const gx = Number.isFinite(g.treeX) ? g.treeX : g.x;
    const gz = Number.isFinite(g.treeZ) ? g.treeZ : g.z;
    if (Math.hypot(gx - tree.x, gz - tree.z) <= RULES.grave.treeUniqueRadius) return g.name || "";
  }
  return "";
}

document.addEventListener("keydown", (e) => {
  if (!state.started) return;

  if (e.code === "Escape") {
    if (ui.isOpen()) ui.close();
    if (ui.helpVisible()) {
      ui.toggleHelp(false);
      player.active = true;
      player.focus();
    }
    if (ui.listVisible()) {
      ui.hideList();
      player.active = true;
      player.focus();
    }
    return;
  }

  const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
  if (typing) return;

  // 声音开关：面板开着也能按，随时可以把墓园静音
  if (e.code === "KeyM") {
    toggleSound();
    return;
  }

  if (ui.isOpen()) return;

  if (e.code === "KeyH") {
    const shown = ui.toggleHelp();
    if (shown) {
      player.active = false;
      player.release();
    } else {
      player.active = true;
      player.focus();
    }
    return;
  }

  if (ui.helpVisible() || ui.listVisible()) return;

  if (e.code === "KeyE") {
    tryInteract();
    return;
  }

  if (e.code === "KeyR") {
    tryEcho();
    return;
  }

  if (e.code === "Tab") {
    e.preventDefault();
    openList();
  }
});

function openList() {
  const me = state.selfId;
  const rows = [...localGraveBook.values()].map((g) => ({
    ...g,
    distance: Math.hypot(g.x - player.pos.x, g.z - player.pos.z),
    mine: g.authorId === me,
  }));
  // 自己的碑排前面，其余按远近
  rows.sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || a.distance - b.distance);
  ui.renderList(rows, (g) => {
    ui.hideList();
    player.active = true;
    player.focus();
    state.guide = { id: g.id, name: g.name, x: g.x, z: g.z };
    ui.toast(`「${g.name}」在 ${Math.round(g.distance)} 米外。屏幕上那行字会一直指着它。`, 3600);
  });
  player.active = false;
  player.release();
}

/** 手机不模拟键盘：左半屏拖动走，右半屏拖动看，按钮仍然走同一套交互。 */
function bindTouchControls() {
  if (!TOUCH_MODE) return;
  const knob = document.getElementById("touch-knob");
  let moveId = null;
  let lookId = null;
  let originX = 0;
  let originY = 0;
  let lastX = 0;
  let lastY = 0;

  const resetMove = () => {
    moveId = null;
    player.setTouchMove(0, 0);
    knob.style.transform = "";
  };

  canvas.addEventListener("touchstart", (e) => {
    if (!state.started || ui.isOpen()) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth * 0.46 && moveId === null) {
        moveId = t.identifier;
        originX = t.clientX;
        originY = t.clientY;
      } else if (lookId === null) {
        lookId = t.identifier;
        lastX = t.clientX;
        lastY = t.clientY;
      }
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    if (!state.started || ui.isOpen()) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === moveId) {
        let dx = t.clientX - originX;
        let dy = t.clientY - originY;
        const len = Math.hypot(dx, dy);
        if (len > 42) {
          dx *= 42 / len;
          dy *= 42 / len;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        player.setTouchMove(dx / 42, dy / 42);
      } else if (t.identifier === lookId) {
        player.lookBy((t.clientX - lastX) * 1.5, (t.clientY - lastY) * 1.5);
        lastX = t.clientX;
        lastY = t.clientY;
      }
    }
  }, { passive: false });

  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === moveId) resetMove();
      if (t.identifier === lookId) lookId = null;
    }
  };
  canvas.addEventListener("touchend", end);
  canvas.addEventListener("touchcancel", end);
  window.addEventListener("blur", resetMove);

  document.getElementById("touch-act").addEventListener("click", tryInteract);
  document.getElementById("touch-list").addEventListener("click", openList);
}
bindTouchControls();

function compassDir(g) {
  const dx = g.x - player.pos.x;
  const dz = g.z - player.pos.z;
  const angle = Math.atan2(dx, -dz);
  const dirs = ["正北", "东北", "正东", "东南", "正南", "西南", "正西", "西北"];
  const idx = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return dirs[idx];
}

function compassWord(g) {
  return `它在你的${compassDir(g)}方。`;
}

/* ---------------------------------------------------------------- 主循环 */

let last = performance.now();
let diagAt = 0;
let placeAt = 0;

// 后台标签页里 requestAnimationFrame 会被浏览器压到每秒一两帧。
// 自动化验证时用 ?fixed=1 换取稳定的 60 步时钟，跑的仍是同一套 update。
const FIXED_STEP = new URLSearchParams(location.search).has("fixed");
const schedule = FIXED_STEP ? (fn) => setTimeout(fn, 16) : (fn) => requestAnimationFrame(fn);

function frame() {
  schedule(frame);
  const now = performance.now();
  const dt = FIXED_STEP ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
  last = now;

  player.update(dt);
  world.update(dt, camera);
  graves.update(dt, camera);
  peers.update(dt, camera);

  // 运行状态外显，便于在没有开发者工具的情况下核对
  if (state.started && now - diagAt > 400) {
    diagAt = now;
    const first = [...graves.entries.values()][0];
    let size = null;
    let rot = null;
    if (first) {
      size = first.bodySize;
      rot = [first.root.rotation.x, first.root.rotation.y, first.root.rotation.z].map((n) => +n.toFixed(2));
    }
    const near = world.nearestTree(player.pos.x, player.pos.z);
    document.documentElement.dataset.cc = JSON.stringify({
      ready: !!net,
      graves: localGraveBook.size,
      rendered: graves.entries.size,
      peers: Math.max(0, peers.entries.size),
      x: +player.pos.x.toFixed(2),
      y: +player.pos.y.toFixed(2),
      z: +player.pos.z.toFixed(2),
      pitch: +player.pitch.toFixed(2),
      yaw: +player.yaw.toFixed(2),
      treeX: near ? +near.tree.x.toFixed(1) : null,
      treeZ: near ? +near.tree.z.toFixed(1) : null,
      treeD: near ? +near.distance.toFixed(2) : null,
      panel: ui.openPanel || null,
      seated: player.sitting,
      locked: player.locked,
      sound: sound.ambientKind || "none",
      soundPan: +sound.ambientPan.toFixed(2),
      soundLevel: +sound.ambientLevel.toFixed(2),
      env: sound.placeLevels,
      voice: voiceBox.url ? 1 : 0,
      bells: state.bellCount,
      silences: state.silenceCount,
      size,
      calls: renderer.info.render.calls,
      tris: renderer.info.render.triangles,
    });
  }

  // 网络步子
  if (net) {
    state.sendAcc += dt;
    if (state.sendAcc >= 1 / RULES.net.moveHz) {
      state.sendAcc = 0;
      net.send({ t: "move", ...player.snapshot(), anim: player.anim() });
    }
  }

  // 名录指路：走进去之前，这行字一直在
  if (state.guide) {
    const g = state.guide;
    const d = Math.hypot(g.x - player.pos.x, g.z - player.pos.z);
    if (d < RULES.interact.readRadius + 1) {
      state.guide = null;
      ui.guide(null);
      ui.toast(`「${g.name}」就在这儿。`, 2400);
    } else {
      ui.guide(`「${g.name}」 ${Math.round(d)} 米 · ${compassDir(g)}`);
    }
  }

  // 靠近提示
  if (state.started && !ui.isOpen() && !ui.helpVisible() && !ui.listVisible()) {
    const hit = nearestGrave();
    if (hit && hit.distance <= RULES.interact.readRadius) {
      const g = hit.entry.grave;
      ui.prompt(g.voice && !g.sealed ? `E　读「${g.name}」　·　R　说一句话` : `E　读「${g.name}」`);
      ui.hot(true);
      sound.near(Math.max(0, 1 - hit.distance / RULES.interact.readRadius));
    } else if (hit && hit.distance <= RULES.interact.stoneRadius) {
      ui.prompt(`「${hit.entry.grave.name}」就在前面`);
      ui.hot(true);
      sound.near(0.3);
    } else {
      const space = spaceCheck();
      if (space) {
        ui.prompt("");
      } else {
        ui.prompt("E　在这里立一座碑");
      }
      ui.hot(false);
      sound.near(0);
    }
  } else {
    ui.prompt(null);
    ui.hot(false);
  }

  // 脚下的地方也有声音：湖岸的水、林下的落叶、空地的风。
  // 每四分之一秒算一次，不跟渲染抢时间；层只建一次，之后只调音量。
  if (state.started && now - placeAt > 240) {
    placeAt = now;
    const L = RULES.world.lake;
    const lake = lakeDist(player.pos.x, player.pos.z);
    const water = Math.max(0, Math.min(1, 1 - Math.abs(lake - L.r) / 12));
    let canopy = 0;
    for (const tree of world.treeSpots || []) {
      const d = Math.hypot(tree.x - player.pos.x, tree.z - player.pos.z);
      if (d < 18) canopy += 1 - d / 18;
    }
    const forest = Math.max(0, Math.min(1, canopy / 2.6));
    const wind = Math.max(0, 1 - forest * 0.7 - water * 0.6);
    const depth = RULES.world.waterLevel - heightAt(player.pos.x, player.pos.z);
    const wet = lake <= L.r ? Math.max(0, Math.min(1, depth / RULES.world.wadeDepth)) : 0;
    sound.place(water, forest, wind, wet);
  }

  // 碑的声音：三米内才响。预览碑也走这条，选完声音当场就能听见
  const audioHit = nearestGrave();
  const insideSound = audioHit && audioHit.distance <= RULES.grave.soundRadius;
  if (insideSound && audioHit.entry.grave.sound && audioHit.entry.grave.sound !== "none") {
    sound.ambient(
      audioHit.entry.grave.sound,
      1 - audioHit.distance / RULES.grave.soundRadius,
      panToward(audioHit.entry.grave.x, audioHit.entry.grave.z)
    );
  } else {
    sound.ambient("none", 0);
  }

  // 碑上留的那段声音：走进三米就响，走开就停。一次只放一块碑的。
  voiceTick(audioHit);

  // 走路的脚步声
  if (player.moved && player.grounded) sound.step(player.speed, player.crouching);

  // 雾层跟着人走，慢慢转；浮尘跟着人，轻轻浮
  const airT = performance.now() / 1000;
  for (let i = 0; i < mistLayers.length; i += 1) {
    const m = mistLayers[i];
    m.position.x = camera.position.x;
    m.position.z = camera.position.z;
    m.rotation.z = airT * (0.012 + i * 0.007);
  }
  dust.position.set(camera.position.x, Math.sin(airT * 0.35) * 0.12, camera.position.z);
  dust.rotation.y = airT * 0.02;

  renderer.render(scene, camera);
}

/** 走进碑的声音半径才响；走开就停。同一块碑听见一次，走开再回来会重新响。 */
const voiceBox = { url: "", el: null };

function voiceTick(hit) {
  const radius = voiceBox.url ? RULES.media.voiceRadius + 0.7 : RULES.media.voiceRadius;
  const near = hit && hit.distance <= radius;
  const want = near && hit.entry.grave.audio ? hit.entry.grave.audio : "";

  if (want === voiceBox.url) {
    // 已经在放同一段：走远了就停，走回来还在播就保持
    if (!want && voiceBox.el) {
      voiceBox.el.pause();
      voiceBox.el = null;
    }
    return;
  }

  if (voiceBox.el) {
    voiceBox.el.pause();
    voiceBox.el = null;
  }
  voiceBox.url = want;
  if (!want) return;

  const el = new Audio(want);
  el.preload = "auto";
  el.playsInline = true;
  el.volume = 0.9;
  el.onerror = () => {
    voiceBox.url = "";
    voiceBox.el = null;
  };
  el.onended = () => {
    if (voiceBox.el === el) voiceBox.el = null;
  };
  el.play().catch(() => {});
  voiceBox.el = el;
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

ui.onSitHook = null;
player.onSit = (sitting) => {
  ui.seat(sitting);
  if (!sitting) player.focus();
};

ui.onReadShown = null;

frame();

// 供调试与验证使用
window.__cemetery = {
  ruleset: RULESET_ID,
  get ready() {
    return !!state.started && !!net;
  },
  get graves() {
    return [...localGraveBook.values()];
  },
  get peers() {
    return peers.entries.size;
  },
  get player() {
    return { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw };
  },
  state,
  ui,
  graves,
  player,
  camera,
  heightAt,
};
