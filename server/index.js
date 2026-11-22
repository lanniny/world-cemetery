import http from "node:http";
import { promises as fs, createReadStream, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import os from "node:os";
import { WebSocketServer } from "ws";
import { Cemetery } from "./store.js";
import { Accounts } from "./accounts.js";
import { backupNow } from "../scripts/backup.js";
import { RULES, RULESET_ID } from "../public/js/rules.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PUBLIC = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA = path.join(DATA_DIR, "graves.json");
const UPLOADS = path.join(DATA_DIR, "uploads");
const PORT = Number(process.env.PORT || 8787);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

const cemetery = new Cemetery(DATA);
const accounts = new Accounts(DATA_DIR);
const visibleGraves = () => cemetery.graves.filter((g) => !g.hidden);

// 管理员只有一把环境变量里的钥匙；没配置时，管理入口彻底关闭。
const ADMIN_KEY = String(process.env.CC_ADMIN_KEY || "");
const adminKeyMatches = (input) => {
  if (!ADMIN_KEY) return false;
  const a = Buffer.from(String(input || ""));
  const b = Buffer.from(ADMIN_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * 回声的上游配置。密钥只在服务端，浏览器永远看不到。
 * 优先用环境变量，其次读 config/echo.json（这个文件不进源码包）。
 */
const ECHO = (() => {
  const fromEnv = {
    base: (process.env.ECHO_BASE_URL || "").replace(/\/+$/, ""),
    key: process.env.ECHO_API_KEY || "",
    model: process.env.ECHO_MODEL || "gpt-4o-mini",
  };
  if (fromEnv.base && fromEnv.key) return fromEnv;
  try {
    const raw = readFileSync(path.join(ROOT, "config", "echo.json"), "utf8");
    const j = JSON.parse(raw);
    return {
      base: String(j.baseUrl || "").replace(/\/+$/, ""),
      key: String(j.apiKey || ""),
      model: String(j.model || "gpt-4o-mini"),
    };
  } catch {
    return fromEnv;
  }
})();

const accountHits = new Map();
const accountRateLimited = (key) => {
  const now = Date.now();
  const rec = accountHits.get(key);
  if (!rec || now - rec.start > 60000) {
    accountHits.set(key, { start: now, count: 1 });
    return false;
  }
  return rec.count++ >= 12;
};

const echoHits = new Map(); // 限流：谁问得太勤
const echoRateLimited = (key) => {
  const now = Date.now();
  const rec = echoHits.get(key);
  if (!rec || now - rec.start > 60000) {
    echoHits.set(key, { start: now, count: 1 });
    return false;
  }
  if (rec.count >= RULES.echo.perMinute) return true;
  rec.count += 1;
  return false;
};

/**
 * 只允许公网 https（本机 http 例外，方便调试）。
 * 这一条是防 SSRF 的：不能让任何人借这个接口去摸内网。
 */
const PRIVATE_HOST = /^(10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
const isAllowedUpstream = (base) => {
  let url;
  try {
    url = new URL(base);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname;
  if (host === "127.0.0.1" || host === "localhost") return true;
  if (url.protocol === "http:") return false;
  if (PRIVATE_HOST.test(host)) return false;
  return true;
};

/**
 * 照片和声音的上传。只认这几种格式，靠文件头判断，不信客户端说的类型。
 */
const UPLOAD_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/mpeg": "mp3",
};

const matchMagic = (buf, type) => {
  const head = buf.subarray(0, 12);
  if (type === "image/jpeg") return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (type === "image/png") return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  if (type === "image/webp")
    return head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP";
  if (type === "audio/webm") return head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
  if (type === "audio/ogg") return head.subarray(0, 4).toString("ascii") === "OggS";
  if (type === "audio/mp4" || type === "audio/m4a") return head.subarray(4, 8).toString("ascii") === "ftyp";
  if (type === "audio/mpeg") return head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
  return false;
};

const uploadHits = new Map();
const uploadRateLimited = (key) => {
  const now = Date.now();
  const rec = uploadHits.get(key);
  if (!rec || now - rec.start > 60000) {
    uploadHits.set(key, { start: now, count: 1 });
    return false;
  }
  if (rec.count >= RULES.media.perMinute) return true;
  rec.count += 1;
  return false;
};

const SAFE_UPLOAD_NAME = /^[a-f0-9-]{36}\.(jpg|png|webp|webm|ogg|m4a|mp3)$/i;

const readJsonBody = (req, max = 8192) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > max) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("bad_json"));
      }
    });
    req.on("error", reject);
  });

/**
 * 回应用户，但不扮演活人：短句、不承诺未来、不编造细节。
 * 这段提示词是这个功能的伦理边界，改它之前想清楚。
 */
const buildEchoMessages = (grave, history, text) => {
  const system = [
    `你是「${grave.name}」留在这个世界上的一段回声，不是这个人本身。`,
    grave.voice ? `别人记得他说话的样子：${grave.voice}` : "",
    grave.epitaph ? `他的碑上刻着：${grave.epitaph}` : "",
    "怎么说话：",
    "- 每次只说一两句，不超过四十个字，像真的在说话，不要写成文章。",
    "- 不要说自己是在扮演、是程序、是模型。",
    "- 不要假装还活着，不要说“明天见”“等你回来”，不给时间、地址、电话、承诺。",
    "- 被问到怎么走的、走了以后怎么样，用这个人的方式轻轻带过，不要细说。",
    "- 不要编造具体的人名、日期、地点、事件；不记得就说不记得。",
  ]
    .filter(Boolean)
    .join("\n");

  const kept = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-RULES.echo.historyMax)
    .map((m) => ({ role: m.role, content: clean(m.content, 200) }));

  return [
    { role: "system", content: system },
    ...kept,
    { role: "user", content: text },
  ];
};
const players = new Map(); // uid -> { ws, name, x, y, z, yaw, anim, last, visits: Map }
const sockets = new WeakMap();

const clean = (value, max) => {
  const text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
  return text.slice(0, max);
};

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const send = (ws, payload) => {
  if (ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      /* 断开中的连接，忽略 */
    }
  }
};

const broadcast = (payload, exceptUid = null) => {
  const text = JSON.stringify(payload);
  for (const [uid, p] of players) {
    if (uid === exceptUid) continue;
    if (p.ws.readyState === 1) {
      try {
        p.ws.send(text);
      } catch {
        /* ignore */
      }
    }
  }
};

const distance = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const clampToWorld = (v) => Math.max(-RULES.world.radius, Math.min(RULES.world.radius, v));

/** 碑上那些能被写、也能被改的字：raise 与 edit 共用同一份校验，免得两边走样。 */
const graveFields = (input = {}) => ({
  name: clean(input.name, RULES.grave.nameMax),
  epitaph: clean(input.epitaph, RULES.grave.epitaphMax),
  story: clean(input.story, RULES.grave.storyMax),
  form: RULES.grave.formIds.includes(input.form) ? input.form : "slab",
  relic: RULES.grave.relicIds.includes(input.relic) ? input.relic : "none",
  sound: RULES.grave.soundIds.includes(input.sound) ? input.sound : "none",
  voice: clean(input.voice, RULES.echo.voiceMax),
  photo: /^\/uploads\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(String(input.photo || ""))
    ? String(input.photo)
    : "",
  photoOn: input.photoOn === "face" ? "face" : "ground",
  audio: /^\/uploads\/[a-f0-9-]{36}\.(webm|ogg|m4a|mp3)$/i.test(String(input.audio || ""))
    ? String(input.audio)
    : "",
  tone: Math.max(0, Math.min(5, Math.round(num(input.tone)))),
  burial: RULES.grave.burialIds.includes(input.burial) ? input.burial : "stone",
  // 忌日：只记月和日。到了那天，这座碑会自己亮一夜，不用人来。
  anniversary: /^\d{2}-\d{2}$/.test(String(input.anniversary || "")) ? String(input.anniversary) : "",
  // 生卒：只记年份，四位数。写不出来就空着。
  born: /^\d{4}$/.test(String(input.born || "")) ? String(input.born) : "",
  died: /^\d{4}$/.test(String(input.died || "")) ? String(input.died) : "",
});

/** 湖：水面那一圈。水葬的船必须落在水里，别的葬法不能漂在湖心。 */
const inLake = (x, z) =>
  Math.hypot(x - RULES.world.lake.x, z - RULES.world.lake.z) <= RULES.world.lake.r;

/**
 * 葬法能不能落在这儿。位置决定一切：
 * 船要下水，木牌要有树，石碑和灯放在哪都行。
 */
const burialProblem = (fields, x, z, input) => {
  if (fields.burial === "water") {
    if (!inLake(x, z)) return "船要放进水里。走到湖边再放下它。";
  }
  if (fields.burial === "tree") {
    const tx = num(input.treeX, NaN);
    const tz = num(input.treeZ, NaN);
    if (!Number.isFinite(tx) || !Number.isFinite(tz)) return "树葬要贴着一棵树。走近一棵树再说。";
    if (distance(x, z, tx, tz) > RULES.grave.treeAnchorMax) return "离那棵树太远了，木牌挂不住。";
    if (inLake(tx, tz)) return "水里没有树。";
    // 一棵树只认一座纪念。以树干坐标判断，不靠碑与碑之间的间距——
    // 同一个树位可以站下很多块牌，但那棵树只会被一个人记住。
    for (const g of cemetery.graves) {
      if (g.burial !== "tree") continue;
      const gx = Number.isFinite(g.treeX) ? g.treeX : g.x;
      const gz = Number.isFinite(g.treeZ) ? g.treeZ : g.z;
      if (distance(tx, tz, gx, gz) <= RULES.grave.treeUniqueRadius) {
        return "这棵树已经有人靠着。换一棵吧。";
      }
    }
  }
  if (fields.burial === "stone" && inLake(x, z)) return "水里立不住碑。";
  return null;
};

/** 从磁盘上抹掉一份上传，只认 uuid 文件名。 */
const dropUpload = (rel) => {
  if (typeof rel !== "string" || !rel.startsWith("/uploads/")) return;
  const name = rel.slice("/uploads/".length);
  if (SAFE_UPLOAD_NAME.test(name)) fs.unlink(path.join(UPLOADS, name)).catch(() => {});
};

/** 还有没有别的碑在用它；有人用就别删。 */
const uploadStillUsed = (rel, except) =>
  cemetery.graves.some((g) => g !== except && (g.photo === rel || g.audio === rel));

/** 空地判定：任何墓碑 2.6 米内不许再立碑，界外也不行。 */
const findSpaceProblem = (x, z) => {
  if (Math.hypot(x, z) > RULES.world.radius - 4) return "太靠近雾墙了。往里走一点。";
  for (const g of cemetery.graves) {
    if (distance(x, z, g.x, g.z) < RULES.grave.minSpacing) {
      return "这里已经有碑了。离它远一点。";
    }
  }
  return null;
};

const newestFirst = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

async function handleRest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const json = (code, payload) => {
    res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload));
    return true;
  };

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ruleset: RULESET_ID, graves: visibleGraves().length, online: players.size }));
    return;
  }

  // 进来之前先把名字留下：一个名字 + 一句只有你知道的话。
  // 同名就是同一个账号，那句话对不上就进不去——没有找回，也没有邮箱。
  if (url.pathname === "/api/account") {
    if (req.method !== "POST") return json(405, { error: "method" });
    let body;
    try {
      body = await readJsonBody(req, 4096);
    } catch {
      return json(400, { error: "bad_body" });
    }
    const who = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anon");
    if (accountRateLimited(who)) return json(429, { error: "too_fast", message: "歇一会儿再来。" });

    const result = await accounts.enter(body.name, body.secret);
    if (result.error) return json(400, { error: "account", message: result.error });
    return json(200, {
      ok: true,
      uid: result.user.id,
      name: result.user.name,
      token: accounts.token(result.user.id),
      created: result.created,
    });
  }

  // 认领：这台浏览器以前用临时身份立的碑，登录之后可以划到自己名下。
  if (url.pathname === "/api/claim") {
    if (req.method !== "POST") return json(405, { error: "method" });
    let body;
    try {
      body = await readJsonBody(req, 4096);
    } catch {
      return json(400, { error: "bad_body" });
    }
    const uid = accounts.verify(body.token);
    if (!uid) return json(401, { error: "bad_token" });
    const legacy = clean(body.legacyUid, 40);
    if (!accounts.claimable(legacy)) return json(400, { error: "already_claimed" });

    const name = accounts.findById(uid)?.name || "无名者";
    let moved = 0;
    for (const g of cemetery.graves) {
      if (g.authorId !== legacy) continue;
      cemetery.patch(g.id, (x) => {
        x.authorId = uid;
        x.authorName = name;
      });
      moved++;
    }
    accounts.markClaimed(legacy, uid);
    return json(200, { ok: true, moved });
  }

  // 管理入口只认 CC_ADMIN_KEY。藏起可恢复，绝不走 remove，也不碰上传文件。
  if (url.pathname === "/api/admin/graves" || url.pathname === "/api/admin/graves/list") {
    if (req.method !== "POST") return json(405, { error: "method" });
    if (!ADMIN_KEY) return json(503, { error: "admin_off" });
    let body;
    try {
      body = await readJsonBody(req, 4096);
    } catch {
      return json(400, { error: "bad_body" });
    }
    if (!adminKeyMatches(body.key)) return json(403, { error: "bad_key" });

    if (url.pathname === "/api/admin/graves/list") {
      return json(200, {
        ok: true,
        graves: cemetery.graves.slice().sort(newestFirst).map((g) => ({
          id: g.id,
          name: g.name,
          authorName: g.authorName,
          createdAt: g.createdAt,
          hidden: !!g.hidden,
        })),
      });
    }

    const id = String(body.id || "");
    if (typeof body.hidden !== "boolean") return json(400, { error: "bad_hidden" });
    const target = cemetery.find(id);
    if (!target) return json(404, { error: "no_grave" });
    const updated = cemetery.patch(id, (g) => {
      g.hidden = body.hidden;
    });
    await cemetery.flush();
    if (body.hidden) broadcast({ t: "gone", id });
    else broadcast({ t: "raised", grave: updated });
    return json(200, { ok: true, id, hidden: body.hidden });
  }

  if (url.pathname === "/api/graves") {
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify({ ruleset: RULESET_ID, graves: visibleGraves().sort(newestFirst) }));
    return;
  }

  // 回声：站在碑前说一句话，碑用那个人的口吻回一句。
  if (url.pathname === "/api/echo") {
    const json = (code, payload) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(payload));
    };
    if (req.method !== "POST") return json(405, { error: "method" });

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return json(400, { error: "bad_body" });
    }

    // 立碑者自己带的钥匙优先，其次才是墓园自己的兜底配置。
    // 请求里的 key 只在内存里过一遍：不写盘、不进档案、不回显。
    let use = null;
    const asked = body.upstream;
    if (asked && typeof asked === "object") {
      const base = String(asked.baseUrl || "").replace(/\/+$/, "");
      const key = String(asked.key || "");
      if (base && key) {
        if (!isAllowedUpstream(base)) return json(400, { error: "bad_upstream" });
        use = { base, key, model: clean(asked.model, 60) || "gpt-4o-mini" };
      }
    }
    if (!use) {
      if (!ECHO.base || !ECHO.key) return json(503, { error: "echo_off" });
      use = ECHO;
    }

    const grave = cemetery.find(String(body.id || ""));
    if (!grave || grave.hidden) return json(404, { error: "no_grave" });
    if (grave.sealed) return json(400, { error: "sealed" });
    if (!grave.voice) return json(400, { error: "no_voice" });

    const text = clean(body.text, RULES.echo.inputMax);
    if (!text) return json(400, { error: "empty" });

    const who = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anon");
    if (echoRateLimited(who)) return json(429, { error: "too_fast" });

    try {
      const upstream = await fetch(`${use.base}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${use.key}` },
        body: JSON.stringify({
          model: use.model,
          messages: buildEchoMessages(grave, body.history, text),
          max_tokens: 160,
          temperature: 0.75,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!upstream.ok) return json(502, { error: "upstream", status: upstream.status });
      const data = await upstream.json();
      const reply = clean(data?.choices?.[0]?.message?.content || "", RULES.echo.replyMax);
      if (!reply) return json(502, { error: "empty_reply" });
      return json(200, { reply });
    } catch (err) {
      return json(502, { error: "upstream", detail: String(err?.message || err).slice(0, 80) });
    }
  }

  if (url.pathname === "/api/upload") {
    if (req.method !== "POST") return json(405, { error: "method" });
    const who = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anon");
    if (uploadRateLimited(who)) return json(429, { error: "too_fast" });

    let body;
    try {
      body = await readJsonBody(req, 2_100_000);
    } catch {
      return json(400, { error: "bad_body" });
    }

    const kind = body.kind === "audio" ? "audio" : "photo";
    const declared = String(body.type || "").toLowerCase();
    const raw = String(body.data || "");
    if (!raw) return json(400, { error: "empty" });

    let buf;
    try {
      buf = Buffer.from(raw, "base64");
    } catch {
      return json(400, { error: "bad_data" });
    }
    if (!buf.length) return json(400, { error: "empty" });

    const limit = kind === "audio" ? RULES.media.audioBytes : RULES.media.photoBytes;
    if (buf.length > limit) return json(400, { error: "too_big", limit });

    const allowed =
      kind === "audio"
        ? ["audio/webm", "audio/ogg", "audio/mp4", "audio/m4a", "audio/mpeg"]
        : ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(declared) || !matchMagic(buf, declared)) {
      return json(400, { error: "bad_type" });
    }

    const name = `${crypto.randomUUID()}.${UPLOAD_TYPES[declared]}`;
    try {
      await fs.mkdir(UPLOADS, { recursive: true });
      await fs.writeFile(path.join(UPLOADS, name), buf);
    } catch {
      return json(500, { error: "write_failed" });
    }
    return json(200, { url: `/uploads/${name}`, bytes: buf.length, kind });
  }

  if (url.pathname.startsWith("/uploads/")) {
    const name = url.pathname.slice("/uploads/".length);
    if (!SAFE_UPLOAD_NAME.test(name)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const file = path.join(UPLOADS, name);
    try {
      const stat = await fs.stat(file);
      res.writeHead(200, {
        "content-type": MIME[path.extname(name).toLowerCase()] || "application/octet-stream",
        "content-length": stat.size,
        "cache-control": "public, max-age=31536000, immutable",
      });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end("not found");
    }
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(PUBLIC, "." + pathname);
  if (!filePath.startsWith(PUBLIC + path.sep)) {
    res.writeHead(403).end("forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) throw new Error("is dir");
    res.writeHead(200, {
      "content-type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "content-length": stat.size,
      "cache-control": pathname.startsWith("/vendor/") ? "public, max-age=86400" : "no-store",
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("这里什么都没有。");
  }
}

const server = http.createServer((req, res) => {
  handleRest(req, res).catch((err) => {
    console.error("[http]", err);
    if (!res.headersSent) res.writeHead(500);
    res.end("error");
  });
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (!req.url.startsWith("/live")) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws) => {
  let uid = null;
  let alive = true;

  ws.on("pong", () => {
    alive = true;
  });

  const heartbeat = setInterval(() => {
    if (!alive) {
      ws.terminate();
      return;
    }
    alive = false;
    try {
      ws.ping();
    } catch {
      /* ignore */
    }
  }, RULES.net.heartbeatMs);

  const reply = (payload) => send(ws, payload);
  const reject = (reason, extra = {}) => reply({ t: "reject", reason, ...extra });

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== "string") return;

    if (msg.t === "join") {
      // 身份只认 token。客户端自报的 uid 一律不采信——否则谁都能顶着别人的名字改别人的碑。
      const member = accounts.verify(msg.token);
      uid = member || crypto.randomUUID();
      const name = member
        ? accounts.findById(member)?.name || "无名者"
        : clean(msg.name, 20) || "无名者";
      const isMember = !!member;

      const existing = players.get(uid);
      if (existing && existing.ws !== ws) {
        try {
          existing.ws.close(4001, "同名游魂在别处醒来");
        } catch {
          /* ignore */
        }
      }

      const px = clampToWorld(num(msg.x));
      const pz = clampToWorld(num(msg.z));

      players.set(uid, {
        ws,
        name,
        x: px,
        y: num(msg.y, 1.6),
        z: pz,
        yaw: num(msg.yaw),
        anim: "idle",
        last: Date.now(),
        stillX: px,
        stillZ: pz,
        stillSince: Date.now(),
        visits: existing?.visits || new Map(),
      });
      sockets.set(ws, uid);

      reply({
        t: "welcome",
        you: uid,
        member: isMember,
        name,
        ruleset: RULESET_ID,
        rules: RULES,
        graves: visibleGraves(),
        // 名字只在进门时说一次，之后每秒八次的同步里不再重复
        online: [...players.entries()].filter(([ouid]) => ouid !== uid).map(([ouid, op]) => [ouid, op.name]),
      });
      broadcast({ t: "peerIn", uid, name }, uid);
      return;
    }

    if (!uid || !players.has(uid)) return;

    if (msg.t === "move") {
      const p = players.get(uid);
      p.x = clampToWorld(num(msg.x, p.x));
      p.y = num(msg.y, p.y);
      p.z = clampToWorld(num(msg.z, p.z));
      p.yaw = num(msg.yaw, p.yaw);
      p.anim = ["idle", "walk", "run", "sit", "ghost"].includes(msg.anim) ? msg.anim : "walk";
      p.last = Date.now();
      // 站住不动才算"沉默"，挪动一点就重新计时
      if (Math.hypot(p.x - p.stillX, p.z - p.stillZ) > RULES.net.silenceMoveTolerance) {
        p.stillX = p.x;
        p.stillZ = p.z;
        p.stillSince = Date.now();
      }
      return;
    }

    if (msg.t === "raise") {
      if (!accounts.isMember(uid)) {
        return reject("先给自己一个名字。在门口写下只有你知道的那句话，再回来立碑。");
      }
      const input = msg.grave || {};
      const fields = graveFields(input);
      if (!fields.name) return reject("碑上得有名字。", { field: "name" });

      const owned = cemetery.graves.filter((g) => g.authorId === uid).length;
      if (owned >= RULES.grave.maxPerOwner) {
        return reject(`一个人最多在这里留 ${RULES.grave.maxPerOwner} 座碑。`);
      }

      let x = clampToWorld(num(input.x));
      let z = clampToWorld(num(input.z));
      const burialIssue = burialProblem(fields, x, z, input);
      if (burialIssue) return reject(burialIssue);

      // 树葬：碑的坐标就取树干那一点，木牌才会真的挂在树上；
      // 顺带把树的位置记下来，"挂在哪棵树上"是一件该留住的事
      let treeX = null;
      let treeZ = null;
      if (fields.burial === "tree") {
        x = clampToWorld(num(input.treeX));
        z = clampToWorld(num(input.treeZ));
        treeX = x;
        treeZ = z;
      }

      const spaceProblem = findSpaceProblem(x, z);
      if (spaceProblem) return reject(spaceProblem);

      const grave = {
        id: crypto.randomUUID(),
        authorId: uid,
        authorName: players.get(uid).name,
        ...fields,
        x,
        z,
        treeX,
        treeZ,
        ry: num(input.ry),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lights: 0,
        visits: 0,
        sealed: false,
        notes: [],
        offerings: [],
      };
      cemetery.add(grave);
      broadcast({ t: "raised", grave });
      return;
    }

    const target = msg.id && cemetery.find(msg.id);
    // 藏起不是删除：档案、照片、留言都留着，但任何互动都不能绕进来。
    if (target?.hidden) return reject("这座碑暂时不在这里。");
    if (msg.t === "visit") {
      if (!target) return;
      const p = players.get(uid);
      const key = `${msg.id}`;
      const now = Date.now();
      const lastVisit = p.visits.get(key) || 0;
      if (now - lastVisit < 5 * 60 * 1000) return; // 同一人 5 分钟内只算一次
      p.visits.set(key, now);
      cemetery.patch(msg.id, (g) => {
        g.visits += 1;
      });
      const g = cemetery.find(msg.id);
      reply({ t: "updated", id: msg.id, visits: g.visits });
      return;
    }

    if (msg.t === "light") {
      if (!target || target.sealed) return;
      // 记下"最后一次有人记起它"，碑会因此亮一点、苔会退一点
      const litAt = new Date().toISOString();
      cemetery.patch(msg.id, (g) => {
        g.lights += 1;
        g.lastLightAt = litAt;
      });
      const g = cemetery.find(msg.id);
      broadcast({ t: "updated", id: msg.id, lights: g.lights, lastLightAt: g.lastLightAt, by: uid });
      // 别人献光的钟声：三十几米内的人都听得见，但只有献光的人自己知道是谁来过
      broadcast({ t: "bell", id: msg.id, x: g.x, z: g.z }, uid);
      return;
    }

    if (msg.t === "note") {
      if (!target || target.sealed) return;
      const text = clean(msg.text, RULES.grave.noteMax);
      if (!text) return;
      if (target.notes.length >= 200) return reject("这座碑的留言已经满了。");
      const note = { text, at: new Date().toISOString(), by: players.get(uid)?.name || "无名者" };
      cemetery.patch(msg.id, (g) => {
        g.notes.push(note);
        g.notes = g.notes.slice(-200);
      });
      broadcast({ t: "noted", id: msg.id, note });
      return;
    }

    if (msg.t === "offer") {
      // 在别人的碑前放下一样东西。放得下、留得住，但一天只能放一件。
      if (!target || target.sealed) return reject("它已经沉睡了。");
      const kind = ["flower", "candle", "bird"].includes(msg.kind) ? msg.kind : "";
      if (!kind) return;
      const list = target.offerings || [];
      if (list.length >= 3) return reject("这座碑前面已经放满了。");
      const day = new Date().toISOString().slice(0, 10);
      const key = `${uid}:${msg.id}:${day}`;
      if (offerToday.has(key)) return reject("今天你已经在这儿放过东西了。明天再来。");
      if (offerDay !== day) {
        offerDay = day;
        offerToday.clear();
      }
      offerToday.add(key);
      const item = { kind, by: players.get(uid)?.name || "无名者", at: new Date().toISOString() };
      cemetery.patch(msg.id, (g) => {
        g.offerings = [...(g.offerings || []), item].slice(-3);
      });
      const g = cemetery.find(msg.id);
      broadcast({ t: "updated", id: msg.id, offerings: g.offerings, by: uid });
      return;
    }

    if (msg.t === "seal") {
      if (!target) return;
      if (target.authorId !== uid) return reject("只有立碑的人能让它沉睡。");
      cemetery.patch(msg.id, (g) => {
        g.sealed = !g.sealed;
      });
      broadcast({ t: "updated", id: msg.id, sealed: cemetery.find(msg.id).sealed });
      return;
    }

    if (msg.t === "edit") {
      if (!target) return reject("这块碑已经不在了。");
      if (target.authorId !== uid) return reject("只有立碑的人能改它。");
      const input = msg.grave && typeof msg.grave === "object" ? msg.grave : {};
      const fields = graveFields(input);
      if (!fields.name) return reject("碑上得有名字。", { field: "name" });

      const before = [target.photo, target.audio];
      const updated = cemetery.patch(msg.id, (g) => Object.assign(g, fields));
      if (!updated) return reject("这块碑已经不在了。");
      // 被换掉的照片和录音不该继续占着磁盘（别的碑还在用就留着）
      for (const rel of before) {
        if (rel && rel !== updated.photo && rel !== updated.audio && !uploadStillUsed(rel, updated)) {
          dropUpload(rel);
        }
      }
      broadcast({ t: "edited", grave: updated });
      return;
    }

    if (msg.t === "remove") {
      if (!target) return;
      if (target.authorId !== uid) return reject("只有立碑的人能删除它。");
      const gone = cemetery.remove(msg.id);
      if (!gone) return;
      // 碑走了，它带走的照片和声音也不该留在磁盘上
      for (const rel of [gone.photo, gone.audio]) {
        if (!uploadStillUsed(rel, gone)) dropUpload(rel);
      }
      broadcast({ t: "gone", id: msg.id });
      return;
    }
  });

  ws.on("close", () => {
    clearInterval(heartbeat);
    const id = sockets.get(ws);
    if (id && players.get(id)?.ws === ws) {
      players.delete(id);
      broadcast({ t: "peerOut", uid: id });
    }
  });

  ws.on("error", () => {
    /* 交给 close 处理 */
  });
});

/**
 * 影子同步。只发看得见的：雾把 72 米外的人吃掉，没必要为他们付带宽。
 * 用数组而不是对象，一个人一条只占几十字节——一百人在线时这是数量级的差别。
 */
const ANIM_CODE = { idle: "i", walk: "w", run: "r", sit: "s", ghost: "g" };
const peerRange2 = RULES.net.peerRange * RULES.net.peerRange;

setInterval(() => {
  if (!players.size) return;
  for (const [uid, p] of players) {
    if (p.ws.readyState !== 1) continue;
    const rows = [];
    for (const [ouid, op] of players) {
      if (ouid === uid) continue;
      const dx = op.x - p.x;
      const dz = op.z - p.z;
      if (dx * dx + dz * dz > peerRange2) continue;
      rows.push([ouid, +op.x.toFixed(2), +op.y.toFixed(2), +op.z.toFixed(2), +op.yaw.toFixed(3), ANIM_CODE[op.anim] || "w"]);
    }
    try {
      p.ws.send(`{"t":"peers","l":${JSON.stringify(rows)}}`);
    } catch {
      /* ignore */
    }
  }
}, Math.round(1000 / RULES.net.peersHz));

/**
 * 两个人同时在同一个碑前站住不动，会有一圈光浮起来。
 * 这是这套设计里唯一允许的"互动"：没有人说话，也没有人知道对面是谁。
 */
const silenceAt = new Map();
// 每人每座碑每天只能放一样东西
let offerDay = "";
const offerToday = new Set();

setInterval(() => {
  const now = Date.now();
  for (const g of cemetery.graves) {
    if (g.hidden) continue;
    const waiting = [];
    for (const [uid, p] of players) {
      if (now - p.stillSince < RULES.net.silenceDwellMs) continue;
      if (distance(p.x, p.z, g.x, g.z) <= RULES.interact.readRadius) waiting.push(uid);
    }
    if (waiting.length < 2) continue;
    const last = silenceAt.get(g.id) || 0;
    if (now - last < RULES.net.silenceCooldownMs) continue;
    silenceAt.set(g.id, now);
    broadcast({ t: "silence", id: g.id, x: g.x, z: g.z, n: waiting.length });
  }
}, 600);

async function boot() {
  await cemetery.load();
  await accounts.load();
  server.listen(PORT, "0.0.0.0", () => {
    const lan = [];
    for (const list of Object.values(os.networkInterfaces())) {
      for (const item of list || []) {
        if (item.family === "IPv4" && !item.internal) lan.push(`http://${item.address}:${PORT}`);
      }
    }
    console.log(`\n  世界公墓已开门  ruleset=${RULESET_ID}`);
    console.log(`  本机     http://localhost:${PORT}`);
    for (const url of lan) console.log(`  同一网络  ${url}`);
    console.log(`  档案      ${DATA}`);
    console.log(`  现有墓碑  ${cemetery.graves.length} 座\n`);
    backupNow()
      .then((dir) => console.log(`  自动备份  ${dir}`))
      .catch((err) => console.error("[backup] startup failed", err));
    setInterval(() => {
      backupNow().catch((err) => console.error("[backup] scheduled failed", err));
    }, 24 * 60 * 60 * 1000).unref();
  });
}

process.on("SIGINT", async () => {
  await cemetery.flush();
  process.exit(0);
});

boot().catch((err) => {
  console.error(err);
  process.exit(1);
});
